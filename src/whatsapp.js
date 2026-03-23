import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { transcribe } from './transcriber.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tempDir = join(__dirname, '..', 'temp');
const authDir = join(__dirname, '..', 'auth_info_baileys');
const logger = pino({ level: 'silent' });

let sock = null;

export async function initWhatsApp(io) {
  await mkdir(tempDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
    browser: ['Transcreve', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr, { width: 300 });
      io.emit('qr', qrDataUrl);
      console.log('QR Code gerado - escaneie com o WhatsApp');
    }

    if (connection === 'open') {
      const phoneNumber = sock.user.id.split(':')[0];
      console.log(`Conectado: ${phoneNumber}`);
      io.emit('connected', { phoneNumber });
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log(`Conexão fechada. Razão: ${reason}`);

      if (reason === DisconnectReason.loggedOut) {
        io.emit('disconnected', { reason: 'logged_out' });
        console.log('Deslogado. Escaneie o QR Code novamente.');
      }

      // Reconectar
      setTimeout(() => initWhatsApp(io), 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      // Só processa mensagens recebidas (não enviadas por mim)
      if (msg.key.fromMe) continue;

      // Só processa mensagens de áudio
      const audioMsg = msg.message?.audioMessage;
      if (!audioMsg) continue;

      const sender = msg.pushName || msg.key.remoteJid;
      const senderJid = msg.key.remoteJid;
      const timestamp = msg.messageTimestamp;
      const duration = audioMsg?.seconds || 0;

      console.log(`Áudio recebido de ${sender} (${duration}s)`);
      io.emit('transcribing', { sender, senderJid, timestamp, duration });

      try {
        // Baixar áudio
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
          logger,
          reuploadRequest: sock.updateMediaMessage,
        });

        // Salvar em arquivo temporário
        const audioPath = join(tempDir, `${randomUUID()}.ogg`);
        await writeFile(audioPath, buffer);

        // Transcrever
        const result = await transcribe(audioPath);

        io.emit('transcription', {
          sender,
          senderJid,
          timestamp,
          duration,
          text: result.text,
        });

        console.log(`Transcrição: ${result.text.substring(0, 80)}...`);

        // Limpar arquivo temporário
        await unlink(audioPath).catch(() => {});
      } catch (err) {
        console.error('Erro ao transcrever:', err.message);
        io.emit('transcription_error', {
          sender,
          senderJid,
          timestamp,
          error: err.message,
        });
      }
    }
  });
}

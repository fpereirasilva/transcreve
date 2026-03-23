import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initWhatsApp } from './src/whatsapp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log('Browser conectado');
  socket.on('disconnect', () => console.log('Browser desconectado'));
});

initWhatsApp(io);

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

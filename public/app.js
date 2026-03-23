const socket = io();

const qrSection = document.getElementById('qr-section');
const qrImg = document.getElementById('qr-img');
const qrLoading = document.getElementById('qr-loading');
const connectedSection = document.getElementById('connected-section');
const disconnectedSection = document.getElementById('disconnected-section');
const phoneNumber = document.getElementById('phone-number');
const transcriptions = document.getElementById('transcriptions');
const transcriptionsTitle = document.getElementById('transcriptions-title');
const emptyState = document.getElementById('empty-state');

function formatPhone(number) {
  if (number.startsWith('55') && number.length >= 12) {
    const ddd = number.slice(2, 4);
    const part1 = number.slice(4, 9);
    const part2 = number.slice(9);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }
  return `+${number}`;
}

function formatTime(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return min > 0 ? `${min}m${sec.toString().padStart(2, '0')}s` : `${sec}s`;
}

function showSection(section) {
  qrSection.style.display = 'none';
  connectedSection.style.display = 'none';
  disconnectedSection.style.display = 'none';
  section.style.display = 'block';
}

// QR Code recebido
socket.on('qr', (dataUrl) => {
  showSection(qrSection);
  qrImg.src = dataUrl;
  qrImg.style.display = 'block';
  qrLoading.style.display = 'none';
});

// Conectado
socket.on('connected', (data) => {
  showSection(connectedSection);
  phoneNumber.textContent = formatPhone(data.phoneNumber);
  emptyState.style.display = 'block';
});

// Desconectado
socket.on('disconnected', () => {
  showSection(disconnectedSection);
});

// Transcrevendo (em andamento)
socket.on('transcribing', (data) => {
  emptyState.style.display = 'none';
  transcriptionsTitle.style.display = 'block';

  const id = `t-${data.timestamp}-${data.senderJid}`;
  const card = document.createElement('div');
  card.className = 'transcription-card transcribing';
  card.id = id;
  card.innerHTML = `
    <div class="transcription-header">
      <span class="sender-name">${escapeHtml(data.sender)}</span>
      <div class="transcription-meta">
        <span>${formatDuration(data.duration)}</span>
        <span>${formatTime(data.timestamp)}</span>
      </div>
    </div>
    <p class="transcription-text loading">Transcrevendo...</p>
  `;
  transcriptions.prepend(card);
});

// Transcrição concluída
socket.on('transcription', (data) => {
  emptyState.style.display = 'none';
  transcriptionsTitle.style.display = 'block';

  const id = `t-${data.timestamp}-${data.senderJid}`;
  const existing = document.getElementById(id);

  if (existing) {
    existing.className = 'transcription-card';
    existing.querySelector('.transcription-text').className = 'transcription-text';
    existing.querySelector('.transcription-text').textContent = data.text;
  } else {
    const card = document.createElement('div');
    card.className = 'transcription-card';
    card.innerHTML = `
      <div class="transcription-header">
        <span class="sender-name">${escapeHtml(data.sender)}</span>
        <div class="transcription-meta">
          <span>${formatDuration(data.duration)}</span>
          <span>${formatTime(data.timestamp)}</span>
        </div>
      </div>
      <p class="transcription-text">${escapeHtml(data.text)}</p>
    `;
    transcriptions.prepend(card);
  }
});

// Erro na transcrição
socket.on('transcription_error', (data) => {
  const id = `t-${data.timestamp}-${data.senderJid}`;
  const existing = document.getElementById(id);

  if (existing) {
    existing.className = 'transcription-card';
    existing.querySelector('.transcription-text').className = 'transcription-text error-text';
    existing.querySelector('.transcription-text').textContent = `Erro: ${data.error}`;
  }
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

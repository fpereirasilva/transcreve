import { execFile } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, '..', 'scripts', 'transcribe.py');

export function transcribe(audioPath) {
  return new Promise((resolve_, reject) => {
    execFile('python', [scriptPath, audioPath], {
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Erro na transcrição: ${error.message}\n${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        resolve_(result);
      } catch {
        resolve_({ text: stdout.trim(), language: 'pt', duration: 0 });
      }
    });
  });
}

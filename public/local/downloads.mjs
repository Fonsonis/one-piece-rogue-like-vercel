const ANDROID_URL = 'https://github.com/Fonsonis/one-piece-rogue-like-vercel/releases/latest/download/one-piece-rogue-like.apk';
const WINDOWS_URL = 'https://github.com/Fonsonis/one-piece-rogue-like-vercel/releases/latest/download/one-piece-rogue-like-setup.exe';

export function openDownloadChooser(opener) {
  if (document.getElementById('download-chooser')) return;
  const overlay = document.createElement('div');
  overlay.id = 'download-chooser';
  overlay.className = 'overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'download-chooser-title');
  overlay.innerHTML = `
    <div class="modal">
      <h2 id="download-chooser-title">Descargar el juego</h2>
      <p>Elige la versión adecuada para tu dispositivo. Ambas incluyen el juego completo y funcionan sin conexión.</p>
      <div class="actions">
        <a class="btn green" href="${ANDROID_URL}" target="_blank" rel="noopener noreferrer">🤖 APK para Android</a>
        <a class="btn blue" href="${WINDOWS_URL}" target="_blank" rel="noopener noreferrer">🖥️ EXE para Windows</a>
        <button class="btn gray" type="button" id="download-chooser-close">Cerrar</button>
      </div>
      <small>Windows puede mostrar un aviso de SmartScreen mientras el instalador no tenga firma digital.</small>
    </div>`;

  const close = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    opener?.focus?.();
  };
  const onKeydown = event => {
    if (event.key === 'Escape') close();
  };
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('#download-chooser-close').addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);
  document.body.append(overlay);
  overlay.querySelector('a').focus();
}

export const downloadUrls = Object.freeze({ android: ANDROID_URL, windows: WINDOWS_URL });

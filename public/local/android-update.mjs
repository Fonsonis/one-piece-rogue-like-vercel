const CURRENT_VERSION = '1.1.0';
const RELEASE_URL = 'https://github.com/Fonsonis/one-piece-rogue-like-vercel/releases/latest/download/one-piece-rogue-like.apk';
const VERSION_URL = 'https://one-piece-rogue-like-vercel.vercel.app/android-version.json';

export function isAndroidApp() {
  return globalThis.Capacitor?.isNativePlatform?.() === true && globalThis.Capacitor?.getPlatform?.() === 'android';
}

function compareVersions(left, right) {
  const a = String(left).split('.').map(Number);
  const b = String(right).split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

async function openExternal(url) {
  const capacitor = globalThis.Capacitor;
  const browser = capacitor?.registerPlugin?.('Browser') || capacitor?.Plugins?.Browser;
  if (browser?.open) return browser.open({ url });
  globalThis.open(url, '_blank', 'noopener,noreferrer');
}

export async function downloadAndroidApk({ toast } = {}) {
  if (!isAndroidApp()) {
    globalThis.location.assign(RELEASE_URL);
    return;
  }

  try {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const release = await response.json();
    if (compareVersions(release.version, CURRENT_VERSION) <= 0) {
      toast?.(`✅ Ya tienes la versión más reciente (${CURRENT_VERSION}).`);
      return;
    }
    const accepted = globalThis.confirm(`Hay una actualización disponible: ${release.version}. ¿Quieres descargarla ahora?`);
    if (accepted) await openExternal(release.downloadUrl || RELEASE_URL);
  } catch {
    toast?.('No se pudo comprobar la actualización. El juego offline sigue disponible.');
  }
}

export const androidRelease = Object.freeze({ version: CURRENT_VERSION, downloadUrl: RELEASE_URL });

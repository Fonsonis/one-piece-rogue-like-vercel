const CURRENT_VERSION = '1.2.0';
const CURRENT_VERSION_CODE = 10200;
const RELEASE_URL = 'https://github.com/Fonsonis/one-piece-rogue-like-vercel/releases/latest/download/one-piece-rogue-like.apk';
const RELEASE_VERSION_URL = 'https://github.com/Fonsonis/one-piece-rogue-like-vercel/releases/latest/download/android-version.json';
const RELEASE_API_URL = 'https://api.github.com/repos/Fonsonis/one-piece-rogue-like-vercel/releases/latest';

export function isAndroidApp() {
  return globalThis.Capacitor?.isNativePlatform?.() === true && globalThis.Capacitor?.getPlatform?.() === 'android';
}

async function nativeGet(url) {
  // GitHub release redirects do not expose CORS headers. Use the native HTTP
  // bridge only for this small manifest; the APK stays in DownloadManager.
  const http = globalThis.Capacitor?.registerPlugin?.('CapacitorHttp') || globalThis.Capacitor?.Plugins?.CapacitorHttp;
  if (!http?.get) throw new Error('El módulo de conexión nativa no está disponible.');
  const response = await http.get({
    url,
    responseType: 'json',
    headers: url.startsWith(RELEASE_API_URL) ? { Accept: 'application/vnd.github+json' } : {},
    connectTimeout: 15000,
    readTimeout: 15000,
    disableRedirects: false,
  });
  if (!(response.status >= 200 && response.status < 300)) {
    throw new Error(`El servidor de actualizaciones respondió HTTP ${response.status}.`);
  }
  let data;
  try {
    // Release assets can arrive as application/octet-stream rather than JSON.
    data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  } catch {
    throw new Error('El archivo de versión publicado no contiene JSON válido.');
  }
  return data;
}

function validateRelease(release) {
  const versionCode = Number(release?.versionCode);
  if (!release || typeof release.version !== 'string' || !release.version.trim() ||
      !Number.isSafeInteger(versionCode) || versionCode <= 0 || versionCode > 2147483647 ||
      typeof release.downloadUrl !== 'string' ||
      !new RegExp(`^https://github\\.com/Fonsonis/one-piece-rogue-like-vercel/releases/(?:download/android-${versionCode}|latest/download)/one-piece-rogue-like\\.apk$`).test(release.downloadUrl)) {
    throw new Error('El archivo de versión publicado está incompleto o no es válido.');
  }
  return { ...release, versionCode };
}

async function latestAndroidRelease() {
  try {
    return validateRelease(await nativeGet(`${RELEASE_VERSION_URL}?t=${Date.now()}`));
  } catch (manifestError) {
    // The release asset endpoint can fail while the GitHub API still exposes
    // the published APK. Only accept an APK from the same release tag.
    try {
      const release = await nativeGet(`${RELEASE_API_URL}?t=${Date.now()}`);
      const code = Number(/^android-(\d+)$/.exec(release?.tag_name || '')?.[1]);
      const apk = release?.assets?.find(asset => asset.name === 'one-piece-rogue-like.apk');
      if (!Number.isInteger(code) || !apk || apk.state !== 'uploaded') throw new Error('La última release no incluye una APK publicada.');
      return validateRelease({ version: release.name || release.tag_name, versionCode: code, downloadUrl: apk.browser_download_url });
    } catch (apiError) {
      throw new Error(`${manifestError.message} Consulta alternativa: ${apiError.message}`);
    }
  }
}

function androidUpdater() {
  return globalThis.Capacitor?.registerPlugin?.('AndroidUpdater') || globalThis.Capacitor?.Plugins?.AndroidUpdater;
}

function downloadMessage(status) {
  const downloaded = Number(status.bytesDownloaded) || 0;
  const total = Number(status.totalBytes) || 0;
  if (total > 0) {
    const percent = Math.min(100, Math.floor(downloaded * 100 / total));
    return `⬇ Descargando actualización… ${percent}% · ${(downloaded / 1048576).toFixed(1)}/${(total / 1048576).toFixed(1)} MB`;
  }
  return status.state === 'paused' ? '⏸ Android ha pausado la descarga; se reanudará cuando sea posible.' : '⬇ Preparando descarga segura en Android…';
}

async function finishNativeDownload(updater, initialStatus, toast) {
  let status = initialStatus;
  let previousMessage = '';
  let pausedSince = 0;
  while (['pending', 'running', 'paused'].includes(status?.state)) {
    const message = downloadMessage(status);
    if (message !== previousMessage) toast?.(message);
    previousMessage = message;
    if (status.state === 'paused') {
      pausedSince ||= Date.now();
      if (Date.now() - pausedSince > 15000) {
        toast?.('⏸ La descarga sigue en pausa en Android. Puedes volver a pulsar el botón para comprobarla más tarde.');
        return;
      }
    } else pausedSince = 0;
    await new Promise(resolve => setTimeout(resolve, 900));
    status = await updater.getStatus();
  }
  if (status?.state !== 'successful') {
    throw new Error(status?.error || `Descarga Android fallida (código ${status?.reason ?? 'sin estado'})`);
  }

  toast?.('✅ APK descargado por completo. Abriendo el instalador de Android…');
  const result = await updater.install();
  if (result?.state === 'permissionRequired') {
    toast?.('🔐 Autoriza “instalar apps desconocidas”. Al volver se abrirá el instalador automáticamente.');
  }
}

async function installedRelease() {
  const capacitor = globalThis.Capacitor;
  const app = capacitor?.registerPlugin?.('App') || capacitor?.Plugins?.App;
  if (!app?.getInfo) throw new Error('No se puede leer la versión instalada desde Android.');
  const info = await app.getInfo();
  const versionCode = Number(info.build);
  if (!Number.isSafeInteger(versionCode) || versionCode <= 0) throw new Error('Android devolvió un código de compilación inválido.');
  return {
    version: info.version || CURRENT_VERSION,
    versionCode,
  };
}

export async function downloadAndroidApk({ toast } = {}) {
  if (!isAndroidApp()) {
    globalThis.location.assign(RELEASE_URL);
    return;
  }

  let phase = 'leer la versión instalada';
  try {
    const installed = await installedRelease();
    phase = 'buscar la actualización';
    toast?.(`↻ Buscando una compilación posterior a ${installed.version} (${installed.versionCode})…`);
    const release = await latestAndroidRelease();
    const releaseCode = release.versionCode;
    const hasNewBuild = releaseCode > installed.versionCode;
    if (!hasNewBuild) {
      toast?.(`✅ Ya tienes la compilación más reciente (${installed.version} · ${installed.versionCode}).`);
      return;
    }
    const accepted = globalThis.confirm(`Hay una actualización disponible: ${release.version} (compilación ${releaseCode}). ¿Quieres descargarla ahora?`);
    if (accepted) {
      phase = 'descargar o instalar la actualización';
      const updater = androidUpdater();
      if (!updater?.startDownload || !updater?.getStatus || !updater?.install) throw new Error('Plugin AndroidUpdater no disponible');
      const status = await updater.startDownload({
        url: release.downloadUrl,
        versionCode: releaseCode,
      });
      await finishNativeDownload(updater, status, toast);
    }
  } catch (error) {
    console.error('[android-update] No se pudo completar la actualización', error);
    const detail = error?.message || 'Error sin detalles del sistema.';
    toast?.(`No se pudo ${phase}. ${detail} Vuelve a pulsar “Actualizar APK” para reintentar.`);
  }
}

export const androidRelease = Object.freeze({ version: CURRENT_VERSION, versionCode: CURRENT_VERSION_CODE, downloadUrl: RELEASE_URL });

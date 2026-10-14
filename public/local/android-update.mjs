const CURRENT_VERSION = '1.2.0';
const CURRENT_VERSION_CODE = 10200;
const RELEASE_URL = globalThis.GameDistribution?.androidUrl || '';
const RELEASE_VERSION_URL = globalThis.GameDistribution?.androidVersionUrl || '';
const RELEASE_API_URL = globalThis.GameDistribution?.androidReleasesApiUrl || '';

export function isAndroidApp() {
  return globalThis.Capacitor?.isNativePlatform?.() === true && globalThis.Capacitor?.getPlatform?.() === 'android';
}

async function nativeGet(url) {
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
    data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  } catch {
    throw new Error('El archivo de versión publicado no contiene JSON válido.');
  }
  return data;
}

function validateRelease(release) {
  const versionCode = Number(release?.versionCode);
  let downloadUrl;
  let configuredUrl;
  try {
    downloadUrl = new URL(release?.downloadUrl);
    configuredUrl = new URL(RELEASE_URL);
  } catch {
    throw new Error('El archivo de versión publicado está incompleto o no es válido.');
  }
  const configuredArtifact = '/releases/latest/download/mareas-del-umbral.apk';
  const releaseRoot = configuredUrl.pathname.endsWith(configuredArtifact)
    ? configuredUrl.pathname.slice(0, -configuredArtifact.length)
    : null;
  const validPath = releaseRoot && (
    downloadUrl.pathname === `${releaseRoot}/releases/download/android-${versionCode}/mareas-del-umbral.apk` ||
    downloadUrl.pathname === configuredUrl.pathname
  );
  if (!release || typeof release.version !== 'string' || !release.version.trim() ||
      !Number.isSafeInteger(versionCode) || versionCode <= 0 || versionCode > 2147483647 ||
      typeof release.downloadUrl !== 'string' ||
      configuredUrl.protocol !== 'https:' || downloadUrl.protocol !== 'https:' ||
      downloadUrl.origin !== configuredUrl.origin || downloadUrl.username || downloadUrl.password ||
      downloadUrl.search || downloadUrl.hash || !validPath) {
    throw new Error('El archivo de versión publicado está incompleto o no es válido.');
  }
  return { ...release, versionCode };
}

async function latestAndroidRelease() {
  try {
    return validateRelease(await nativeGet(`${RELEASE_VERSION_URL}?t=${Date.now()}`));
  } catch (manifestError) {
    try {
      const release = await nativeGet(`${RELEASE_API_URL}?t=${Date.now()}`);
      const code = Number(/^android-(\d+)$/.exec(release?.tag_name || '')?.[1]);
      const apk = release?.assets?.find(asset => asset.name === 'mareas-del-umbral.apk');
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
  return status.state === 'paused' ? "⏸ Android ha pausado la technique_038; se reanudará cuando sea posible." : "⬇ Preparando technique_038 segura en Android…";
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
        toast?.("⏸ La technique_038 sigue en pausa en Android. Puedes volver a pulsar el botón para comprobarla más tarde.");
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

export async function pendingAndroidUpdate() {
  if (!isAndroidApp() || !RELEASE_VERSION_URL) return null;
  const [installed, release] = await Promise.all([installedRelease(), latestAndroidRelease()]);
  return release.versionCode > installed.versionCode ? release : null;
}

export async function downloadAndroidApk({ toast } = {}) {
  if(!RELEASE_URL){toast?.('Todavía no se ha publicado un instalador de esta edición.');return;}
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

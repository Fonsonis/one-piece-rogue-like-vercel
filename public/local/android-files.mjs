export function isAndroidApp() {
  return globalThis.Capacitor?.isNativePlatform?.() === true && globalThis.Capacitor?.getPlatform?.() === 'android';
}

function nativePlugin(name) {
  return globalThis.Capacitor?.registerPlugin?.(name) || globalThis.Capacitor?.Plugins?.[name];
}

export async function exportAndroidJson(contents, filename = 'grandlinelike.json') {
  if (!isAndroidApp()) throw new Error('La exportación nativa solo está disponible en Android.');
  const filesystem = nativePlugin('Filesystem');
  const share = nativePlugin('Share');
  if (!filesystem?.writeFile || !share?.share) throw new Error('Faltan los plugins nativos de archivos.');

  const file = await filesystem.writeFile({
    path: filename,
    data: contents,
    directory: 'CACHE',
    encoding: 'utf8',
    recursive: true,
  });
  if (!file?.uri) throw new Error('Android no devolvió la ubicación del JSON.');
  await share.share({
    title: 'Copia de GrandLineLike',
    url: file.uri,
    dialogTitle: 'Guardar o compartir partida',
  });
  return file.uri;
}

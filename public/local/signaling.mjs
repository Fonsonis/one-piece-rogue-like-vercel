const OFFICIAL_ORIGIN = 'https://one-piece-rogue-like-vercel.vercel.app';
const REQUEST_TIMEOUT = 10000;

export function normalizeRoomCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8);
}

export function formatRoomCode(value) {
  const code = normalizeRoomCode(value);
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function signalingEndpoint(locationValue = globalThis.location, native = globalThis.Capacitor?.isNativePlatform?.() === true) {
  const protocol = locationValue?.protocol || '';
  const web = !native && ['http:', 'https:'].includes(protocol);
  return `${web ? locationValue.origin : OFFICIAL_ORIGIN}/api/multiplayer`;
}

export async function roomSignal(action, data = {}, { fetcher = globalThis.fetch, endpoint = signalingEndpoint() } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
      cache: 'no-store',
      signal: controller.signal,
    });
    let payload;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'No se pudo contactar con el servicio de salas. Comprueba que tienes Internet.');
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('El servicio de salas está tardando demasiado. Comprueba tu conexión.');
    if (error instanceof TypeError) throw new Error('No se pudo contactar con el servicio de salas. Comprueba que tienes Internet.');
    throw error;
  } finally { clearTimeout(timer); }
}

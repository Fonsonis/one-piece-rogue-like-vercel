// No signaling service, STUN, TURN, analytics or remote QR endpoint.
export const MAX_TOKEN = 24000;
const encoder = new TextEncoder(), decoder = new TextDecoder();
const id = () => crypto.randomUUID().replaceAll('-', '');
function base64(bytes) {
  return btoa(Array.from(bytes, n => String.fromCharCode(n)).join('')).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
async function transform(bytes, stream, max = MAX_TOKEN) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const parts = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) { await reader.cancel(); throw new Error('El código es demasiado grande.'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let at = 0;
  for (const part of parts) { result.set(part, at); at += part.length; }
  return result;
}
export async function encodeSignal(signal) {
  const bytes = encoder.encode(JSON.stringify(signal));
  if (bytes.length > MAX_TOKEN) throw new Error('Demasiadas interfaces de red. Desactiva la VPN e inténtalo otra vez.');
  if (typeof CompressionStream !== 'undefined') return 'OPZ1.' + base64(await transform(bytes, new CompressionStream('deflate')));
  return 'OPL1.' + base64(bytes);
}
export async function decodeSignal(token) {
  if (typeof token !== 'string' || token.length > MAX_TOKEN) throw new Error('Código inválido o demasiado grande.');
  token = token.trim();
  if (!/^OP[ZL]1\.[A-Za-z0-9_-]+$/.test(token)) throw new Error('Este no es un código de partida local.');
  try {
    let bytes = Uint8Array.from(atob(token.slice(5).replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    if (token.startsWith('OPZ')) bytes = await transform(bytes, new DecompressionStream('deflate'));
    const value = JSON.parse(decoder.decode(bytes));
    if (value.v !== 1 || !['offer', 'answer'].includes(value.type) || !/^[a-f0-9]{32}$/.test(value.room) ||
        !/^[a-f0-9]{32}$/.test(value.link) || typeof value.sdp !== 'string' || value.sdp.length > 18000 ||
        !value.sdp.startsWith('v=0') || !value.sdp.includes('m=application ') ||
        !value.sdp.includes('a=fingerprint:sha-256 ') || !value.sdp.includes('a=ice-ufrag:')) throw Error();
    // Accept host candidates only: never silently fall back to internet relays.
    const candidates = value.sdp.split(/\r?\n/).filter(line => line.startsWith('a=candidate:'));
    if (!candidates.length || candidates.some(line => !/ typ host(?: |$)/.test(line))) throw Error();
    return value;
  } catch { throw new Error('Código incompleto, incompatible o sin una dirección de red local. Genera uno nuevo.'); }
}
export async function qrFrames(token) {
  const hash = base64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)))).slice(0, 12);
  const count = Math.ceil(token.length / 700);
  return Array.from({ length: count }, (_, i) => `OPQR1|${hash}|${i}|${count}|${token.slice(i * 700, (i + 1) * 700)}`);
}
export class FrameCollector {
  constructor() { this.reset(); }
  reset() { this.key = null; this.parts = new Map(); this.count = 0; }
  async add(text) {
    if (typeof text !== 'string' || text.length > MAX_TOKEN) throw new Error('QR inválido.');
    if (/^OP[ZL]1\./.test(text)) return { token: text, received: 1, count: 1 };
    const match = /^OPQR1\|([A-Za-z0-9_-]{12})\|(\d+)\|(\d+)\|(.+)$/.exec(text);
    if (!match) throw new Error('Este QR no pertenece al multijugador local.');
    const [, key, indexText, countText, part] = match;
    const index = Number(indexText), count = Number(countText);
    if (count < 1 || count > 35 || index >= count || part.length > 700) throw new Error('QR inválido.');
    if (key !== this.key) { this.reset(); this.key = key; this.count = count; }
    if (count !== this.count) throw new Error('Fragmentos de QR incompatibles.');
    this.parts.set(index, part);
    if (this.parts.size !== count) return { received: this.parts.size, count };
    const token = Array.from({ length: count }, (_, i) => this.parts.get(i)).join('');
    const hash = base64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)))).slice(0, 12);
    if (hash !== key) { this.reset(); throw new Error('QR incompleto. Vuelve a escanearlo.'); }
    return { token, received: count, count };
  }
}
export class LocalLink {
  constructor({ room, link, onState = () => {}, onMessage = () => {}, Peer = globalThis.RTCPeerConnection } = {}) {
    if (!Peer) throw new Error('Este navegador no admite partidas locales. Prueba un navegador actualizado.');
    this.room = room || id(); this.id = link || id(); this.onState = onState; this.onMessage = onMessage;
    this.closed = false;
    this.pc = new Peer({ iceServers: [], iceTransportPolicy: 'all', bundlePolicy: 'max-bundle' });
    this.pc.onconnectionstatechange = () => {
      if (!this.closed) this.onState(this.pc.connectionState);
    };
    this.pc.ondatachannel = event => {
      if (this.channel || event.channel.label !== 'one-piece-local-v1') return event.channel.close();
      this.bind(event.channel);
    };
  }
  bind(channel) {
    this.channel = channel;
    channel.onopen = () => { clearTimeout(this.timeout); this.onState('connected'); };
    channel.onclose = () => { if (!this.closed) this.onState('closed'); };
    channel.onerror = () => { if (!this.closed) this.onState('failed'); };
    channel.onmessage = event => {
      if (typeof event.data !== 'string' || event.data.length > 100000) return;
      let packet;
      try { packet = JSON.parse(event.data); } catch { return; }
      if (packet && typeof packet === 'object' && !Array.isArray(packet)) this.onMessage(packet);
    };
  }
  async gather() {
    if (this.pc.iceGatheringState !== 'complete') await new Promise((resolve, reject) => {
      const finish = error => { clearTimeout(timer); this.pc.removeEventListener('icegatheringstatechange', check); this.cancelGather = null; error ? reject(error) : resolve(); };
      const check = () => { if (this.pc.iceGatheringState === 'complete') finish(); };
      const timer = setTimeout(() => finish(new Error('No se pudo obtener la conexión local. Desactiva VPN y revisa la Wi-Fi.')), 15000);
      this.cancelGather = () => finish(new Error('Emparejamiento cancelado.'));
      this.pc.addEventListener('icegatheringstatechange', check); check();
    });
    if (this.closed) throw new Error('Emparejamiento cancelado.');
    const { type, sdp } = this.pc.localDescription;
    if (!sdp.includes('a=candidate:')) throw new Error('El navegador no ofrece una dirección local. Revisa sus permisos de red y la Wi-Fi.');
    return encodeSignal({ v: 1, room: this.room, link: this.id, type, sdp });
  }
  async offer() {
    this.bind(this.pc.createDataChannel('one-piece-local-v1', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    return this.gather();
  }
  async answer(signal) {
    if (signal.type !== 'offer') throw new Error('Escanea el QR de invitación del anfitrión.');
    this.room = signal.room; this.id = signal.link;
    await this.pc.setRemoteDescription({ type: signal.type, sdp: signal.sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    return this.gather();
  }
  async accept(signal) {
    if (signal.type !== 'answer' || signal.link !== this.id || signal.room !== this.room) throw new Error('Esta respuesta pertenece a otra invitación.');
    if (this.pc.signalingState !== 'have-local-offer') throw new Error('Esta invitación ya se utilizó.');
    await this.pc.setRemoteDescription({ type: signal.type, sdp: signal.sdp });
    this.timeout = setTimeout(() => { if (this.channel?.readyState !== 'open') this.onState('timeout'); }, 30000);
  }
  send(packet) {
    if (this.closed || this.channel?.readyState !== 'open' || this.channel.bufferedAmount > 300000) return false;
    const value = JSON.stringify(packet);
    if (value.length > 100000) return false;
    try { this.channel.send(value); return true; } catch { return false; }
  }
  close() {
    if (this.closed) return;
    this.closed = true; clearTimeout(this.timeout); this.cancelGather?.();
    this.channel?.close(); this.pc.close();
  }
}

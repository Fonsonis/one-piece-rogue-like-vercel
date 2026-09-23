import { createHash } from 'node:crypto';
import { createMultiplayerService, ServiceError } from '../server/multiplayer-service.mjs';

function redisCommand(parts) {
  const base = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!base || !token) throw new ServiceError(503, 'El servicio de salas todavía no está configurado.');
  return fetch(base, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
  }).then(async response => {
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.error) throw new Error(payload?.error || 'Redis request failed.');
    return payload?.result;
  });
}

const service = createMultiplayerService({ command: redisCommand });
const json = (response, status, payload) => response.status(status).json(payload);

async function rateLimit(request) {
  const address = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const key = `oprl:multiplayer:rate:${createHash('sha256').update(address).digest('hex').slice(0, 24)}`;
  const first = await redisCommand(['SET', key, '1', 'NX', 'EX', 60]);
  const count = first === 'OK' ? 1 : Number(await redisCommand(['INCR', key]));
  if (count > 30) throw new ServiceError(429, 'Demasiados intentos de crear o buscar salas. Espera un minuto.');
}

function allowedOrigin(origin) {
  if (!origin) return '';
  if (['https://one-piece-rogue-like-vercel.vercel.app', 'https://localhost', 'oprl://game'].includes(origin)) return origin;
  if (/^https:\/\/one-piece-rogue-like-vercel-[a-z0-9-]+\.vercel\.app$/.test(origin)) return origin;
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)) return origin;
  return '';
}

export default async function handler(request, response) {
  const origin = allowedOrigin(request.headers.origin);
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'Método no permitido.' });
  try {
    if (request.headers.origin && !origin) throw new ServiceError(403, 'Origen no permitido.');
    if (Number(request.headers['content-length'] || 0) > 60000) throw new ServiceError(413, 'La petición es demasiado grande.');
    if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new ServiceError(415, 'El contenido debe enviarse como JSON.');
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ServiceError(400, 'Petición inválida.');
    if (JSON.stringify(body).length > 55000) throw new ServiceError(413, 'La petición es demasiado grande.');
    if (['create', 'join'].includes(body.action)) await rateLimit(request);
    const result = await service(body.action, body);
    return json(response, 200, { ok: true, ...result });
  } catch (error) {
    if (error instanceof SyntaxError) return json(response, 400, { ok: false, error: 'El contenido de la petición no es válido.' });
    if (error instanceof ServiceError) return json(response, error.status, { ok: false, error: error.message });
    console.error('multiplayer signaling error', error);
    return json(response, 503, { ok: false, error: 'El servicio de salas no está disponible. Inténtalo de nuevo.' });
  }
}

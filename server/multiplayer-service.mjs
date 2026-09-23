import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL = 15 * 60;
const JOIN_TTL = 3 * 60;
const MAX_QUEUE = 12;
const PREFIX = 'oprl:multiplayer:v1';

export class ServiceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const roomKey = code => `${PREFIX}:room:${code}`;
const queueKey = code => `${PREFIX}:queue:${code}`;
const joinKey = (code, joinId) => `${PREFIX}:join:${code}:${joinId}`;
const parseJson = value => {
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; }
};
const cleanCode = value => String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8);
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const validSecret = value => typeof value === 'string' && /^[A-Za-z0-9_-]{32}$/.test(value);
const validSignal = value => typeof value === 'string' && value.length <= 24000 && /^OP[ZL]1\.[A-Za-z0-9_-]+$/.test(value);
const validProtocol = value => typeof value === 'string' && /^[a-z0-9-]{4,40}$/.test(value);
const secretHash = value => createHash('sha256').update(value).digest('hex');

function sameSecret(storedHash, candidate) {
  if (typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/.test(storedHash) || !validSecret(candidate)) return false;
  return timingSafeEqual(Buffer.from(storedHash), Buffer.from(secretHash(candidate)));
}

export function createMultiplayerService({ command, bytes = randomBytes } = {}) {
  if (typeof command !== 'function') throw new TypeError('Redis command is required.');
  const secret = () => bytes(24).toString('base64url');
  const id = () => bytes(12).toString('hex');
  const code = () => Array.from(bytes(8), byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
  const getRoom = async value => parseJson(await command(['GET', roomKey(value)]));
  const getJoin = async (value, joinId) => parseJson(await command(['GET', joinKey(value, joinId)]));
  const requireRoom = async (value, hostSecret) => {
    const room = await getRoom(value);
    if (!room || !sameSecret(room.hostHash, hostSecret)) throw new ServiceError(404, 'La sala no existe o ya ha caducado.');
    return room;
  };
  const requireJoin = async (value, joinId, guestSecret) => {
    if (!validId(joinId)) throw new ServiceError(400, 'Solicitud de unión inválida.');
    const join = await getJoin(value, joinId);
    if (!join || !sameSecret(join.guestHash, guestSecret)) throw new ServiceError(404, 'La solicitud de unión ha caducado.');
    return join;
  };
  const saveJoin = (value, joinId, join) => command(['SET', joinKey(value, joinId), JSON.stringify(join), 'EX', JOIN_TTL]);

  return async function handle(action, input = {}) {
    if (action === 'create') {
      if (!validProtocol(input.protocol)) throw new ServiceError(400, 'Versión multijugador inválida.');
      for (let attempt = 0; attempt < 6; attempt++) {
        const value = code(), hostSecret = secret();
        const result = await command(['SET', roomKey(value), JSON.stringify({ hostHash: secretHash(hostSecret), protocol: input.protocol }), 'NX', 'EX', ROOM_TTL]);
        if (result === 'OK') return { code: value, hostSecret, expiresIn: ROOM_TTL };
      }
      throw new ServiceError(503, 'No se pudo reservar un código de sala. Inténtalo de nuevo.');
    }

    const value = cleanCode(input.code);
    if (value.length !== 8) throw new ServiceError(400, 'Introduce un código de sala de 8 caracteres.');

    if (action === 'join') {
      const room = await getRoom(value);
      if (!room) throw new ServiceError(404, 'No se encuentra esa sala. Revisa el código con el anfitrión.');
      if (!validProtocol(input.protocol) || room.protocol !== input.protocol) throw new ServiceError(409, 'Las versiones del juego no coinciden. Actualizad ambos dispositivos.');
      const queued = Number(await command(['LLEN', queueKey(value)])) || 0;
      if (queued >= MAX_QUEUE) throw new ServiceError(409, 'La sala tiene demasiadas solicitudes pendientes.');
      const joinId = id(), guestSecret = secret();
      await saveJoin(value, joinId, { guestHash: secretHash(guestSecret), status: 'waiting' });
      await command(['RPUSH', queueKey(value), joinId]);
      await command(['EXPIRE', queueKey(value), ROOM_TTL]);
      return { code: value, joinId, guestSecret, expiresIn: JOIN_TTL };
    }

    if (action === 'host-poll') {
      await requireRoom(value, input.hostSecret);
      await command(['EXPIRE', roomKey(value), ROOM_TTL]);
      await command(['EXPIRE', queueKey(value), ROOM_TTL]);
      const ids = await command(['LRANGE', queueKey(value), '0', '-1']) || [];
      const joins = [];
      const validIds = ids.slice(0, MAX_QUEUE).filter(validId);
      const values = validIds.length ? await command(['MGET', ...validIds.map(joinId => joinKey(value, joinId))]) : [];
      for (let index = 0; index < validIds.length; index++) {
        const joinId = validIds[index], join = parseJson(values[index]);
        if (!join) { await command(['LREM', queueKey(value), '0', joinId]); continue; }
        joins.push({ joinId, status: join.status, answer: join.status === 'answered' ? join.answer : undefined });
      }
      return { code: value, joins };
    }

    if (action === 'offer') {
      await requireRoom(value, input.hostSecret);
      const join = await getJoin(value, input.joinId);
      if (!validSignal(input.offer)) throw new ServiceError(400, 'La oferta de conexión no es válida.');
      if (join?.status === 'offered') {
        if (join.offer !== input.offer) throw new ServiceError(409, 'Esta solicitud ya tiene otra invitación.');
        return { code: value, joinId: input.joinId };
      }
      if (!join || join.status !== 'waiting') throw new ServiceError(409, 'El invitado ya no está esperando esta invitación.');
      join.status = 'offered'; join.offer = input.offer;
      await saveJoin(value, input.joinId, join);
      return { code: value, joinId: input.joinId };
    }

    if (action === 'guest-poll') {
      const join = await requireJoin(value, input.joinId, input.guestSecret);
      return { code: value, status: join.status, offer: join.status === 'offered' || join.status === 'answered' ? join.offer : undefined, reason: join.status === 'rejected' ? join.reason : undefined };
    }

    if (action === 'answer') {
      const join = await requireJoin(value, input.joinId, input.guestSecret);
      if (join.status === 'answered') {
        if (join.answer !== input.answer) throw new ServiceError(409, 'Esta solicitud ya tiene otra respuesta.');
        return { code: value, joinId: input.joinId };
      }
      if (join.status !== 'offered') throw new ServiceError(409, 'El anfitrión todavía no ha preparado la conexión.');
      if (!validSignal(input.answer)) throw new ServiceError(400, 'La respuesta de conexión no es válida.');
      join.status = 'answered'; join.answer = input.answer;
      await saveJoin(value, input.joinId, join);
      return { code: value, joinId: input.joinId };
    }

    if (action === 'complete' || action === 'reject') {
      await requireRoom(value, input.hostSecret);
      const join = await getJoin(value, input.joinId);
      if (!join) return { code: value, joinId: input.joinId };
      if (action === 'reject') {
        join.status = 'rejected'; join.reason = String(input.reason || 'El anfitrión no puede aceptar más jugadores.').slice(0, 160);
        delete join.offer; delete join.answer;
        await saveJoin(value, input.joinId, join);
      } else {
        await command(['DEL', joinKey(value, input.joinId)]);
        await command(['LREM', queueKey(value), '0', input.joinId]);
      }
      return { code: value, joinId: input.joinId };
    }

    if (action === 'cancel') {
      await requireJoin(value, input.joinId, input.guestSecret);
      await command(['DEL', joinKey(value, input.joinId)]);
      await command(['LREM', queueKey(value), '0', input.joinId]);
      return { code: value };
    }

    if (action === 'close') {
      await requireRoom(value, input.hostSecret);
      const ids = await command(['LRANGE', queueKey(value), '0', '-1']) || [];
      const keys = [roomKey(value), queueKey(value), ...ids.filter(validId).map(joinId => joinKey(value, joinId))];
      await command(['DEL', ...keys]);
      return { code: value };
    }

    throw new ServiceError(400, 'Operación de sala no reconocida.');
  };
}

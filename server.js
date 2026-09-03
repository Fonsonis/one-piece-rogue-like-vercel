// Servidor local: estáticos + API de cuentas de jugador.
// Cada jugador se guarda como players/<nombre>.json
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json' };
const PLAYERS = path.join(__dirname, 'players');
fs.mkdirSync(PLAYERS, { recursive: true });

const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const validUser = u => /^[A-Za-z0-9_-]{3,20}$/.test(u);
const playerFile = u => path.join(PLAYERS, u + '.json');

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function handleApi(req, res, body) {
  let data;
  try { data = JSON.parse(body || '{}'); } catch (e) { return send(res, 400, { error: 'JSON inválido' }); }
  const user = data.user || '';
  const pass = data.pass || '';
  if (!validUser(user)) return send(res, 400, { error: 'Usuario inválido: 3-20 caracteres (letras, números, _ y -)' });
  if (pass.length < 3) return send(res, 400, { error: 'La contraseña necesita al menos 3 caracteres' });
  const file = playerFile(user);

  if (req.url === '/api/register') {
    if (fs.existsSync(file)) return send(res, 409, { error: 'Ese nombre de pirata ya existe' });
    const profile = { pass: hash(pass), created: new Date().toISOString(), meta: data.meta || null, run: data.run || null };
    fs.writeFileSync(file, JSON.stringify(profile, null, 2));
    return send(res, 200, { ok: true, meta: profile.meta, run: profile.run });
  }

  let profile = null;
  try { profile = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  if (!profile || profile.pass !== hash(pass)) return send(res, 401, { error: 'Usuario o contraseña incorrectos' });

  if (req.url === '/api/login') return send(res, 200, { ok: true, meta: profile.meta, run: profile.run || null });
  if (req.url === '/api/save') {
    profile.meta = data.meta || null;
    profile.run = data.run || null;
    profile.saved = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(profile, null, 2));
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'Ruta desconocida' });
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/api/')) {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => handleApi(req, res, body));
    return;
  }
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const file = path.join(__dirname, path.normalize(p));
  if (!file.startsWith(__dirname) || file.startsWith(PLAYERS)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8791, () => console.log('GrandLineLike en http://localhost:8791'));

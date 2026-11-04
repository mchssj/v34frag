// Mide en staging, con la cuenta kyan: pedidos de estado, acciones y el tiempo hasta que llega el aviso por el socket.
import { readFileSync } from 'node:fs';

const envTxt = readFileSync('E:/Css V34 Web/v34frag/.env', 'utf8');
const env = (k) => (envTxt.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').replace(/["\r]/g, '');
const API = 'https://api.cmleague.lat';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };
const resumen = (k, a) => console.log(`${k.padEnd(34)} mediana ${pct(a, 0.5)} ms · p90 ${pct(a, 0.9)} ms · máx ${Math.round(Math.max(...a))} ms`);

const { access_token: token } = await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env('STAGING_TEST_KYAN_EMAIL'), password: env('STAGING_TEST_KYAN_PASSWORD') }),
}).then((r) => r.json());
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const timed = async (path, init = {}) => {
  const t = performance.now();
  const r = await fetch(`${API}${path}`, { headers: H, ...init });
  await r.arrayBuffer();
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return performance.now() - t;
};

// Socket: anota cuándo llega cada aviso.
const events = [];
const ws = await new Promise((resolve) => {
  const s = new WebSocket(`${API.replace('https', 'wss')}/api/v1/mm/ws`);
  s.onopen = () => s.send(JSON.stringify({ t: 'auth', token }));
  s.onmessage = (m) => { const e = JSON.parse(m.data); if (e.t === 'ping') { s.send('{"t":"pong"}'); return; } events.push({ t: e.t, at: performance.now() }); if (e.t === 'ready') resolve(s); };
});

// Conexión del socket: de abrirlo a recibir "ready" (incluye validar el token).
const ready = [];
for (let i = 0; i < 12; i++) {
  const t = performance.now();
  await new Promise((resolve) => {
    const s = new WebSocket(`${API.replace('https', 'wss')}/api/v1/mm/ws`);
    s.onopen = () => s.send(JSON.stringify({ t: 'auth', token }));
    s.onmessage = (m) => { if (JSON.parse(m.data).t === 'ready') { ready.push(performance.now() - t); s.close(); resolve(); } };
  });
  await sleep(200);
}

const live = [], profile = [], join = [], leave = [], evJoin = [], ping = [];
for (let i = 0; i < 12; i++) {
  live.push(await timed('/api/v1/mm/state/live'));
  profile.push(await timed('/api/v1/mm/profile'));
  ping.push(await timed('/api/health'));
  events.length = 0;
  const t0 = performance.now();
  join.push(await timed('/api/v1/mm/queue', { method: 'POST', body: JSON.stringify({ mode: '5v5' }) }));
  await sleep(1500);
  const ev = events.find((e) => e.t === 'queue.changed');
  if (ev) evJoin.push(ev.at - t0);
  leave.push(await timed('/api/v1/mm/queue', { method: 'DELETE' }));
  await sleep(300);
}
ws.close();
resumen('GET /api/health (red + API)', ping);
resumen('GET /mm/state/live', live);
resumen('GET /mm/profile', profile);
resumen('POST /mm/queue (buscar)', join);
resumen('DELETE /mm/queue (cancelar)', leave);
resumen('aviso queue.changed desde "buscar"', evJoin);
resumen('socket: abrir hasta "ready"', ready);

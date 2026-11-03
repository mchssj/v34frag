// Mide en staging el flujo completo del 1v1 con kyan y daniloev: de "Buscar" (el segundo) a "Partida encontrada" en
// los dos, y de "Aceptar" (el segundo) al aviso del veto. Cancela cada sala apenas arranca el veto (sin sanciones), así
// el servidor de juego no llega a recibirla.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const envTxt = readFileSync('E:/Css V34 Web/v34frag/.env', 'utf8');
const env = (k) => (envTxt.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').replace(/["\r]/g, '');
const API = 'https://api.cmleague.lat';
const ref = env('STAGING_SUPABASE_URL').replace(/^https:\/\/([a-z0-9]+)\..*$/, '$1');
const pgEnv = { ...process.env, PGHOST: env('STAGING_PG_HOST'), PGPORT: env('STAGING_PG_PORT'), PGPASSWORD: env('STAGING_PG_PASSWORD'), PGUSER: `${env('STAGING_PG_USER')}.${ref}`, PGSSLMODE: 'require' };
const db = (q) => execFileSync('docker', ['exec', '-e', 'PGHOST', '-e', 'PGPORT', '-e', 'PGUSER', '-e', 'PGPASSWORD', '-e', 'PGSSLMODE', 'supabase_db_v34frag-api', 'psql', '-d', 'postgres', '-tAc', q], { env: pgEnv, encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };
const resumen = (k, a) => console.log(`${k.padEnd(40)} mediana ${pct(a, 0.5)} ms · máx ${Math.round(Math.max(...a))} ms · (${a.map(Math.round).join(', ')})`);

async function cuenta(prefix) {
  const { access_token: token } = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env(`STAGING_TEST_${prefix}_EMAIL`), password: env(`STAGING_TEST_${prefix}_PASSWORD`) }),
  }).then((r) => r.json());
  const events = [];
  const ws = await new Promise((resolve) => {
    const s = new WebSocket(`${API.replace('https', 'wss')}/api/v1/mm/ws`);
    s.onopen = () => s.send(JSON.stringify({ t: 'auth', token }));
    s.onmessage = (m) => {
      const e = JSON.parse(m.data);
      if (e.t === 'ping') { s.send('{"t":"pong"}'); return; }
      events.push({ ...e, at: performance.now() });
      if (e.t === 'ready') resolve(s);
    };
  });
  const call = async (method, path, body) => {
    const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(`${prefix} ${path} ${r.status} ${JSON.stringify(await r.json())}`);
  };
  const wait = async (t, since, ms = 6000) => {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      const e = events.find((x) => x.t === t && x.at >= since);
      if (e) return e.at - since;
      await sleep(10);
    }
    return null;
  };
  return { ws, call, wait };
}

const a = await cuenta('KYAN');
const b = await cuenta('DANILOEV');
const found = [], veto = [];
for (let i = 0; i < 5; i++) {
  await a.call('POST', '/api/v1/mm/queue', { mode: '1v1' });
  await sleep(300);
  const t0 = performance.now();
  await b.call('POST', '/api/v1/mm/queue', { mode: '1v1' });
  const fa = await a.wait('lobby.found', t0), fb = await b.wait('lobby.found', t0);
  if (fa === null || fb === null) throw new Error('no llegó lobby.found');
  found.push(Math.max(fa, fb));
  await a.call('POST', '/api/v1/mm/lobby/accept');
  await sleep(300);
  const t1 = performance.now();
  await b.call('POST', '/api/v1/mm/lobby/accept');
  const va = await a.wait('lobby.veto', t1);
  if (va === null) throw new Error('no llegó lobby.veto');
  veto.push(va);
  db(`select mm_cancel_lobby(l.id, 'Prueba de rendimiento (Claude)') from mm_lobbies l where l.status not in ('finished', 'cancelled') and l.mode = '1v1'`);
  await sleep(2500);
}
a.ws.close(); b.ws.close();
db(`delete from mm_queue where mode = '1v1'`);
resumen('"Buscar" del 2.º → "Partida encontrada"', found);
resumen('"Aceptar" del 2.º → aviso del veto', veto);

// Staging: kyan cancela en el mismo instante en que daniloev entra y completa la sala del 1v1. Antes del replanteo 64,
// kyan podía salir de la cola ("left") y quedar igual en la sala. También comprueba el ping del socket.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const envTxt = readFileSync('E:/Css V34 Web/v34frag/.env', 'utf8');
const env = (k) => (envTxt.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').replace(/["\r]/g, '');
const API = 'https://api.cmleague.lat';
const ref = env('STAGING_SUPABASE_URL').replace(/^https:\/\/([a-z0-9]+)\..*$/, '$1');
const pgEnv = { ...process.env, PGHOST: env('STAGING_PG_HOST'), PGPORT: env('STAGING_PG_PORT'), PGPASSWORD: env('STAGING_PG_PASSWORD'), PGUSER: `${env('STAGING_PG_USER')}.${ref}`, PGSSLMODE: 'require' };
const db = (q) => execFileSync('docker', ['exec', '-e', 'PGHOST', '-e', 'PGPORT', '-e', 'PGUSER', '-e', 'PGPASSWORD', '-e', 'PGSSLMODE', 'supabase_db_v34frag-api', 'psql', '-d', 'postgres', '-tAc', q], { env: pgEnv, encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(prefix) {
  const { access_token: token } = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env(`STAGING_TEST_${prefix}_EMAIL`), password: env(`STAGING_TEST_${prefix}_PASSWORD`) }),
  }).then((r) => r.json());
  return (method, path, body) => fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
}
const kyan = await login('KYAN');
const dani = await login('DANILOEV');
const K = db(`select id from auth.users where email = '${env('STAGING_TEST_KYAN_EMAIL')}'`);

// Ping: un socket de kyan durante 32 s.
const { access_token: tk } = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env('STAGING_TEST_KYAN_EMAIL'), password: env('STAGING_TEST_KYAN_PASSWORD') }) }).then((r) => r.json());
const pings = [];
const ws = new WebSocket(`${API.replace('https', 'wss')}/api/v1/mm/ws`);
ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token: tk }));
ws.onmessage = (m) => { if (JSON.parse(m.data).t === 'ping') { pings.push(Date.now()); ws.send('{"t":"pong"}'); } };

let enSala = 0, salio = 0, mal = 0;
for (let i = 0; i < 10; i++) {
  await kyan('POST', '/api/v1/mm/queue', { mode: '1v1' });
  await sleep(200);
  await Promise.all([kyan('DELETE', '/api/v1/mm/queue'), dani('POST', '/api/v1/mm/queue', { mode: '1v1' })]);
  await sleep(400);
  const lobby = db(`select l.id from mm_lobbies l join mm_lobby_players lp on lp.lobby_id = l.id where lp.user_id = '${K}' and l.status not in ('finished','cancelled')`);
  const ultima = db(`select outcome from mm_queue_log where user_id = '${K}' order by id desc limit 1`);
  if (lobby) enSala++; else salio++;
  if (lobby && ultima === 'left') mal++;
  db(`select mm_cancel_lobby(l.id, 'Prueba de la carrera (Claude)') from mm_lobbies l where l.status not in ('finished','cancelled') and l.mode = '1v1'`);
  db(`delete from mm_queue where mode = '1v1'`);
  await sleep(500);
}
await sleep(Math.max(0, 32_000 - 10 * 1300));
ws.close();
console.log(`carrera: ${enSala} veces ganó el armado (kyan en la sala), ${salio} ganó cancelar, ${mal} con kyan en la sala y "left" (el error)`);
console.log(`ping: ${pings.length} recibidos${pings.length > 1 ? `, cada ${Math.round((pings.at(-1) - pings[0]) / (pings.length - 1) / 1000)} s` : ''}`);

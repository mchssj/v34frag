// Demo del anticheat, SOLO contra la Supabase local: hace de Bridge sin servidor de juego.
//   pnpm ac:demo preparar <email>   ficha con SteamID para esa cuenta y servidor protegido
//   pnpm ac:demo abrir <email>      el jugador entra al servidor (abre sesión; la aplicación tiene que estar vinculada)
//   pnpm ac:demo cerrar <email>     el jugador se va
import { execSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const [cmd, email] = process.argv.slice(2);
if (!cmd || !email || !['preparar', 'abrir', 'cerrar'].includes(cmd)) {
  console.error('Uso: pnpm ac:demo <preparar|abrir|cerrar> <email>');
  process.exit(2);
}
const st = JSON.parse(execSync('pnpm exec supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()) as { API_URL: string; SERVICE_ROLE_KEY: string; ANON_KEY: string };
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(st.API_URL)) throw new Error('Esto solo corre contra la Supabase local');

const a = createClient(st.API_URL, st.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const users = (await a.auth.admin.listUsers({ perPage: 1000 })).data.users;
const user = users.find((u) => u.email === email);
if (!user) throw new Error(`No existe la cuenta ${email}: regístrala primero en la web local`);

const NAME = 'Servidor de demo';
const SECRET_NOTE = 'demo-anticheat-local';
const token = createHash('sha256').update(SECRET_NOTE + st.SERVICE_ROLE_KEY).digest('hex');
const tokenHash = createHash('sha256').update(token).digest('hex');
const must = <T extends { error: unknown }>(r: T) => { if (r.error) throw r.error; return r; };

if (cmd === 'preparar') {
  const found = (await a.from('game_servers').select('id').eq('name', NAME).maybeSingle()).data;
  const serverId = found?.id ?? crypto.randomUUID();
  if (!found) must(await a.from('game_servers').insert({ id: serverId, name: NAME, token_hash: tokenHash, active: true }));
  must(await a.from('ac_server_policy').upsert({ server_id: serverId, protected: true, enforce_mixes: true }));
  const player = (await a.from('players').select('id, steam_id').eq('user_id', user.id).maybeSingle()).data;
  const steam = `7656119${String(parseInt(randomBytes(4).toString('hex'), 16)).padStart(10, '0').slice(0, 10)}`;
  if (!player) must(await a.from('players').insert({ nick: `Demo${randomBytes(3).toString('hex')}`, steam_id: steam, user_id: user.id }));
  else if (!player.steam_id) must(await a.from('players').update({ steam_id: steam }).eq('id', player.id));
  console.log('Listo. Ya se puede aprobar el equipo en la web.');
} else {
  const player = (await a.from('players').select('steam_id').eq('user_id', user.id).single()).data as { steam_id: string };
  const anon = createClient(st.API_URL, st.ANON_KEY, { auth: { persistSession: false } });
  if (cmd === 'abrir') {
    // Sin CLIENT_IP_HEADER la API ve al agente como "unknown".
    console.log(must(await anon.rpc('ac_bridge_player', { p_token: token, p_steam: player.steam_id, p_ip: 'unknown', p_in_mix: true })).data);
  } else {
    must(await anon.rpc('ac_bridge_end', { p_token: token, p_steam: player.steam_id }));
    console.log('Sesión cerrada.');
  }
}

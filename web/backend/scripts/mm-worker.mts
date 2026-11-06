// Worker del matchmaking (v34frag-mm.service): llama a mm_tick() cada 2 s. Local: pnpm mm:worker
// Necesita SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno, como season:tick.
// (replanteo 75) En cada vuelta publica o edita los avisos de reemplazo en Discord (src/jobs/mm-replace.ts). Para eso usa
// DISCORD_QUEUE_WEBHOOK_URL, DISCORD_QUEUE_ROLE_ID y FRONTEND_URL; sin el webhook, los reemplazos no se avisan.
import { createClient } from '@supabase/supabase-js';
import { runReplaceNotices, type ReplaceRpc } from '../src/jobs/mm-replace';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('mm:worker: faltan SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}
const hook = process.env.DISCORD_QUEUE_WEBHOOK_URL?.startsWith('https://discord.com/api/webhooks/') ? process.env.DISCORD_QUEUE_WEBHOOK_URL : undefined;
const replaceCfg = { hook, role: process.env.DISCORD_QUEUE_ROLE_ID || undefined, frontendUrl: process.env.FRONTEND_URL || 'https://cmleague.lat' };
if (!hook) console.error('mm:worker: sin DISCORD_QUEUE_WEBHOOK_URL, los reemplazos no se avisan en Discord');

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const rpc: ReplaceRpc = (fn, args) => sb.rpc(fn as never, args as never);
const BASE_MS = 2_000;
const MAX_MS = 30_000;
let wait = BASE_MS;
let stopping = false;
let lastReplaceError = '';

for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => (stopping = true));

while (!stopping) {
  const { error } = await sb.rpc('mm_tick' as never);
  if (error) {
    console.error(`${new Date().toISOString()} mm:worker: ${error.message}`);
    wait = Math.min(wait * 2, MAX_MS); // Si la base falla, se espera cada vez más.
  } else {
    wait = BASE_MS;
    try {
      const n = await runReplaceNotices(rpc, replaceCfg);
      if (n) console.log(`${new Date().toISOString()} mm:worker: ${n} aviso(s) de reemplazo en Discord`);
      lastReplaceError = '';
    } catch (e) {
      // El mismo error, una sola vez (si no, sale cada 2 s).
      const msg = (e as Error).message;
      if (msg !== lastReplaceError) console.error(`${new Date().toISOString()} mm:worker: reemplazos: ${msg}`);
      lastReplaceError = msg;
    }
  }
  await new Promise((r) => setTimeout(r, wait));
}

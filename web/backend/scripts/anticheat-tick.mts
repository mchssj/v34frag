// Retención del anticheat (cron del VPS, una vez al día): pnpm anticheat:tick
// Necesita SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno, como notify:tick.
import { createClient } from '@supabase/supabase-js';
import { runRetention } from '../src/jobs/anticheat-retention';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('anticheat:tick: faltan SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
try {
  const n = await runRetention({
    rpc: (fn, args) => sb.rpc(fn as never, args as never) as unknown as PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
    removeFiles: (paths) => sb.storage.from('ac-evidence').remove(paths),
  });
  if (n) console.log(`${new Date().toISOString()} anticheat:tick: ${n} sesiones borradas`);
} catch (e) {
  console.error(`anticheat:tick: ${(e as Error).message}`);
  process.exit(1);
}

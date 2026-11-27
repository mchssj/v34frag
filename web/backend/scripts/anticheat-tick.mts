// Retención del anticheat (cron del VPS, una vez al día): pnpm anticheat:tick
// Necesita SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno, como notify:tick.
import { createClient } from '@supabase/supabase-js';
import { runRetention, runScreenshotRetention } from '../src/jobs/anticheat-retention';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('anticheat:tick: faltan SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
try {
  const db = {
    rpc: (fn: string, args?: Record<string, unknown>) =>
      sb.rpc(fn as never, args as never) as unknown as PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
    removeFiles: (paths: string[]) => sb.storage.from('ac-evidence').remove(paths),
  };
  // Primero las capturas vencidas (7 días, replanteo 156) y después las sesiones enteras.
  const shots = await runScreenshotRetention(db);
  if (shots) console.log(`${new Date().toISOString()} anticheat:tick: ${shots} capturas vencidas borradas`);
  const n = await runRetention(db);
  if (n) console.log(`${new Date().toISOString()} anticheat:tick: ${n} sesiones borradas`);
} catch (e) {
  console.error(`anticheat:tick: ${(e as Error).message}`);
  process.exit(1);
}

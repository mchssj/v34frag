// Worker del matchmaking (v34frag-mm.service): llama a mm_tick() cada 2 s. Local: pnpm mm:worker
// Necesita SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno, como season:tick.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('mm:worker: faltan SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const BASE_MS = 2_000;
const MAX_MS = 30_000;
let wait = BASE_MS;
let stopping = false;

for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => (stopping = true));

while (!stopping) {
  const { error } = await sb.rpc('mm_tick' as never);
  if (error) {
    console.error(`${new Date().toISOString()} mm:worker: ${error.message}`);
    wait = Math.min(wait * 2, MAX_MS); // Si la base falla, se espera cada vez más.
  } else {
    wait = BASE_MS;
  }
  await new Promise((r) => setTimeout(r, wait));
}

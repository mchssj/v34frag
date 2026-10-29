// Notificaciones programadas (cron del VPS, cada 10 minutos): pnpm notify:tick
// Llama a notify_due() con la clave de servicio (ver src/jobs/notify-due.ts y el plan
// docs/bitacora/2026-10-29-notificaciones-programadas). Escribe una línea en el log solo si mandó algo, y sale con 1 si falla.
// Necesita SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno (el mismo season.env del cierre de temporadas).
import { createClient } from '@supabase/supabase-js';
import { runNotifyDue, summary } from '../src/jobs/notify-due';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('notify:tick: faltan SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
try {
  const line = summary(await runNotifyDue((fn) => sb.rpc(fn)));
  if (line) console.log(`${new Date().toISOString()} notify:tick: ${line}`);
} catch (e) {
  console.error(`notify:tick: ${(e as Error).message}`);
  process.exit(1);
}

// Cierre automático de la temporada (cron del VPS, cada 10 minutos): pnpm season:tick
// Llama a season_close_due() con la clave de servicio. Cierra la temporada activa si llegó su fecha; con un mix en
// vivo espera (hasta 6 horas). Escribe una línea en el log solo si cerró o si está esperando, y sale con 1 si falla.
// Necesita SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno (plan docs/bitacora/2026-10-20-temporadas).
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('season:tick: faltan SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await sb.rpc('season_close_due');
if (error) {
  console.error(`season:tick: ${error.code ?? ''} ${error.message}`);
  process.exit(1);
}
const r = data as { closed: boolean; reason?: string; season_id?: string; next_season_id?: string; medals?: number; reset?: number };
const now = new Date().toISOString();
if (r.closed) console.log(`${now} season:tick: cerrada ${r.season_id} (${r.medals} medallas, ${r.reset} reinicios); abierta ${r.next_season_id}`);
else if (r.reason === 'live_match') console.log(`${now} season:tick: la temporada ${r.season_id} venció; espera a que termine el mix en vivo`);

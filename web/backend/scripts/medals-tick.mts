// Motor de las medallas configurables (cron del VPS, cada 5 minutos): pnpm medals:tick
// Llama a medals_evaluate_pending() con la clave de servicio: saca de la cola a los jugadores con partidas nuevas y les da las
// medallas activas que ya cumplen. Si falla, los jugadores siguen en la cola para la próxima vuelta y el mix ya quedó
// guardado. Escribe una línea solo si dio alguna medalla, y sale con 1 si falla.
// Necesita SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno (bitácora docs/bitacora/2026-11-04-medallas-configurables).
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('medals:tick: faltan SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let players = 0;
let medals = 0;
// Hasta 10 vueltas de 500 jugadores: después de activar una medalla sin retro, o de un recálculo grande, la cola crece.
for (let i = 0; i < 10; i++) {
  const { data, error } = await sb.rpc('medals_evaluate_pending', { p_limit: 500 });
  if (error) {
    console.error(`medals:tick: ${error.code ?? ''} ${error.message}`);
    process.exit(1);
  }
  const r = data as { players: number; medals: number };
  players += r.players;
  medals += r.medals;
  if (r.players < 500) break;
}
if (medals > 0) console.log(`${new Date().toISOString()} medals:tick: ${medals} medallas a ${players} jugadores revisados`);

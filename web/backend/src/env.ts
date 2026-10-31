import { z } from 'zod';
import { parseOrigins } from './lib/cors';

// Variables tal como llegan del runtime: `env` de Workers o `process.env` en Node.
export type RawEnv = Record<string, unknown>;

const EnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'preview', 'production']),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  CORS_ORIGINS: z.string().default(''),
  FRONTEND_URL: z.url(),
  GIT_SHA: z.string().min(1).default('dev'),
  // Header confiable con la IP del cliente (lo pone el proxy): x-forwarded-for o cf-connecting-ip.
  CLIENT_IP_HEADER: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.enum(['', 'x-forwarded-for', 'cf-connecting-ip', 'x-real-ip']))
    .default(''),
  // URL pública del Worker de demos (descarga en <DEMO_BASE_URL>/demo/<match_uid>). Sin ella no se arma demo_url.
  DEMO_BASE_URL: z
    .url()
    .transform((s) => s.replace(/\/+$/, ''))
    .optional(),
  // URL pública del Worker de clips (video en <CLIPS_BASE_URL>/clip/<partida>/<jugada>-<sufijo>.mp4 mientras está
  // en R2). Sin ella no se arma video.url (queda el reproductor de Drive).
  CLIPS_BASE_URL: z
    .url()
    .transform((s) => s.replace(/\/+$/, ''))
    .optional(),
  // Dirección pública del relay del HUD (https://hud.cmleague.lat): links de OBS de los streamers y csstv_hud_host del cfg.
  HUD_BASE_URL: z
    .url()
    .transform((s) => s.replace(/\/+$/, ''))
    .optional(),
  // Secreto del anticheat: la base lo pide para que solo la API informe la IP del agente (replanteo 39). Sin él, el agente da 501.
  AC_API_SECRET: z.string().min(32).optional(),
  // La API no la usa: la usa el cron de las temporadas (scripts/season-tick.mts). Se declara para que el despliegue
  // falle temprano si viene mal formada.
  SUPABASE_SERVICE_KEY: z.string().min(20).optional(),
});

export type Config = z.infer<typeof EnvSchema> & { corsOrigins: RegExp[] };

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Configuración inválida: ${problems.join('; ')}`);
    this.name = 'ConfigError';
  }
}

// En Workers el objeto `env` es el mismo en todos los requests de un isolate; en Node es `process.env`.
const cache = new WeakMap<object, Config>();

export function loadConfig(raw: RawEnv): Config {
  const hit = cache.get(raw);
  if (hit) return hit;

  const parsed = EnvSchema.safeParse(raw);
  // Solo nombres de variables y el problema: nunca los valores.
  if (!parsed.success) throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));

  let corsOrigins: RegExp[];
  try {
    corsOrigins = parseOrigins(parsed.data.CORS_ORIGINS);
  } catch (e) {
    throw new ConfigError([`CORS_ORIGINS: ${(e as Error).message}`]);
  }

  const config: Config = { ...parsed.data, SUPABASE_URL: parsed.data.SUPABASE_URL.replace(/\/+$/, ''), corsOrigins };
  cache.set(raw, config);
  return config;
}

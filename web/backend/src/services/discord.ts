// Números del Discord de la comunidad para la tarjeta del inicio (plan docs/bitacora/2026-11-07-jugadas-landing-emparejamiento).
// Salen de la invitación pública (sin token): approximate_presence_count y approximate_member_count. No se manda nada del
// visitante: la API consulta sola y guarda la respuesta 10 minutos.

export const DISCORD_CACHE_MS = 10 * 60_000;
export const DISCORD_TIMEOUT_MS = 3000;

export type DiscordCounts = { online: number | null; members: number | null; invite_url: string };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);

export async function discordCounts(code: string, fetcher: Fetcher = fetch, timeoutMs = DISCORD_TIMEOUT_MS): Promise<DiscordCounts> {
  const invite_url = `https://discord.gg/${code}`;
  try {
    const res = await fetcher(`https://discord.com/api/v9/invites/${encodeURIComponent(code)}?with_counts=true`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { online: null, members: null, invite_url };
    const j = (await res.json()) as { approximate_presence_count?: unknown; approximate_member_count?: unknown };
    return { online: count(j.approximate_presence_count), members: count(j.approximate_member_count), invite_url };
  } catch {
    return { online: null, members: null, invite_url };
  }
}

const cache = new Map<string, { at: number; value: Promise<DiscordCounts> }>();

/** Con caché de 10 minutos por código. Una respuesta sin números se guarda solo 1 minuto, para volver a probar antes. */
export function cachedDiscordCounts(code: string, fetcher: Fetcher = fetch, now = Date.now()): Promise<DiscordCounts> {
  const hit = cache.get(code);
  if (hit && now - hit.at < DISCORD_CACHE_MS) return hit.value;
  const value = discordCounts(code, fetcher);
  cache.set(code, { at: now, value });
  void value.then((v) => {
    if (v.members === null && cache.get(code)?.value === value) cache.set(code, { at: now - DISCORD_CACHE_MS + 60_000, value });
  });
  return value;
}

/** Para las pruebas. */
export function clearDiscordCache() {
  cache.clear();
}

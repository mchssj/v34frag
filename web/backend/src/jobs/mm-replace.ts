// Avisos de reemplazo del matchmaking en Discord (plan docs/bitacora/2026-11-04-mm-reemplazos, replanteo 75). Los publica el
// worker del matchmaking en cada vuelta: mm_replace_pending() dice qué mensaje publicar o editar y mm_replace_mark() guarda
// cómo quedó. Mismo webhook y mismo rol que el aviso de la cola (Daniel, 2026-11-05). El aviso no lleva nombres de jugadores.

export type ReplaceShown = 'open' | 'found' | 'closed';

export type ReplaceNotice = {
  id: string;
  shown: ReplaceShown;
  message_id: string | null;
  token: string | null;
  mode: string;
  map: string | null;
  expires_at: string;
  score: { a: number; b: number } | null;
};

export type ReplaceConfig = { hook?: string; role?: string; frontendUrl: string };

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
export type ReplaceRpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

/** "5v5 en de_dust2 (7-5)": el markdown escapado (el _ de los mapas) y sin menciones (lo pone la base, pero se limpia igual). */
function matchLine(n: ReplaceNotice) {
  const clean = (s: string) => s.replace(/[@#:<]/g, '').slice(0, 40).replace(/[\\*_~`|>]/g, '\\$&');
  const map = n.map ? ` en ${clean(n.map)}` : '';
  const score = n.score ? ` (${n.score.a}-${n.score.b})` : '';
  return `${clean(n.mode)}${map}${score}`;
}

/** El link de la página del reemplazo en la web. */
export function replaceLink(frontendUrl: string, token: string) {
  return `${frontendUrl.replace(/\/+$/, '')}/mm/reemplazo/${encodeURIComponent(token)}`;
}

/** El texto del mensaje en cada estado. Solo el abierto menciona al rol; al editarlo, el link desaparece. */
export function replaceText(n: ReplaceNotice, cfg: ReplaceConfig) {
  const what = matchLine(n);
  if (n.shown === 'open') {
    const unix = Math.floor(Date.parse(n.expires_at) / 1000);
    return [
      `${cfg.role ? `<@&${cfg.role}> ` : ''}**Se busca reemplazo** para un mix del matchmaking: ${what}.`,
      `Entra acá: ${replaceLink(cfg.frontendUrl, n.token ?? '')}`,
      `El primero que entre se lo queda. El link vence <t:${unix}:R>.`,
    ].join('\n');
  }
  if (n.shown === 'found') return `~~Se busca reemplazo~~ **Reemplazo encontrado** para el mix de ${what}.`;
  return `~~Se busca reemplazo~~ El pedido de reemplazo para el mix de ${what} se cerró.`;
}

type Fetch = typeof fetch;

/**
 * Publica o edita los avisos pendientes. Devuelve cuántos tocó. Un aviso que Discord rechaza suma un intento (la base deja de
 * reintentarlo a los 5). Sin webhook configurado no hace nada: los pedidos siguen abiertos igual.
 */
export async function runReplaceNotices(rpc: ReplaceRpc, cfg: ReplaceConfig, fetchImpl: Fetch = fetch): Promise<number> {
  if (!cfg.hook) return 0;
  const { data, error } = await rpc('mm_replace_pending');
  if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
  const list = (Array.isArray(data) ? data : []) as ReplaceNotice[];
  let done = 0;
  for (const n of list) {
    if (!n.message_id && (n.shown !== 'open' || !n.token)) continue;
    const content = replaceText(n, cfg);
    // Al editar no se vuelve a mencionar a nadie.
    const allowed_mentions = { parse: [], roles: n.message_id || !cfg.role ? [] : [cfg.role] };
    const res = await fetchImpl(n.message_id ? `${cfg.hook}/messages/${n.message_id}` : `${cfg.hook}?wait=true`, {
      method: n.message_id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions }),
    }).catch(() => null);
    let messageId: string | null = n.message_id;
    if (res?.ok && !n.message_id) {
      const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
      messageId = typeof body?.id === 'string' ? body.id : null;
    }
    const ok = Boolean(res?.ok) && messageId !== null;
    const mark = await rpc('mm_replace_mark', { p_id: n.id, p_shown: n.shown, p_message_id: messageId, p_ok: ok });
    if (mark.error) throw new Error(`${mark.error.code ?? ''} ${mark.error.message}`.trim());
    if (ok) done++;
  }
  return done;
}

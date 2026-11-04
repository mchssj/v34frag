// Notificaciones programadas (plan docs/bitacora/2026-10-29-notificaciones-programadas): partida o PCW en 1 hora, PCW
// vencida sin rival, temporada por terminar, partida de torneo sin resultado y VIP por vencer. Todo lo decide
// notify_due() en la base (replanteo 35); acá solo se la llama y se resume lo que mandó.

/** Cuántos avisos mandó de cada tipo. */
export type NotifyDueResult = Record<string, number>;

type Rpc = (fn: 'notify_due') => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;

/** Llama a notify_due() con un cliente de la clave de servicio. Tira el error de la base si falla. */
export async function runNotifyDue(rpc: Rpc): Promise<NotifyDueResult> {
  const { data, error } = await rpc('notify_due');
  if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
  if (typeof data !== 'object' || data === null) throw new Error('notify_due no devolvió un resumen');
  return data as NotifyDueResult;
}

/** "match_soon 2, vip_expiring 1", o null si no mandó nada (para no llenar el log cada 10 minutos). */
export function summary(r: NotifyDueResult): string | null {
  const parts = Object.entries(r)
    .filter(([, n]) => typeof n === 'number' && n > 0)
    .map(([k, n]) => `${k} ${n}`);
  return parts.length ? parts.join(', ') : null;
}

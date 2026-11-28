// Retención del anticheat (plan docs/bitacora/2026-10-30-anticheat-integridad): borra las sesiones vencidas con sus capturas.
// Primero los archivos: si eso falla, la sesión sigue y se reintenta. Las de un caso abierto (held) no vencen.

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
export type RetentionDb = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
  removeFiles: (paths: string[]) => PromiseLike<{ error: { message: string } | null }>;
};

const must = (r: RpcResult) => {
  if (r.error) throw new Error(`${r.error.code ?? ''} ${r.error.message}`.trim());
  return r.data;
};

/**
 * Capturas vencidas (replanteo 157: 7 días, Kyan 2026-11-27), aunque la sesión siga dentro de su plazo. Las de una sesión
 * conservada no vencen. La fila queda, marcada, para la cadena de integridad. Devuelve cuántas borró.
 */
export async function runScreenshotRetention(db: RetentionDb): Promise<number> {
  let purged = 0;
  for (let round = 0; round < 20; round++) {
    const due = must(await db.rpc('ac_screenshot_retention_due', { p_limit: 500 })) as { id: string; storage_path: string }[];
    if (!due.length) break;
    const { error } = await db.removeFiles(due.map((d) => d.storage_path));
    if (error) throw new Error(`Storage: ${error.message}`);
    purged += must(await db.rpc('ac_screenshot_purged', { p_ids: due.map((d) => d.id) })) as number;
    if (due.length < 500) break;
  }
  return purged;
}

/** Devuelve cuántas sesiones borró. */
export async function runRetention(db: RetentionDb): Promise<number> {
  const due = must(await db.rpc('ac_retention_due')) as { sessions: string[] };
  let deleted = 0;
  for (const id of due.sessions) {
    const paths = must(await db.rpc('ac_retention_paths', { p_session: id })) as string[];
    if (paths.length) {
      const { error } = await db.removeFiles(paths);
      if (error) throw new Error(`Storage: ${error.message}`);
    }
    if (must(await db.rpc('ac_retention_delete', { p_session: id }))) deleted++;
  }
  return deleted;
}

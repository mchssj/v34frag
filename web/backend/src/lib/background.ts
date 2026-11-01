import type { Context } from 'hono';
import { logError } from './errors';
import type { AppEnv } from './types';

/**
 * Corre una tarea sin demorar la respuesta (por ejemplo, actualizar last_seen).
 * En Workers usa waitUntil para que no se corte; en Node la promesa sigue sola.
 * Si falla, solo se registra: nunca afecta al request.
 */
export function inBackground(c: Context<AppEnv>, task: Promise<unknown>): void {
  const safe = task.catch((e) => logError(c, e));
  try {
    c.executionCtx.waitUntil(safe);
  } catch {
    // Node: no hay ExecutionContext.
  }
}

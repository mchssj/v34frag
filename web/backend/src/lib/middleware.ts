import type { MiddlewareHandler } from 'hono';
import { ConfigError, loadConfig } from '../env';
import { AppError, logError } from './errors';
import type { AppEnv } from './types';

// Valida la configuración en el primer request y la deja en c.var.config.
export const withConfig: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    c.set('config', loadConfig(c.env ?? {}));
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    logError(c, e);
    throw new AppError(500, 'CONFIG_INVALID', 'El servidor está mal configurado.');
  }
  await next();
};

// Una línea JSON por request. Nunca el cuerpo ni el header Authorization.
export const requestLog: MiddlewareHandler<AppEnv> = async (c, next) => {
  const start = performance.now();
  await next();
  if (c.var.config?.APP_ENV === 'test') return;
  console.log(
    JSON.stringify({
      level: 'info',
      requestId: c.get('requestId'),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - start),
    }),
  );
};

import { OpenAPIHono } from '@hono/zod-openapi';
import { validationError } from './errors';
import type { AppEnv } from './types';

// Todas las rutas se crean con esto: el hook de validación es por instancia, no se hereda al montar.
export const createRouter = () =>
  new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) throw validationError(result.error);
    },
  });

import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { isAllowedOrigin } from './lib/cors';
import { errorBody, onError } from './lib/errors';
import { requestLog, withConfig } from './lib/middleware';
import { MemoryRateLimiter, type RateLimiter } from './lib/ratelimit';
import { createRouter } from './lib/router';
import { account } from './routes/account';
import { adminDemos } from './routes/admin-demos';
import { adminPlayers } from './routes/admin-players';
import { adminServers } from './routes/admin-servers';
import { adminTeams } from './routes/admin-teams';
import { auth } from './routes/auth';
import { claim } from './routes/claim';
import { elo } from './routes/elo';
import { events } from './routes/events';
import { live } from './routes/live';
import { matches } from './routes/matches';
import { me } from './routes/me';
import { pcw } from './routes/pcw';
import { pcwPlay } from './routes/pcw-play';
import { players } from './routes/players';
import { roster } from './routes/roster';
import { system } from './routes/system';
import { teams } from './routes/teams';

// Mensajes de validación en español para el frontend.
z.config(z.locales.es());

export type AppOptions = {
  // Por defecto, contador en memoria del proceso (en Workers se usa el binding si existe).
  rateLimiter?: RateLimiter;
};

export function createApp(options: AppOptions = {}) {
  const app = createRouter();
  const rateLimiter = options.rateLimiter ?? new MemoryRateLimiter();

  app.use('*', requestId());
  app.use('*', withConfig);
  app.use('*', async (c, next) => {
    c.set('rateLimiter', rateLimiter);
    await next();
  });
  app.use('*', requestLog);
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: (origin, c) => (isAllowedOrigin(origin, c.var.config.corsOrigins) ? origin : null),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'If-None-Match'],
      exposeHeaders: ['X-Request-Id', 'ETag', 'Retry-After'],
      maxAge: 600,
    }),
  );

  app.route('/', system);
  app.route('/', auth);
  app.route('/', me);
  app.route('/', pcw);
  app.route('/', account);
  app.route('/', claim); // antes que players: /players/unclaimed no es un {id}
  app.route('/', players);
  app.route('/', teams);
  app.route('/', roster);
  app.route('/', adminPlayers);
  app.route('/', adminTeams);
  app.route('/', adminServers);
  app.route('/', adminDemos);
  app.route('/', elo);
  app.route('/', matches);
  app.route('/', live);
  app.route('/', events);
  app.route('/', pcwPlay);

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'El `access_token` que devuelve `POST /auth/login`.',
  });
  app.doc31('/api/openapi.json', (c) => ({
    openapi: '3.1.0',
    info: {
      title: 'v34frag API',
      version: c.var.config.GIT_SHA,
      description:
        'API de la web v34frag. Errores: `{ error: { code, message, details?, requestId } }`. ' +
        'Rutas con sesión: header `Authorization: Bearer <access_token>`.',
    },
    servers: [{ url: new URL(c.req.url).origin }],
  }));
  app.get('/api/docs', Scalar({ url: '/api/openapi.json', pageTitle: 'v34frag API' }));
  app.get('/', (c) => c.redirect('/api/docs'));

  app.notFound((c) => c.json(errorBody(c, 'NOT_FOUND', `No existe la ruta ${c.req.method} ${c.req.path}.`), 404));
  app.onError(onError);

  return app;
}

export type App = ReturnType<typeof createApp>;

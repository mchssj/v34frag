// Entrada de Node (pnpm dev:node, y dist/server.mjs en el VPS). La misma app que en Workers, servida con @hono/node-server.
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { nodeUdp } from './lib/udp-node';

// En el VPS las variables las pone systemd (/etc/cmleague/api.env): no se busca .dev.vars.
if (process.env.APP_ENV !== 'production') {
  try {
    process.loadEnvFile('.dev.vars');
  } catch {
    // Sin .dev.vars: se usan las variables del entorno.
  }
}

// El build (scripts/build.mjs) reemplaza BUILD_SHA por el commit, así /api/health dice qué versión corre.
const env = { ...process.env, GIT_SHA: process.env.GIT_SHA || process.env.BUILD_SHA || 'dev' };
const app = createApp({ udp: nodeUdp });
const port = Number(process.env.PORT ?? 8787);
// HOST=127.0.0.1 en el VPS: solo Caddy llega a la API. Sin HOST, todas las interfaces (como antes).
const hostname = process.env.HOST || undefined;

const server = serve({ fetch: (req) => app.fetch(req, env), port, hostname }, (info) => {
  console.log(`v34frag-api ${env.GIT_SHA} (Node ${process.versions.node}) en http://${hostname ?? 'localhost'}:${info.port}/api/docs`);
});

// Reinicio ordenado: deja de aceptar conexiones y termina los pedidos en curso. systemd espera hasta 20 s.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    console.log(`${signal}: cerrando`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 15_000).unref();
  });
}

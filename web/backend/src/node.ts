// Entrada de Node (npm run dev:node). La misma app que en Workers, servida con @hono/node-server.
import { serve } from '@hono/node-server';
import { createApp } from './app';

try {
  process.loadEnvFile('.dev.vars');
} catch {
  // Sin .dev.vars: se usan las variables del entorno.
}

const app = createApp();
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: (req) => app.fetch(req, process.env), port }, (info) => {
  console.log(`v34frag-api (Node ${process.versions.node}) en http://localhost:${info.port}/api/docs`);
});

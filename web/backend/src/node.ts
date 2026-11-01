// Entrada de Node (pnpm dev:node, y dist/server.mjs en el VPS). La misma app que en Workers, servida con @hono/node-server.
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { createApp } from './app';
import { createClient } from '@supabase/supabase-js';
import { createMmHub, listenMm } from './mm/socket';
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

// Socket del matchmaking: solo en Node. El token se valida con Supabase Auth, y sin MM_LISTEN_URL queda apagado
// (el frontend sigue con el polling de respaldo).
const authClient = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_ANON_KEY ?? 'x', { auth: { persistSession: false, autoRefreshToken: false } });
const hub = createMmHub(async (token) => {
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as { exp?: number };
  return { id: data.user.id, exp: payload.exp };
});
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
app.get('/api/v1/mm/ws', upgradeWebSocket(() => {
  let conn: ReturnType<typeof hub.open> = null;
  return {
    onOpen: (_e, ws) => { conn = hub.open(ws); },
    onMessage: (e) => { if (conn) void hub.message(conn, String(e.data)); },
    onClose: () => { if (conn) hub.closed(conn); },
  };
}));
const stopListen = process.env.MM_LISTEN_URL ? await listenMm(process.env.MM_LISTEN_URL, hub).catch((e: Error) => {
  console.error(`mm: no se pudo escuchar: ${e.message}`);
  return null;
}) : null;

const server = serve({ fetch: (req) => app.fetch(req, env), port, hostname }, (info) => {
  console.log(`v34frag-api ${env.GIT_SHA} (Node ${process.versions.node}) en http://${hostname ?? 'localhost'}:${info.port}/api/docs`);
});
injectWebSocket(server);

// Reinicio ordenado: deja de aceptar conexiones y termina los pedidos en curso. systemd espera hasta 20 s.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    console.log(`${signal}: cerrando`);
    hub.shutdown();
    void stopListen?.();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 15_000).unref();
  });
}

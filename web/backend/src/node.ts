// Entrada de Node (pnpm dev:node, y dist/server.mjs en el VPS). La misma app que en Workers, servida con @hono/node-server.
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { Hono } from 'hono';
import { createApp } from './app';
import { createClient } from '@supabase/supabase-js';
import { createMmHub, listenMm, mmSql, sqlPresence } from './mm/socket';
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
// Un pedido del estado liviano cuenta como presencia en la cola (replanteo 63): la web sin socket sigue buscando.
const app = createApp({ udp: nodeUdp, mmPolled: (user) => hub.polled(user) });
const port = Number(process.env.PORT ?? 8787);
// HOST=127.0.0.1 en el VPS: solo Caddy llega a la API. Sin HOST, todas las interfaces (como antes).
const hostname = process.env.HOST || undefined;

// Socket del matchmaking: solo en Node. El token se valida con Supabase Auth, y sin MM_LISTEN_URL queda apagado
// (el frontend sigue con el polling de respaldo).
const authClient = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_ANON_KEY ?? 'x', { auth: { persistSession: false, autoRefreshToken: false } });
const mmDb = process.env.MM_LISTEN_URL ? mmSql(process.env.MM_LISTEN_URL) : null;
const hub = createMmHub(async (token) => {
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as { exp?: number };
  return { id: data.user.id, exp: payload.exp };
}, mmDb ? sqlPresence(mmDb) : undefined);
// App aparte: los middlewares de la API (secureHeaders) escriben cabeceras y la respuesta 101 no las admite.
const wsApp = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app: wsApp });
wsApp.get('/api/v1/mm/ws', upgradeWebSocket(() => {
  let conn: ReturnType<typeof hub.open> = null;
  return {
    onOpen: (_e, ws) => { conn = hub.open(ws); },
    onMessage: (e) => { if (conn) void hub.message(conn, String(e.data)); },
    onClose: () => { if (conn) hub.closed(conn); },
  };
}));
const stopListen = mmDb ? await listenMm(mmDb, hub).catch((e: Error) => {
  console.error(`mm: no se pudo escuchar: ${e.message}`);
  return null;
}) : null;

// Red de seguridad de la cola (replanteo 63): cada 15 s, después de dar 30 s para que todos se reconecten al arrancar.
let sweepTimer: ReturnType<typeof setInterval> | undefined;
const sweepStart = mmDb
  ? setTimeout(() => {
      sweepTimer = setInterval(() => void hub.sweep(), 15_000);
    }, 30_000)
  : undefined;

const server = serve({ fetch: (req) => app.fetch(req, env), port, hostname }, (info) => {
  console.log(`v34frag-api ${env.GIT_SHA} (Node ${process.versions.node}) en http://${hostname ?? 'localhost'}:${info.port}/api/docs`);
});
injectWebSocket(server);

// Reinicio ordenado: deja de aceptar conexiones y termina los pedidos en curso. systemd espera hasta 20 s.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    console.log(`${signal}: cerrando`);
    clearTimeout(sweepStart);
    clearInterval(sweepTimer);
    hub.shutdown();
    void stopListen?.();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 15_000).unref();
  });
}

#!/usr/bin/env node
// Prueba de humo contra una API levantada: node scripts/smoke.mjs <url-base>
//   Local:    crea una cuenta descartable con /auth/signup (la Supabase local no pide confirmar el email).
//   Remoto:   usa una cuenta de prueba existente: SMOKE_EMAIL y SMOKE_PASSWORD. Nunca crea cuentas fuera de localhost.
// Sale con código 1 si algo falla.
const base = (process.argv[2] ?? 'http://localhost:8787').replace(/\/+$/, '');
const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);

let fallas = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const mal = (msg) => {
  fallas++;
  console.log(`  FALLA ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : mal(msg));

async function call(method, path, { body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

console.log(`Humo contra ${base}`);

const health = await call('GET', '/api/health?deep=1');
check(health.status === 200 && health.data?.status === 'ok', `health 200 (env=${health.data?.env}, version=${health.data?.version})`);
check(health.data?.supabase === 'ok', 'health llega a Supabase');
check(Boolean(health.headers.get('x-request-id')), 'devuelve X-Request-Id');

const doc = await call('GET', '/api/openapi.json');
check(doc.status === 200 && doc.data?.openapi === '3.1.0', `openapi.json (${Object.keys(doc.data?.paths ?? {}).length} rutas)`);
check((await call('GET', '/api/docs')).status === 200, '/api/docs');

let email = process.env.SMOKE_EMAIL;
let password = process.env.SMOKE_PASSWORD;
if (!email) {
  if (!local) {
    mal('faltan SMOKE_EMAIL y SMOKE_PASSWORD para probar el login fuera de localhost');
    process.exit(1);
  }
  email = `smoke-${Date.now()}@test.local`;
  password = 'humo-clave-123';
  const s = await call('POST', '/auth/signup', { body: { email, password, tag: 'Humo' } });
  check(s.status === 201, `signup de una cuenta descartable (${s.status})`);
}

const login = await call('POST', '/auth/login', { body: { email, password } });
check(login.status === 200 && login.data?.access_token, `login (${login.status})`);
const token = login.data?.access_token;

if (token) {
  const me = await call('GET', '/auth/me', { token });
  check(me.status === 200 && me.data?.email === email, `auth/me (${me.status})`);
  const prof = await call('GET', '/api/v1/me/profile', { token });
  check(prof.status === 200 && prof.data?.user?.id === me.data?.id, `me/profile (${prof.status})`);
  const out = await call('POST', '/auth/logout', { token });
  check(out.status === 204, `logout (${out.status})`);
  const again = await call('POST', '/auth/refresh', { body: { refresh_token: login.data.refresh_token } });
  check(again.status === 401, `el refresh_token deja de servir tras el logout (${again.status})`);
}

const bad = await call('POST', '/auth/login', { body: { email, password: 'equivocada' } });
check(bad.status === 401 && bad.data?.error?.code === 'INVALID_CREDENTIALS', 'login con contraseña equivocada → 401');

console.log(fallas ? `\n${fallas} falla(s).` : '\nTodo ok.');
process.exit(fallas ? 1 : 0);

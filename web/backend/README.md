# v34frag API (`web/backend`)

API REST de la web v34frag: **Node 24 + Hono + TypeScript**, sobre Supabase (Auth, PostgREST, Storage). El mismo código corre en Node (destino principal: un VPS) y en Cloudflare Workers (alternativa).

- Plan y decisiones: [`docs/bitacora/2026-10-14-backend-base-auth-perfil/`](../../docs/bitacora/2026-10-14-backend-base-auth-perfil/)
- Contrato para el frontend: `GET /api/openapi.json` y la documentación interactiva en `GET /api/docs`.

## Requisitos

- **Node 24** (`.nvmrc`). Con nvm: `nvm use`.
- **Docker Desktop** corriendo, para la Supabase local de las pruebas.

## Arrancar en local

```bash
cd web/backend
npm ci
cp .dev.vars.example .dev.vars   # apunta a la Supabase LOCAL
npm run db:start                 # Supabase en Docker con el esquema real (la primera vez baja las imágenes)
npm run dev:node                 # Node:    http://localhost:8787/api/docs
# o
npm run dev                      # Workers: http://localhost:8787/api/docs (wrangler / workerd)
```

Studio de la base local: http://127.0.0.1:54323. Correos de Auth (confirmaciones): http://127.0.0.1:54324.

## Scripts

| Script | Qué hace |
|---|---|
| `dev:node` / `dev` | Levanta la API con Node (recarga al guardar) o con el runtime de Workers |
| `typecheck` | `tsc` con los tipos de Workers (`tsconfig.json`) y con los de Node (`tsconfig.node.json`) |
| `test` | Pruebas unitarias (sin red) |
| `test:int` | Pruebas de integración contra la Supabase local (requiere `db:start`) |
| `test:coverage` | Las dos suites con cobertura. Falla si alguna métrica queda por debajo del **60 %**. Reporte HTML en `coverage/` |
| `test:coverage:unit` | Cobertura solo con las unitarias (sin Docker, para el CI) |
| `smoke` | Humo contra una API levantada: `npm run smoke -- http://localhost:8787`. Fuera de localhost pide `SMOKE_EMAIL` y `SMOKE_PASSWORD` de una cuenta de prueba |
| `db:start` / `db:stop` / `db:reset` | Supabase local: levantar, apagar, o borrar y recargar el esquema |
| `db:types` | Regenera `src/db/types.ts` desde la base local (después de cambiar el esquema) |
| `deploy` / `deploy:preview` | Solo para la alternativa de Workers |

## Estructura

```
src/
├── app.ts            createApp(): middlewares, rutas, OpenAPI, /api/docs, errores
├── node.ts           entrada de Node (@hono/node-server, lee .dev.vars)
├── worker.ts         entrada de Cloudflare Workers
├── env.ts            configuración validada con zod
├── db/types.ts       tipos de la base (generados, no editar a mano)
├── lib/              auth, errores, CORS, límite de intentos, Supabase, uploads, router
├── schemas/          esquemas zod = contrato OpenAPI (common, auth, profile)
├── services/         lógica compartida entre rutas
└── routes/           un archivo por dominio (system, auth, me)
test/
├── unit/             sin red: Supabase simulado con fetch falso
└── integration/      contra la Supabase local (usuarios reales, RLS reales)
```

## Cómo agregar un endpoint

1. **Esquemas** en `src/schemas/<dominio>.ts` con `z` de `@hono/zod-openapi` y `.openapi('Nombre')` para que aparezcan como componentes en la OpenAPI.
2. **Ruta** en `src/routes/<dominio>.ts`:

   ```ts
   const getAlgo = createRoute({
     method: 'get',
     path: '/api/v1/algo/{id}',
     tags: ['Algo'],
     summary: 'Qué hace, en una línea',
     security: bearer,                         // si pide sesión
     middleware: [requireUser] as const,       // y requireAdmin si es de admin
     request: { params: z.object({ id: z.uuid() }) },
     responses: { 200: { description: 'OK', ...json(Algo) }, ...errorResponses(401, 404) },
   });

   export const algo = createRouter().openapi(getAlgo, async (c) => {
     const { id } = c.req.valid('param');
     const { data, error } = await c.var.sb.from('tabla').select('...').eq('id', id).maybeSingle();
     if (error) throw fromPostgrest(error);
     if (!data) throw new AppError(404, 'NOT_FOUND', 'No existe.');
     return c.json(data, 200);
   });
   ```

3. **Montarla** en `src/app.ts`: `app.route('/', algo)`.
4. **Pruebas**: el caso feliz, entrada inválida (400), sin sesión (401) y sin permiso (403) en `test/integration/`; la lógica pura y los errores raros en `test/unit/`.

Reglas:

- Crear los routers siempre con `createRouter()`: trae el hook que convierte los errores de zod en `400 VALIDATION_ERROR`.
- Errores con `throw new AppError(status, code, mensaje)`. Los de Supabase se traducen con `fromPostgrest` (base de datos) o `fromAuthError` (Auth). Nunca devolver el mensaje crudo de la base.
- `c.var.sb` actúa **como el usuario**: las RLS aplican. No usar la `service_role` sin un plan que lo justifique.
- Tareas que no deben demorar la respuesta: `inBackground(c, promesa)`.
- Rutas públicas: `/api/v1/...`. Login: `/auth/...`.

## Formato de errores

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Los datos enviados no son válidos.", "details": [{ "path": "tag", "message": "..." }], "requestId": "..." } }
```

Códigos: `VALIDATION_ERROR` (400), `BUSINESS_RULE` (400, mensaje de una función SQL), `INVALID_FILE` (400), `UNAUTHORIZED` (401), `INVALID_CREDENTIALS` (401), `FORBIDDEN` (403), `EMAIL_NOT_CONFIRMED` (403), `NOT_FOUND` (404), `CONFLICT` (409), `FILE_TOO_LARGE` (413), `RATE_LIMITED` (429, con `Retry-After`), `CONFIG_INVALID` y `INTERNAL` (500). El `requestId` también viene en el header `X-Request-Id` y aparece en los logs.

## Configuración

| Variable | Ejemplo | Para qué |
|---|---|---|
| `APP_ENV` | `production` | `development`, `test`, `preview` o `production` |
| `SUPABASE_URL` | `https://wmzfwsizashpszxlvpeb.supabase.co` | |
| `SUPABASE_ANON_KEY` | clave pública | La misma de `config.js` |
| `CORS_ORIGINS` | `https://tudominio.com,http://localhost:*` | Orígenes permitidos; `*` como subdominio o puerto |
| `FRONTEND_URL` | `https://tudominio.com` | A dónde lleva el link del correo de confirmación |
| `CLIENT_IP_HEADER` | `x-forwarded-for` | Header confiable con la IP del cliente (lo pone el proxy). Vacío en local |
| `GIT_SHA` | `04270ae` | Versión que muestra `/api/health` |
| `PORT` | `8787` | Solo Node |

En Node se leen de `.dev.vars` (si existe) o del entorno. En Workers, de `wrangler.toml` y los secretos.

## Esquema de la base

`supabase/schema/` (en la raíz del repo) tiene el esquema real volcado. Si cambia la base de producción:

```bash
supabase/schema/volcar.sh <última migración aplicada en producción>   # desde la raíz, usa las PG_* del .env
cd web/backend && npm run db:reset && npm run db:types
```

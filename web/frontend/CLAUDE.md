# CLAUDE.md — frontend (`web/frontend`)

Frontend nuevo de v34frag: SPA con Vite + React 19 + TypeScript. Reemplaza al `index.html` de la raíz del repo, que sigue en producción hasta el corte. Habla **solo con la API** de `web/backend` (nunca con Supabase directo).

## Reglas

- **Alcance:** cuando se trabaja en el frontend, solo se modifica `web/frontend/` y la bitácora (abajo). Todo lo demás (`web/backend`, `supabase/`, `server/`, `cloudflare/`, el resto de `docs/`, el `index.html` viejo) **solo se lee y se consulta**. Si el backend necesita un cambio, se anota como pendiente para el equipo de backend.
- **Bitácora:** todo plan que se apruebe se anota en `docs/bitacora/AAAA-MM-DD-nombre-corto/` siguiendo `docs/bitacora/PLANTILLA.md`: `PLAN.md` (el plan aprobado, no se edita después), `DOCUMENTACION.md` y `GUIA_IMPLEMENTACION.md` al terminar, y una fila en `docs/bitacora/README.md`. Ejemplo: `docs/bitacora/2026-10-15-frontend-auth/`.
- **Comentarios:** siempre en español, cortos y solo cuando ayudan a entender algo que no es obvio (una regla de negocio, una decisión de seguridad, un caso borde). Nada de comentarios largos, ni en inglés, ni que repitan lo que el código ya dice.
- **No se editan a mano:** `src/api/schema.d.ts` (`pnpm gen:api`), `src/routeTree.gen.ts` (lo genera el plugin del router) ni `src/components/ui/*` salvo ajustes puntuales (los agrega `shadcn add`).
- **Errores de la API:** se decide qué mostrar según `error.code`, nunca según el texto. Ver `src/api/errors.ts`.
- **Seguridad:** los tokens nunca van en URLs, logs ni mensajes de error. Nada de `dangerouslySetInnerHTML`. Toda redirección que venga de la URL pasa por `safeRedirect`.

## Comandos

Node 24 y pnpm 11 (fijados con mise en `CSSTV/.mise.toml`, fuera del repo).

```bash
pnpm install
pnpm dev          # http://localhost:5173 (necesita VITE_API_URL en .env.local)
pnpm build        # typecheck + build
pnpm test         # Vitest (una vez); pnpm test:watch para modo watch
pnpm lint
pnpm typecheck
pnpm gen:api      # regenera src/api/schema.d.ts desde la API local (http://localhost:8787)
```

`pnpm gen:api` necesita la API corriendo (`web/backend`, `pnpm dev:node`). Para generar desde un archivo: `pnpm exec openapi-typescript <ruta>/openapi.json -o src/api/schema.d.ts`.

La política de dependencias es la misma que la del backend (`pnpm-workspace.yaml`): solo versiones publicadas hace al menos 7 días y `trustPolicy: no-downgrade`.

## Stack

| Pieza | Uso |
|---|---|
| TanStack Router | Rutas por archivo en `src/routes/`; guardas en `beforeLoad` |
| TanStack Query | Datos del servidor (`/auth/me`, perfil…) y mutaciones |
| Zustand | Solo la sesión (tokens y "Recordarme"), en `src/auth/tokenStore.ts` |
| openapi-fetch + openapi-typescript | Cliente tipado desde la OpenAPI del backend |
| react-hook-form + zod | Formularios |
| shadcn/ui (Radix, preset `b3PBYm`) + Tailwind 4 | Componentes y estilos |
| Vitest + Testing Library | Pruebas |

## Estructura

```
src/
  api/        schema.d.ts (generado), client.ts (openapi-fetch + authFetch), errors.ts (ApiError y mensajes)
  auth/       tokenStore, refresh, authFetch, queries, guards, AuthSync, schemas, callback, redirect
  features/   componentes por dominio (auth/, profile/)
  lib/        env.ts (VITE_API_URL validada), image.ts (recorte del avatar)
  routes/     una ruta por archivo; _auth = páginas sin sesión, _app = con sesión, _admin = rol admin
  test/       setup y utilidades de prueba
```

## Sesión (resumen)

- Tokens Bearer: access de 1 hora y refresh **de un solo uso**. `expires_at` llega en segundos Unix y se guarda en milisegundos.
- "Recordarme" marcado: localStorage. Sin marcar: sessionStorage. Clave `csstv.session`.
- Las pestañas se sincronizan por `BroadcastChannel('csstv:auth')`. Un aviso de revocación solo cierra la sesión de una pestaña si tiene el mismo refresh token.
- La renovación es única: una promesa por pestaña y `navigator.locks` entre pestañas (`src/auth/refresh.ts`).
- `authFetch` renueva antes de que venza, reintenta una vez tras un 401 y, si la renovación falla, reintenta una vez sin `Authorization` (las rutas públicas siguen funcionando).
- El usuario vive en Query (`['auth','me']`), no en Zustand.

## Pendientes

- **Backend desactualizado:** la rama `feat/backend-api-fase-1` del remoto todavía no tiene lo nuevo del contrato (`docs/contrato-api.md`): `GET /api/v1/aliases/{alias}/available`, alias único, `PUT /me/alias`, rol `organizer`, equipos, torneos, etc. Cuando se suba: rebase de esta rama y `pnpm gen:api`. Lo provisorio está marcado con `// Provisorio:`.
- **Confirmación de email:** el backend manda el link a `FRONTEND_URL` y Supabase vuelve con los tokens en el fragmento de la URL (flujo implicit). El frontend los descarta y pide iniciar sesión (`src/auth/callback.ts`). Falta definir con el backend una página de destino propia y la recuperación de contraseña.
- **Mejora de la sesión:** pasar el refresh token a una cookie `httpOnly; Secure; SameSite=Strict` del dominio de la API (cambio en el backend). El cambio en el frontend queda aislado en `tokenStore` y `refresh`.
- **Despliegue (VPS):** configurar una cabecera CSP con `connect-src` limitado a `api.<dominio>`.

# Auth del frontend nuevo: guía de implementación

## Estado

Implementado el 2026-10-16 en la rama `feat/frontend-fase-1` (rebase sobre `origin/feat/backend-api-fase-1`), **sin desplegar**. Typecheck, lint, build y 82 pruebas automáticas en verde. **Todavía no se probó contra la API levantada** (ver "Pruebas").

## Archivos

| Archivo | Cambio |
|---|---|
| `web/` → `web/frontend/` | El frontend se movió para convivir con `web/backend` |
| `web/frontend/CLAUDE.md` | Nuevo: reglas (alcance, comentarios en español), comandos, stack, estructura y pendientes |
| `web/frontend/docs/contrato-api.md` | Nuevo: copia del contrato del backend del 2026-10-15 |
| `web/frontend/.env.example` | Nuevo: `VITE_API_URL` |
| `web/frontend/.gitattributes` | Nuevo: LF siempre (Prettier usa `endOfLine: lf`) |
| `web/frontend/pnpm-workspace.yaml` | Misma política que el backend: `minimumReleaseAge` de 7 días y `trustPolicy: no-downgrade` |
| `web/frontend/package.json` | Dependencias nuevas; scripts `test`, `test:watch`, `gen:api`; `typecheck` pasa a `tsc -b` |
| `web/frontend/vitest.config.ts`, `src/test/*` | Nuevos: configuración y utilidades de prueba |
| `web/frontend/src/api/*` | Nuevos: `schema.d.ts` (generado), `client.ts`, `errors.ts` |
| `web/frontend/src/auth/*` | Nuevos: `tokenStore`, `refresh`, `authFetch`, `queries`, `guards`, `AuthSync`, `redirect`, `callback`, `schemas`, `roles` |
| `web/frontend/src/features/auth/*`, `src/features/profile/*` | Nuevos: formularios, pasos opcionales, esquemas y mutaciones del perfil |
| `web/frontend/src/lib/*` | Nuevos: `env.ts`, `image.ts`, `useDebouncedValue.ts` |
| `web/frontend/src/components/RouteError.tsx` | Nuevo: pantalla de error de ruta con Reintentar |
| `web/frontend/src/components/ui/*` | Componentes de shadcn agregados; `sonner` usa el `ThemeProvider` propio |
| `web/frontend/src/routes/*` | Landing, `_auth` (ingresar, registro, confirmar), `_app` (panel, completar perfil), `_admin` |
| `web/frontend/src/main.tsx` | Router con contexto de Query y limpieza del link de confirmación antes de crearlo |

## Despliegue

No se desplegó. Para levantarlo en local:

```bash
# API (otra terminal): ver web/backend/README.md
cd web/backend && pnpm install --frozen-lockfile && pnpm db:start && pnpm dev:node   # http://localhost:8787

# Frontend
cd web/frontend
cp .env.example .env.local        # VITE_API_URL=http://localhost:8787
pnpm install
pnpm gen:api                      # regenera los tipos desde la API local
pnpm dev                          # http://localhost:5173
```

La configuración local del backend (`.dev.vars.example`) ya permite `http://localhost:*` en CORS y usa `FRONTEND_URL=http://localhost:5173`.

## Pruebas

### Automáticas (`pnpm test`, Vitest)

82 pruebas en 9 archivos, todas en verde el 2026-10-16:

| Archivo | Qué cubre |
|---|---|
| `auth/tokenStore.test.ts` | Conversión de `expires_at`, persistencia según "Recordarme", login y logout entre pestañas, saludo de una pestaña nueva, revocación con token distinto e igual |
| `auth/refresh.test.ts` | Diez renovaciones simultáneas → una llamada; token ya renovado por otra pestaña → ninguna llamada; 401 cierra la sesión; error de red la conserva; **carrera en el modo sin recordarme** (B recibe 401 con el token viejo y termina con la sesión de A, y A conserva la suya) |
| `auth/authFetch.test.ts` | Bearer, rutas sin token, un solo reintento con el mismo cuerpo, sin bucle, reintento sin `Authorization` tras renovación fallida, logout sin reintento, renovación anticipada, renovación compartida entre peticiones |
| `api/errors.test.ts` | Lectura del formato de error, `Retry-After`, mensajes por `code`, `applyFieldErrors` |
| `auth/redirect.test.ts` | Rutas internas válidas y once intentos de redirección abierta |
| `auth/callback.test.ts` | Link de confirmación con tokens, con error, PKCE, otros tipos y URL normal |
| `auth/guards.test.ts` | Redirección sin sesión, **sin redirección con la API caída o un 500**, `requireGuest`, `ForbiddenError` |
| `features/auth/LoginForm.test.tsx` | Validación local, credenciales incorrectas, login correcto, "Recordarme" desmarcado, límite de intentos |
| `features/auth/SignupForm.test.tsx` | Registro con y sin confirmación, alias tomado en vivo, `409` en `tag`, email ya registrado, validación local |

Las pruebas usan mocks de `BroadcastChannel` y `navigator.locks` (`src/test/fakes.ts`) que simulan varias pestañas con storages separados y entrega asíncrona, y MSW para la API en los formularios.

### Contra la API real

**No se hizo todavía.** Necesita la Supabase local en Docker (`pnpm db:start` del backend). Queda pendiente la lista de verificación del plan: registro con alias libre y tomado, login correcto e incorrecto, recarga, token vencido, dos pestañas en los dos modos, sesión que muere en una página pública, API apagada, 403 en `/admin` y `redirect` malicioso.

## En qué se apartó del plan

1. **Backend detrás del contrato.** La rama remota (`59561b6`) solo tiene Auth y Mi perfil: no tiene `GET /api/v1/aliases/{alias}/available`, el alias único ni el rol `organizer`. Con la aprobación del usuario se siguió con lo disponible:
   - la rama del frontend se rebaseó sobre `origin/feat/backend-api-fase-1`;
   - `schema.d.ts` se generó exportando una copia del backend al scratchpad y pidiéndole `/api/openapi.json` a la app con variables de prueba, sin tocar `web/backend`;
   - la disponibilidad del alias usa `fetch` directo y trata un 404 como "sin verificar", y `Role` agrega `organizer` a mano. Los dos están marcados `// Provisorio:` y se reemplazan con `pnpm gen:api` cuando se suba el backend nuevo.
2. **Política de dependencias** (no estaba en el plan): se adoptó la del backend. El scaffold había instalado versiones de menos de 7 días, así que se bajaron a las más nuevas permitidas. `semver@6.3.1` quedó excluido de `trustPolicy` por ser un falso positivo conocido. MSW quedó en la versión 2 por compatibilidad con Vitest.
3. **`typecheck`** corría `tsc --noEmit` sobre el tsconfig raíz, que no incluye archivos, y no revisaba nada. Pasó a `tsc -b`.
4. **`lastChange` en el `tokenStore`** (`local`, `remote`, `expired`): sin esto, `AuthSync` re-ejecutaba las guardas al hacer login o registro y competía con la navegación del formulario (el registro terminaba en `/` en vez de `/completar-perfil`).
5. **`authFetch`** también renueva antes del logout si el token está por vencer, para que el servidor revoque el refresh token. Si la renovación anticipada ocurrió y la petición igual da 401, no renueva de nuevo.
6. **`safeRedirect`** además rechaza cualquier `\`, los caracteres de control y las rutas que se normalizan a `//…` (por ejemplo `/..//evil.com`).
7. **Link de confirmación del email:** el plan lo dejaba fuera de alcance. Se agregó la limpieza de la URL (`callback.ts`) porque, sin eso, los tokens que manda Supabase quedaban visibles en la barra y en el historial. La página de destino propia sigue pendiente con el backend.
8. **Componentes de shadcn:** `spinner` y `separator` en lugar de `progress`. `sonner` se conectó al `ThemeProvider` propio y se quitó `next-themes`.
9. **Setup de pruebas:** `cleanup()` de Testing Library después de cada prueba (sin *globals* de Vitest no es automático) y un *stub* de `ResizeObserver`, que jsdom no implementa porque no calcula *layout* y que Radix usa en Checkbox y Select. Es solo para pruebas: en el navegador `ResizeObserver` es nativo.
10. **Copia del contrato** en `web/frontend/docs/contrato-api.md`, hasta que el backend lo suba a `docs/frontend/`.

## Cómo revertir

Los cambios están en la rama `feat/frontend-fase-1`, sin merge. Para deshacerlos, se revierten los commits de esta fase (`git revert <commit>`) o se descarta la rama. No hay migraciones ni cambios en el backend ni en producción.

# Auth del frontend nuevo: guía de implementación

## Estado

Implementado y **probado de punta a punta contra la API real** el 2026-10-16, en la rama `feat/frontend-fase-1` (rebase sobre `origin/feat/backend-api-fase-1` al `0c0b433`), **sin desplegar**. Typecheck, lint y build en verde; 83 pruebas unitarias y 15 de punta a punta con Playwright, todas en verde.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/` → `web/frontend/` | El frontend se movió para convivir con `web/backend` |
| `web/frontend/CLAUDE.md` | Nuevo: reglas (alcance, comentarios en español), comandos, stack, estructura y pendientes |
| `web/frontend/e2e/*`, `playwright.config.ts`, `tsconfig.e2e.json` | Nuevos: pruebas de punta a punta con Playwright |
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

83 pruebas en 9 archivos, todas en verde el 2026-10-16:

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

### De punta a punta (`pnpm test:e2e`, Playwright)

El 2026-10-16, contra la API del backend (`0e56b8b`) con la Supabase local en Docker y el esquema real (replanteo 01 a 12), en Chromium. 15 pruebas en verde en una sola corrida (26 s), que cubren toda la lista de verificación del plan:

| Prueba | Resultado |
|---|---|
| Landing de visitante sin esperas | ✔ |
| Link de confirmación: los tokens no quedan en la URL y avisa "cuenta confirmada" | ✔ |
| Sesión muerta en una página pública: la landing sigue como visitante y se borra la sesión | ✔ |
| Alias tomado avisado mientras se escribe (sin distinguir mayúsculas) | ✔ |
| Registro completo con datos personales, redes y avatar (verificado después en `GET /api/v1/me/profile`) | ✔ |
| Login incorrecto y después `redirect=//evil.com` → termina en `/` | ✔ |
| Ruta protegida → login → vuelve; la recarga mantiene la sesión; el logout la cierra y revoca el refresh token | ✔ |
| Dos pestañas con Recordarme: el logout en una cierra la otra | ✔ |
| Sin Recordarme: otra pestaña recibe la sesión por `BroadcastChannel`; al reabrir el navegador se pierde | ✔ |
| Token vencido: se renueva sin que se note (cambia el refresh token) | ✔ |
| Con Recordarme, la sesión sigue al reabrir el navegador | ✔ |
| Usuario común en `/admin` → 403 | ✔ |
| API caída con sesión: "No se pudo conectar", sin mandar al login | ✔ |
| Página de cuenta con sesión → sale al inicio | ✔ |

La suite respeta el límite real de la API (10 intentos de login o registro por minuto): corre en serie, gasta 9 y comparte una cuenta creada por la API para las pruebas que solo necesitan una sesión.

También se verificó por HTTP: CORS desde `localhost:5173` (con `Retry-After` y `X-Request-Id` expuestos), los `code` de error, el `409` con `details[0].path = "tag"` para un alias repetido, y la rotación del refresh token.

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
10. **Contrato:** durante la implementación se usó una copia local; cuando el backend subió `docs/frontend/contract.md` se borró la copia y el CLAUDE.md apunta al original.
11. **Backend actualizado el 2026-10-16:** el equipo subió 29 commits (jugadores, equipos, partidas, torneos, PCW, paginación, admin de servidores). Se hizo rebase de la rama sobre `0e56b8b` (único conflicto: la tabla del índice de la bitácora) y `pnpm gen:api` desde la API levantada. Con eso se quitó todo lo provisorio: la disponibilidad del alias usa `api.GET` con el tipo `AliasAvailability` y `Role` sale del schema (`user`, `organizer`, `admin`). No hubo cambios que rompieran lo implementado.
12. **Pruebas de punta a punta con Playwright** (no estaban en el plan, que preveía una verificación manual): `e2e/`, `playwright.config.ts` y `tsconfig.e2e.json`, para que la verificación quede automatizada y se pueda repetir.

13. **Segundo rebase el 2026-10-16** sobre `0c0b433` (18 commits más: ajustes de ELO, configuración del ELO, demos, `!claim` y la entrega del frontend del 16/10), sin conflictos. Tipos regenerados; no se rompió nada. Según la entrega, el aviso del registro ahora explica que el SteamID se vincula con `!claim` (antes decía que lo vinculaba un admin).
14. **Copia de producción en la base local** (autorizada por el equipo de backend el 2026-10-16): mismo procedimiento que el ensayo del ELO (`docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/`). `pg_dump --data-only` de solo lectura (todo `public` y `auth.users`) a `~/.v34frag/prod-copy/`, fuera del repo; carga sobre el esquema de producción con `session_replication_role = replica` y replanteo 01 a 15 encima. Resultado: 40 cuentas, 72 jugadores, 17 equipos (89 miembros), 19 partidas y 41 ELO. Se usó el `pg_dump` del contenedor local (no hay uno instalado en esta máquina) y el usuario del pooler `postgres.<ref>` (el `PG_USER` del `.env` de la raíz es `postgres` y el pooler lo rechaza). Producción no se modificó. Las 15 pruebas de punta a punta pasan también con estos datos.
15. **Tercer rebase el 2026-10-19** sobre `5b1c934` (17 commits más: mixes en vivo, grupos de doble eliminación y sorteo, `preferences.theme_fx`, plugin 2.2.0 con `!claim`, estado de los servidores, cambio de contraseña y "mis partidas").
    - **Conflictos:** solo en la tabla del índice de la bitácora (las dos ramas sumaron filas), resuelto conservando todas en orden de fecha. Respaldo previo en la rama local `backup/frontend-pre-rebase-2026-10-19` y en un stash.
    - **Tipos regenerados:** solo se rompió `CompetitionSection`, que necesitaba el nombre de la plantilla nueva `groups_double` ("Grupos de doble eliminación + playoffs").
    - **Base local recargada:** los replanteos 04, 06 y 10 cambiaron y hay una migración nueva (`20261017120000`). Como cada replanteo aborta si se aplica dos veces, se recargó todo: esquema de producción, copia de producción, replanteo 01 a 19 y `local-overrides.sql`. Antes se guardó un respaldo de los datos locales en `~/.v34frag/`, fuera del repo, y se recuperó de ahí la contraseña local de prueba de KilluaZ.
    - **Límite de logins en las e2e:** la suite gasta unos 12 logins y registros, y la API deja 10 por minuto en una ventana fija. Pasaba o fallaba según cómo cayeran en la ventana, y con la API recién levantada falló dos veces seguidas. Ahora `e2e/authBudget.ts` (`spendAuth`) espera antes de cada login o registro hasta que en los últimos 61 s haya menos de 10; si ningún tramo de 60 s pasa de 10, tampoco lo pasa ninguna ventana fija. La espera no cuenta para el tiempo máximo de la prueba. Dos corridas seguidas: 38 de 38.
    - **Verificación:** typecheck, lint, 145 pruebas unitarias y 38 e2e en verde.
16. **Cuarto rebase el 2026-10-19** sobre `897668b` (6 commits más: ping, modo, región y mixes en vivo en el estado de los servidores; desvincular un SteamID con aprobación, elegir el principal y la fecha de cada SteamID; plugins `csstv_sell` y `csstv_calladmin`).
    - **Conflictos:** solo en la tabla del índice de la bitácora, otra vez. Se ordenó por fecha y se quitó una fila que quedaba repetida. Respaldo en la rama `backup/frontend-pre-rebase-2026-10-19b` y en un stash.
    - **Base local:** los replanteos `20_servidores_modo_region.sql` y `21_steam_desvincular.sql` son nuevos y no se cambió ninguno anterior, así que se aplicaron encima, sin recargar. Antes, un respaldo de los datos locales en `~/.v34frag/`.
    - **Tipos regenerados:**
      - cada SteamID de `GET /me/claim-code` suma `added_at` y `unlink_pending`; se actualizaron los datos de prueba;
      - `GET /me/steam-requests` ahora mezcla pedidos de SteamID adicional (`kind: add`) y de desvincular (`kind: remove`); la lista de pendientes de Vinculación filtra `kind: "add"`, porque si no, un pedido de desvincular aparecería como una cuenta pendiente.
    - **Verificación:** typecheck, lint, 174 pruebas unitarias y 39 e2e en verde.
17. **Quinto rebase el 2026-10-22** sobre `3b9ccbc` (4 commits más: cancelar el pedido de desvincular, fecha del último cambio de contraseña, arreglo del 500 con sesión cerrada, y `!whois` con los consejos del plugin 2.4.0).
    - **Conflictos:** solo el índice de la bitácora. Se quitó una fila vieja de `!sell` que venía en el stash. Respaldo en la rama `backup/frontend-pre-rebase-2026-10-20` y en un stash.
    - **Base local:** las migraciones `20261019180000_whois` y `20261020120000_whois_menu` (solo funciones) y los replanteos 22 y 23 se aplicaron encima, en el orden de la recarga completa, sin errores. Respaldo previo en `~/.v34frag/`.
    - **Tipos regenerados:**
      - `AuthUser` suma `password_changed_at`; se actualizó un dato de prueba;
      - suma `DELETE /api/v1/me/steam/{steamid}/unlink` y el estado `cancelled` en los pedidos.
    - **Bug del 500, resuelto:** el backend trata `AuthSessionMissingError` como `401`. Verificado contra la API local: con el token de una sesión cerrada, `/auth/me` responde `401`.
    - **Verificación:** typecheck, lint, 183 pruebas unitarias y 40 e2e en verde.
18. **Sexto rebase el 2026-10-24** sobre `0a6e1bb` (26 commits más: temporadas con medallas y reinicio del nivel 10, ajustes manuales de ELO, clips automáticos con video y publicación en Discord, HUD de observer, política de privacidad y ajustes del servidor).
    - **Conflictos:** ninguno; el stash volvió sin tocar el índice. Respaldo en la rama `backup/frontend-pre-rebase-2026-10-24`.
    - **Base local:** las migraciones `20261023120000_clips` (sin transacción propia, así que se aplicó con `psql -1`), `20261023180000_clips_video` y `20261024120000_clips_discord`, y los replanteos 24, 25 y 26, encima y en el orden de la recarga completa, sin errores. Respaldo previo en `~/.v34frag/`.
    - **Tipos regenerados:** suman temporadas, clips y ajustes de ELO, sin romper nada del frontend.
    - **Cambio del contrato que rompe:** se borraron `POST /admin/elo/recompute` y `/simulate`. El frontend no los usa.
    - **`CLIPS_BASE_URL`:** variable nueva y opcional del backend; no hace falta en local.
    - **Verificación:** typecheck, lint, 186 pruebas unitarias y 40 e2e en verde.

## Pendientes para el backend

- Ninguno abierto. La aclaración del refresh token (rota pero no es estrictamente de un solo uso) ya está en el contrato desde el 2026-10-16; el frontend ya guardaba siempre el último.

## Incidentes durante las pruebas

- **Exportar el backend con `git archive` en Windows:** con `core.autocrlf=true`, `git archive` convierte los archivos a CRLF y la migración 04 del replanteo fallaba (busca un texto exacto dentro de una función). Se resolvió exportando con `git -c core.autocrlf=false archive`; los archivos quedan idénticos al repo. No es un problema del backend.
- **Rutas largas en Windows:** la CLI de Supabase no arrancaba desde la copia en el scratchpad porque la ruta pasaba los 260 caracteres. Se usó un *junction* con una ruta corta y el binario directo. No le pasa a quien trabaja en `web/backend`.
- **Servidor de desarrollo después de cada rebase:** Vite queda con módulos que no encuentra mientras git mueve los archivos. Se resuelve reiniciándolo (pasó en los dos rebases; en el tercero se reinició antes de probar).
- **`19_listado_servidor.sql` viene con CRLF** en el commit del backend (los demás replanteos están en LF). A psql no le afecta, porque el CR es espacio en blanco, y se cargó tal cual. Conviene avisarle al backend para que lo normalice.

## Cómo revertir

Los cambios están en la rama `feat/frontend-fase-1`, sin merge. Para deshacerlos, se revierten los commits de esta fase (`git revert <commit>`) o se descarta la rama. No hay migraciones ni cambios en el backend ni en producción.

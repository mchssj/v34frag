# Vinculación con varios SteamID, cambio de contraseña y efectos de tema en la cuenta: guía de implementación

## Estado

Implementado y probado en local (2026-10-19) en la rama `feat/frontend-fase-1`, contra el backend del rebase del 2026-10-19 (`5b1c934`). Sin commit y sin desplegar.

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/features/profile/sections/LinkSection.tsx` | `PlayerCard` reemplazada por "Cuentas de juego" (vinculadas, pendientes, vacío, límite, código y detección del `!claim`) |
| `src/features/profile/accounts.ts` + `.test.ts` | Nuevo: `gameAccounts` y `claimOutcome` |
| `src/features/profile/sections/PasswordCard.tsx` + `.test.tsx` | Nuevo: tarjeta "Contraseña" |
| `src/features/profile/password.ts` + `.test.ts` | Nuevo: `passwordScore` y `passwordFeedback` |
| `src/features/profile/sections/AccountSection.tsx` | Suma `PasswordCard` arriba de los datos de la cuenta |
| `src/features/profile/sections/LinkSection.test.tsx` | Nuevo: vacío, vinculadas y pendientes, límite y sondeo (vinculada y rechazada) |
| `src/features/profile/queries.ts` | `useChangePassword` |
| `src/features/onboarding/queries.ts` | `mySteamRequestsOptions` (clave `["claim", "requests"]`) |
| `src/auth/queries.ts` | Exporta `missingSession` (lo usa también el cambio de contraseña) |
| `src/api/errors.ts` | Códigos `WRONG_PASSWORD`, `SAME_PASSWORD` y `NOT_AVAILABLE`, con sus mensajes |
| `src/features/profile/sections/PreferencesSection.tsx` | Guarda `preferences.theme_fx` en la cuenta; vuelve atrás si falla |
| `src/features/theme-fx/useSyncThemeFx.ts` | Nuevo: lleva el valor de la cuenta al navegador |
| `src/features/theme-fx/pref.ts` | `setThemeFxPref(null)` borra la preferencia; sin el TODO |
| `src/routes/_app.tsx` | Usa `useSyncThemeFx` |
| `e2e/profile.spec.ts` | Vinculación nueva con "Copiar"; prueba nueva de contraseña y sincronización de efectos; Preferencias comprueba la cuenta; la sesión inyectada se pone una sola vez por pestaña |

## Despliegue

No se desplegó.

## Pruebas

### Unitarias y de componente (Vitest)

174 en verde (antes 145). Las nuevas cubren:
- **`password.test.ts`:** puntaje, etiquetas, igual a la actual, coinciden o no, errores al guardar y rechazos del backend;
- **`accounts.test.ts`:** vacío, orden, pendientes, tope de la API y los tres resultados de `claimOutcome`;
- **`LinkSection.test.tsx`** (MSW): estados de la tarjeta, botones deshabilitados y el sondeo con relojes simulados (`!claim` vinculado y rechazado);
- **`PasswordCard.test.tsx`** (MSW): errores sin llamar a la API, el ojo, `WRONG_PASSWORD` en el campo y el éxito, que guarda la sesión nueva.

### De punta a punta (Playwright, contra la API real)

39 en verde (antes 38):
- **Vinculación:** estado vacío, "0 de 3", generar código, la caja con el vencimiento, "Generar otro código" y "Copiar", comprobando el portapapeles.
- **Contraseña** (nueva):
  - la actual incorrecta muestra el error y el cambio funciona;
  - el refresh token viejo queda rechazado (`401`) y la pestaña sigue conectada al recargar;
  - después de cerrar sesión, el login con la contraseña nueva entra;
  - en la misma prueba: la cuenta tenía "Sin sonido" guardado y, al entrar con el navegador sin preferencia, queda `silent`.
- **Preferencias:** además del navegador, comprueba `preferences.theme_fx` con `GET /me/profile`.
- **Vincular de verdad** necesita el servidor del juego: lo cubren las pruebas de componente.

### Visual

Capturas en claro y oscuro, a 1280 px, de Vinculación (vacía y con 2 vinculadas y 1 pendiente, con datos simulados en el navegador) y de Cuenta con el formulario abierto. Se compararon con las medidas y los textos del handoff: el prototipo suelto no carga estilos ni un rol, porque se abre desde el `Landing.dc.html` del proyecto principal.

**Desborde horizontal:** ninguno en 320 ni en 390 px.

## En qué se apartó del plan

- **Resultado del `!claim`:** el plan decía tostar según si el SteamID estaba en `steam_ids`. Al leer `claim_with_code` (replanteo 15) se vio que el código queda usado también cuando el comando falla. Se sumó el tercer caso, error con el mensaje del servidor, que el handoff pide igual ("Si se escribe `!claim` desde un SteamID que ya está en otra cuenta web").
- **Códigos de error nuevos:** `WRONG_PASSWORD` y `SAME_PASSWORD` no estaban en `api/errors.ts` y se iban a convertir en `VALIDATION_ERROR`; se sumaron junto con `NOT_AVAILABLE`, que también es nuevo en el backend.
- **Ninguno más.**

## Cambios posteriores

- **Meta de las cuentas vinculadas (2026-10-19, pedido de Esteban):** sin las partidas; solo "Vinculada {mes año}". Mientras la API no mande la fecha, la fila dice "Vinculada —" (decisión de Esteban). La prueba de componente lo comprueba.
- **Peticiones dobles en desarrollo (2026-10-19, pedido de Esteban):** medidas con Playwright y CDP en el Home, en desarrollo y en el build de producción. Cada endpoint tiene un solo `GET` real. Lo demás es:
  - la **preflight de CORS** (`OPTIONS`, 204, sin cuerpo), porque la API está en otro origen y la petición lleva `Authorization`; el backend la deja cachear 10 minutos (`Access-Control-Max-Age: 600`), salvo con "Disable cache" tildado en DevTools;
  - en desarrollo, un **`GET` cancelado** por `StrictMode` (monta, desmonta y vuelve a montar; TanStack Query cancela la primera con la `signal` y la repite). En producción no aparece.
  No hay nada que corregir.

## Ampliación (2026-10-19): vinculación completa y servidores reales

Con el backend del cuarto rebase (`897668b`). Plan aprobado por Esteban, con sus imágenes de cómo se ve desvincular y estas decisiones:
- **"Cancelar solicitud":** deshabilitado con "Próximamente", porque no hay endpoint;
- **Motivo:** "¿Por qué?" opcional en la confirmación;
- **Columna Ping:** pasa a "Latencia", con tooltip;
- **Datos reales:** el pill del hero y la IP de la Bienvenida.

### Vinculación

- **Fecha:** "Vinculada ago 2026" sale de `added_at`, o "Fecha desconocida" si es `null` (`gameAccounts` en `accounts.ts`).
- **Hacer principal:** `useMakePrimary`, con `POST /api/v1/me/steam/{steamid}/primary`. El éxito muestra el toast "Cuenta principal actualizada"; el rechazo, el mensaje del backend (por ejemplo, el límite de 24 horas).
- **Desvincular:** confirmación inline con "Un admin tiene que aprobar la desvinculación", el motivo opcional (hasta 200 caracteres), "Cancelar" y "Enviar solicitud".
  - Usa `useRequestUnlink`, con `POST …/unlink`; sin motivo no se manda la clave.
  - Hay una sola confirmación abierta a la vez.
  - **El único SteamID no tiene "Desvincular":** el backend no lo permite.
- **Pedido en revisión** (`unlink_pending`): badge naranja "Desvinculación en revisión", sin los otros botones, y "Cancelar solicitud" deshabilitado.
- **Desvío del plan:** las dos mutaciones van en `features/onboarding/queries.ts`, junto a las de `!claim`, y no en `profile/queries.ts`. Allí armaban una importación circular, porque `onboarding/queries` ya importa de `profile/queries`.

### Servidores

- **Consulta:** `serverStatusOptions` (`features/public/queries.ts`), con `GET /servers/status`, `staleTime` de 20 s y refresco cada 30 s. La comparten la sección, el pill del hero y la Bienvenida, así que es una sola petición.
- **Tabla:**
  - subtítulo con modo traducido (`SERVER_MODE`), región e IP; si no entra en una línea, la IP baja entera, porque es el botón de copiar;
  - jugadores con su barra, o "—";
  - columna "Latencia" con tooltip;
  - "Offline" sin respuesta y sin "Conectar" si no hay IP;
  - filas de carga y una línea de error con "Reintentar".
- **KPIs y pill del hero:** `totals.online/servers`, `totals.players` y `totals.live_matches`. El badge "Partidas" del sidebar sigue con `liveCountOptions`.
- **Bienvenida:** el `connect` usa `claimServer` (uno de mix en línea; si no hay, cualquiera en línea con IP). Si no hay ninguno, dice "Entra a un servidor de CSSTV cuando haya uno en línea."
- **`config/site.ts`:** se borraron `SERVERS`, `GameServer` y `CLAIM_SERVER`. Queda solo Discord.

### Pruebas

183 unitarias y 40 e2e en verde.
- **Nuevas de componente:** fechas, el único SteamID, hacer principal (éxito y rechazo), desvincular con motivo (y cancelar sin mandar nada) y el pedido en revisión.
- **Unitarias:** `claimServer` y los modos.
- **e2e nueva:** servidores y pill del hero con `/servers/status` simulado (modo, región, latencia, "Offline", copiar IP).
- **e2e de registro:** simula el estado de los servidores y comprueba que el `connect` elige el de mix. Antes comprobaba la IP fija.

**Capturas:** claro y oscuro, comparadas con las imágenes de Esteban. Sin desborde en 320 ni en 390 px.

## Ampliación (2026-10-22): cancelar el pedido de desvincular y último cambio de contraseña

Con el backend del quinto rebase (`3b9ccbc`), a pedido de Esteban.

- **"Cancelar solicitud" funciona:**
  - usa `useCancelUnlink` (`features/onboarding/queries.ts`), con `DELETE /api/v1/me/steam/{steamid}/unlink`;
  - éxito: el toast "Solicitud cancelada", y al recargar el estado la cuenta vuelve a la normalidad, con sus botones;
  - error: el mensaje del backend, por ejemplo si un admin ya resolvió el pedido;
  - se borró `SoonButton`, que ya no tenía uso: Vinculación no tiene más acciones sin backend.
- **"Último cambio hace X"** en la tarjeta Contraseña:
  - `passwordChangedText` (`features/profile/password.ts`) arma el texto desde `password_changed_at` de `/auth/me`: "hace un momento" el primer minuto, después el tiempo relativo ("hace 3 días", "ayer");
  - sin fecha no se muestra, porque solo se guarda desde el 2026-10-19;
  - después de cambiarla aparece enseguida, porque la sesión nueva que devuelve `POST /me/password` ya trae la fecha (verificado contra la API local).
- **Pruebas:** 186 unitarias y 40 e2e en verde.
  - La prueba de componente del pedido en revisión ahora cancela de verdad (`DELETE` y toast) y comprueba que vuelve "Desvincular".
  - Las de `passwordChangedText` cubren sin fecha, "hace un momento" y "hace 3 días".
  - La e2e de contraseña comprueba que una cuenta nueva no muestra la línea y que, después del cambio, dice "Último cambio hace un momento".

## Incidentes durante las pruebas

- **`/auth/me` responde 500 con una sesión cerrada (bug del backend).**
  - **Causa:** con el token de una sesión que el cambio de contraseña cerró, Auth responde `403 session_not_found`. supabase-js lo convierte en `AuthSessionMissingError` (status 400, sin código), y `fromAuthError` (`web/backend/src/lib/errors.ts`) termina en `500 INTERNAL`.
  - **Efecto:** el otro dispositivo ve "Algo salió mal" en lugar de volver al login. Se vio en la e2e cuando la prueba reinyectaba la sesión vieja.
  - **Arreglo:** va en el backend, que tiene que tratar `AuthSessionMissingError` como `401`. El frontend no lo parcha.
  - **Resuelto el 2026-10-22:** el backend lo arregló así (`fromAuthError`) y se verificó contra la API local.
- **La e2e reinyectaba la sesión vieja:** el `addInitScript` de `signedUpUser` volvía a poner la sesión del registro en cada carga y pisaba la que guardó la app. Ahora se inyecta una sola vez por pestaña, con una marca en `sessionStorage`.
- **Docker estaba apagado** al retomar la sesión: se abrió Docker Desktop y se levantó la base con `db-local.sh start`, que no recarga nada si ya tiene el esquema. Los datos seguían ahí.

## Pedidos al backend

1. ~~Hacer principal y desvincular.~~ **Resuelto** el 2026-10-19 (`POST /me/steam/{steamid}/primary` y `/unlink`).
2. ~~Fecha de vínculo por SteamID.~~ **Resuelto** el 2026-10-19 (`added_at`).
3. ~~Cancelar mi pedido de desvincular.~~ **Resuelto** el 2026-10-22 (`DELETE /me/steam/{steamid}/unlink`).
4. ~~`password_changed_at` en `/auth/me`.~~ **Resuelto** el 2026-10-22.
5. Recuperar la contraseña (`forgot-password` / `reset-password`), cuando esté el envío de correos.
6. ~~**Bug:** `/auth/me` con una sesión cerrada responde `500`.~~ **Resuelto** el 2026-10-22 (ver Incidentes).

## Cómo revertir

Todavía no hay commit: alcanza con descartar los cambios de los archivos de arriba. No hay cambios en el backend ni en la base.

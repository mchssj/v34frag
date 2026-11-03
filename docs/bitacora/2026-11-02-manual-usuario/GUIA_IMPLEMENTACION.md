# Manual de usuario por rol: guía de implementación

## Estado

**En curso (2026-11-02), sin commit ni despliegue.** Aprobado por Daniel el 2026-11-02, con el cambio de que el manual lo sirva la API, solo con sesión y filtrado por rol.

| Paso del plan | Estado |
|---|---|
| 1. La regla en `PLANTILLA.md`, `CLAUDE.md` y `docs/manual/README.md` | Hecho |
| 2. La API | Hecho: typecheck limpio y 436 pruebas unitarias en verde (12 nuevas en `manual.test.ts`) |
| 3. La web | Hecho: typecheck y lint limpios, 514 pruebas en verde (15 nuevas) |
| 4. Jugador | Textos hechos (2026-11-03): las 9 páginas del plan, sin capturas. Ver "Las páginas de Jugador" |
| 5. Capitán y organizador | Textos hechos (2026-11-03): Capitán 5 (2 ocultas por PCW), Organizador 5 |
| 6. Moderador y admin | Textos hechos (2026-11-03): Moderador 4 (1 oculta por PCW), Admin 9 |
| 7. Streamer y servidor externo | Textos hechos (2026-11-03): 2 y 3 |
| 8. Links "¿Cómo funciona?" | Pendiente |
| 9. Repaso de Daniel y despliegue | Pendiente. Ninguna página tiene capturas todavía |

## Las páginas de Jugador (2026-11-03)

| Orden | Página | Comprobado en |
|---|---|---|
| 1 | `crear-cuenta` | `RegisterFlow`, `WelcomeFlow`, `ProfileSection`, `PrivacySection` y `auth/schemas.ts` (contraseña de 8, alias de 2 a 24, cambio cada 15 días en `me.ts`) |
| 2 | `vincular-steamid` | (de antes) |
| 3 | `buscar-partida` | (de antes) |
| 4 | `jugar-en-el-servidor` | Comandos registrados en los `.sp` y `csstv/*.inc`, `csstv_reporter.cfg` y `live_mm.cfg` (pausas 2 × 60 s, `!tech` 120 s, pausa automática 120 s, `!gg` con 8 rondas y todos menos uno, prórroga MR3 con 12000, cuchillo con 60 s) y `maps.inc` (sin `!rtv` con sala) |
| 5 | `elo-y-estadisticas` | Staging: `elo_apply_match` (solo `kind = 'mix'`), `elo_weight` (35 % y 90 %), `mm_elo_delta` y `mm_config` (abandono: derrota completa más 5; `!gg` con abandono, 50 %), `mm_elo_stake`, `elo_level`, `season_reset_elo`. No se citan base ni bonus: el admin los cambia |
| 6 | `clips-y-demos` | Staging: `clip_config` (10 por partida, 2 por jugador, tipos); `Highlights.tsx`, `MixRoom.tsx`, `RoomOverview.tsx`; demos 90 días (`demo_expire(90)`) |
| 7 | `equipo` | Staging: `team_create`, `team_invite`, `team_request_join`, `team_leave`, `team_can_join`, `team_config` (10 miembros, capitán de 1), `team_invites.expires_at` (7 días); `CreateTeam`, `FindTeam`, `NoTeam`, `TeamView` |
| 8 | `notificaciones` | `NotificationsMenu`, `NotificationPrefsCard`; staging: `notification_wants` (Novedades apagada por defecto), `notification_required` (invitación, pedido, cambio de contraseña y acción de la moderación), tope de 100 |
| 9 | `baneos-y-sanciones` | `PlayFeed` (Mis sanciones), `ReportDialog` y `labels.ts`, `BanDialog`, `ReportsPanel` (exclusión de 1 a 90 días); staging: `mm_block_reason` |

## Las demás secciones (2026-11-03)

37 páginas en total; las 3 de PCW con `oculta: true`. Probado con la API local contra staging: `daniloev` (usuario) recibe Jugador 9, Capitán 3, Streamer 2 y Servidor externo 3; `adminprueba` (admin), además, Organizador 5, Moderador 3 y Admin 9.

| Sección | Páginas | Comprobado en |
|---|---|---|
| Capitán | `armar-plantel`, `inscribir-torneo`, `jugar-partida-torneo`, `jugar-pcw` (oculta), `sanciones-pcw` (oculta) | `Roster`, `InviteDrawer`, `Recruit`, `JoinRequests`, `TeamLogo` (`EditTeamSheet`), `RegisterDialog`, `EventView`, `ServerPanel`; staging: `team_invite`, `team_kick`, `team_rename`, `team_set_member_role`, `event_register`, `event_unregister`; bitácora `2026-11-02-iniciar-torneo-pcw` (reservas, espera, abandono, cfg por tipo de partida) |
| Organizador | `crear-torneo`, `inscripciones-y-fixture`, `iniciar-partida`, `espera-wo-y-cuatro`, `resultados-y-llave` | `EventForm`, `ManageTabs`, `SeedingTab`, `MatchSheet`, `VetoTurnCard` (15 a 120 s), `ServerPanel` (esperas 5, 10, 15 y 20 min; "con 4", "Esperar 5 min más", "Cancelar el inicio", "Liberar el servidor"), `auth/permissions.ts` |
| Moderador | `banear-jugador`, `moderar-equipos`, `sanciones-pcw` (oculta), más `sanciones-matchmaking` (de antes) | `BanDialog`, `BanPanel`, `AdminBansPage`, `TeamPanel`, `AdminTeamsPage`, `PcwBansTab`; replanteo `43` (qué hace el moderador y qué el admin) |
| Admin | `servidores`, `elo-y-mixes`, `matchmaking`, `reportes-matchmaking`, `temporadas`, `mapas-y-ranking-equipos`, `usuarios-y-fichas`, `clips`, `equipos` | Las páginas de `features/admin/*` y `features/matchmaking/admin/*` |
| Streamer | `hud-obs`, `panel-y-retraso` | `HudCard`, `StreamerSection`, `hud/relay/public/control.html` y `control.js`; bitácoras `2026-10-29-frontend-hud` y `2026-11-01-hud-retraso-por-servidor` |
| Servidor externo | `sumar-servidor`, `configuracion-obligatoria`, `demos-y-clips` | `CLAUDE.md` (configuración obligatoria y despliegue), bitácoras `2026-10-13-licencia-servidores` y `2026-10-28-demos-servidores-externos`, `PENDIENTES.md` 1.27 |

**Para revisar con Daniel (de estas secciones):**

- **Los reportes del matchmaking son solo del admin en la web:** están en Administración › Matchmaking, que el moderador no ve (`canAccessAdminSection`). La página quedó en Admin (`admin/reportes-matchmaking`), y Jugador y Moderador dicen "la moderación" en lugar de "un moderador". Si los moderadores tienen que resolver reportes, hay que abrirles esa pestaña.
- **"Reprocesar" un clip no está en la web nueva:** Administración › Clips dice que se usa "Reprocesar" en la jugada, dentro de la partida, pero ese botón no existe fuera de Administración. `admin/clips` no lo menciona.
- **El capitán no puede cambiar el nombre ni la sigla de su equipo:** "Editar equipo" solo cambia el logo y dice "pídeselo a un admin", aunque la base (`team_rename`) deja al capitán una vez cada 30 días. El manual sigue a la web.
- **Servidor externo** es visible para todas las cuentas: no lleva IPs, claves ni nombres de servidores; solo lo que el dueño necesita saber para pedirlo.

**Lo que se dejó afuera a propósito:**

- **Los clips extra de los VIP:** el VIP no está en la web nueva (queda en `kyan/pruebas`).
- **PCW:** la categoría de notificaciones existe, pero PCW sigue en "Pronto".
- **Cambiar la privacidad:** la web todavía no deja; la página dice que se le pide a un admin.

**Para revisar con Daniel:**

- `baneos-y-sanciones` cuenta que el baneo de la web impide entrar a los servidores. Hoy solo bloquea el matchmaking: el plugin `csstv_bans` todavía no existe (`PENDIENTES.md`). Si no sale con el corte, esa línea se ajusta.
- Los mensajes de `mm_block_reason` y de las funciones de equipos están en voseo ("Tenés", "Confirmá") y la web en tuteo. El manual usa tuteo.
- `PhotoStep` dice que el nombre real lo ven solo los admins y los capitanes, y Privacidad dice que con perfil público lo ve cualquiera. El manual no repite ninguna de las dos.

## Ramas

| Parte | Rama | Carpeta |
|---|---|---|
| Manual, web, regla y bitácora | `feat/frontend-fase-1` | `E:\Css V34 Web\v34frag` |
| API | `feat/mm-claim-en-sala` (la línea que se despliega en staging) | worktree `E:\Css V34 Web\v34frag-mmclaim` |

En esas dos carpetas también hay cambios sin commit que no son de este requerimiento: `match.inc` y la inversa de la `56` en `v34frag-mmclaim`; `PlayBar.tsx`, `demo.ts`, `source.ts` y `types.ts` del matchmaking en `v34frag` (de otra sesión). No se tocaron.

## Archivos

| Archivo | Cambio |
|---|---|
| `docs/manual/README.md` | Nuevo: secciones, formato, estilo, links, capturas y cómo se mantiene |
| `docs/manual/jugador/vincular-steamid.md` y `buscar-partida.md` | Nuevas |
| `docs/bitacora/PLANTILLA.md` | `DOCUMENTACION.md` suma "Qué cambia para cada rol" (obligatoria) |
| `CLAUDE.md` | Convención "Manual de usuario" |
| `web/backend/src/lib/manual.ts` | Nuevo: secciones, visibilidad por rol, encabezado, validación, índice |
| `web/backend/src/lib/manual-node.ts` | Nuevo: lee la carpeta del disco (solo Node; fuera del `tsconfig.json` del Worker) |
| `web/backend/src/routes/manual.ts` | Nuevo: las tres rutas |
| `web/backend/src/app.ts`, `lib/types.ts` | `AppOptions.manual` y `c.var.manual` |
| `web/backend/src/lib/auth.ts` | `userRole` exportada |
| `web/backend/src/node.ts` | Carga el manual al arrancar y loguea páginas, capturas y errores |
| `web/backend/scripts/build.mjs` | Valida el manual (`MANUAL_DIR` o `../../docs/manual`) y lo copia a `dist/manual`. Sin carpeta, solo avisa |
| `web/backend/tsconfig.json` | Excluye `manual-node.ts` |
| `web/backend/test/unit/manual.test.ts` | Nuevo: 12 pruebas, y una más que valida `docs/manual` cuando la rama lo tiene |
| `deploy/vps/desplegar.sh` (en las dos ramas) | `api` sube también `manual/` si el build lo dejó |
| `web/frontend/package.json`, `pnpm-lock.yaml` | `react-markdown` 10.1.0 y `remark-gfm` 4.0.1 |
| `web/frontend/src/features/help/` | Nuevo módulo: `api/queries.ts`, `types/`, `components/ManualMarkdown.tsx`, `lib/links.ts`, `pages/HelpIndex.tsx` y `HelpPage.tsx`, pruebas y `test/fixtures.ts` |
| `web/frontend/src/routes/_app/help.index.tsx` y `help.$seccion.$tarea.tsx` | Nuevas |
| `web/frontend/src/features/shell/lib/nav.ts` | Ítem "Ayuda" y breadcrumbs de `/help` |
| `web/frontend/src/features/shell/api/queries.ts` | `useCrumbData` con la sección y el título de la página |
| `web/frontend/src/features/shell/lib/nav.test.ts` | 2 pruebas nuevas |

## Pruebas

### API

```bash
cd web/backend && pnpm typecheck && pnpm test     # 436, 12 nuevas
MANUAL_DIR="<repo>/docs/manual" pnpm build        # "Manual de usuario: 2 páginas y 0 capturas -> dist/manual"
```

**Contra staging, sin desplegar (2026-11-02):** `dist/server.mjs` corriendo en local (puerto 8899) con la Supabase de staging y tokens reales de `daniloev` (usuario) y `adminprueba` (admin):

| Pedido | Resultado |
|---|---|
| Índice sin sesión | 401 |
| Índice como usuario | `inicio: jugador`, sección `jugador` con 2 páginas |
| Índice como admin | `inicio: jugador` (la sección `admin` todavía no tiene páginas), solo `jugador` |
| `jugador/vincular-steamid` como usuario | El título y el texto |
| `admin/servidores` como usuario | 404 |

### Web

```bash
cd web/frontend && pnpm typecheck && pnpm lint && pnpm test   # 514, 15 nuevas
```

No se miró en el navegador.

### Las reglas de las dos páginas

Comprobadas en la base de staging (`pg_get_functiondef`) y en el código de la web, no en la bitácora:

- `claim_with_code`: los mensajes, el código de 10 minutos y 5 por hora (`claim_code_create`), el tope de 3 (`claim_config.max_steam_ids`), la unión con la ficha vieja (replanteo 52). Los SteamID extra, según el plan aprobado de `claim-varios-steamid` (abajo).
- `mm_block_reason`: correo confirmado, sanción, exclusión, baneo; sin SteamID ni ficha se puede buscar.
- `mm_config`: 15 s para aceptar y por turno del veto, 5 min para conectarse, 3 min de espera de servidor y para volver, grupos de 2 con 500 de ELO, escalera de sanciones 5, 15, 60 y 1440 minutos.
- `mm_tick`, `mm_penalize`, `mm_decline`, `mm_cancel_lobby`, `mm_start_veto`: quién es capitán, quién empieza el veto, mapa al azar, vuelta a la cola, abandono y `!gg`, el contador que baja cada 7 días.

### Depende de otro requerimiento

`jugador/vincular-steamid.md` ya cuenta lo que aprobó Daniel en [`2026-11-02-claim-varios-steamid`](../2026-11-02-claim-varios-steamid/PLAN.md) (replanteo `58`, en implementación en otra sesión): el `!claim` siempre en una partida y los SteamID extra al instante, con el mensaje "Listo: sumamos este SteamID a tu ficha". Hoy, en staging, el SteamID extra todavía queda pendiente de un admin. Si ese requerimiento no sale con el corte, hay que volver esa parte de la página a "un admin lo tiene que aprobar".

## En qué se apartó del plan

- **"Ayuda" en el grupo Comunidad**, debajo de Ranking, y no al final del menú: al final queda debajo de Administración, que es larga.
- **Una página que no existe** muestra "No encontramos esa página" con un botón a la ayuda, en lugar de redirigir sola: así se entiende qué pasó.
- **Las capturas como `blob:`** se crean una vez por captura y quedan mientras dure la sesión (son pocas y livianas): revocarlas al desmontar rompía la imagen con el doble montaje de React en desarrollo.
- **La carpeta del manual en la rama de la API:** el build lee `MANUAL_DIR`; al desplegar desde la rama temporal se pasa `MANUAL_DIR=<v34frag>/docs/manual` (o se copia la carpeta), hasta que las ramas se junten.

## Despliegue

Todavía no. Cuando se despliegue:

1. **API:** la rama temporal de siempre (`feat/mm-claim-en-sala` + `feat/backend-api-fase-1`) y `MANUAL_DIR="E:/Css V34 Web/v34frag/docs/manual" deploy/vps/desplegar.sh api`. Comprobar en el log de `cmleague-api` la línea `manual: N páginas y M capturas`.
2. **Web:** `deploy/vps/desplegar.sh web`.

## Cómo revertir

- **Web:** quitar el ítem "Ayuda" de `nav.ts` (las rutas quedan sin link) o revertir el commit.
- **API:** las rutas no tocan la base; revertir el commit, o desplegar sin `manual/` (el índice queda vacío).

# SEO de la web nueva (cmleague.lat): guía de implementación

## Estado

Implementado y probado el 2026-11-03 en la rama `kyan/seo` (creada desde `feat/frontend-fase-1` en `4614544`), **sin commit y sin desplegar**. Search Console ya está verificado. Lo del VPS lo despliega Daniel.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/auth/guards.ts` | Nueva guarda `loadSession` (usuario o `null`, sin redirigir) |
| `web/frontend/src/routes/_app.tsx` | `loadSession` en vez de `requireAuth`; `user` puede ser `null`; aviso de reconexión solo con sesión |
| `src/routes/_app/{home,play,myteam,pcw,profile,mixes.live.$uid,help.index,help.$seccion.$tarea}.tsx` | `beforeLoad: requireAuth` |
| `src/routes/_app/admin.tsx` | `requireAuth` y después `requireAdminSection` |
| `src/features/shell/lib/nav.ts` | Marca `auth` en Para ti, Jugar, PCW, Mi equipo y Ayuda; `canSeeNavItem` |
| `src/features/shell/components/AppSidebar.tsx` | `user` opcional, menú filtrado, botones de acceso al pie, el logo lleva a `/` sin sesión |
| `src/features/shell/components/Topbar.tsx` | "Iniciar sesión" en lugar de las notificaciones |
| `src/features/shell/components/CommandMenu.tsx` | Sin "Mi perfil" ni "Cerrar sesión" para un visitante |
| `src/features/shell/api/queries.ts` | `useBadgeCounts` acepta `null` |
| `src/features/profile/api/queries.ts`, `src/features/teams/api/queries.ts` | `myProfileOptions` y `myTeamsOptions` solo con sesión |
| `src/features/mixes/components/MixHighlights.tsx` | La imagen del MVP solo con sesión |
| `src/lib/seo.ts` (nuevo) | `usePageMeta` y `useCanonical` |
| `src/routes/__root.tsx` | Canónica en cada navegación |
| `src/routes/_app/{ranking.index,ranking.teams,players.index,players.compare,player.$nick,teams.$id,events.index,events.$id,matches.index,match.$id}.tsx`, `terminos.tsx`, `privacidad.tsx`, `_auth/login.tsx`, `_auth/register.tsx` | Título y descripción; login y registro con `noindex` |
| `web/frontend/index.html` | Canónica, `theme-color`, Open Graph, Twitter Card, JSON-LD |
| `web/frontend/public/robots.txt`, `sitemap.xml`, `og.png` (nuevos) | Rastreo, sitemap fijo e imagen para compartir |
| `src/test/render.tsx` | `withSession()` para las pruebas de "el usuario con sesión ve…" |
| 8 archivos `*.test.tsx` (MixRoom, MixHighlights, WelcomeFlow, PlayerProfile, NotificationPrefsCard, Compare, PlayersRanking, TeamsRanking) | Llaman a `withSession()`; `MixHighlights` suma una prueba sin sesión |
| `src/lib/seo.test.ts` (nuevo), `src/features/shell/lib/nav.test.ts` | Pruebas de metadatos y del menú por rol |

## Despliegue (pendiente)

1. Commit en `kyan/seo` cuando Kyan lo pida. Para pasarlo a `feat/frontend-fase-1` o a `main` hace falta el sí de Kyan o de Daniel, y avisarle a Killuaz, porque toca el shell.
2. **Daniel:** desplegar la web con `deploy/vps/desplegar.sh`, como siempre.
3. **Daniel, Caddy** (`deploy/vps/Caddyfile`, bloque `cmleague.lat`): que un archivo con extensión que no existe responda 404 en vez del `index.html`. Hoy `/robots.txt` y cualquier ruta inventada devuelven 200 con la SPA (soft 404). Por ejemplo:

   ```caddy
   @archivo_inexistente {
   	path_regexp \.[a-zA-Z0-9]+$
   	not file
   }
   respond @archivo_inexistente 404
   try_files {path} /index.html
   ```

4. Con la web desplegada, enviar `https://cmleague.lat/sitemap.xml` en Search Console (propiedad `cmleague.lat`, Sitemaps) y pedir la indexación de la portada y de `/ranking`.

### Pendientes del backend (Daniel)

- `GET /api/v1/manual` y sus páginas responden 401 sin sesión. Si el manual del jugador se abre a visitantes, se le saca `requireAuth` a `help.*` y la marca `auth` a Ayuda.
- `GET /api/v1/mm/mvp-image` pide sesión. Es una imagen decorativa: si se hace pública, se le saca el `enabled` en `MixHighlights.tsx`.
- Un sitemap dinámico (`/sitemap.xml` en la API, o uno que se genere al desplegar) con los perfiles de jugador, los equipos, los torneos y las partidas.
- Opcional, a futuro: HTML con el título y la OG de cada perfil, equipo y partida para los bots sin JavaScript (Discord muestra hoy la tarjeta general del sitio en cualquier link).

## Pruebas

### Pruebas automáticas (`web/frontend`)

- `pnpm typecheck`, `pnpm lint` y `pnpm build`: sin errores.
- `pnpm test`: **565 pruebas en 92 archivos, todas pasan** (incluida la nueva sin sesión de `MixHighlights`).
- Las 14 pruebas que fallaron al principio miraban lo que ve un usuario con sesión, pero no cargaban ninguna sesión, así que con `/me/profile` sin pedir se quedaban sin datos. Ahora llaman a `withSession()`.

### Navegador, sin sesión, contra la API de producción

Se hizo con `vite preview` y un proxy local a `https://api.cmleague.lat` (solo lecturas `GET`, con un archivo de configuración temporal que se borró después).

| Página | Resultado |
|---|---|
| `/ranking?page=2` | Tabla con datos reales; título "Ranking de jugadores · CM League"; canónica `https://cmleague.lat/ranking` (sin `?page`) |
| `/player/musul` | Perfil completo; título "musul · CM League"; ningún pedido a `/me`; consola sin errores |
| `/teams/<id>` | Título con el nombre del equipo y su descripción |
| `/match/<id>` (mix terminado) | Sala completa. Al principio daba un 401 de `/mm/mvp-image`, que se corrigió; después, ningún pedido con error |
| `/home` | Redirige a `/login?redirect=%2Fhome` con título "Iniciar sesión · CM League" y `noindex` |
| `/events` | Título "Torneos · CM League". No hay torneos en producción, así que la página de un torneo no se pudo abrir |
| 375 px | Topbar con "Iniciar sesión" y ranking legible |

**No se probó** iniciar sesión en el navegador (las pruebas automáticas cubren el shell con sesión) ni la página de un torneo con datos.

## En qué se apartó del plan

- **Títulos:** el plan decía `head()` de TanStack Router con `<HeadContent />`. En cambio, se usó un hook (`usePageMeta`) que escribe en las etiquetas que ya trae `index.html`. Por dos motivos: `HeadContent` agrega un `<title>` nuevo al lado del de `index.html` (que tiene que quedar para los bots sin JavaScript), y los títulos de equipos y torneos necesitan datos de una consulta, no de la ruta.
- **Ayuda:** el plan la ponía entre las públicas, pero la API del manual responde 401 sin sesión. Sigue privada y queda como pendiente del backend.
- **Caddy:** el plan lo ponía en esta tanda, pero el `CLAUDE.md` del frontend limita los cambios a `web/frontend/` y la bitácora, y Kyan pidió que lo del VPS lo haga Daniel. Queda como paso de despliegue.
- **Search Console:** se planeó un TXT en Namecheap, pero Google verificó el dominio solo por el proveedor. No se tocó el DNS.
- **Imagen del MVP:** no estaba en el plan; apareció en la prueba en el navegador (401 en la sala de un mix).

## Cómo revertir

- Sin commit todavía: borrar el worktree (`git worktree remove .claude/worktrees/seo`) y la rama `kyan/seo`.
- Ya desplegado: revertir el commit y volver a desplegar la web. Los archivos de `public/` desaparecen con el build anterior.
- Search Console no afecta la web; la propiedad se puede quitar desde su configuración.

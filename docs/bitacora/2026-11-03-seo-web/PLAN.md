# Plan: SEO de la web nueva (cmleague.lat)

> Planeación original. Estado: **aprobado por Kyan (2026-11-03)**, mejoras 1 a 4 de la revisión. Lo del VPS lo despliega Daniel.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Rama | `kyan/seo`, creada desde `feat/frontend-fase-1` (worktree aparte) | El frontend nuevo vive en esa rama; `kyan/pruebas` no lo tiene. Decidido por Kyan |
| Páginas públicas | Sin sesión se ven ranking (jugadores y equipos), jugadores, perfil de jugador, comparar, equipos, partidas, sala de una partida, torneos y ayuda | Son las páginas con contenido para buscadores. La API ya las sirve sin sesión |
| Páginas privadas | Siguen con sesión: Para ti (`/home`), Jugar, Mi equipo, PCW, Perfil, Administración, sala en vivo del matchmaking y bienvenida | Son de la cuenta o del admin |
| Shell sin sesión | El mismo sidebar y topbar, sin los ítems privados ni de admin, sin notificaciones, y con "Iniciar sesión" y "Crear cuenta" al pie | Una sola navegación; el visitante ve la misma web que el jugador |
| Consultas de la cuenta | `GET /me/profile` y `GET /me/teams` no se piden sin sesión | Sin sesión responden 401 y ensucian la consola y la red |
| Títulos | `head()` de TanStack Router por ruta + `<HeadContent />` en la raíz | Cada página con su título y descripción; es la forma nativa del router |
| Canónica | `<link rel="canonical">` con el origen y la ruta, sin parámetros | Evita duplicados por `?tab=`, `?page=`, etc. |
| Open Graph | En `index.html`, con imagen `og.png` de 1200×630 | Tarjeta al compartir en Discord y redes |
| robots.txt y sitemap | Archivos estáticos en `public/`. El sitemap dinámico (jugadores, equipos, torneos) queda para el backend | Lo dinámico necesita la API (Daniel) |
| Caddy | 404 real para archivos con extensión que no existen; Daniel lo despliega | Hoy `robots.txt` y cualquier ruta devuelven el `index.html` con 200 |
| Search Console | Verificar el dominio con un TXT en Namecheap, desde el Chrome de Kyan | Pedido por Kyan |

## 1. El flujo completo

```mermaid
flowchart TD
    V[Visitante o Googlebot] --> R{Ruta}
    R -->|pública| S[Shell sin sesión]
    R -->|privada| G{¿Hay sesión?}
    G -->|no| L[/login]
    G -->|sí| A[Shell con sesión]
    S --> P[Página + título, descripción y canónica]
    A --> P
```

## 2. Rutas y guardas (`web/frontend/src`)

- `routes/_app.tsx`: la guarda pasa a ser opcional (`loadSession`): carga el usuario si hay sesión y si no, `user: null`.
- Las rutas privadas suman `beforeLoad: requireAuth` (`home`, `play`, `myteam`, `pcw`, `profile`, `admin`, `mixes/live/$uid`).
- `admin.tsx` encadena `requireAuth` y `requireAdminSection`.

## 3. Shell sin sesión

- `AppSidebar`: `user` puede ser `null`; oculta los ítems privados y de admin; al pie, botones de acceso.
- `Topbar`: sin notificaciones si no hay sesión.
- `ReconnectBanner` y la búsqueda solo con sesión donde corresponda.

## 4. Metadatos

- `index.html`: Open Graph, Twitter Card, `theme-color`, `og:image`.
- `head()` en cada ruta pública; `noindex` en login y registro.
- Canónica desde la raíz.

## 5. robots.txt, sitemap.xml y Caddy

- `public/robots.txt`: bloquea `/admin`, `/profile`, `/home`, `/play`, `/myteam`, `/pcw`, `/welcome`, `/login`, `/register`, `/demo`; línea `Sitemap:`.
- `public/sitemap.xml`: rutas fijas públicas.
- `deploy/vps/Caddyfile`: un archivo con extensión que no existe responde 404.

## 6. Requisitos antes de empezar

- Dependencias del frontend instaladas con `pnpm install --frozen-lockfile`.
- Sesión de Kyan en Google y Namecheap en su Chrome para la verificación.

## 7. Orden de implementación

1. Guardas y rutas privadas.
2. Shell sin sesión y consultas de la cuenta.
3. Metadatos por ruta, canónica e `index.html`.
4. `robots.txt`, `sitemap.xml`, `og.png` y Caddyfile.
5. Pruebas: `typecheck`, `test`, `build` y revisión en el navegador sin sesión.
6. Search Console y TXT en Namecheap.
7. Documentación, guía y fila en el índice.

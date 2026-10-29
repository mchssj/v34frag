# Partidas favoritas (prototipo VIP)

Está en `/demo/favoritas` del frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), solo con `pnpm dev`.

## Qué hace

- **Tabla:** es la de `MixesList` (fecha, mapa, bandos, rondas, MVP, demo), con los mixes del jugador de la demo. Tu nick aparece como "vos".
- **Estrella:** marca o desmarca un mix. El filtro **Favoritas (n)** muestra solo esos, y **Vaciar favoritas** las borra todas.
- **Sin VIP:** la estrella y el filtro muestran un aviso.
- **Guardado:** en el demo, en `localStorage` (`demo-partidas-favoritas`). Si el navegador no deja guardar, duran lo que dura la página.

## Archivos (en `web/frontend/src/`)

- `features/vip/Favorites.tsx`
- `routes/demo.favoritas.tsx`

## Lo que falta para la versión real

- **Daniel:**
  - Una tabla `match_favorites (user_id, match_id, created_at)`.
  - `PUT` y `DELETE /api/v1/me/favorites/{match_id}`, con chequeo de VIP.
  - El filtro `favorites=true` en `GET /api/v1/mixes`.
  - Decidir qué pasa si se vence el VIP. La propuesta es dejar ver las favoritas sin dejar marcar nuevas, como los cosméticos congelados de la progresión VIP.
- **Esteban:** la estrella y el filtro en el listado de mixes.

## Pruebas (2026-10-29)

- Se marcaron tres mixes con clics seguidos y quedaron los tres en "Favoritas (3)" y en `localStorage`.
- La primera versión perdía uno con dos clics muy seguidos. Se corrigió usando la función de `setState`.

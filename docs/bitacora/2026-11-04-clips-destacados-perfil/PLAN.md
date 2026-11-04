# Plan: clips destacados en el perfil

> Planeación original. Estado: **propuesta**, pendiente de aprobación. Pedido por Daniel el 2026-11-04 (punto 3 de 3).

## Qué se pide

Una pestaña de clips destacados en **Mi Perfil**. Cada jugador elige hasta 3 de sus clips, y un VIP hasta 10. Los dos topes se configuran.

## Decisiones tomadas

| Tema | Decisión propuesta |
|---|---|
| Dónde se eligen | En la sección nueva **Mi Perfil › Clips** (`/profile/clips`) |
| Dónde se ven | En la ficha pública del jugador, en una pestaña **Clips** al lado de las que ya tiene (Resumen, Partidas, Mapas…). Sin destacados, la pestaña no aparece |
| Qué clips se pueden elegir | Los propios (del SteamID vinculado a la cuenta), con video (`video_status = 'done'`) y no ocultos por un admin |
| Topes | `clip_config.featured_max` (3) y `featured_max_vip` (10), en Administración › Clips |
| Orden | El jugador los ordena (subir/bajar). El primero va arriba en la ficha |
| Si deja de ser VIP | No se borra nada. En la ficha se ven solo los primeros `featured_max`, y no puede sumar más hasta estar debajo del tope |
| Video | Hoy el video está en R2 15 días y después solo en Drive. **Los destacados no se archivan:** `clip_archive_due` los saltea mientras estén destacados. Si se quita uno con más de 15 días, entra en el archivo de la noche siguiente |
| Destacado viejo ya archivado | Si el clip ya salió de R2, se sube de nuevo desde Drive al destacarlo (lo hace la máquina de render en su vuelta). Mientras tanto, la ficha muestra "Preparando el video" |

## 1. El flujo

```mermaid
sequenceDiagram
    participant J as Jugador
    participant W as Web (Mi Perfil › Clips)
    participant A as API
    participant B as Base
    participant R as Render (portátil)
    J->>W: Marca un clip como destacado
    W->>A: PUT /api/v1/me/clips/featured [ids en orden]
    A->>B: clip_featured_set(ids)
    B-->>A: OK o 409 (más que el tope)
    alt El clip ya no está en R2
        R->>B: clip_restore_pending()
        R->>R: baja de Drive y sube a R2
        R->>B: clip_restore_done(id, key)
    end
    Note over B: clip_archive_due saltea los destacados
```

## 2. Base de datos (replanteo nuevo)

- Tabla `player_featured_clips`: `user_id`, `clip_id`, `position`, `created_at`, con clave `(user_id, clip_id)`. Lectura pública, y escritura solo por la función.
- `clip_config`: `featured_max smallint default 3` y `featured_max_vip smallint default 10` (entre 1 y 50), en `clip_set_config` o en una función propia.
- `clip_featured_set(p_clips uuid[])`: reemplaza la lista del usuario. Valida que los clips sean suyos y tengan video, y el tope con `is_vip()`.
- `player_featured_clips_list(p_player uuid)`: los destacados visibles de un jugador, con el tope que le toca hoy, y el video y los datos de `match_clip_list`.
- `clip_archive_due`: excluye los destacados.
- `clip_restore_pending()`/`clip_restore_done()`: para la vuelta a R2 de un destacado archivado.

## 3. API

- `GET /api/v1/me/clips`: mis clips con video, con cuáles están destacados y el tope que me toca.
- `PUT /api/v1/me/clips/featured`: la lista en orden. `409` si pasa el tope y `400` si un clip no es mío o no tiene video.
- `GET /api/v1/players/{id}/clips/featured`: público, para la ficha.
- Esquemas, tipos y pruebas.

## 4. Web

- `features/profile/pages/ClipsSection.tsx`: la grilla de mis clips (miniatura, tipo, mapa, fecha). Una estrella para destacar, el contador "2 de 3" (o "de 10" con VIP), el orden de los elegidos y, si no es VIP, un aviso de que con VIP llega a 10.
- `ProfileLayout`: la sección nueva en el menú.
- `features/player/components/tabs/ClipsTab.tsx`: los destacados en la ficha pública, con el mismo reproductor de los clips de una partida.
- Administración › Clips: los dos topes.

## 5. Render

- `render/procesar.py`, en `daily`: los destacados no aparecen en `clip_archive_due` (lo resuelve la base). La vuelta a R2 de un destacado archivado baja el archivo de Drive (`drive.download`, ya existe) y lo sube con `r2.py`.

## 6. Manual, términos y privacidad

- Manual: una página nueva, `jugador/clips-destacados.md`, y una línea en `jugador/crear-cuenta.md` (la tabla de Mi Perfil). En el manual del VIP, que llega a 10. En `admin/`, los topes.
- **Privacidad: cambia un plazo.** Hoy dice que los videos están 15 días en R2 y después solo en Drive. Los destacados quedan en R2 mientras sigan destacados. Se actualiza `/privacidad` y `terms/privacidad.html`.
- Términos: si la página del VIP enumera sus beneficios, se suma "hasta 10 clips destacados".

## 7. Requisitos antes de empezar

- Que Daniel apruebe dónde se ven (la ficha pública) y lo de mantener los destacados en R2. El costo es chico: 10 clips de unos 20 MB son 200 MB por VIP, y el plan gratis de R2 tiene 10 GB.

## 8. Orden de implementación

1. Replanteo con su inversa y pruebas SQL.
2. API y pruebas.
3. Web (Mi Perfil, ficha y admin).
4. Render (vuelta a R2 de los archivados).
5. Documentación, manual, privacidad y changelog.
6. Desplegar: base, API, web y `render/` en el portátil.

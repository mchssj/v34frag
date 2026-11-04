# La foto de cada integrante en el plantel de un equipo: guía de implementación

## Estado

**En staging desde el 2026-11-03**, sin commit. Producción, con el corte.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/69_foto_en_plantel.sql` | Nuevo (en las dos ramas): `team_members_view` con la foto de la cuenta como respaldo |
| `supabase/replanteo/README.md` | Fila de la `69` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/69_foto_en_plantel.sql` | Nuevo: la inversa |
| `pruebas/69.sql`, `pruebas/correr.sh` | 4 pruebas y la comprobación de la inversa |

## Despliegue (hecho el 2026-11-03)

1. **Pruebas** en staging, dentro de una transacción que se deshace: `bash pruebas/correr.sh "<conexión>"` (en staging el usuario es `postgres.edaljnirzvisiaathitt`).
2. **Base:** `69` con `psql -v ON_ERROR_STOP=1`.
3. **Comprobado:** `GET /api/v1/teams/6bf9b9c7-…/members` devuelve la foto de daniloev (antes `null`).

La API y la web no cambian. Nada para los servidores de juego.

## Pruebas

`pruebas/69.sql`, corridas en staging (deshechas):

1. Sin foto en la ficha, toma la de la cuenta.
2. Con foto en la ficha, manda la de la ficha.
3. Da lo mismo que `player_overview`.
4. La vista sigue con `security_invoker`.

Y la inversa deja la definición exactamente como antes. Resultado: todas `OK`.

## En qué se apartó del plan

Ninguno.

## Incidentes durante las pruebas

- La primera versión de las pruebas usaba URLs inventadas para la foto de la cuenta y chocó con `avatar_url_propio` (tiene que ser del bucket `avatars`), y después con que un integrante necesita el SteamID vinculado. Se corrigieron las pruebas, no el replanteo.

## Cómo revertir

La inversa: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/69_foto_en_plantel.sql`.

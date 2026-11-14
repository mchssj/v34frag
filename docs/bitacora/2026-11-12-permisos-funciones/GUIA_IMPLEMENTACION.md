# Permisos de las funciones y tablas de producción: guía de implementación

## Estado

**Desplegado el 2026-11-14** (23:44 a 23:51 UTC): la `118` y la `119` en producción, y la API y la web `e0b08e9f9e82`. Ver el despliegue en la [guía de la tienda](../2026-11-11-tienda-de-puntos/GUIA_IMPLEMENTACION.md).

Antes: Probado en la copia local de producción el 2026-11-12. **Se despliega junto con la tienda** (`113`), por decisión de Daniel del 2026-11-12; falta el commit.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/114_permisos.sql` | Nuevo, generado: 413 `revoke` sobre 332 funciones y 75 tablas y vistas, los permisos por columna de `ac_devices` y de `matches`, y los chequeos del final |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/114_permisos.sql` | Nuevo, generado: la inversa |
| `pruebas/referencia.sh` | Nuevo: arma la base de referencia (`referencia.sh [hasta] [base]`) |
| `pruebas/comparar.sh` | Nuevo: compara los permisos de dos bases (`local:<base>` o `prod`) |
| `pruebas/generar_114.py` | Nuevo: escribe la `114` y su inversa |
| `pruebas/probar_114.sh` | Nuevo: la prueba |
| `deploy/supabase/migrar-vps.sh` | Carga el esquema de `public` sin los permisos por defecto y compara también los permisos con el origen |
| `supabase/replanteo/README.md` | La fila de la `114` |

## Despliegue (pendiente)

Con el visto bueno de Daniel. No reinicia nada y no toca datos: se puede aplicar con un mix en curso.

1. Respaldo: `sudo cmleague-respaldar` en el VPS (o confirmar que el del día ya está en R2).
2. Túnel a la base: `ssh -L 5433:127.0.0.1:5432 ubuntu@<VPS>` (en Windows, con el `ssh` de `C:\Windows\System32\OpenSSH`).
3. Comprobar que producción sigue como en la copia: `bash pruebas/comparar.sh local:referencia_permisos prod` tiene que dar las mismas 407 diferencias. Si cambió algo, volver a copiar producción y regenerar la `114`.
4. Aplicar, con los `PG_*` del `.env`: `tr -d '\r' < supabase/replanteo/114_permisos.sql | psql -v ON_ERROR_STOP=1`. Si algún chequeo del final falla, la transacción se deshace sola.
5. Verificar:
   - `bash pruebas/comparar.sh local:referencia_114 prod` da 0 diferencias.
   - La web abre (inicio, ranking, una partida, Jugar) y el próximo mix se guarda.
6. Commit en `main`. La `114` también en `feat/frontend-fase-1` y `feat/mm-claim-en-sala`, porque toca funciones del matchmaking.

## Pruebas

### La 114 sobre la copia de producción (`pruebas/probar_114.sh`, 2026-11-12)

1. **Antes:** 407 objetos con permisos de más y ninguna columna distinta.
2. **Con la 114:** los permisos son los de la base armada desde cero hasta la `114` (`referencia_114`): 0 diferencias, también por columna. De paso se comprobó que la `114` se aplica bien en una base armada desde cero, donde sus `revoke` no cambian nada.
3. **Por la API local:**
   - `anon` recibe `42501` en `season_close_run`, `csstv_after_ingest` y `notify_due`;
   - `csstv_ingest`, la función del plugin, sigue respondiendo: 422, porque el token es falso.
4. **La inversa** vuelve exactamente a los permisos de antes, y la `114` se puede aplicar otra vez.

### La API (suite de integración sobre la copia con la 114)

- 204 de 211 pruebas pasan con la `114` aplicada. `ips` y `notify-due`, que fallaban por estos permisos, ahora pasan.
- Las 7 que fallan ya fallaban sin la `114` y vienen de la configuración y los datos reales de la copia: `claim` (2), `hud`, `live`, `medals` (2), y una de `tournaments` por fotos de corridas anteriores que quedaban en el bucket. Esa última pasa después de borrar las fotos.

### Lo que usa el código

Se cruzaron las funciones que pierden algún permiso con todas las llamadas a `rpc` del código:
- **El plugin, los Workers y el render** no usan ninguna de las que cambian.
- **La API** usa varias que pierden `anon`, pero todas desde rutas con `requireUser`.
- **`notify_due`** pierde `authenticated`, y el timer `cmleague-notify` la llama con la clave de servicio.

## En qué se apartó del plan

- **Permisos por columna.** El plan no los contemplaba: un `revoke` sobre una tabla también borra los permisos por columna. La primera versión de la `114` dejó `matches` sin lectura y fallaron 91 pruebas. La comparación pasó a mirar también las columnas, y la `114` vuelve a dar los de `ac_devices`.
- **`matches`.** La `10` dio lectura columna por columna sobre las columnas que existían en ese momento, menos `link_code`; las que se agregaron después (`parent_approved`) nunca la recibieron, ni siquiera en la base armada desde cero. La `114` la da sobre todas las columnas que existen al aplicarse, menos `link_code`. Es el único permiso que la `114` da en lugar de quitar.
- **Dos referencias.** La `114` se genera comparando con la referencia hasta la `112` (`referencia_permisos`, lo que tiene producción), y se verifica con la referencia hasta la `114` (`referencia_114`).

## Incidentes durante las pruebas

- **Los finales de línea.** El worktree de `main` tiene los `.sql` con CRLF y la base desde cero fallaba en la `04`; `referencia.sh` los pasa a LF al cargarlos. Lo mismo le pasa a `web/backend/scripts/db-local.sh` en esta máquina; falta corregirlo, en otro requerimiento.
- **La copia local se recargó una vez** (`copia-produccion.sh cargar` y la `113`), para volver a los permisos exactos de producción después de la primera versión de la `114`.

## Cómo revertir

Aplicar la inversa en producción, por el túnel: `tr -d '\r' < docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/114_permisos.sql | psql -v ON_ERROR_STOP=1`. Vuelve a dejar abiertas las funciones internas: solo si la `114` rompió algo, y hasta corregirlo.

# El jugador reemplazado puede volver a buscar partida: guía de implementación

## Estado

**Desplegado el 2026-11-16** en la base de producción (replanteo `125`). No hay nada pendiente.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/125_mm_reemplazado_puede_buscar.sql` | Nuevo: `mm_active_lobby` sin las filas con `replaced_by` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/125_mm_reemplazado_puede_buscar.sql` | Nuevo: la inversa (la definición de la `48`) |
| `supabase/replanteo/README.md` | Fila de la `125` |
| `docs/manual/jugador/buscar-partida.md` | En **Reemplazos**: se puede volver a buscar en cuanto entra el reemplazo |
| `docs/bitacora/README.md` | Fila de este requerimiento |

## Despliegue (hecho el 2026-11-16)

1. Túnel a la base del VPS, con el `ssh` de Windows (`C:\Windows\System32\OpenSSH\ssh.exe`, que tiene la clave): `ssh -N -L 5433:127.0.0.1:5432 ubuntu@<VPS>`.
2. Aplicar la migración, que va en su propia transacción y termina con `notify pgrst, 'reload schema'`:

   ```bash
   tr -d '\r' < supabase/replanteo/125_mm_reemplazado_puede_buscar.sql | psql -v ON_ERROR_STOP=1
   ```

No hace falta reiniciar nada ni esperar al final de los mix: es una función de lectura que el servidor no usa.

## Pruebas

### Producción (2026-11-16)

- **Antes:** la sala `b67a605b-a802-42a6-ab4d-bc7586bfeb1b` estaba `live`. nachinn tenía `abandoned = true` y `replaced_by` lleno (lo reemplazó gttt.), y `mm_active_lobby` le devolvía esa sala. La definición en producción era la misma de la `48`.
- **Después:** `mm_active_lobby` de nachinn devuelve `null`, y la función sigue devolviendo esa sala a los otros 10 jugadores de la partida (incluido gttt.). Los permisos de la función no cambiaron (`postgres` y `service_role`).
- No se probó en local ni con una prueba automática: el cambio es una condición más en una consulta y se comprobó con el caso real.

## En qué se apartó del plan

- El arreglo se aplicó en producción antes de escribir el plan, porque Daniel pidió que nachinn pudiera buscar en el momento.

## Cómo revertir

Por el túnel:

```bash
tr -d '\r' < docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/125_mm_reemplazado_puede_buscar.sql | psql -v ON_ERROR_STOP=1
```

Vuelve a dejar atado a la sala, hasta que termine la partida, a quien ya fue reemplazado.

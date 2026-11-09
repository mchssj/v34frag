# El resultado tardío cierra la sala del matchmaking: guía de implementación

## Cambios respecto del plan

Ninguno.

## Pruebas (base local, 2026-11-09)

`pruebas/probar_99.sh` aplica la `99` y su inversa dentro de una transacción con `rollback`. `csstv_link_game` local era idéntica a la de producción (mismo `md5`). Usa la sala terminada más reciente con su mix y la deja como la deja el `abort` del plugin.

| # | Prueba | Resultado |
|---|---|---|
| 1 | Cancelada por "no llegó a la web" hace 20 minutos: se vincula, sala `finished` con `result` y ganador, partida madre `finished` | ok |
| 2 | Cancelada por "El servidor se reinició durante la partida": no se vincula | ok |
| 3 | Mix de otro servidor: no se vincula | ok |
| 4 | Cancelada hace 25 horas: no se vincula | ok |
| 5 | Sala `live`: se vincula como antes | ok |
| 6 | La inversa deja `csstv_link_game` con el mismo `md5` | ok |

## Despliegue en producción

```sh
sudo docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < 99_resultado_tardio_mm.sql
sudo docker exec -i supabase-db psql -U postgres -d postgres -c "notify pgrst, 'reload schema';"
```

No necesita salas paradas: solo cambia `csstv_link_game`.

**Estado:** aplicado en producción el 2026-11-09 a las 19:49 UTC (`csstv_link_game` con el bloque de la 99, PostgREST recargado). Commit pendiente (en `main`, `feat/frontend-fase-1` y `feat/mm-claim-en-sala`), cuando Daniel lo pida.

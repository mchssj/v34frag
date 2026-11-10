# Con todos conectados, la sala no se cancela por el plazo de conexión: guía de implementación

## Cambios respecto del plan

- Se planeó como replanteo `107`, pero otra sesión usó ese número el mismo día (el baneo saca del matchmaking, `107_mm_baneo_saca_de_cola.sql`). Pasó a ser la `108`. Esa `107` no toca `mm_tick`.

## Pruebas

### Base (`pruebas/probar_108.sh`, en la base local, copia de producción, en una transacción que se deshace)

| # | Prueba | Resultado |
|---|---|---|
| 1 | Todos conectados, el último hace 1 minuto: sigue en `connecting`, con `connect_deadline` = último + 3 min, y avisa `lobby.update` | ok |
| 2 | Todos conectados, el último hace 4 minutos: cancelada con "Estaban todos, pero la partida no arrancó (faltó el !ready)" | ok |
| 3 | Uno sin conectar: como antes, cancelada con "No se conectaron todos a tiempo" y sanción solo a ese (ninguna en 1 ni 2) | ok |
| 4 | Plazo sin vencer: no cambia ni avisa | ok |
| 5 | La vuelta siguiente de `mm_tick` no vuelve a tocar la sala del caso 1 | ok |
| 6 | La inversa deja `mm_tick` idéntico | ok |

No se probó con un servidor real: el plugin no cambia, y el `!ready` sigue avisando `live` como antes.

### Web

`pnpm typecheck`, `pnpm test` (715, con 2 nuevas en `RoomOverview.test.tsx`: la cuenta "para entrar" y "para que todos escriban !ready"), `eslint` y `prettier` sin errores en lo que se tocó.

## Despliegue

1. Base: aplicar la `108` en el VPS sin salas en `connecting`, y `notify pgrst, 'reload schema';`. No reinicia nada.
2. Web: `deploy/vps/desplegar.sh web` desde `main`, sin mixes en curso.

**Estado:** sin desplegar.

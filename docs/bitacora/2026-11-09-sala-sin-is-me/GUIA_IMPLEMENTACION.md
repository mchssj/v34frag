# La sala del matchmaking sin `is_me`: guía de implementación

## Estado

**Desplegado en producción el 2026-11-09** (alrededor de las 14:20, hora de Bogotá), con un mix del matchmaking en vivo (de_dust2_ob), con la autorización de Daniel. Falta el commit.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/98_mm_ficha_is_me.sql` | Saca el comentario que cortaba la línea de `mm_player_card` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/98_mm_ficha_is_me.sql` | Inversa (vuelve a la línea cortada; solo para pruebas) |
| `docs/bitacora/2026-11-09-sala-sin-is-me/pruebas/probar_98.sh` | Prueba en una transacción que se deshace |
| `supabase/replanteo/README.md` | Fila de la `98` |

## Despliegue (hecho el 2026-11-09)

1. **Túnel:** `ssh -L 5433:127.0.0.1:5432 ubuntu@<VPS>`. Desde la PC de Daniel entra el `ssh` de Windows (`C:\Windows\System32\OpenSSH\ssh.exe`, el del cmd) y no el de Git Bash: la llave que acepta el VPS no es `~/.ssh/id_ed25519`.
2. **Prueba:** `probar_98.sh "<conexión>"`. Tiene que decir `antes, con is_me: false`, `is_me del dueño: true, de otro: false, linked: true, country: true, verified: true` y `función igual a antes: true`.
3. **Aplicar:** `PGCLIENTENCODING=UTF8 psql "<conexión>" -f supabase/replanteo/98_mm_ficha_is_me.sql` y después `notify pgrst, 'reload schema'`. No reinicia nada ni corta una sala en curso: una sala abierta se corrige en el próximo pedido de la web.
4. **Ramas:** es del matchmaking, así que el commit va en `feat/frontend-fase-1` y en `feat/mm-claim-en-sala`.
5. La `95`, la `96` y la `97` son de `main`. Si se aplican después, no tocan `mm_player_card`.

## Pruebas

### Antes de aplicar, en producción

- En producción, las tres salas del 2026-11-09 (12:50, 13:49 y 13:58, hora de Bogotá) tuvieron los 6 vetos automáticos. El día anterior, casi todos los vetos los habían hecho los capitanes.
- `mm_player_card` solo la usan `mm_lobby_json` y `mm_my_profile`, y a `mm_lobby_json` la usan `mm_my_live`, `mm_lobby_match`, `mm_game_room` y `mm_replace_info`. Todas son lecturas de la web, solo para usuarios con sesión. No hay triggers, vistas ni bloqueos sobre la función, y el plugin no la usa. Por eso aplicarla no afecta un mix en curso.
- `probar_98.sh` contra producción: igual que en local, todo en verde.

### Después de aplicar

`is_me` del dueño true, de otro false, con `linked` y `country`; la línea cortada ya no está, y la sala en vivo siguió en `live`.

### Local

`probar_98.sh docker` (2026-11-09):

```
antes, con is_me: false
is_me del dueño: true, de otro: false, linked: true, country: true, verified: true
--- Inversa
función igual a antes: true
```

En la base local, `mm_player_card` era la única función con código después de un comentario `-- (replanteo N)` en la misma línea.

La web no cambia para el matchmaking: las pruebas de la sala ya pasaban porque usan datos con `is_me`.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

No hace falta: la inversa vuelve a romper la sala. Existe solo para que la prueba compruebe que la función queda igual que antes.

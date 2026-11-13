# Ronda de cuchillo por vida y nombre de la web: guía de implementación

## Cambios respecto del plan

| Plan | Qué se hizo | Por qué |
|---|---|---|
| Replanteo `93` | Replanteo **`113`** | `main` ya usa la 93 (`93_mm_chat_del_grupo`) y llega hasta la 112 |
| Todos con ficha | **Los VIP se saltan la regla** y la base devuelve `vip` | Lo pidió Kyan durante la implementación |
| Todas las fichas | **Las fichas privadas no se tocan** | Para no mostrar en el servidor a quién pertenece el SteamID de una ficha privada |
| Solo la 2.12.0 (sobre la 2.11.0) | También la **2.10.1**, el mismo cambio sobre la 2.10.0 de `main`, desplegada | La 2.11.0 necesita la `92` y tareas de Daniel. Kyan pidió subir esto ya |
| Despliegue después del commit | Desplegado antes del commit | Lo pidió Kyan |

## Cómo se armó la 2.10.1

No hay rama nueva (solo se commitea en `kyan/pruebas`). La 2.10.1 se arma así:

```bash
git archive origin/main server/addons/sourcemod/scripting | tar -x -C <dir>
cd <dir> && patch -p1 < docs/bitacora/2026-11-12-cuchillo-por-vida-y-nombre-web/build_2.10.1/sobre_main_2.10.0.patch
spcomp csstv_reporter.sp -i<include de SourceMod 1.10> -iinclude
```

El parche solo toca `csstv/knife.inc`, `csstv/claim.inc`, `csstv_reporter.sp` (include, init, versión) y agrega `csstv/webnick.inc`. Se compiló con `spcomp` 1.10.0.6490 (el de `C:\Users\Agus\Downloads\cssds`), la misma versión de SourceMod de los servidores. La 2.10.0 de los servidores la compiló el 1.8, por eso pesa distinto (152279 contra 145833 bytes).

Cuando Daniel lleve el cambio a `main` o a `feat/frontend-fase-1`, tiene que aplicar este parche (o el diff de `kyan/pruebas` sin la repetición 2D).

## Pruebas

En `C:\Users\Agus\Downloads\cssds`, con `csstv_send 0` y bots quietos (`bot_zombie 1`). Detalle en `pruebas/RESULTADOS.md`.

| Prueba | 2.12.0 | 2.10.1 |
|---|---|---|
| Cuchillo por tiempo, ganan los T por vida | CT 120 contra T 140: ganó el T | CT 120 contra T 200: ganó el T |
| Nick de la ficha, con ñ y tilde | Bien | Bien |
| Cambiarse el nombre (`sm_rename`) | Vuelve al de la ficha | Vuelve al de la ficha |
| VIP | No se le toca y lo puede cambiar | — |

Sin probar:

- `csstv_web_nick` en una base: Docker no estaba corriendo en la PC.
- Un jugador real cambiándose el nombre desde la consola del juego (`name …`), con ClientMod.

## Despliegue (2026-11-12)

`pruebas/subir_2_10_1.py --hacer`, por la API del panel de MVZG (`SFTP_CSS_API_KEY`). En cada uno: comprueba que hay 2.10.0, la deja como `plugins/disabled/csstv_reporter_2.10.0.smx`, sube la 2.10.1 y la baja para compararla. No recarga nada: entra en el próximo cambio de mapa.

| Servidor | Reporter | Respaldo | Verificado |
|---|---|---|---|
| **#1** (`157703b5`) | 2.10.1, md5 `8e68bf20…` | `disabled/csstv_reporter_2.10.0.smx` | Byte a byte |
| **#2** (`cd1be322`) | 2.10.1, md5 `8e68bf20…` | `disabled/csstv_reporter_2.10.0.smx` | Byte a byte |
| **#3** (`16c850ff`) | 2.10.1, md5 `8e68bf20…` | `disabled/csstv_reporter_2.10.0.smx` | Byte a byte (la primera vez el panel cortó por tiempo; se reintentó) |

El de retake (ExtremeHost) no se tocó: se daba de baja alrededor del 2026-11-10.

## Falta

1. Aplicar la `113` en la base del VPS (Daniel o Kyan). Hasta entonces nadie cambia de nombre; el cuchillo ya anda.
2. Verificar en cada servidor, después del cambio de mapa, que `sm plugins list` muestre la 2.10.1.
3. Que Kyan pruebe el nombre entrando con su cuenta (después de la `113`).
4. Publicar `CHANGELOG_DISCORD.txt` en Discord. La parte del nombre recién funciona con la `113` aplicada.
5. Llevar el cambio a `main` / `feat/frontend-fase-1` (Daniel), con el parche de `build_2.10.1/`.
6. Desplegar la web para que `/privacidad` muestre el párrafo nuevo.

## Volver atrás

- Plugin: en cada servidor, `plugins/disabled/csstv_reporter_2.10.0.smx` a `plugins/csstv_reporter.smx` (con `files/rename` del panel), sin partida en curso. Entra en el próximo mapa.
- Solo el nombre: `csstv_web_names 0` en `csstv_reporter.cfg`.
- Base: la inversa de la `113`.

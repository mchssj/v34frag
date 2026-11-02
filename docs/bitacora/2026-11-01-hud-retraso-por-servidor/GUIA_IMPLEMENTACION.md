# Retraso del HUD por streamer y por servidor: guía de implementación

## Estado

**Implementado y probado en local el 2026-11-01**, con commit en `feat/frontend-fase-1` (copiado también a `feat/backend-api-fase-1`) y **desplegado en el VPS el 2026-11-01** (`e0aa0ccc791d`, que tiene el mismo relay que `3c6358b7`). Relay 2.3.0. Solo cambia el relay, incluida su propia API (`api/control` y `api/status`). No cambian la base, la API del backend, la web ni los plugins, así que no hay nada que subir al real ni a flow: solo al VPS.

La solución urgente del 2026-11-01 (`"delay": 0` en `/etc/cmleague/hud.json`, respaldo en `hud.json.bak_20261101`) se sacó el 2026-11-02: `"delay"` volvió a `null` y cada streamer elige en `/control`.

## Cambios respecto del plan

- Las dos decisiones abiertas las tomó Daniel el 2026-11-01: **por streamer y por servidor**, y **cualquier streamer** puede elegir En vivo.
- La historia guarda 315 s (300 más un margen para que entre una foto completa), no 300.
- La secuencia se filtra una sola vez por canal (`gate`) antes de repartir el paquete a las vías.
- Se marcan como miradas las vías de quienes tienen `/hud` **o** `/control` abierto, para que no se borre la vía que alguien está por usar.

## Archivos

| Archivo | Cambio |
|---|---|
| `hud/relay/src/channel.ts` | Historia y vías por retraso |
| `hud/relay/src/control.ts` | `delays` por servidor |
| `hud/relay/src/hub.ts` | Estado por vía, `status`, log y limpieza |
| `hud/relay/src/main.ts` | Modo local, log del retraso al arrancar, versión 2.3.0 |
| `hud/relay/public/control.html`, `control.js` | Tarjeta Retraso y aviso |
| `hud/relay/test/retraso.test.ts` | 13 pruebas nuevas |

## Pruebas

- `pnpm test`: **47 de 47** (las 34 de antes y 13 nuevas). `pnpm typecheck` y `pnpm build:node` sin errores.
- Prueba de humo en modo local con `pnpm simular 30` (relay en los puertos 27599/18090, configuración en el scratchpad): `api/status` pasó de `tv` (30 s) a `live` (0 s), a 12 s y de vuelta a `tv`; el log registró cada cambio y `relay-control.json` quedó con `delays: {}`. La página `/control` no se miró en el navegador.

## Despliegue (hecho el 2026-11-01)

- `deploy/vps/desplegar.sh hud` desde `feat/frontend-fase-1`: 47 pruebas, build, subida a `/srv/cmleague/hud/releases/e0aa0ccc791d` y `/healthz` con `"version":"2.3.0","build":"e0aa0ccc791d"`. La versión anterior (`1a3d9e92badb-local10302031`, la 2.2.1) quedó guardada. Nadie estaba transmitiendo.
- 2026-11-02, Daniel con el usuario `ubuntu` (`deploy` no tiene permiso sobre `/etc/cmleague/`): respaldo `hud.json.bak_20261101_delay0`, `"delay": null` en `hud.json` y `systemctl restart cmleague-hud`. El relay arrancó a las 05:54 UTC con `/healthz` en 2.3.0.

## Pasos que faltan

1. Verlo en `/control` con flow: la tarjeta Retraso, el aviso rojo y dos pestañas de `/hud` con modos distintos.

## Revertir

- Relay: volver a la versión anterior que guarda `desplegar.sh` en el VPS (guarda 5) o desplegar el commit anterior.
- Lo que eligieron los streamers se pierde: la 2.2.1 descarta `delays` al cargar `control.json` (`mergeControl` solo copia los campos que conoce) y lo borra del archivo de todos en el primer cambio que cualquiera haga en `/control`. Si hace falta conservarlo, respaldar `/var/lib/cmleague-hud/control.json` (el `StateDirectory` de `cmleague-hud.service`) antes de revertir y restaurarlo al volver a la 2.3.0.

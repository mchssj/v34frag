# Plan: íconos en el feed de kills del HUD, como el deathnotice de ClientMod

> Planeación original. Estado: **aprobado por Daniel el 2026-10-23** ("solo haz el ajuste de los iconos del deathnotice").

Hoy el feed de kills del HUD de observer ([`2026-10-22-hud-observer`](../2026-10-22-hud-observer/)) muestra el nombre del arma y un "HS". Daniel quiere íconos parecidos a los originales y los agregados del deathnotice de ClientMod: no scope, asistencia con flash, matar ciego, a través del humo y wallbang.

Queda **fuera** de este plan saber a quién mira el observer y ocultar la barra superior del espectador: se analizó el 2026-10-23 y Daniel decidió no tocarlo por ahora.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| De dónde salen los datos | Del `player_death` que extiende `clientmod_deathnotice`: `assister`, `assistedflash`, `penetrated`, `attackerblind`, `smoke` y `noscope` | Verificado el 2026-10-23 por SFTP (solo lectura): `resource/modevents.res` del **servidor real y de RBK** ya tiene esos campos, y los dos tienen `clientmod_deathnotice.smx`. El HUD muestra lo mismo que ven los jugadores |
| Íconos | La fuente `clientmodkillfeed.ttf` de ClientMod: tiene las armas de CS:S, el headshot y los cinco íconos extra (`!` wallbang, `"` asistencia con flash, `#` ciego, `$` humo y `%` no scope) | Son los íconos que ve el streamer en el juego |
| Cómo llega la fuente al HUD | El relay la lee de la instalación de ClientMod del streamer (la tiene, porque el servidor es solo para ClientMod) y la sirve en `/font/killfeed.ttf`. **No va dentro de `relay.exe` ni del repo** | No repartimos archivos de Valve ni de ClientMod |
| Dónde la busca | `gameDir` en `relay.json`. Si es `null`, prueba `C:\` a `F:\CSSv34_ClientMod` | Es la carpeta que usa el instalador de ClientMod |
| Sin la fuente | El feed vuelve a mostrar los nombres de las armas y "HS", y la consola del relay avisa | El HUD sigue funcionando |
| Orden del feed | `[ciego] Atacante + [flash] Asistente [arma] [no scope] [humo] [wallbang] [headshot] Víctima` | El mismo orden que el kill feed de ClientMod |
| Compatibilidad | Los campos nuevos van al final del evento `kill`. El relay nuevo con el plugin 1.0.0 los toma como 0, y el relay 1.0.0 con el plugin nuevo los ignora | Se pueden actualizar por separado |

## 1. Plugin `csstv_hud` 1.1.0

En `Event_PlayerDeath`, el evento pasa a ser:

```
E|kill|<atacante>|<víctima>|<arma>|<headshot>|<asistente>|<flash>|<paredes>|<ciego>|<humo>|<noscope>
```

Sin `clientmod_deathnotice`, `GetInt` y `GetBool` devuelven 0 y el feed queda como uno normal. El resto del plugin no cambia.

## 2. Relay y HUD 1.1.0

- `protocol.ts` y `state.ts`: los campos nuevos en la kill.
- `config.ts`: `gameDir` (por defecto `null`).
- `font.ts` (nuevo): busca `cstrike/resource/clientmodkillfeed.ttf`.
- `server.ts`: `GET /font/killfeed.ttf`.
- `common.js`: la letra de cada arma en la fuente.
- `hud.js` y `hud.css`: el feed con íconos si la fuente carga, y con texto si no.
- `simular.ts`: kills con asistencias, wallbangs, humo, no scope y ciego, para verlo sin servidor.
- Pruebas del evento nuevo, del viejo y de la búsqueda de la fuente.

## 3. Despliegue

- **Plugin:** al servidor real (`SFTP_CSS_*`) y a RBK (`SERVER1_*`) en la misma tanda. En RBK, con `csstv_hud "0"`, porque todavía no tiene el plugin. Es un plugin sin licencia y aparte del reporter: actualizarlo no corta partidas. Se sube **cuando Daniel lo pida**.
- **Relay:** un `relay.exe` nuevo para el streamer.

## 4. Orden de implementación

1. Plugin 1.1.0 y compilarlo.
2. Relay y HUD, pruebas y typecheck.
3. Verlo con `pnpm simular` y sacar una captura.
4. `relay.exe` nuevo.
5. Documentación y despliegue cuando Daniel lo pida.

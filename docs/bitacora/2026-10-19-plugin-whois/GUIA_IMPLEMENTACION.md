# `!whois` en el servidor: guía de implementación

## Estado

**Implementado el 2026-10-19, sin probar y sin desplegar**, a pedido de Daniel ("todavía no hagas pruebas en mi local ni despliegues, solo implementa").

- Hecho: migración de producción, replanteo `23` con su inversa y sus pruebas SQL (escritas, **sin correr**), `csstv/whois.inc`, cvar `csstv_claim`, reporter 2.3.0 y cfg.
- Verificado: el reporter **compila** con el `spcomp` 1.8 del servidor local, con `CSSTV_DEBUG` y sin él, sin errores ni avisos. El build sin `CSSTV_DEBUG` quedó en `server/addons/sourcemod/plugins/csstv_reporter.smx`.
- No se corrió nada contra la Supabase local ni contra el servidor local.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261019180000_whois.sql` | Nuevo: `csstv_steam0` y `csstv_whois` (un SteamID por ficha), para producción |
| `supabase/replanteo/23_whois.sql` | Nuevo: `csstv_whois` con todos los SteamID de la ficha |
| `supabase/replanteo/README.md` | Fila de la `23` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/23_whois.sql` | Nuevo: vuelve a la versión de producción |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/23_whois.sql` | Nuevo: pruebas SQL (con rollback) |
| `server/addons/sourcemod/scripting/csstv/whois.inc` | Nuevo: `!whois` |
| `server/addons/sourcemod/scripting/csstv/claim.inc` | Cvar `csstv_claim` |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 2.3.0, include, `Whois_Init` y `Whois_ClientReset`, encabezado |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Compilado 2.3.0 (sin `CSSTV_DEBUG`) |
| `server/cfg/sourcemod/csstv_reporter.cfg` | `csstv_claim "0"` |

## Pruebas (pendientes)

### 1. Base local (Docker)

1. `cd web/backend && pnpm db:reset`: carga la migración de producción y, después, el replanteo hasta la `23`.
2. `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/correr.sh`: la `23` se aplica, una segunda aplicación aborta, la inversa deja la estructura idéntica y se vuelve a aplicar. Corre `pruebas/23_whois.sql` (18 comprobaciones).
3. Probar la versión de producción sola: `REPLANTEO=0 pnpm db:reset` y llamar a `csstv_whois` con un token creado a mano en `game_servers` (`token_hash` = sha256 del token), por SteamID y por texto.

### 2. Servidor local (`E:\CSS DEDICATED SERVER\server`)

**Envía a la Supabase real:** `csstv_whois` solo lee, pero el resto del plugin no. Poner `csstv_send 0` después de cada carga del cfg (con `csstv_send 0`, `!whois` responde "no está disponible") y vaciar `data/csstv/queue/` antes de reiniciar. Para probar `!whois`, levantar `csstv_send 1` solo mientras se prueba, sin mix en curso, o apuntar `csstv_api_url` a la Supabase local.

1. Compilar con `CSSTV_DEBUG` (los bots tienen un SteamID falso que sale de su nombre).
2. Casos:
   - `!whois` sin argumento: muestra el uso.
   - Un jugador sin permisos: SourceMod responde que no tiene acceso.
   - Nombre parcial de un conectado, un nombre exacto, varios conectados, un bot sin `CSSTV_DEBUG`.
   - Un desconectado por un nick viejo, por el alias y por el nick de la ficha; uno que no existe; un texto de 1 carácter.
   - Un SteamID en `STEAM_0` y en SteamID64.
   - Desde el chat (`!whois`) y desde la consola (`sm_whois`): la respuesta tiene que llegar por el mismo lado.
   - Espera de 3 segundos.
   - `csstv_claim 0`: `!claim` responde que todavía no está disponible.
3. Revisar el log: `!whois de <admin>: …`.

## Despliegue hecho (2026-10-20)

Daniel pidió desplegar sin las pruebas.

1. **Base de producción:** Daniel corrió `supabase/migrations/20261019180000_whois.sql` en el SQL Editor.
2. **Plugin**, con un script SFTP (`paramiko`) que primero solo inspeccionó y después, en cada servidor: pasó la 2.1.1 a `plugins/disabled/csstv_reporter_2.1.1.smx`, subió la 2.3.0 y la volvió a bajar para comparar el md5, agregó `csstv_claim "0"` al final del `cfg/sourcemod/csstv_reporter.cfg` (la copia del cfg anterior quedó solo en local) y dejó en `plugins/disabled/` como mucho 3 versiones anteriores de cada plugin `csstv_*`.

| Servidor | Acceso | `.smx` | md5 | Antes | Borrado de `disabled/` |
|---|---|---|---|---|---|
| Servidor real | `SFTP_CSS_*` | genérico | `dbb117f1bb383a1dfc7b5a9619109a1b` | 2.1.1 (`d96245b1…`) | nada |
| RBK | `SERVER1_*` | licenciado | `cb5ff8854b685700c4deee60a52b4e26` | 2.1.1 (`f3f684f8…`) | `csstv_reporter_1.7.0.smx` |

No se recargó nada: la 2.3.0 se carga en el próximo cambio de mapa de cada servidor. **Falta verificar** (paso 4 de abajo) y publicar el changelog.

## Pasos del despliegue

1. **Base de producción:** Supabase > SQL Editor > pegar `supabase/migrations/20261019180000_whois.sql` > Run. Solo agrega dos funciones y no toca la web vieja. Comprobar que `csstv_whois` existe.
2. **Plugin 2.3.0 en los dos servidores en la misma tanda**, sin recargar con un mix en curso (se carga en el próximo cambio de mapa):
   - **Servidor real** (`SFTP_CSS_*`): el `.smx` genérico.
   - **RBK** (`SERVER1_*`): el build licenciado, `server/build_licenciado.sh be0fd76c-6bdc-477e-a843-6efc309b5ca9 rbk` (sale en `server/licencias/rbk/csstv_reporter.smx`).
3. **cfg de los dos servidores:** agregar `csstv_claim "0"`. **Ojo:** la 2.3.0 trae `!claim`, que antes no estaba en los servidores. Sin `csstv_claim "0"`, `!claim` respondería "No se pudo consultar la web".
4. Verificar en cada servidor: `sm plugins list` (reporter 2.3.0), un `!whois` de un moderador y `!claim` apagado.
5. Publicar el changelog: `CHANGELOG_DISCORD.txt` de esta carpeta.

### En el corte

- La `23` se aplica después de la `22` (la migración de producción ya tiene que estar).
- `csstv_claim "1"` en los dos servidores.

## En qué se apartó del plan

- **Sin link a la web** (Daniel, 2026-10-20): se sacó el cvar `csstv_whois_url` que proponía el plan. `!whois` muestra el nick de la ficha y el alias, sin link.
- Agregados: la consola del servidor también puede usar `!whois`, y la búsqueda acepta `[U:1:N]` porque lo convierte `csstv_steam64`.
- **Respuesta asíncrona:** la respuesta de la web llega después del comando y SourceMod la mandaría a la consola. El plugin guarda si el admin preguntó por chat o por consola y responde por ahí (`SetCmdReplySource`). **`!claim` responde desde su callback sin hacerlo:** conviene verificar en la prueba con un jugador por dónde le llega a él la respuesta.

## Cómo revertir

1. Plugin: volver a subir el reporter 2.1.0 (el que tienen hoy) a los dos servidores, genérico al real y licenciado a RBK. `csstv_claim` puede quedar en el cfg: la 2.1.0 lo ignora.
2. Base de producción: `drop function public.csstv_whois(text, text, text); drop function public.csstv_steam0(text);`.
3. Base local: la inversa de la `23` vuelve a la versión de producción.
4. Código: revertir el commit de este requerimiento.

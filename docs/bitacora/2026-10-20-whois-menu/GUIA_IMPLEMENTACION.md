# Menú de `!whois` cuando hay varias coincidencias: guía de implementación

## Estado

**Implementado el 2026-10-20, sin probar y sin desplegar.**

- Hecho:
  - Migración de producción `20261020120000_whois_menu.sql`.
  - Replanteo `23` reescrito para la función de 4 parámetros, con su inversa y sus pruebas SQL (27 comprobaciones). Las pruebas están escritas, **sin correr**.
  - Reporter 2.3.1.
- Verificado: el reporter **compila** con el `spcomp` 1.8 del servidor local, con `CSSTV_DEBUG` y sin él, sin errores ni avisos. El build sin `CSSTV_DEBUG` quedó en `server/addons/sourcemod/plugins/csstv_reporter.smx` (md5 `774b79c3f9d6a0cfa6869c4c57255613`).
- No se corrió nada contra la Supabase local, la de producción ni el servidor local.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261020120000_whois_menu.sql` | Nuevo: `csstv_whois` con `p_online` y la lista de candidatos; borra la de 3 parámetros |
| `supabase/replanteo/23_whois.sql` | Reescrito: la función de 4 parámetros con candidatos por ficha, y `steam_group`. Todavía no se aplicó en ningún lado |
| `supabase/replanteo/README.md` | Fila de la `23` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/23_whois.sql` | Vuelve a la versión de producción nueva y borra `steam_group` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/23_whois.sql` | Candidatos con el formato nuevo; conectados (también con un adicional de la ficha); tope de 15; nicks con `|` y `;`; la llamada de la 2.3.0 |
| `server/addons/sourcemod/scripting/csstv/whois.inc` | Reescrito: búsqueda con conectados y base, menú, lista en consola |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 2.3.1 |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Compilado 2.3.1 |

## Pruebas (pendientes)

### 1. Base local (Docker)

1. `cd web/backend && pnpm db:reset`: carga las dos migraciones de `!whois` y, después, el replanteo hasta la `23`.
2. `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/correr.sh`: aplicar, segunda aplicación, inversa con la estructura idéntica y volver a aplicar; corre las 27 comprobaciones de `pruebas/23_whois.sql`.
3. La versión de producción sola: `REPLANTEO=0 pnpm db:reset`, un token a mano en `game_servers` y `csstv_whois` por texto con y sin `p_online`.

### 2. Servidor local (con `CSSTV_DEBUG`, que da SteamID falsos a los bots)

**Envía a la Supabase real:** mismos cuidados que en la guía de `2026-10-19-plugin-whois`.

1. Bots con nombres que comparten un pedazo (`dan1`, `dan2`) y un nick parecido en la base de alguien desconectado.
2. Casos:
   - `!whois dan`: menú con los conectados primero; elegir uno conectado (encabezado con su nombre actual) y uno desconectado.
   - `!whois dan1` (nombre exacto): directo, sin menú.
   - Una sola persona (conectado que también aparece por un nick viejo): directo.
   - Más de 15 candidatos: la opción deshabilitada "Hay N…".
   - Desde la consola (`sm_whois dan`): lista en texto con SteamID.
   - Dejar el menú abierto 30 segundos: se cierra solo.
   - El admin se va con el menú abierto o con la consulta en vuelo: nada en el log de errores.

## Despliegue hecho (2026-10-20)

Daniel pidió desplegar sin las pruebas.

1. **Base de producción:** Daniel corrió `supabase/migrations/20261020120000_whois_menu.sql` en el SQL Editor.
2. **Plugin**, con el mismo script SFTP de la 2.3.0 (`paramiko`). Primero inspeccionó y comprobó que los dos tuvieran la 2.3.0 con el md5 esperado (si no, no tocaba nada). Después, en cada servidor: pasó la 2.3.0 a `plugins/disabled/`, subió la 2.3.1 y la volvió a bajar para comparar el md5, y dejó como mucho 3 versiones anteriores del reporter en `disabled/`.

| Servidor | Acceso | `.smx` | md5 | Antes | Borrado de `disabled/` |
|---|---|---|---|---|---|
| Servidor real | `SFTP_CSS_*` | genérico | `774b79c3f9d6a0cfa6869c4c57255613` | 2.3.0 (`dbb117f1…`) | nada |
| RBK | `SERVER1_*` | licenciado | `98dcb36a7db93dc651d15667e6570dd4` | 2.3.0 (`cb5ff885…`) | `csstv_reporter_1.8.0.smx` |

El cfg no cambió (`csstv_claim "0"` ya estaba). No se recargó nada: la 2.3.1 se carga en el próximo cambio de mapa. **Falta verificar** (paso 3 de abajo) y publicar el changelog.

## Pasos del despliegue

1. **Base de producción:** Supabase > SQL Editor > pegar `supabase/migrations/20261020120000_whois_menu.sql` > Run. La 2.3.0 que está en los servidores sigue funcionando con la función nueva (no manda `p_online`), así que se puede correr antes de subir el plugin.
2. **Plugin 2.3.1 en los dos servidores en la misma tanda**, sin recargar (se carga en el próximo cambio de mapa):
   - **Servidor real** (`SFTP_CSS_*`): el `.smx` genérico.
   - **RBK** (`SERVER1_*`): `server/build_licenciado.sh be0fd76c-6bdc-477e-a843-6efc309b5ca9 rbk`.
   - En los dos, la 2.3.0 pasa a `plugins/disabled/csstv_reporter_2.3.0.smx` y en `disabled/` quedan como mucho 3 versiones anteriores del reporter (en el real no se borra nada: quedan la 2.1.0, la 2.1.1 y la 2.3.0; en RBK se borra la 1.8.0).
   - El cfg no cambia.
3. Verificar: `sm plugins list` (2.3.1) y un `/whois` que abra el menú.
4. Publicar el changelog: `CHANGELOG_DISCORD.txt` de esta carpeta.

**Orden importante:** la 2.3.1 sin la migración nueva falla. La función de producción de hoy no tiene `p_online`, así que PostgREST responde un error y el admin ve "No se pudo consultar la web". Primero la base, después el plugin.

### En el corte

La `23` va después de la `22` y necesita las dos migraciones de `!whois` aplicadas.

## En qué se apartó del plan

Nada.

## Cómo revertir

1. Plugin: volver a la 2.3.0 (`plugins/disabled/csstv_reporter_2.3.0.smx`) en los dos servidores.
2. Base de producción: la 2.3.0 funciona con la función nueva, no hace falta tocarla. Para volver a la anterior: correr de nuevo `supabase/migrations/20261019180000_whois.sql` después de `drop function public.csstv_whois(text, text, text, text);`.
3. Código: revertir el commit de este requerimiento.

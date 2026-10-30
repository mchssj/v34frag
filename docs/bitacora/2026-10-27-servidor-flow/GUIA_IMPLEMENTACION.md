# Servidor de flow (CMLeague #3): guía de implementación

## Cambios respecto del plan

- **Sin mapas** (pedido de Daniel, 2026-10-27): el paquete no lleva `maps/`. La lista de los que tiene que tener flow está en `flow/LEEME.txt` y en la documentación.
- `armar_flow.py` se puede volver a correr: salta los archivos que ya bajó con el mismo tamaño.

## Datos de flow

| Qué | Valor |
|---|---|
| UUID en `game_servers` | `7b01c85b-bc3e-4aa3-9ab5-3c2044157034` |
| Token | `.env`: `FLOW_CSSTV_SERVER_TOKEN` |
| Tag | `flow` |
| Acceso | Ninguno (ni panel ni SFTP): se le pasa la carpeta `flow/` |

## Pasos

1. Token en el `.env` (`FLOW_CSSTV_SERVER_TOKEN`) y `flow/` en el `.gitignore`.
2. Armar el paquete (solo lectura sobre el #1 y RBK), con `paramiko` en un entorno virtual aparte:

   ```bash
   python -I -u docs/bitacora/2026-10-27-servidor-flow/pruebas/armar_flow.py "E:/Css V34 Web/v34frag/flow"
   ```

3. Reporter licenciado y copia al paquete:

   ```bash
   bash server/build_licenciado.sh 7b01c85b-bc3e-4aa3-9ab5-3c2044157034 flow
   cp server/licencias/flow/csstv_reporter.smx flow/cstrike/addons/sourcemod/plugins/
   ```

   Resultado del 2026-10-27: 116417 bytes, md5 `0697263ae530ab2cf4ae2a3e7ce92281` (reporter 2.5.0, el mismo fuente que el #1 y RBK).

4. Pasarle a flow la carpeta `flow/` (con `LEEME.txt`). flow la copia sobre `cstrike/`, completa `rcon_password`, `sv_password`, `sv_downloadurl` y `csstv_calladmin_address`, y reinicia.

## Verificar (cuando flow lo instale)

- En la consola: `meta list` (Stripper y SourceMod), `sm plugins list` (`CSSTV Match Reporter (2.5.0)` y los demás `csstv_*` sin errores) y `sm exts list`.
- En la base: `game_servers.last_seen_at` y `plugin_version` de flow se actualizan.
- Un mix de prueba llega a la web con el tag `flow`.

## Próximos despliegues

flow está en la lista de servidores externos de `CLAUDE.md`. Como no tenemos acceso, cada despliegue a flow es **mandarle los archivos** (build licenciado nuevo con el UUID de arriba y los cfgs que cambien) en la misma tanda que el #1 y RBK, y anotar cuándo confirma que los instaló.

## Revertir

Lo instala flow: para sacarlo, que borre lo que copió. En nuestro lado, desactivar el servidor en `game_servers` (`active = false`) corta los envíos.

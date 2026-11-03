# `!claim` en la primera partida y varios SteamID: guía de implementación

## Estado

**Base y web en staging desde el 2026-11-02**, con commit. **El reporter 2.9.1 no se subió a ningún servidor** (el #1 tiene el 2.9.0, subido ese mismo día). No se probó con un cliente real entrando desde otra PC.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/58_claim_varios_steamid.sql` | Nuevo: `claim_with_code` (al instante + `admin_steam_linked`), `csstv_mm_poll` y `csstv_mm_report` con `player_steam_all`, `notification_category` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/58_claim_varios_steamid.sql` | Nueva |
| `server/addons/sourcemod/scripting/csstv/mm.inc` | Recordatorio del `!claim` también con todos vinculados (y no entre mapas) |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 2.9.1 |
| Seis archivos de `web/frontend` | Textos (ver `DOCUMENTACION.md`) |
| `web/frontend/src/features/shell/notifications/lib/model.ts` | `admin_steam_linked` |

Commits: `02df0fd7` y `7ec0a27a` en `feat/mm-claim-en-sala`; `21dc2fb3` en `feat/frontend-fase-1`.

## Despliegue en staging (hecho el 2026-11-02)

- **Base:** `58` aplicada en `edaljnirzvisiaathitt` sin errores. Verificado: `claim_with_code` con `admin_steam_linked` y `csstv_mm_poll` con `player_steam_all`.
- **Web `21dc2fb36f7e`** (la misma tanda que el aviso de Discord): el bundle tiene "¿Juegas desde otra PC?".
- La API no cambió para esto.

## Pruebas

- **Base:** `bash pruebas/correr_local.sh "E:/Css V34 Web/v34frag-mmclaim"` → 11 comprobaciones y la inversa: el segundo SteamID se suma al instante sin pedido, con aviso a los admins y a la cuenta; al máximo sigue el pedido; el poll de la sala trae los dos SteamID y `connected` reconoce el nuevo.
- **CRLF:** la `58` y su inversa se aplicaron también desde copias en CRLF (`reemplazar` ignora los `\r`).
- **Plugin:** compila sin advertencias. Sin probar en un servidor.
- **Web:** typecheck, lint y 514 pruebas en verde (con el trabajo del manual de la carpeta de trabajo); 499 en la carpeta limpia del despliegue.

## En qué se apartó del plan

- **`reemplazar` sin `\r`:** no estaba en el plan. La inversa de la `56` falló por eso en la prueba con bots, y la `58` usa textos de varias líneas.
- **El recordatorio no sale entre mapas** de una serie (`g_bMmBetween`): ahí la gente está esperando el mapa siguiente.

## Falta

1. **Reporter 2.9.1 en el #1** (licenciado, `server/build_licenciado.sh 96bb5060-… srv1`), en el próximo cambio de mapa. El resto de los servidores, con el corte.
2. Probarlo con alguien que entre a una partida desde otra PC.
3. Producción, con el corte (junto con la `48`).

## Cómo revertir

- Base: la inversa de la `58`. Los SteamID que ya se sumaron al instante quedan sumados.
- Plugin: volver al 2.9.0.

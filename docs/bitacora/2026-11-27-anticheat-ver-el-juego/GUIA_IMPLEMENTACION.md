# El anticheat ve el juego de verdad: guía de implementación

## Estado

Implementado en la rama `kyan/ac` (2026-11-27), **sin probar con el juego abierto ni contra una base**, y sin desplegar. Lo que quedó después, en el agente 0.5.0 y el Bridge 1.2.0, está en [`2026-11-27-anticheat-deteccion`](../2026-11-27-anticheat-deteccion/GUIA_IMPLEMENTACION.md).

## Archivos

| Archivo | Cambio |
|---|---|
| `agent/src/core.h` | `GameState { clientmod, hl2, pid }` |
| `agent/src/evidence.cpp` | `GameScan`, módulos cada 5 s en sesión, captura de todo el monitor, sin aviso en las capturas pedidas |
| `agent/src/main.cpp` | El latido manda `game` y lee el perfil |
| `supabase/replanteo/156_anticheat_juego.sql` | Columnas del juego en `ac_devices`, `kind = 'module'`, latido con `p_game` y perfil, Bridge con `hl2_detected` y `game_not_seen` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/156_anticheat_juego.sql` | Inversa |
| `web/backend/src/schemas/anticheat.ts` | `game`, `profile` y `server_name` |
| `web/backend/src/routes/anticheat.ts` | Pasa `p_game` |
| `web/backend/src/routes/anticheat-evidence.ts` | Acepta `module` |
| `server/addons/sourcemod/scripting/cml_anticheat_bridge.sp` | Los códigos `AC-1` a `AC-3`, con el motivo en el log |
| `web/frontend/src/features/admin/anticheat/AdminAnticheatPage.tsx` | El bloque **Módulos del juego** |
| `web/frontend/src/routes/_app/anticheat.vincular.tsx` | Solo "Al aprobar, aceptas los términos y la política de privacidad" |

## Despliegue (pendiente)

Va junto con la detección, en el orden de su guía: replanteos `156` a `159`, API, web, agente y Bridge en **#1, #2 y #3** en la misma tanda.

## Pruebas

| Qué | Resultado |
|---|---|
| Compilación del agente (`agent\build.bat`, `/W4 /WX`) | Sin advertencias |
| Tipos y pruebas unitarias de la API | Pasan (580) |
| Tipos, lint y pruebas del admin en la web | Pasan |
| `GameScan` con `--detect` en la PC de Kyan, sin el juego | Ve que no hay `CMLauncher.exe` ni `hl2.exe` |
| **Con ClientMod abierto** | **No se probó.** Falta ver si encuentra `CMLauncher.exe`, si el EAC deja listar los módulos y si la captura toma todo el monitor |
| **Replanteo `156`** | **No se aplicó:** no había Postgres ni Docker |
| **Bridge** | **No se compiló:** el `spcomp` 1.8 está en el servidor de pruebas de Daniel |

## En qué se apartó del plan

- El plan proponía la versión 0.4.0 del agente. Salió directo como 0.5.0, junto con la detección.
- El plan buscaba la ventana más grande del juego para capturarla. Kyan pidió después **todo el monitor**, por los overlays externos: se captura el monitor donde está esa ventana.
- El consentimiento y la página de vinculación quedaron sin ninguna lista: solo la aceptación de los términos y la privacidad (Kyan, 2026-11-27).
- Las pruebas de integración de la API con `hl2_detected` y `game_not_seen` no se escribieron: necesitan la base local.

## Incidentes durante las pruebas

- Una prueba de captura abrió el Bloc de notas con un `.txt` de Kyan. Desde entonces, los procesos de prueba se abren ocultos.

## Cómo revertir

- Base: la inversa `reversas/156_anticheat_juego.sql`, **después** de las de la `159`, `158` y `157`.
- Servidores: volver a poner el `cml_anticheat_bridge.smx` anterior, en el próximo cambio de mapa.
- Código: `git revert` del commit en `kyan/ac`.

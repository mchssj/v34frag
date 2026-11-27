# `!banlist` en los servidores: guía de implementación

## Estado

Desplegado el 2026-11-27 (UTC): replanteo `154` y reporter 2.12.1 subido a **#1, #2 y #3** (la 2.12.0 en `plugins/disabled/csstv_reporter_2.12.0.smx`). Entra en el próximo cambio de mapa o reinicio de cada uno. Commit `bc4a4a47`.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/bans.inc` | `Cmd_BanList` y `Bans_OnList` |
| `server/addons/sourcemod/scripting/csstv_reporter.sp`, `plugins/csstv_reporter.smx` | 2.12.1 (`877d2e02…`), `spcomp` 1.8.0.5963 |
| `supabase/replanteo/154_csstv_ban_list.sql` e inversa | Base |
| `pruebas/prueba_154.sql`, `pruebas/base_falsa.py`, `pruebas/desplegar.py` | Pruebas y despliegue |
| `docs/manual/moderador/comandos-en-el-servidor.md` | Manual |

## Pruebas

- Base: `prueba_154.sql` contra producción con `rollback`: el más nuevo primero, nombre y motivo limpios de `|`, `;`, comillas, barras y saltos de línea.
- Plugin: servidor local (`-condebug -nohltv`) contra `base_falsa.py`, que devuelve la lista real (sacada con `rollback`): muestra los 13 baneos y `sm_banlist tormenta` deja uno.
- Después del `154`, con el token del #1 por HTTP: 200 y 13 baneos.

## Despliegue

1. `154` como `supabase_admin`.
2. Sin mixes en curso, `pruebas/desplegar.py .env --hacer`: 2.12.0 (`c00156df…`) a `disabled/` y 2.12.1 en su lugar, comparadas.

## Falta

- Después del reinicio o cambio de mapa: `sm plugins info csstv_reporter.smx` (2.12.1) en los tres y probar `!banlist` desde el juego.

## Cómo revertir

`plugins/disabled/csstv_reporter_2.12.0.smx` a `csstv_reporter.smx` en los tres; la inversa del `154`.

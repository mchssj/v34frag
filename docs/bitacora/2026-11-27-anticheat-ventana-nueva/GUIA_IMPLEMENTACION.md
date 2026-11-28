# Ventana nueva del anticheat: guía de implementación

## Estado

Implementada en la rama `kyan/ac`, en el agente 0.5.0 (2026-11-27). Se revisó en imágenes, **sin probarla vinculada** contra una API, y sin distribuir.

## Archivos

| Archivo | Cambio |
|---|---|
| `agent/src/ui.cpp` | El dibujo nuevo: barra de título, perfil, tarjeta de estado y pie. El consentimiento sin listas. Escala las capturas a 1280 px (de la detección) |
| `agent/src/core.h` | `kWidth = 460`, `kHeight = 320`, `kTitleBar = 40`. `UiState` suma `nick`, `memberSince`, `serverName`, `avatar` y `hl2Open`. `ButtonId` suma `BtnLink` |
| `agent/src/main.cpp` | `ApplyProfile` y `MemberSince`, bajar la foto, `BtnLink` abre `/privacidad` y la confirmación antes de desvincular |
| `agent/src/net.cpp` | `HttpGet(url, maxBytes)` |
| `supabase/replanteo/156_anticheat_juego.sql` | `profile` y `session.server_name` en el latido |
| `web/backend/src/schemas/anticheat.ts` | Los mismos campos en la respuesta |

## Despliegue (pendiente)

Va con el agente 0.5.0: ver la guía de [`2026-11-27-anticheat-deteccion`](../2026-11-27-anticheat-deteccion/GUIA_IMPLEMENTACION.md).

## Pruebas

| Qué | Resultado |
|---|---|
| Compilación (`/W4 /WX`) | Sin advertencias |
| Cada pantalla, dibujada a imagen con `--render` | Revisadas: [`consentimiento.png`](consentimiento.png), [`pantallas.png`](pantallas.png) y [`00-ventana-del-agente.png`](../2026-11-27-anticheat-deteccion/capturas/00-ventana-del-agente.png) |
| **Vinculada contra una API, con foto real** | **No se probó** |

## En qué se apartó del plan

- Se sumó la pantalla de equipo bloqueado (`AC-5`), que viene del ban por máquina.
- **CERRAR SESIÓN** pide confirmación antes de desvincular: un clic por error dejaba al jugador sin poder entrar a un mix.

## Cómo revertir

Volver a distribuir el agente anterior. Con la `156` aplicada, un agente viejo sigue funcionando: ignora `profile` y `server_name`.

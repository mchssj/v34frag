# Plan: la cámara de la SourceTV sigue al jugador enfocado del HUD

> Planeación original. Estado: **aprobado en la conversación del 2026-11-02**: hacerlo desde la PC del streamer, sin cambiar el plugin, el relay ni el HUD.

Hoy el streamer cambia de jugador dos veces: en `/control` (la tarjeta grande del HUD) y en su juego (la cámara de la SourceTV). La idea es que lo elija una sola vez, en `/control`, y que un programa en su PC mueva la cámara del juego al mismo jugador.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Dónde corre | Un programa en la PC del streamer (el "agente de cámara") | No cambia el plugin `csstv_hud`, el relay ni el HUD: no hay nada que subir a los servidores ni al VPS |
| Seguir al director de SourceTV | Descartado | Probado en `cssds` el 2026-11-02: `hltv_chase` y `hltv_fixed` del director no llegan a los plugins (0 en 3 minutos con 10 bots), solo `hltv_rank_*` y `hltv_status` |
| De dónde saca el jugador | Del mismo `/events` que usa el HUD (`event: control` trae `focus`, `event: state` trae los jugadores con nombre) | Ya existe y sirve igual en el modo local (`http://127.0.0.1:8090/`) y en el VPS (`https://hud.cmleague.lat/s/<token>/`) |
| `page` en `/events` | `page=control` | El relay cuenta las conexiones `hud` como "transmitiendo" (Administración › Servidores); el agente no es un HUD |
| Cómo mueve la cámara | Escribe en la consola del juego, como `render/render_clip.py`: tecla de consola, Backspace, el texto con `WM_CHAR` y Enter, con `hideconsole; gameui_hide` al final | Es lo único que se probó que funciona con ClientMod (los cfg y los atajos no) |
| Comando | `spec_player "<nombre>"`. El modo de la cámara (primera persona o persecución) no se toca | El streamer elige el modo como siempre |
| Nombres que no se pueden escribir (`™`, `愛`, comillas, `;`) | No se mueve la cámara y se avisa en la ventana del agente | El truco de `spec_next` de `render_clip.py` necesita el índice de entidad de cada jugador, y el HUD no lo tiene (solo el `uid`). Agregarlo es un cambio en el plugin |
| Jugador muerto | No se mueve la cámara | La SourceTV no puede seguir a un muerto. El estado de `/events` ya viene con el retraso de `tv_delay`, igual que la imagen |
| Lenguaje | PowerShell 5.1 con un poco de C# (`Add-Type`) para los mensajes de Windows | Viene con Windows: el streamer no instala nada. Node no puede mandar mensajes a ventanas sin un módulo nativo |
| Administrador | El agente se vuelve a abrir como administrador (un aviso de UAC) | El launcher de ClientMod corre como administrador y Windows no deja que un programa sin esos permisos le mande teclas |
| Adelantarse a las kills | No | El agente solo usa lo que ya ve el HUD (con retraso). Darle el estado en vivo rompería la regla de "en torneos solo transmite alguien neutral" |

## 1. El flujo completo

```mermaid
sequenceDiagram
    participant C as /control (navegador)
    participant R as Relay
    participant A as Agente de cámara
    participant J as CS:S (SourceTV)
    participant H as HUD (OBS)
    C->>R: focus = uid
    R-->>H: event: control (focus)
    R-->>A: event: control (focus)
    A->>A: nombre del uid en el último state; ¿vivo? ¿escribible?
    A->>J: consola: spec_player "nombre"; hideconsole; gameui_hide
    Note over J,H: la cámara y la tarjeta cambian juntas
```

## 2. El agente (`hud/camara/`)

- `camara.ps1`: el agente.
  - Parámetros: `-Url` (el link de `/control` o de `/hud` del streamer; por defecto `http://127.0.0.1:8090/control`), `-Ventana` (por defecto `CS:S v34 ClientMod`) y `-Prueba` (escribe los comandos en pantalla en lugar de mandarlos al juego).
  - Lee `/events?page=control` y se vuelve a conectar solo si se corta.
  - Guarda el último `state` y el último `control`. Cuando `focus` cambia a un jugador, busca su nombre y manda el comando. Si el jugador está muerto o no se puede escribir, lo dice y no hace nada.
  - Si no encuentra la ventana del juego, lo dice y sigue escuchando.
- `camara.bat`: doble clic para abrirlo (`powershell -ExecutionPolicy Bypass`), con el link como argumento opcional.

## 3. Cambios fuera de `hud/camara/`

- `hud/relay/README.md`: una sección en la guía del streamer.
- Nada en el plugin, el relay, el HUD ni la base. Nada que desplegar en los servidores.

## 4. Pruebas

1. **Sin el juego:** relay local (`pnpm start`) con `pnpm simular`, el agente con `-Prueba`, y cambios de `focus` por `POST /api/control`: tiene que escribir el comando correcto, ignorar muertos y nombres no escribibles, y volver a conectarse si se reinicia el relay.
2. **Con el juego, en `cssds`:** `csstv_hud` apuntando al relay local, bots, ClientMod conectado a la SourceTV y OBS grabando. Hay que ver:
   - si `spec_player` funciona en una SourceTV en vivo (en las demos sí);
   - cuánto se ve la consola en la captura de OBS.

## 5. Requisitos antes de empezar

- Node 24 y `pnpm install` en `hud/relay` (para el relay local y la simulación).
- Para la prueba con el juego: ClientMod en la PC y alguien que acepte el aviso de UAC y conecte el juego a la SourceTV.

## 6. Orden de implementación

1. `hud/camara/camara.ps1` y `camara.bat`.
2. Prueba sin el juego.
3. Prueba con el juego en `cssds`.
4. Guía del streamer, `DOCUMENTACION.md`, `GUIA_IMPLEMENTACION.md` y la fila en `docs/bitacora/README.md`.

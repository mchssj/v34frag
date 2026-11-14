# Las voces de los jugadores en los clips grabados con el v34: guía de implementación

## Estado

Hecho y probado en la PC de Daniel el 2026-11-14 (sin el juego y con el juego, con el v34 de `E:\CSS v34 eXpandedCS`), commiteado en `main` el 2026-11-14. Falta probarlo en el portátil y pasar la tarea a `"client": "v34"`.

## Archivos

| Archivo | Cambio |
|---|---|
| `render/leer_demo.py` | `Demo.voice` (los paquetes `svc_VoiceData`: tick, cliente y datos) y `Demo.voice_codec` (de `svc_VoiceInit`). `Bits.bytes` |
| `render/voces.py` | Nuevo: `is_opus`, el Ogg Opus mínimo, `decode` (FFmpeg con `libopus`) y `track` (las voces de un tramo en un `.wav`) |
| `render/render_clip.py` | `voice_enable 1; voice_modenable 1; voice_scale 0` en el cfg con `"v34"`. `ffmpeg_segment(voices=…)`: mezcla con `amix` y `alimiter`, en 44,1 kHz estéreo. El adelanto del sonido del juego (`GAME_AUDIO_ADVANCE_V34`, `game_audio_advance`). `encode(voice=…)` arma las voces de cada tramo |
| `render/procesar.py` y `render/probar_jugada.py` | Le pasan `voice=d.voice` a `encode` |
| `render/CONFIGURAR_PORTATIL.md` | Paso 3b: las voces, `voice_delay` y `game_audio_advance` |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx` y `terms/privacidad.html` | Los clips y las demos incluyen el chat de voz |
| `web/frontend/src/features/legal/lib/meta.ts`, `terms/privacidad.html` y `terms/terminos.html` | Fecha de actualización: 14 de noviembre de 2026 |

## Despliegue

1. Commit en `main` (hecho el 2026-11-14) y `git pull` en el portátil, con la tarea "CMLeague clips" sin una corrida a mitad.
2. En el portátil, grabar el clip de siege con `render\config.v34.json` y escucharlo.
3. Pasar la tarea a `"client": "v34"` en `render\config.json` del portátil (decisión de Daniel).
4. La web (por `/privacidad`) sale con el próximo despliegue de la web. Las páginas de `terms/` se publican con las demás.

## Pruebas

### La prueba antes del plan (2026-11-14)

- Con un `leer_demo.py` modificado en el scratchpad, la demo de `srv2-20261113T174548-aa29` y el 4k de siege (`53900f5c`): 4 jugadores hablan en el tramo, 637 cuadros, decodificados sin errores a 480 muestras por cuadro.
- Comparadas cada 10 ms con el audio del clip de ClientMod (`pruebas/comparar.py`): correlación 0,66 con 220 ms de corrimiento poniendo cada paquete en su tick, y 0,70 con los cuadros seguidos y 280 ms.
- La primera versión sonaba con "un efecto leve de interferencia" con varios hablando (Daniel): eran los cuadros pisados y los huecos. La segunda, con los cuadros seguidos, "se escucha bien".

### Sin el juego

- `voces.track` con el tramo de siege: 4 jugadores, 4,0 s. Contra el audio de ClientMod: 0,72 sin corrimiento.
- `leer_demo` lee la demo de cache en 1,0 s (antes 1,1 s) y guarda 26.562 paquetes de voz; `is_opus` da verdadero.
- La cámara (`2026-11-13-render-clutch-perdido-y-ancla-muerta/pruebas/revisar_camara.py`) da lo mismo que con `main` en dos partidas (54 líneas iguales).
- `ffmpeg_segment` con cuadros y sonido de prueba: con sonido del juego y voces, 5 s en 44,1 kHz estéreo; solo con voces y el último cuadro congelado, 6 s en 44,1 kHz estéreo.
- Las pruebas de legales de la web (`src/features/legal`): 4 de 4.

### Con el juego, en la PC

El 4k de spr en cbble (`35ce97f9`, 3 tramos, hablan 6 jugadores), con `probar_jugada.py` y `"client": "v34"`, comparado con el mismo clip grabado con ClientMod por el portátil:

1. Primera grabación (con `voice_enable 0`): 2 pasadas, 118 s de sesión, sin íconos de voz. **El audio salió mono a 48 kHz**: `amix` tomaba el formato de las voces. Arreglo: `aformat` a 44,1 kHz estéreo antes de mezclar (la prueba de `ffmpeg_segment` de arriba).
2. Segunda grabación: 44,1 kHz estéreo. Las voces solas de los 3 tramos contra el audio de ClientMod: 0,58 sin corrimiento. Pero el clip entero daba la mejor coincidencia a −170 ms: al restarle las voces (`pruebas/restar_voces.py`), el sonido del juego del v34 quedaba 170, 160 y 180 ms atrasado en los tres tramos. En ClientMod los disparos suenan en el tick de la kill (+35 y +53 ms en las dos más limpias).
3. Daniel pidió que se vieran los íconos de quién habla: `voice_scale 0` en vez de `voice_enable 0`. Y el sonido del juego se adelanta 0,17 s.
4. Tercera grabación: 112 s de sesión. El sonido del juego contra el de ClientMod: la mejor coincidencia en 0 ms (0,47, 0,29 y 0,86 en los tres tramos). Se ven los íconos de voz (lucybesteN, TEODORO PIRORO, GabeV), sin el ruido. En Drive: "spr cbble - v34 con voces decodificadas y sonido adelantado (prueba)".

## En qué se apartó del plan

- **`voice_scale 0` en vez de `voice_enable 0`:** Daniel quiso que se vieran los íconos de quién habla. Con la voz prendida y sin volumen, se ven y no suena el ruido.
- **El adelanto del sonido del juego (`game_audio_advance`):** no estaba en el plan. Apareció al comparar con ClientMod: el `.wav` de `startmovie` del v34 queda 0,17 s atrasado.
- **El formato de la mezcla (`aformat`):** sin él, el video salía mono a 48 kHz.

## Cómo revertir

Revertir el commit y `git pull` en el portátil. Con `"client": "v34"` las voces vuelven a sonar como interferencia y el sonido del juego vuelve a quedar 0,17 s atrasado. Para solo apagar algo sin revertir: `"game_audio_advance": 0` en `config.json` quita el adelanto. Las voces no tienen una clave para apagarlas: con `"client": "clientmod"` no se usan.

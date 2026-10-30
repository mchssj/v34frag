# Misiones semanales y Primeros pasos (prototipo)

Prototipo de Kyan para que lo terminen Daniel (backend y plugin) y Esteban (frontend). Está en el frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), en `/demo/misiones`, solo con `pnpm dev`.

Hay dos tipos de misiones:

| Tipo | Qué son | Cómo se renuevan |
|---|---|---|
| **Semanales** | De juego y de comunidad: jugar, ganar, kills, HS, entradas, mapas, PCW… | Cada lunes salen nuevas al azar. Una que salió no vuelve hasta dentro de 2 semanas |
| **Primeros pasos** | Las de la web: votar un clip, subir un clip, entrar a la web 3 días distintos, comparar, buscar, equipar un cosmético, comprar en la tienda, anotarse a un evento… | **Una sola vez desde que te registrás.** No rotan, no se reinician y pagan una vez |

## Qué ve el jugador

- **Popout:** un botón con una mira en la barra de arriba. El número en naranja son las misiones completas que todavía no reclamó, de los dos tipos. El panel tiene dos pestañas:
  - **Esta semana:** cuánto falta para que se renueven, el bonus, las 6 para todos y las 3 VIP.
  - **Primeros pasos 3/14:** las de una sola vez. Las reclamadas van al final, y la pestaña muestra un punto naranja si hay alguna para reclamar.
- **Página de Misiones:** la semana completa, Primeros pasos, el saldo de puntos y de monedas VIP, y las semanas anteriores.
- **Sin VIP:** las misiones VIP, semanales y de Primeros pasos, se ven borrosas con candado.

| | Cuántas | Premio |
|---|---|---|
| Semanales para todos | 2 fáciles, 3 medias y 1 difícil | 30, 60 y 120 puntos |
| Bonus por completar las 6 semanales | — | 150 puntos |
| Semanales VIP | 1 de cada dificultad | 20, 40 y 80 monedas VIP |
| Primeros pasos | 11 para todos y 3 VIP | La misma tabla por dificultad |

Los puntos son los de la tienda (un mix da 10 o 15). Las monedas VIP son las de la progresión VIP.

## La rotación de las semanales

- **Semana:** empieza los lunes a las 06:00 de Argentina.
- **Cómo se eligen:** al azar, con una semilla por semana, así que la misma semana siempre da las mismas misiones.
- **Espera:** una misión que salió **no vuelve hasta dentro de 2 semanas**.
- **Misma stat:** en una semana no puede salir dos veces la misma stat. Por ejemplo, "Ganá 1 mix" y "Ganá 3 mixes" no salen juntas.
- **Orden:** se elige de la más difícil a la más fácil, porque las difíciles tienen menos opciones.
- **Si no alcanza:** primero deja repetir la stat y después afloja la espera, y en los dos casos avisa en la vista de admin.

Las de Primeros pasos no entran nunca en la rotación.

```mermaid
flowchart LR
  S1[Semana 1<br/>salen A, B, C] --> S2[Semana 2<br/>A, B y C no pueden]
  S2 --> S3[Semana 3<br/>A, B y C no pueden]
  S3 --> S4[Semana 4<br/>A, B y C vuelven al sorteo]
```

## Las misiones y los datos del servidor

Las misiones de juego usan **los mismos datos que las medallas** (`docs/MEDALLAS_DATOS_REPORTER.md`). Cada métrica dice de dónde sale:

| Fuente | Qué es | Dónde se usa |
|---|---|---|
| Plugin 1.8 | Lo que el `csstv_reporter` ya manda: kills, HS, asistencias, daño, entradas, k3 a k5, plantadas, defuses, rondas jugadas, mapa y ganador | Semanales que salen desde ya |
| Web | Eventos de la web: días que entraste, clips, demos, comparador, buscador, tienda, cosméticos, exportar stats y eventos | Primeros pasos |
| Plugin nuevo | Lo que hay que pedir en la próxima versión del plugin (schema 2): kills por arma, clutchs, rondas sobrevividas, pistolas, ecos y bombas explotadas | 9 semanales que **esperan** |
| Falta sistema | Necesita algo que todavía no existe | 3 semanales que **esperan**: jugar con alguien de tu grupo (dos, con los grupos del matchmaking) e invitar a un amigo (referidos) |

Las que esperan **quedan en el catálogo pero no se muestran** (`isReady`). Cuando salga el plugin nuevo, alcanza con sumar `"plugin_v2"` a `READY_SOURCES` en `catalog.ts` y entran solas. El test comprueba que siguen respetando la espera.

**No se usan:** el MVP del mix, porque todavía no hay fórmula, y las flashes efectivas, wallbangs y noscopes, porque v34 no los tiene.

**Números:** hay 55 semanales y 14 de Primeros pasos.

- De las semanales, 43 ya pueden salir y 12 esperan.
- Las que ya pueden salir son 11 fáciles, 10 medias y 6 difíciles para todos, y 6, 5 y 5 VIP.
- Con la espera de 2 semanas el mínimo es 6, 9 y 3 para todos y 3 de cada VIP, así que alcanza.
- En 2 meses sale más del 80 % de las semanales.

## Cambiar las misiones

Todo está en `features/missions/catalog.ts`:

| Qué | Dónde |
|---|---|
| Sumar, sacar o cambiar una semanal | `MISSIONS` (helper `w`), una fila por misión: título (`{n}`, `{map}` y `{weapon}` se reemplazan), área, métrica, objetivo, dificultad, VIP y activa |
| Sumar, sacar o cambiar una de Primeros pasos | `FIRST_STEPS` (helper `o`), mismas columnas |
| Apagar una sin borrarla | `active: false` |
| Lo que paga cada dificultad | `REWARDS` y `WEEK_BONUS` |
| Cuántas semanales salen por semana | `SLOTS` |
| Semanas de espera | `COOLDOWN_WEEKS` |
| Qué datos ya existen | `READY_SOURCES` |

La vista **Admin → Misiones** del demo muestra:

- Si alcanzan las semanales de cada dificultad.
- Las próximas 8 semanas. Al tocar una misión se resaltan las semanas en las que sale.
- El catálogo completo, con las de Primeros pasos marcadas "Una vez". Cada fila tiene un switch para activarla, el objetivo editable y la fuente de los datos.
- El switch **Simular el plugin nuevo**.

## Archivos (en `web/frontend/src/`)

| Archivo | Qué tiene |
|---|---|
| `features/missions/catalog.ts` | Métricas con su fuente, semanales, Primeros pasos, recompensas y reglas |
| `features/missions/rotation.ts` | `pickWeek`, `rotation`, `sameStat`, `weekIndex` y `minimumPool` |
| `features/missions/rotation.test.ts` | 12 tests, que se detallan en Pruebas |
| `features/missions/demo.ts` | Progreso simulado. Las semanales se reinician con la semana; Primeros pasos tiene su propio progreso y su propia lista de reclamadas, que no se reinician |
| `features/missions/MissionsUi.tsx` | El popout con las dos pestañas, la fila de misión, el bonus y la página |
| `features/missions/AdminMissions.tsx` | La vista de admin |
| `routes/demo.misiones.tsx` | La ruta con la barra Demo |

## Lo que falta para la versión real

**Daniel:**

- **Tablas:**
  - `missions`: el catálogo, con la columna `once`.
  - `mission_weeks (week, mission_id)`: las semanales de cada semana, **guardadas por el cron al abrir la semana**, para que editar el catálogo no cambie semanas que ya salieron.
  - `mission_progress (user_id, week, mission_id, value, claimed_at)`. Para las de Primeros pasos, `week` va en `null`, se cuenta todo desde que se creó la cuenta y se reclaman una sola vez.
- **Progreso:**
  - Con cada mix guardado, sumar las métricas de plugin a las semanales de la semana del jugador.
  - Con cada evento de la web, sumar a Primeros pasos.
  - Las de Primeros pasos cuentan desde el registro: si la cuenta ya existía cuando se lancen, conviene arrancar con lo que se pueda calcular (días con login, clips subidos y votados).
- **Rutas:** la semana del jugador y sus Primeros pasos con el progreso, reclamar y la administración del catálogo.
  - Reclamar suma puntos o monedas VIP con el mismo registro que la tienda, y chequea el VIP del lado del servidor.
- **Cron del lunes 06:00:** arma la semana con `pickWeek` usando las dos semanas anteriores guardadas.
- **Plugin nuevo:** cuando salga el schema 2, prender `plugin_v2` y entran las 9 que esperan. Se despliega en nuestro servidor y en RBK en la misma tanda.

**Esteban:** el botón con el popout en la barra de arriba, la página de Misiones y Admin → Misiones.

## Pruebas (2026-10-29)

- **Los 12 tests pasan:**
  - Cantidades por semana.
  - Espera de 2 semanas en medio año de rotación.
  - Que no se repita la misma stat en una semana.
  - Que las de Primeros pasos nunca roten, y que las de web sean todas de Primeros pasos.
  - Variedad en 2 meses.
  - Que no salgan semanales sin datos, y que con el plugin nuevo siga respetando la espera.
  - Que la misma semilla dé el mismo resultado.
  - El mínimo del catálogo y el aviso si no alcanza.
  - El corte del lunes a las 06:00.
- **En el navegador:**
  - Con 1 clip votado, 1 subido y 3 días de login se reclamaron 3 de Primeros pasos, por +120 puntos.
  - Al pasar de semana siguieron reclamadas y el progreso se mantuvo: 2 de 10 clips votados y 3 de 15 días.
  - El popout muestra "Primeros pasos 3/14" con las 14 filas.
  - Las semanales se reinician y no repiten.
  - No hubo errores en la consola.
- **Sin revisar:** el modo claro y el celular.

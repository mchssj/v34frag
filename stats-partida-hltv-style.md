# Estadísticas de partida estilo HLTV — explicación y plan de integración

> Esto explica, desde cero, qué muestran tus 5 capturas de pantalla (una tabla de estadísticas de partida tipo HLTV2) y cómo meter algo así en tu web **v34frag / CSSTV**. Está pensado para alguien que no vive todo el día en el código, así que primero explico los conceptos y recién después entro en lo técnico.

---

## 1. ¿Qué es lo que mostraste en las capturas?

Son las estadísticas de **una partida de CS** (5 vs 5), divididas en **5 pestañas**: General, Avanzado, Entrada, Intercambio y Clutch. Es el mismo formato que usa HLTV.org para mostrar el detalle de un mapa jugado. Cada fila es un jugador, agrupados por equipo.

### Pestaña "General"

La foto rápida del partido:

- **K / D / A**: Kills (bajas), Deaths (muertes), Assists (asistencias que ayudaron a una baja sin darla uno mismo).
- **DPR**: daño por ronda ("damage per round"). Cuánto daño promedio le metió el jugador al rival en cada ronda, haya matado o no.
- **A/M**: asesinatos por minuto.
- **K/R**: kills por ronda (kills ÷ rondas jugadas).
- **HS** y **HS %**: cuántas bajas fueron por headshot (tiro a la cabeza) y qué porcentaje representa sobre el total de sus bajas.
- **5k, 4k, 3k, 2k**: cuántas veces el jugador hizo 5, 4, 3 o 2 bajas en una sola ronda (un "ace" es un 5k).
- **MVPs**: rondas donde fue elegido el mejor jugador de esa ronda.
- **Clasificación (rating)**: un número único que resume qué tan bien jugó, combinando todo lo anterior (parecido al "HLTV Rating"). Es lo que se usa para ordenar el ranking.
- **Swing**: cuánto le aportó ese jugador a la probabilidad de ganar la ronda con sus acciones (positivo = sumó, negativo = restó).

### Pestaña "Avanzado"

Métricas más finas, típicas de análisis táctico:

- **RWS**: "Round Win Share" — qué porcentaje del mérito de las rondas ganadas por su equipo se le puede atribuir a ese jugador.
- **KAST**: porcentaje de rondas en las que el jugador aportó algo positivo (Kill, Assist, Survived o Traded — o sea, bajó a alguien, ayudó a bajarlo, sobrevivió la ronda, o lo mataron pero fue vengado al toque). Es la métrica más usada hoy para medir consistencia, más que el K/D crudo.
- **Acc** (precisión): porcentaje de disparos que impactaron en algún lugar del cuerpo rival.
- **Prec. Visible**: precisión sólo contando los disparos hechos mientras tenía a un enemigo a la vista (más representativo que la precisión "a ciegas").
- **Disparos / Impactos**: totales en bruto, usados para calcular los dos porcentajes de arriba.
- **MK / MK%**: "Multi-Kills", cuántas rondas terminó con 2 o más bajas, y qué porcentaje de sus rondas jugadas representa eso.
- **RP / RS**: rondas jugadas / rondas sobrevivido.

### Pestaña "Entrada" (entry fragging)

Mide quién entra primero a los sitios, que es un rol de mucho riesgo:

- **Intentos de Entrada**: veces que fue el primero de su equipo en enfrentarse a un rival en la ronda.
- **Eliminaciones de Entry**: de esos intentos, cuántas veces ganó el duelo (mató primero).
- **Muertes de Entry**: cuántas veces perdió ese duelo (murió primero).
- **Diferencia de Entry**: eliminaciones menos muertes de entry (si es positivo, el jugador "rinde" en ese rol).
- **% de Intentos de Entrada**: qué porcentaje de las rondas de su equipo fue él quien entró primero.
- **% de Entradas con Éxito**: de sus intentos de entry, cuántos terminaron en baja propia.

### Pestaña "Intercambio" (trading)

Mide qué tan bien protege el equipo a sus propios jugadores:

- **Asesinatos Intercambiados**: bajas del jugador que, a los pocos segundos, fueron "vengadas" por un compañero matando al que lo mató a él... en realidad acá es al revés: son bajas suyas que ayudaron a vengar a un compañero caído.
- **Muertes con Trade**: veces que lo mataron pero un compañero vengó esa muerte enseguida (significa que su muerte "valió la pena" porque el equipo no perdió el intercambio).
- **Eliminaciones / Muertes de Entry con Trade**: cruza el concepto de entry (punto anterior) con el de trade: entradas que fueron vengadas o entradas que el equipo no pudo vengar.

### Pestaña "Clutch" (situaciones 1 contra varios)

Mide el desempeño cuando el jugador queda solo contra 2 o más rivales:

- **Victorias en Situaciones Clave**: cuántas rondas de clutch ganó.
- **Rondas de Clutch Perdidas**: cuántas situaciones de este tipo enfrentó y no pudo ganar.
- **Clutches Ganados**: porcentaje de éxito en esas situaciones.
- **Victorias 1vX**: desglose según cuántos rivales quedaban vivos (1v5 es lo más difícil, 1v1 lo más común).

---

## 2. ¿Esto ya existe en tu web, o hay que armarlo?

Fui a revisar tu repo (`mchssj/v34frag`) y tu documentación de base de datos (`docs/MODELO_DATOS.md`). Esto es lo que encontré:

**Tu web es:**

- Una SPA (aplicación de una sola página) en `index.html`, todo en HTML + CSS + JavaScript puro, sin paso de build.
- Habla directo con **Supabase** (la base de datos Postgres + autenticación + almacenamiento de archivos).
- Tiene un plugin de SourceMod en `server/` que corre dentro del servidor de CS:S y manda los resultados de las partidas (mixes) a Supabase automáticamente — eso es tu "Match Reporter".

**Lo que ya tenés en la base de datos (tabla `match_player_stats`)**, cargado por ese plugin: `kills`, `deaths`, `assists`, `headshots`, `damage`, `rounds`, `k1`–`k5` (contador de multi-kills), `first_kills`, `first_deaths`, `plants`, `defuses`, `teamkills`, `suicides`, `rating`, y además `elo_before/after/delta` y `win_prob` (de tu sistema de ELO).

Con eso ya podés armar **toda la pestaña "General"** y buena parte de la info base de "Avanzado" (los k1–k5 son tus columnas 5k/4k/3k/2k, `first_kills`/`first_deaths` son la base de la pestaña "Entrada").

**Lo que falta (no está en tu esquema actual):**

- RWS, KAST, precisión y precisión visible, disparos, impactos, MK%, RP/RS → pestaña "Avanzado" completa.
- Trade kills / trade deaths y su cruce con entries → pestaña "Intercambio" completa.
- Clutches por tipo (1v1 a 1v5) y rondas de clutch perdidas → pestaña "Clutch" completa.
- El cálculo de "Entrada" existe parcialmente (`first_kills`/`first_deaths`) pero faltan los porcentajes derivados listos para mostrar.
- No hay ninguna vista en el front (`index.html`) que arme esta tabla por partida; hoy `match_player_stats` está marcada en tu propia documentación como **"sin uso en el front"**.

En resumen: el plugin de SourceMod (`server/`) ya manda bastante, pero no manda todo lo necesario para estas 5 pestañas, y el front todavía no dibuja nada de esto. Hay que trabajar en 3 capas: el plugin (qué datos captura y envía), la base de datos (dónde se guardan) y el front (cómo se muestran).

---

## 3. Plan de integración (paso a paso)

### Fase 0 — Decidir el alcance real

No hace falta construir las 5 pestañas de una. Te conviene priorizar así, de más fácil/valioso a más difícil:

1. **General** (ya tenés casi todos los datos).
2. **Entrada** (ya tenés `first_kills`/`first_deaths`, falta derivar los porcentajes).
3. **Avanzado** (necesita capturar disparos/impactos y calcular KAST — requiere más trabajo en el plugin).
4. **Intercambio** (necesita que el plugin detecte "trades", o sea, muertes vengadas dentro de una ventana de tiempo corta).
5. **Clutch** (necesita que el plugin detecte situaciones 1vX y su resultado).

Te sugiero hacer 1 y 2 primero como "versión mínima mostrable", y dejar 3–5 para una segunda etapa.

### Fase 1 — Ampliar lo que el plugin de SourceMod captura y envía

Ubicación: `server/` (tu plugin para el servidor v34).

- Agregar el conteo de disparos realizados y disparos que impactaron (para Acc / Prec. Visible).
- Agregar detección de "trade": cuando un jugador muere y, dentro de una ventana corta (ej. 3-5 segundos), un compañero mata al que lo mató.
- Agregar detección de clutch: cuando queda 1 jugador vivo de un equipo contra 2+ del otro, y si gana o pierde esa ronda, guardando cuántos rivales había vivos en ese momento (para distinguir 1v1 de 1v5).
- Mandar estos nuevos campos junto con el resto del payload que ya envía por `ingest_server_chunk` / `ingest_server_match`.

### Fase 2 — Ampliar el esquema de Supabase

Nueva migración SQL en `supabase/migrations/`, agregando columnas a `match_player_stats` (o una tabla aparte `match_player_stats_adv` si preferís no tocar la tabla actual):

- `shots_fired`, `shots_hit`, `shots_hit_visible` → para Acc y Prec. Visible.
- `rounds_survived` → para RS.
- `trade_kills`, `traded_deaths`, `entry_kills_traded`, `entry_deaths_traded` → pestaña Intercambio.
- `clutch_1v1_won`, `clutch_1v2_won`, ..., `clutch_1v5_won`, `clutch_rounds_lost` → pestaña Clutch.
- `rws` y `kast` pueden guardarse ya calculados por el plugin, o calcularse en una función de Postgres a partir de datos más crudos (lo segundo es más prolijo pero más trabajo).

También conviene extender `recompute_player_stats(player)` (la función que ya tenés) para que recalcule estos nuevos promedios por jugador, igual que hoy hace con rating, K/D, HS%, ADR, etc.

### Fase 3 — Construir la vista en el front

Dentro de `index.html`, en la vista de detalle de partida:

- Agregar las 5 pestañas (General / Avanzado / Entrada / Intercambio / Clutch) como botones que cambian qué columnas de la tabla se muestran, igual que en tus capturas.
- Una tabla por equipo, igual que ahora, trayendo los datos con una consulta a `match_player_stats` filtrando por `match_id` (uniendo con `players` para mostrar nick y rango/rating de ELO).
- Como es JavaScript vanilla, podés reusar el mismo patrón de renderizado que ya usás en el resto de la SPA (sin frameworks).

### Fase 4 — Documentar y probar

- Actualizar `docs/MODELO_DATOS.md` con las columnas nuevas (tu propia documentación ya tiene el hábito de marcar qué está "confirmado" y qué no — seguí ese estilo).
- Actualizar `docs/GUIA_SERVIDOR.md` si cambia algo de la instalación del plugin.
- Probar primero con partidas tipo `pcw` (mix), que es donde ya corre el Match Reporter automático.

---

## 4. Resumen en una frase

Tenés la mitad del camino hecho: el plugin ya manda estadísticas básicas y la base de datos ya tiene una tabla pensada justo para esto. Lo que falta es (a) que el plugin capture algunos datos más finos (disparos, trades, clutches), (b) sumar esas columnas en Supabase, y (c) dibujar la tabla con pestañas en el front, que hoy no existe todavía.
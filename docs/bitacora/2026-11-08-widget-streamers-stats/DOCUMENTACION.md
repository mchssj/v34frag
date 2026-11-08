# Widget para streamers con stats completas y personalizable (prototipo)

Prototipo de Kyan para que lo terminen Daniel (backend) y Esteban (frontend). Está en el frontend de `repo` (rama `kyan/pruebas`), en `/demo/widget`, solo con `pnpm dev` (configuración `frontend-repo`, puerto 5174).

Parte del widget para OBS de [`2026-10-29-widget-streamers`](../2026-10-29-widget-streamers/).

## Qué hay

**Seis diseños.** Los tres de antes siguen igual, salvo que el nivel ahora es el anillo de 10 barras elegido el 2026-11-01.

| Diseño | Tamaño para OBS (al 100 %) | Qué muestra |
|---|---|---|
| Mini | 170 × 64 | Nivel y ELO |
| Compacto | 360 × 150 | Más nick, barra al próximo nivel, resultado y ELO del período, frase |
| Completo | 420 × 190 | Más K/D, rating, pico y últimos resultados |
| **Stats** (nuevo) | 420 × 200 | La tarjeta de la referencia de Kyan, con el estilo de la web. Tiene seis partes: el nivel con el puesto en el ranking abajo, el ELO, 4 stats grandes, la frase, 5 stats chicas y una última fila con HS, ranking, puesto en el país con la bandera y los últimos resultados |
| **Barra** (nueva) | 720 × 56 | Una tira para abajo de la pantalla: nivel, nick, ELO, bandera, stats grandes, frase y últimos resultados |
| **Vertical** (nuevo) | 200 × 500 | Una columna para el costado de la cámara: nivel grande, nick, ELO, frase, barra al próximo nivel, las stats una debajo de la otra y los últimos resultados |

**Stats que se pueden elegir (19):**

- ADR, Rating, K/D, KR y HS.
- V-D y ELO del período.
- Ace, 4K, 3K, Sniper (AWP y Scout) y Cuchillo.
- Clutch, Entradas y Pistolas.
- Mixes, Pico, Ranking y País.

Se marcan en orden y el número dice en qué lugar salen: hasta 4 grandes y 5 chicas.

**Personalización:**

| Opción | Valores |
|---|---|
| Diseño | Los seis de arriba |
| Período | Hoy, 24 h, temporada o histórico |
| Stats grandes y chicas | Las de arriba, en el orden elegido (solo en los diseños que las usan) |
| Color de acento | 8 sugeridos (el primero es el naranja de la marca) o cualquiera con el selector |
| Fondo | Opacidad de 0 a 100 % |
| Tamaño | De 75 a 150 %. El tamaño para OBS se recalcula |
| Qué se muestra | Nick, tag del equipo, nivel, barra al próximo nivel, últimos resultados, bandera y frase |
| Frase | Hasta 40 caracteres |
| Últimos resultados | 5 o 10 |

**Frase automática:** si el streamer no escribe una, sale sola cuando hay algo para destacar, en este orden:

1. "Primero del ranking".
2. "Racha de N victorias", desde 3.
3. "Top 10 del ranking (#N)".
4. "+N ELO hoy", desde 50.
5. "Primero de su país".

Si no hay nada, no se muestra.

**Todo va en la URL**, y solo lo que cambia respecto de lo de fábrica. Por ejemplo `/widget?id=…&d=stats&a=00b4ff&h=tag`. Si un valor no es válido, el widget usa el de fábrica en lugar de romperse. OBS guarda la URL, así que no hace falta cuenta ni tabla nueva.

## De dónde salen los datos

Todas las stats ya las manda el reporter (2.9.3 en `kyan/pruebas`; desde 2.7.0 en el JSON de cada partida):

| Stat | Del JSON del reporter |
|---|---|
| ADR | `damage` / `rounds` |
| KR, K/D, HS | `kills`, `deaths`, `rounds` y `headshots` |
| 3K, 4K, Ace | `k3`, `k4` y `k5` |
| Sniper | `weapon_kills.awp` + `weapon_kills.scout` |
| Cuchillo | `weapon_kills.knife` |
| Clutch | `clutches` (1v1 a 1v5) |
| Entradas, Pistolas | `first_kills` y `pistol_won` |

El rating, el ranking y el país salen de la web.

## Archivos (en `web/frontend/src/`)

| Archivo | Qué tiene |
|---|---|
| `features/widget/options.ts` | Diseños, períodos, stats, partes, valores de fábrica, `parseOptions` (lee la URL) y `widgetUrl` (la arma) |
| `features/widget/options.test.ts` | 4 tests: URL mínima, ida y vuelta, valores inválidos y topes |
| `features/widget/StreamWidget.tsx` | Los seis diseños. Comparten el marco (color, opacidad y tamaño), y además `statValue`, `autoPhrase` y `LevelRing` |
| `features/widget/demo.ts` | Datos de ejemplo de los cuatro períodos. Un mix simulado suma a todos |
| `routes/demo.widget.tsx` | Los seis diseños con las opciones elegidas, y el personalizador con vista previa y URL |

## Lo que falta para la versión real

- **Daniel:** que `widget_player()` reciba el período y devuelva `period` con estos campos para ese período:
  - `v`, `d`, `e` y `elo`.
  - `kills`, `deaths`, `rounds`, `damage` y `headshots`.
  - `k3`, `k4` y `k5`.
  - `sniper` y `knife`, de `weapon_kills`.
  - `clutches`, `entries`, `pistols` y `rating`.

  Además tiene que devolver `rank`, `country_rank` y `country`, y los últimos 10 resultados (hoy son 5).
- **Esteban:**
  - El personalizador en el perfil, al lado de lo que ya hay del widget.
  - La página `/widget`, que lea la URL con `parseOptions` y pida los datos cada minuto.
- **Tamaño:** el tamaño usa `zoom`, que anda en el navegador de OBS (Chromium). Si se ve mal en alguna versión vieja de OBS, se cambia por `transform: scale`.

## Pruebas (2026-11-08)

- **Tests:** los 4 tests pasan, y compila y pasa lint.
- **En el navegador:**
  - Se ven los seis diseños. La primera versión de **Stats** se encimaba con 340 px de ancho, y se pasó a 400.
  - Con "Primero del ranking" y 3 victorias, la frase automática sale en todos los diseños menos Mini, que no tiene lugar.
  - Al cambiar el color y ocultar el tag, la URL quedó `…&d=stats&a=00b4ff&h=tag`.
  - El vertical con 9 stats mide 490 px de alto, así que el tamaño recomendado quedó en 200 × 500.
  - No hubo errores en la consola.
- **Sin revisar:**
  - En OBS de verdad.
  - Con datos reales, porque `widget_player()` todavía no devuelve las stats nuevas.

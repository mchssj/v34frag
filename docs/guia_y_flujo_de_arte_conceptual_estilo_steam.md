# Guía de Producción: Arte Conceptual estilo Tienda de Puntos de Steam

Este documento define las reglas técnicas, artísticas y de control de presupuesto para generar paquetes coordinados de cosméticos para la tienda de CMLeague (Avatar + Marco + Fondo de Miniperfil + Animaciones), al estilo de la tienda de puntos de Steam, utilizando **Replicate MCP**.

Las medidas son las de **nuestra web**, no las de Steam: Steam es solo la referencia de estilo.

## 1. Dónde va cada archivo

```text
inspiraciones y borradores  →  fuera del repo (carpeta temporal o una carpeta propia en la PC)
archivos finales            →  web/frontend/public/cosmetics/avatares/   (avatares)
                               web/frontend/public/cosmetics/marcos/     (marcos)
                               web/frontend/public/cosmetics/fondos/     (fondos de miniperfil)
catálogo                    →  una fila por cosmético en public.shop_items (kind, name, file, collection, price…)
recorte de marcos           →  docs/recortar_marco.mjs
```

* `file` en `shop_items` es la ruta relativa a `public/cosmetics/` (ej. `marcos/cyberpunk.png`).
* Para probar, la fila se agrega primero en la base **local** (Supabase en Docker, contenedor `supabase_db_v34frag-api`). Nunca en producción hasta que el paquete esté aprobado.
* Los cosméticos de la tienda **no se suben desde la web**: son archivos del repo que se publican con el frontend. Administración › Tienda solo cambia precios y textos.

### Reglas para las inspiraciones (Control de Tokens)

* **Formato y peso:** Guarda las referencias en su tamaño original de Steam (`184x184`, `224x224` o `624x372`) o máximo `512px`. Nunca subas capturas de pantalla completas en alta resolución.
* **Uso bajo demanda:** No leas toda la carpeta automáticamente. Inspecciona **únicamente 1 o 2 archivos** cuando el usuario indique una referencia específica al iniciar un nuevo paquete.
* **Extracción única:** Al analizar una referencia, sintetiza su estilo en una **Ficha Técnica de 4 líneas** (Paleta hex, Proporción/Grosor del borde, Motivos visuales, Iluminación) y usa ese texto en las siguientes iteraciones en lugar de volver a cargar la imagen.

## 2. Especificaciones Técnicas de CMLeague

Todo activo generado debe respetar cómo lo dibuja la web (`web/frontend/src/features/shop/cosmetics.tsx` y `cosmeticos.css`):

| Activo | Tamaño final | Proporción de generación | Regla de composición obligatoria |
| :--- | :--- | :--- | :--- |
| **Avatar** | `512x512` (los actuales son SVG de 256) | `1:1` (`1024x1024`) | Primer plano o busto centrado. Alto contraste para que sea legible en miniatura (se ve hasta de 44 px). |
| **Marco de Perfil** | `512x512` a `1024x1024` PNG con transparencia (los actuales son SVG de 256) | `1:1` (`1024x1024`) | La foto del jugador va **dentro del marco con un margen de 12,5 % por lado** y esquinas redondeadas al 8 %. El diseño va **en el 12–14 % exterior**; lo que entre más tapa la foto. Centro y fondo exterior en **blanco puro (`#FFFFFF`)**, nunca negro (ver Fase 3). |
| **Fondo Miniperfil** | Vertical **1:2** (ej. `512x1024`); los actuales son SVG de 400×400 recortados al centro | `9:16` o la más alta que dé el modelo | La tarjeta es **vertical (1:2)**, con el avatar, el nombre y el nivel apilados en el centro. **Centro despejado de arriba abajo**; los detalles llamativos arriba, abajo y en los bordes. Un 16:9 recortado a 1:2 pierde justo los costados. |

**El marco tiene que tocar la foto (Daniel, 2026-11-20):** el borde interior del diseño llega hasta el contorno de la foto (12,5 %) o lo pisa un poco, sin dejar espacio entre los dos, **aunque la referencia de Steam lo deje** (como `7.gif`). Si el diseño ondula o tiembla, el borde interior tiene que pisar la foto en todo momento. Las esquinas de la foto son redondeadas: un marco de esquinas rectas necesita un relleno ahí.

### Formatos y peso

El código no pone un límite de peso a los archivos de la tienda, pero un marco se carga muchas veces en una misma página (grupo, sala, rankings): apuntar a **menos de 500 KB** por archivo.

| Activo | Fijo | Animado |
| :--- | :--- | :--- |
| **Marco** | PNG o WebP con transparencia | **WebP animado** (o GIF) con transparencia. La web lo dibuja con `<img>`, así que **no sirve WebM**. Los marcos animados actuales son SVG. |
| **Avatar** | PNG o WebP | `.webm` en bucle, mudo, con un `.webp` fijo **del mismo nombre** (bitácora `2026-11-12-avatares-animados`). |
| **Fondo de miniperfil** | PNG o WebP | `.webm` con su `.webp` fijo del mismo nombre, como el avatar. |

Los límites de 1 MB (fijo) y 8 MB / 10 s (animado) con conversión automática a WebM son de las **subidas propias de los VIP** (`web/backend/src/routes/custom.ts`), no de la tienda.

## 3. Flujo de Iteración Económico (Optimización de Créditos)

Para maximizar el saldo en Replicate (~$5 USD = ~125 imágenes HD o ~1,600 borradores), sigue estrictamente estas **6 fases (0 a 5)** y pide aprobación del usuario antes de pasar de fase:

### Fase 0: Inspiración y alcance (Costo: $0)

Antes de mirar ninguna imagen, pregúntale al usuario:

1. **Qué se usa como inspiración:** un archivo de `inspiraciones/` (cuál, uno o dos como máximo) o solo una temática descrita con palabras.
2. **Qué cosméticos salen de esa inspiración:** avatar, marco, fondo de miniperfil o una combinación. Son cosméticos distintos y no se mezclan:
   * **Avatar:** la imagen que va dentro del hueco del marco, en lugar de la foto del jugador.
   * **Marco:** el borde que va encima, alrededor del avatar o de la foto.
   * **Fondo de miniperfil:** la imagen detrás de la tarjeta del jugador.
3. **Fijo o animado**, para cada cosmético que sale.

Las fases siguientes trabajan solo con los cosméticos elegidos acá. Ejemplo: de `1.gif` (un marco animado de Steam) sale solo un marco.

### Fase 1: Dirección de Arte (Costo: $0)

1. Define la temática del paquete (ej. *Cyberpunk Pixel Art*, *Dark Fantasy Gótico*, *Retro Synthwave*).
2. Si en la Fase 0 se eligió una referencia, analízala y extrae su Ficha Técnica.
3. Propón el concepto de los cosméticos elegidos en la Fase 0 (si son varios, coordinados entre sí) antes de ejecutar herramientas de Replicate.
4. Revisa que se vea en los dos temas de la web (claro y oscuro). Si la referencia es negra o blanca, propón la variante del otro tono (Fase 5).
5. Si es animado, propón **cómo** animarlo: video (Fase 4, ~$0,45) o temblor en local ($0), según el tipo de movimiento de la referencia.
6. Decide si conviene el **camino SVG, sin IA** (formas geométricas simples, claras sobre transparente o elementos chicos que se mueven), que reemplaza las Fases 2 a 4.

### Fase 2: Exploración Rápida / Borradores (Costo: ~$0.003 / imagen)

* **Modelo:** `black-forest-labs/flux-schnell` (4 pasos).
* Genera 2 o 3 variaciones rápidas de **cada cosmético elegido en la Fase 0**, para validar composición, paleta y silueta. En el marco, sirve además para validar el prompt: que el centro salga vacío y el borde del grosor pedido antes de gastar en recraft.
* **No generes video ni uses modelos Pro en esta fase.**
* Pregunta al usuario cuál dirección aprueba antes de continuar.

### Fase 3: Producción Final en Alta Calidad (Costo: ~$0.04 / imagen)

Una vez aprobada la dirección en Fase 2:

1. **Avatar Final:** Genera con `recraft-ai/recraft-v3` (usando estilo `digital_illustration/pixel_art` si es pixel art) o `black-forest-labs/flux-1.1-pro`.
2. **Fondo de Miniperfil Final:** Genera **vertical** con `black-forest-labs/flux-1.1-pro`, reforzando el espacio despejado en el centro, de arriba abajo.
3. **Marco de Perfil (2 pasos):**
   * *Paso 3A:* Genera el borde simétrico **sobre blanco puro**. Usa el modelo que más se parezca al borrador aprobado:
     * Dibujos de línea con placas o circuitos (marco cyberpunk): `recraft-ai/recraft-v3`.
     * Líquidos, brillos y degradados (marco de plasma azul, 2026-11-20): `black-forest-labs/flux-1.1-pro`, con el mismo prompt del borrador de flux-schnell. Con ese prompt, recraft se fue a una acuarela asimétrica con olas dentro del hueco.
     * **Cuando importa más la calidad:** `black-forest-labs/flux-1.1-pro-ultra` (~$0,06, 2048 px). Con las llamas fantasmales de `5.gif` dio llamas nítidas con núcleos brillantes y un personaje con la cara bien definida, mucho mejor que el borrador.
   * **Fondo blanco o negro:** blanco por defecto. **Negro si el diseño es claro o luminoso** (fuego, neón, magia, colores pastel): sobre blanco lo claro se confunde con el fondo y queda desteñido. Sobre negro se recorta con `--fondo-negro` (ver abajo). En ese caso, **lo oscuro del diseño también se vuelve transparente**: un personaje oscuro tiene que pasar a luminoso, con solo los ojos y la boca oscuros.
     * `ideogram-ai/ideogram-v2` no sirvió: llenó el centro de gris y dibujó una franja de casi el doble.
   * *Ajuste de posición (sin gastar):* si el diseño quedó bien pero la franja está muy adentro (tapa la foto), se recorta el centro y se agranda. Con un factor `s`, un punto a `p` % del borde pasa a `50 − (50 − p) × s` %. Ejemplo: de 12–18 % a 6–13 % con `s = 1,15`: `ffmpeg -i marco.png -vf "crop=890:890,scale=1024:1024:flags=lanczos,format=rgba" ajustado.png` (890 = 1024 / 1,15).
   * *Paso 3B:* Recorta en local con `docs/recortar_marco.mjs` (no `lucataco/remove-bg`, ver abajo).

#### Prompts del marco (aprendido el 2026-11-20)

* **Recraft corta el prompt a 500 caracteres sin avisar** (solo lo dice en los logs). Lo que quede después se pierde: poner primero lo del centro vacío y contar los caracteres.
* **No usar la palabra "avatar"**: recraft e ideogram dibujan un retrato en el centro. Tampoco "picture frame": sale un cuadro colgado en la pared, en perspectiva y con sombra.
* Lo que funcionó: describirlo como una plantilla de tarjeta con el centro en blanco. Ejemplo (recraft-v3, `1024x1024`, `digital_illustration`):

  ```text
  Blank card template: a hollow square border only, flat front view, symmetrical, touching the canvas edges.
  The middle 75% is a blank solid white rounded square, totally empty like an unused placeholder. Border style:
  <temática: materiales, luces, motivos>. No subject, no character, no scenery, no text.
  ```

#### Marco pintado entero (el que mejor resultado dio, 2026-11-20)

En vez de generar el borde sobre blanco o negro y recortarlo por color, se genera **una escena completa** que rodea la foto (paisaje, lluvia de código…) y el hueco se corta con la forma exacta de la web: `node docs/hueco_marco.mjs marco.png salida.png "#ff4fd8"`. El color opcional dibuja un contorno neón con brillo sobre el borde de la foto.

* **Ventajas:** no se pierde ningún color del diseño (lo oscuro y lo claro quedan), el marco toca la foto siempre, y **cualquier video sirve**, porque el hueco se corta igual en cada cuadro. Además, como solo el hueco es transparente, el animado pesa poco (Código 183 KB y Synthwave 220 KB, contra 574 KB del plasma).
* **Prompt:** "artwork designed as a picture frame border", con lo importante en los bordes y "the central area, the middle 75 percent, is plain …".
* **El centro se tapa con la foto:** lo más característico tiene que quedar en el 13 % exterior. Flux tiende a centrar (el sol de Synthwave salió en el medio dos veces). Como `flux-1.1-pro-ultra` entrega 2048 px, se puede **recortar un cuadrado corrido** para llevar el motivo al borde sin perder calidad: `crop=iw*0.81:ih*0.81:iw*0.095:ih*0.19` subió el sol para que asome sobre la foto.
* **Animado:** el video se hace con la imagen **completa** (sin recortar) y el recorte se aplica después a cada cuadro: `RECORTE="crop=…" MODO=--hueco COLOR="#ff4fd8" bash docs/animar_marco.sh video.mp4 carpeta`.
* Código y Synthwave se rehicieron así porque en SVG se veían pobres. Synthwave quedó en la tienda (replanteo `133`); Código se descartó antes de publicarse. `docs/generar_codigo.mjs` queda como ejemplo de SVG con texto.
* **Lo publicado:** los 13 marcos de la bitácora `docs/bitacora/2026-11-20-marcos-nuevos/`. Los descartados (Llamas fantasma, Vacío y Código) no se publicaron.

#### Recorte del marco (Paso 3B)

`lucataco/remove-bg` **no sirve para marcos**: busca el objeto principal, así que en la prueba borró la mitad de arriba del marco y dejó el centro blanco opaco. Además no es un modelo oficial (necesita el ID de versión y la consulta del MCP para obtenerlo vuelve vacía).

En su lugar, `docs/recortar_marco.mjs` vuelve transparente el blanco conectado con los bordes y con el centro, con borde suave y sin halo. No gasta créditos y se comprueba solo: falla si el centro o las esquinas no quedan transparentes o si la franja del marco no queda opaca. Por eso el fondo tiene que ser **blanco**: con negro, un diseño oscuro no se puede separar del fondo.

1. Recraft entrega WebP. Pasarlo a PNG con el decodificador de Windows (PowerShell, sin instalar nada):

   ```powershell
   Add-Type -AssemblyName PresentationCore
   $in = [IO.File]::OpenRead("marco.webp")
   $dec = [Windows.Media.Imaging.BitmapDecoder]::Create($in, 'PreservePixelFormat', 'OnLoad')
   $bmp = New-Object Windows.Media.Imaging.FormatConvertedBitmap($dec.Frames[0], [Windows.Media.PixelFormats]::Bgra32, $null, 0)
   $enc = New-Object Windows.Media.Imaging.PngBitmapEncoder
   $enc.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bmp))
   $out = [IO.File]::Create("marco.png"); $enc.Save($out); $out.Close(); $in.Close()
   ```

   Un PNG RGB (como el de flux) también se pasa a RGBA: `ffmpeg -i marco.png -vf format=rgba marco-rgba.png`.

2. Recortar, según el estilo:
   * **Dibujo de línea** (bordes nítidos, como el cyberpunk): `node docs/recortar_marco.mjs marco.png marco-final.png`. Rellena el blanco desde los bordes y el centro, y deja el diseño opaco.
   * **Brillo, líquido o tinta** (halos que se apagan de a poco, como el plasma, o trazos de un solo color con blanco encerrado entre ellos, como el boceto de tinta): `node docs/recortar_marco.mjs --brillo marco.png marco-final.png`. En el boceto, el modo de línea dejó manchas blancas opacas en los huecos entre trazos, porque el relleno solo entra desde los bordes y el centro. Cada píxel pierde opacidad según qué tan blanco es: el brillo queda como un tinte translúcido sobre la foto. El otro modo lo deja como una niebla blanca que tapa la foto, **aunque la comprobación pase**. Contra: los reflejos blancos también se vuelven transparentes.
   * **Diseño luminoso sobre negro** (llamas fantasmales de `5.gif`): `node docs/recortar_marco.mjs --fondo-negro marco.png marco-final.png`. La opacidad sale del canal más brillante: los núcleos blancos quedan opacos y el brillo se conserva sobre la foto. Es lo que le faltó al plasma, que perdió sus reflejos blancos por recortarse sobre blanco. Para un video: `MODO=--fondo-negro bash docs/animar_marco.sh …`.
3. Mirar el resultado sobre un fondo de cuadros antes de darlo por bueno, y bajar el peso (sección 2): a 512 px y WebP con `ffmpeg -i marco-final.png -vf scale=512:512 -c:v libwebp -lossless 0 -q:v 90 marco.webp`.

### Fase 4: Animación Opcional (Costo: ~$0.20 – $0.45 / clip)

**Solo ejecutar si el usuario lo solicita explícitamente sobre una imagen final aprobada.**

* **Modelos:** `minimax/video-01-live` (ideal para pixel art / 2D) o `kwaivgi/kling-v2.5-turbo-pro` (ideal para lluvia, humo, líquidos y neón; acepta `start_image` y `end_image`).
  * Al 2026-11-20, `kwaivgi/kling-v1.6-pro` no está disponible para la cuenta y `kwaivgi/kling-v2.1` fue discontinuado.
  * Kling tarda de 2,5 a 6 minutos (5,5 con las llamas de `5.gif`, por la cola del proveedor) y la espera del MCP vence a los 2: **el MCP reintenta solo y crea una segunda predicción igual, que también se cobra**. Después de un vencimiento, listar las predicciones (`list_predictions` con `created_after`), cancelar la repetida y seguir la otra con `get_predictions`. **Mejor evitarlo:** lanzar los videos **sin** `Prefer: wait`, que devuelve la predicción en `starting` al instante, y seguirla con `get_predictions`.
* **Prompt de movimiento obligatorio:** *"Static locked camera, no zoom, no pan. Subtle seamless ambient loop: falling rain, flickering neon lights, drifting embers/smoke. Preserve exact original art style."*
* Si el modelo soporta `last_frame_image`, pasa la misma imagen inicial para lograr un bucle perfecto.
* Clips cortos (5 a 10 segundos): se repiten en bucle.
* **Línea que tiembla (sin video, $0):** si la animación de la referencia es solo que los trazos tiemblan, como un dibujo animado a mano (`2.gif`), no hace falta un modelo de video. `node docs/temblor_marco.mjs marco-final.png carpeta 4 0.006` hace 4 copias con una deformación suave distinta (hasta 1,5 px a 256), que se alternan a 10 cuadros por segundo: `ffmpeg -framerate 10 -i carpeta/c_%03d.png -c:v libwebp -lossless 0 -q:v 80 -loop 0 marco.webp`. El boceto pesó 51 KB. Conviene achicar a 256 px **antes** de deformar, para que la amplitud se mida sobre el tamaño final.
* **Marco animado:** los modelos de video entregan MP4 **sin transparencia**. Se parte de la imagen del marco sobre blanco (la original de la Fase 3, antes del recorte) como `start_image` y `end_image`, y el prompt pide que el fondo y el centro sigan en blanco. Después se recorta cada cuadro (sección 4). Con el marco de plasma, Kling dejó la cámara quieta y el fondo blanco en los 5 segundos.

### Camino SVG, sin IA (Costo: $0)

Algunas referencias se ven mejor dibujadas con código que generadas: se decide en la Fase 1 y reemplaza las Fases 2 a 4. Así están hechos los marcos que ya tiene la tienda (`circuito.svg`, `neon.svg`…).

* **Cuándo:** la referencia son **formas geométricas simples, nítidas y chicas** (destellos, puntos, rombos, arcos, líneas), **claras sobre transparente** o con una **animación de elementos que aparecen, se mueven y desaparecen**. Con IA fallan las dos cosas: lo claro se va con el fondo blanco y un modelo de video deforma y hace parpadear las formas chicas.
* **Qué se gana:** nítido a cualquier tamaño, unos 6 KB, bucle exacto y la paleta en parámetros.
* **Cómo (ejemplo `3.gif`, 2026-11-20):**
  * `node docs/generar_destellos.mjs web/frontend/public/cosmetics/marcos/destellos.svg` genera el marco: cada esquina tiene un destello grande, uno chico, un punto y un arco creciente, y se enciende por turnos.
  * **Cada esquina va como copia propia, con su `begin`.** Las copias hechas con `<use>` comparten el reloj de la animación y se encenderían todas a la vez.
  * **`begin` negativo** (`-1.5s`) para que todo arranque ya en marcha. Los elementos que aparecen llevan `scale(0)` u `opacity="0"` de base, así no quedan visibles antes de empezar.
  * **Contorno de un tono más oscuro** en las formas claras, para que se vean también en el tema claro.
* **Personajes simples también (ejemplo `4.gif`, 2026-11-20):** un conejo hecho de un óvalo, dos orejas y tres trazos, con poses y caras (`web/frontend/public/cosmetics/marcos/conejo.svg`, escrito a mano porque no se repite). Con IA, el video le cambiaría la forma y la cara entre cuadros. Recursos útiles:
  * **Origen en la base del personaje** (`translate` al punto de apoyo y el dibujo hacia arriba), así `scale` lo estira y lo aplasta desde abajo.
  * **Caras que cambian de golpe:** un grupo por cara y `opacity` con `calcMode="discrete"`.
  * **Contorno de los elementos claros:** las mismas formas un poco más grandes y del color del contorno, debajo (como en las nubes).
* **Bordes orgánicos y piezas al azar (ejemplo `6.gif`, 2026-11-20):** `node docs/generar_vacio.mjs marco.svg [semilla]` genera una franja negra que ondula como tinta, un contorno glitch rojo y cian, gotas y formas neón que parpadean. Lo que hizo falta:
  * **Ondular un borde:** animar el `d` del camino entre varias poses. Todas tienen que tener **los mismos comandos** (mismo número de puntos), o el navegador salta sin animar. El generador lo comprueba.
  * **Copias sincronizadas a propósito:** las copias con `<use>` comparten el reloj (lo contrario de las esquinas de destellos). Sirve para el contorno glitch, que tiene que seguir a la franja.
  * **Un marco negro y el tema oscuro:** en vez de una variante clara, un contorno de color desfasado (rojo y cian) que encaja con el estilo y se ve en los dos temas.
  * **El borde interior tiene que pisar siempre el contorno de la foto**, aunque ondule. Si no, en el tema claro queda un hueco del color de la página entre el marco y la foto.
  * **Semilla fija:** lo aleatorio (ondas, colores, cuándo aparece cada forma) sale igual cada vez que se genera.
* **Fiel a la referencia (lección de `6.gif`, 2026-11-20):** el primer "Vacío" no se pareció en nada a `6.gif`: franja gruesa en vez de fina, pocas gotas en vez de muchas manchas, y un contorno rojo y cian inventado para el tema oscuro que le cambió el carácter. Reglas:
  * **No agregar elementos que la referencia no tiene.** Si hace falta algo para el tema oscuro, se pregunta antes y se prefiere una variante aparte (Fase 5).
  * **Si una decisión de la Fase 0 quita lo que más caracteriza a la referencia** (ej. sacar las manchas), avisarlo en ese momento.
  * **Comparar lado a lado con la referencia, grande (500 px) y sobre el mismo fondo, antes de mostrarlo.** Medir grosor, distancia al borde y tamaño de los elementos contra la referencia, no a ojo.
* **Varias paletas de una vez (ejemplo `7.gif`, 2026-11-20):** `node docs/generar_energia.mjs carpeta` genera la línea de energía en cinco paletas (violeta, la original; tóxico, ámbar, hielo y magenta), con la misma forma. Lo que hizo falta:
  * **Brillo que sigue una forma dentada:** trazos con `stroke-dasharray` que recorren el borde, difuminados con `feGaussianBlur` y recortados con un `clipPath` que usa la misma línea. Sin el recorte y el difuminado parecían barras de carga.
  * **Los tramos de `stroke-dasharray` tienen que sumar exactamente `pathLength`** (100), o el recorrido salta en cada vuelta. El generador lo comprueba, y ya atrapó un error de cuenta.
  * **Pixel art:** `shape-rendering="crispEdges"` en la línea y las chispas, y `auto` en el brillo.
* **Límites del SVG como imagen (ejemplo Código, 2026-11-20):** la web dibuja los marcos con `<img>`, así que el SVG **no ejecuta scripts ni carga fuentes externas**. Lo que en un boceto se arme con JavaScript va a un generador que escribe el SVG estático (`node docs/generar_codigo.mjs marco.svg`). El texto usa fuentes genéricas (`ui-monospace, Consolas, monospace`) y caracteres ASCII: los katakana u otros alfabetos pueden salir como cuadrados en algunas computadoras. Para una columna de caracteres en un solo `<text>`, `x` e `y` llevan **un valor por carácter**; con una sola `x`, cada carácter se corre a la derecha del anterior.
* **Revisar** con capturas en 6 momentos del ciclo, sobre tema claro y oscuro y con un avatar de prueba: `node docs/vista_marco_svg.mjs marco.svg vista.html [segundos]` (por defecto, 6 momentos de un ciclo de 2 s; ej. `"0.4,1,1.3,1.75,2,2.6"` para uno de 3 s) y después `chrome --headless=new --window-size=1200,400 --screenshot=vista.png file:///<ruta>/vista.html`.
* **Variante de color (Fase 5):** el generador recibe los colores. Ej.: `node docs/generar_destellos.mjs marco.svg "#ffe9c7" "#a05a20" "#c07a40"`.

### Fase 5 (opcional): Variantes de color (Costo: $0)

El mismo cosmético con otra paleta, para venderlo como otra pieza de la tienda. **Solo si el usuario lo pide** y si el cosmético lo permite.

* **Cuándo sirve:** cuando el diseño es de **una sola familia de color** sobre transparencia (el plasma azul, un neón de un color). Se cambia el color en local: queda exactamente la misma forma y la misma animación, sin gastar créditos.
* **Cuándo no:** cuando el diseño mezcla varios colores que tienen que seguir distintos (el cyberpunk, con placas, rosa y celeste), o cuando la paleta nueva cambia el material (de agua a madera). En esos casos se vuelve a generar desde la Fase 3 con la paleta nueva en el prompt, y la forma no va a ser la misma.
* **Cómo:** `node docs/recolorear_marco.mjs <de>:<de> <a>:<a> entrada salida` (un PNG o una carpeta de cuadros). Lleva un rango de tonos a otro sin tocar la transparencia, el brillo ni la saturación. Para un animado, `PALETA="<de>:<de> <a>:<a>" bash docs/animar_marco.sh video.mp4 carpeta 1.15`.
* **Tonos** en grados: 0 rojo, 30 naranja, 60 amarillo, 120 verde, 195 celeste, 225 azul, 270 violeta, 300 magenta.
* **Ejemplo (2026-11-20):** el plasma azul a fuego con `225:195 0:40`. El azul oscuro pasa a rojo y el celeste claro a naranja: lo más claro queda más cálido, como en el fuego real. El rango del origen sale de la paleta de la Ficha Técnica.
* **Negro a blanco** (tinta a tiza): `recolorear_marco.mjs` no sirve, porque el negro no tiene tono. Se invierte el color sin tocar la transparencia, cuadro por cuadro: `ffmpeg -i c_001.png -vf "lutrgb=r=negval:g=negval:b=negval" tiza/c_001.png`.
* **Un marco negro o muy oscuro necesita una variante clara** (y uno blanco, una oscura): la web tiene tema claro y oscuro, y el negro sobre fondo oscuro casi no se ve. Se plantea en la Fase 1, como en el boceto de `2.gif` (tinta negra y tiza blanca).
* Cada variante es una fila propia en `shop_items`, con su archivo.

## 4. Post-Procesado

Los archivos de la tienda se convierten a mano con FFmpeg (instalado en la PC de Daniel con winget) antes de copiarlos a `public/cosmetics/`.

* **Avatar animado** (`.webm` + `.webp` del mismo nombre):
  ```bash
  ffmpeg -i input.mp4 -t 10 -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512" -c:v libvpx-vp9 -b:v 0 -crf 34 -an avatar.webm
  ffmpeg -i input.mp4 -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512" -frames:v 1 avatar.webp
  ```

* **Fondo de miniperfil vertical (1:2)**, igual que el avatar con `scale=512:1024…crop=512:1024`.

* **Marco animado** (WebP animado con transparencia): `bash docs/animar_marco.sh video.mp4 carpeta [escala]`. Saca los cuadros, aplica el ajuste de posición (`escala`, ej. `1.15`), recorta cada uno con `recortar_marco.mjs --brillo` y arma el WebP en `carpeta/marco-animado.webp`.
  * **Peso:** con 512 px, 24 cuadros por segundo y calidad 80, el marco de plasma pesó **17,6 MB**. Los valores por defecto del script (256 px, 10 cuadros por segundo, calidad 50 y transparencia en 8 niveles) lo dejaron en **574 KB**. La transparencia se guarda sin pérdida y es la mitad del peso: reducir sus niveles casi no se nota. Con 8 cuadros por segundo baja a 461 KB, pero el movimiento se ve a saltos.
  * **Revisar el bucle:** el salto del último cuadro al primero tiene que parecerse al de dos cuadros seguidos (`ffmpeg -i carpeta/alfa/c_001.png -i carpeta/alfa/c_051.png -lavfi psnr -f null -`, comparado con dos cuadros vecinos).
  * FFmpeg no reproduce WebP animados: para verlo, abrirlo en el navegador.

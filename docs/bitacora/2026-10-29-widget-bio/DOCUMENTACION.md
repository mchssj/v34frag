# Widget para la bio de Twitch y Twitter (prototipo VIP)

Prototipo de Kyan para que lo terminen Daniel (backend) y Esteban (frontend). Está en el frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), en `/demo/bio`, solo con `pnpm dev`.

Es distinto del widget para OBS (`2026-10-29-widget-streamers`): aquel va encima del stream y este va en la bio.

## Qué hace

Hay tres formatos. Todos muestran la foto con la insignia de nivel, el nick, ELO, puesto, K/D, rating y el link al perfil.

| Formato | Medida | Para qué | Qué se copia |
|---|---|---|---|
| Panel de Twitch | 320 × 160 | Twitch → Acerca de → Editar paneles | El PNG, el link del panel y la URL de la imagen que se actualiza sola |
| Firma para webs | 400 × 120 | Linktree, una web propia o cualquier página con HTML | Un `<iframe>`, o una imagen con link para las páginas que no aceptan iframes |
| Tarjeta del link | 1200 × 630 | Lo que muestran Twitter/X, Discord y WhatsApp al pegar `cmleague.lat/tuNick` | El link para la bio o un tweet |

- **Nitidez:** el panel y la firma se dibujan al doble de tamaño, para que se vean bien en pantallas de alta densidad.
- **Estilos:** los mismos tres de "Exportá tus stats": CM League, Claro y VIP dorado.
- **Sin foto:** el switch "Jugador sin foto" muestra cómo queda con la inicial.
- **Sin VIP:** las imágenes salen con marca de agua, y copiar y descargar quedan con candado.

**Por qué no hay un iframe para Twitch o Twitter:** ninguno de los dos acepta HTML en la bio. Twitch muestra imágenes con un link en los paneles, y Twitter solo muestra la tarjeta del link.

## Archivos (en `web/frontend/src/`)

- `features/bio/draw.ts`: el dibujo de los tres formatos. Reusa los colores, las fuentes y la carga de imágenes de `features/export/card.ts`, que ahora los exporta.
- `features/bio/BioWidget.tsx`: las vistas previas y los códigos para copiar.
- `routes/demo.bio.tsx`

## Lo que falta para la versión real

**Daniel:**

- **Imagen dinámica:** `GET /api/v1/players/{nick}/card.png?f=twitch|firma|og&tema=…`, con caché de unos minutos. Sin esto, el panel de Twitch queda con los números del día en que se descargó.
  - El dibujo de `draw.ts` se puede reusar en el Worker con un canvas del lado del servidor, o rehacerse con una librería de imágenes.
- **Open Graph:** las etiquetas Open Graph (`og:image` apuntando a la imagen `og`) en el perfil público `cmleague.lat/{nick}`. Sin esto, Twitter no muestra la tarjeta.
- **Página del iframe:** `cmleague.lat/embed/{nick}?tema=…`, que tiene que poder mostrarse dentro de otras páginas, así que sin `X-Frame-Options: DENY`.
- **VIP:** si es solo para VIP, la imagen dinámica y el iframe tienen que chequear el VIP. Si no, cualquiera arma la URL a mano.

**Esteban:** el generador en el perfil, al lado del widget para OBS.

Las URLs que muestra el prototipo (`/api/v1/players/…/card.png` y `/embed/…`) **todavía no existen**: son una propuesta.

## Pruebas (2026-10-29)

- En el navegador se vieron los tres formatos con foto, y no hubo errores en la consola.
- No se probó subirlo a Twitch, ni cómo se ve la tarjeta en Twitter: necesitan las URLs reales.

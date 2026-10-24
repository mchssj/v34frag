# Plan: Marca CM League en el frontend

> Planeación original. Estado: **aprobado** el 2026-10-24.

Paquete de logo: `CSSTV/CM-League-Logo/` (`LEEME.txt`, SVG, PNG, PDF, favicon y avatares).

## Contexto

La app pasa a llamarse **CM League** y ya tiene paquete de logo (`CSSTV/CM-League-Logo/`). Hoy el frontend dibuja una marca provisoria en CSS: un cuadro naranja con "TV" y el texto "CSS**TV**". El favicon también dice "TV". Hay que:
- definir qué logo va en cada lugar;
- guardar en la app solo los archivos necesarios: SVG para la página, y para los favicon lo que cada navegador necesite;
- reemplazar el nombre visible;
- dejar una guía de marca para Claude Design.

**Análisis del paquete** (los PNG revisados a ojo):
- **Isotipo:** cuadro naranja redondeado (rx 16/64) con una mira, dos chevrons enfrentados y dos marcas verticales.
- **Lockup:** isotipo + "CM League".
- **Wordmark:** "CM League" sin isotipo. Es Inter ExtraBold con −0.6px, convertido en trazos (no depende de la fuente cargada).
- **Colores:** coinciden exactamente con nuestros tokens.

| Logo | Token |
|---|---|
| `#F54900` (isotipo, versión clara) | `sidebar-primary` en claro |
| `#FF6900` (isotipo y "League", versión oscura) | `sidebar-primary` en oscuro |
| `#CA3500` ("League", versión clara) | `primary` en claro |
| `#0A0A0A` / `#FAFAFA` (tinta) | `foreground` en claro / en oscuro |

- **Versiones:** cada pieza viene en `color-fondo-claro`, `color-fondo-oscuro`, `una-tinta-negro` y `una-tinta-blanco`. En la versión oscura el glifo del isotipo es negro sobre `#FF6900`.
- **Reglas del paquete:** espacio libre de ¼ del alto del isotipo; mínimo 16px el isotipo y 24px de alto el lockup; no recolorear, estirar, rotar ni agregar sombras.

## 1. Qué se guarda y dónde

**Página: SVG oficiales, copiados tal cual** a `web/frontend/src/assets/brand/`:

| Archivo | Para |
|---|---|
| `cmleague-mark-color-fondo-claro.svg` / `…-fondo-oscuro.svg` | Isotipo (sidebar) |
| `cmleague-wordmark-color-fondo-claro.svg` / `…-fondo-oscuro.svg` | Wordmark (sidebar expandido) |
| `cmleague-lockup-color-fondo-claro.svg` / `…-fondo-oscuro.svg` | Lockup (header de la landing y auth) |

**Favicon: lo que cada navegador necesita** en `web/frontend/public/`, desde `04-Favicon-y-app` (respuesta de Esteban):

| Archivo | Para |
|---|---|
| `favicon.svg` (reemplaza el de "TV") | Navegadores actuales |
| `favicon.ico` (16/32/48) | Navegadores viejos y lectores de feeds |
| `apple-touch-icon.png` (180×180, de `apple-touch-icon-180x180.png`) | iPhone/iPad al guardar en la pantalla de inicio (iOS no acepta SVG) |

**No se guardan:** PDF, el resto de los PNG, las versiones de una tinta (hoy no hay ningún lugar sobre foto o sobre naranja), `android-chrome` y el manifest (la web no es instalable), ni los avatares y banners (son para redes).

`index.html`:
```html
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

## 2. Cómo se muestra (claro y oscuro)

- **Componentes `BrandMark`, `BrandWordmark` y `BrandLockup`** en `src/components/brand/`. Reemplazan a `Logo.tsx` y `Wordmark.tsx`.
- **Cada uno renderiza las dos versiones** con `<img>`: la `color-fondo-claro` con `dark:hidden` y la `color-fondo-oscuro` con `hidden dark:block`.
  - **Se usan los archivos oficiales sin tocar,** así que no hay recoloreado.
  - **Sin destello:** `theme-init.js` aplica `.dark` antes del primer render.
  - **Sin dependencias nuevas.**
- **Accesibilidad:** las imágenes son decorativas (`alt=""`); el nombre accesible lo pone el link o el botón que las contiene ("CM League, ir al inicio").
- **Tamaño:** solo se fija el alto (`h-*`) y el ancho sale solo, así que nunca se estira. Hay un `aria-hidden` para que no se lea dos veces.

## 3. Dónde va cada logo

| Lugar | Logo | Tamaño | Notas |
|---|---|---|---|
| Header flotante de la landing | Lockup | 28px de alto | Reemplaza el wordmark de texto. Sigue la bajada "Counter-Strike Source" a partir de 1000px |
| Auth (login, registro, Bienvenida), arriba a la izquierda | Lockup | 28px | Reemplaza `Logo` |
| Sidebar expandido | Isotipo 32px + wordmark de 15px de alto | — | Debajo sigue "Comunidad Counter-Strike: Source" (11px) |
| Sidebar colapsado (48px) | Isotipo 32px | — | Mismo botón; el wordmark se oculta, como hoy |
| Pestaña del navegador | `favicon.svg` / `.ico` | — | El isotipo de fondo claro (es el mismo archivo que trae el paquete como favicon) |
| iPhone, pantalla de inicio | `apple-touch-icon.png` | 180px | — |

Todos cumplen los mínimos (isotipo ≥ 16px, lockup ≥ 24px) y el espacio libre: los `gap` actuales de 8–10px ya superan ¼ del alto del isotipo.

## 4. Nombre visible: CSSTV → CM League

- **`index.html`:** `<title>CM League · Liga competitiva de Counter-Strike: Source</title>`.
- **Pie de la landing:** "CM League · Comunidad de Counter-Strike: Source".
- **Nombres accesibles:** "CM League, ir al inicio" (auth), "CM League, volver arriba" (landing) y el tooltip del sidebar.
- **Textos sueltos:** la descripción del panel móvil y de la búsqueda, el breadcrumb por defecto (`nav.ts`) y "Entra a un servidor de CM League" (`ClaimStep`).
- **Datos de prueba de las e2e:** los servidores simulados pasan a "CM League #1/#2".
- **No cambian las claves internas** (`csstv.session`, `csstv-theme`, `csstv.themeFx`, etc.): renombrarlas cerraría las sesiones y borraría las preferencias guardadas de todos. Tampoco cambian comentarios ni nombres de archivo.

## 5. Guía para Claude Design

Archivo aparte en Descargas: **`C:\Users\xxest\Downloads\CMLeague-marca.md`** (respuesta de Esteban). Lleva:
- las piezas del paquete;
- qué versión va sobre claro y cuál sobre oscuro;
- la tabla de lugares y tamaños;
- los colores con su token;
- espacio libre, mínimos y lo que no se hace;
- el nombre visible y la bajada.

## 6. Pruebas

- **Unitarias:** las que nombran la marca, si alguna lo hace.
- **e2e:**
  - se actualizan los nombres accesibles ("CM League, ir al inicio") y los servidores simulados;
  - nueva prueba: el header de la landing y el sidebar muestran el logo, con su `<img>` cargada (`naturalWidth > 0`), en claro y en oscuro, y la pestaña tiene el favicon;
  - una búsqueda en `src` confirma que no queda "CSSTV" visible.
- **Verificación:** typecheck, lint, `pnpm test`, `pnpm test:e2e`, capturas en claro y oscuro (landing, auth, sidebar abierto y colapsado, teléfono) y desborde de 320 a 1260px.

## 7. Bitácora

- **Carpeta nueva** `docs/bitacora/2026-10-24-marca-cm-league/`, con `PLAN.md` (este plan) y, al terminar, `DOCUMENTACION.md` y `GUIA_IMPLEMENTACION.md`.
- **Una fila** en el `README.md`.
- **`web/frontend/CLAUDE.md`:** en "Diseño", dónde están los logos y la regla de no recolorear.

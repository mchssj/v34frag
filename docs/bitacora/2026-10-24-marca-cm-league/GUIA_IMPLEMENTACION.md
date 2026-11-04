# Marca CM League en el frontend: guía de implementación

## Estado

Implementado y probado en local (2026-10-24) en la rama `feat/frontend-fase-1`. Sin commit y sin desplegar.

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/assets/brand/*.svg` | Nuevos: isotipo, wordmark y lockup, en versión fondo claro y fondo oscuro, copiados del paquete sin cambios |
| `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png` | El favicon de "TV" se reemplaza por el del paquete; se suman `.ico` y el ícono de iPhone |
| `index.html` | Título "CM League · …" y los tres `<link>` del favicon |
| `src/components/brand/Brand.tsx` | Nuevo: `BrandMark`, `BrandWordmark` y `BrandLockup` |
| `src/components/brand/Logo.tsx`, `Wordmark.tsx` | Borrados (la marca provisoria en CSS) |
| `src/features/landing/LandingHeader.tsx` | Lockup; solo el isotipo por debajo de 400px; la bajada desde 1200px |
| `src/features/auth/AuthShell.tsx` | Lockup y nombre accesible "CM League, ir al inicio" |
| `src/features/shell/AppSidebar.tsx` | Isotipo y wordmark; `aria-label` en el link y tooltip "CM League" |
| `src/routes/index.tsx`, `components/ui/sidebar.tsx`, `features/shell/CommandMenu.tsx`, `features/shell/nav.ts`, `features/onboarding/ClaimStep.tsx` | "CSSTV" → "CM League" en los textos visibles |
| `e2e/landing.spec.ts`, `e2e/shell.spec.ts` | Pruebas nuevas de la marca; los servidores simulados pasan a "CM League #1/#2" |
| `CLAUDE.md` | Sección Diseño: dónde están los logos y sus reglas |

## Despliegue

No se desplegó.

## Pruebas

- **Unitarias:** 186 en verde, sin cambios.
- **e2e:** 44 en verde, 4 nuevas:
  - el lockup del header en claro y en oscuro: se ve una sola versión, la del tema, cargada; el título de la pestaña y los tres archivos de favicon responden;
  - en un teléfono de 360px el header muestra solo el isotipo;
  - el sidebar muestra el isotipo y el wordmark cargados, y al colapsar sigue el link de la marca.
- **Visual:** capturas en claro y oscuro de la landing (1280, 1200, 1000, 400 y 320px), el login, el sidebar abierto y colapsado y el teléfono.
- **Desborde horizontal:** ninguno en la landing de 320 a 1440px, ni en la app en 390px.

## En qué se apartó del plan

- **Header de la landing en anchos chicos:** el lockup (unos 123px) es más ancho que el wordmark de texto anterior (unos 55px). El header desbordaba 34px en 320 y 23px en 360, así que **por debajo de 400px va solo el isotipo**. A 1000px desbordaba 55px, porque ahí aparecen la navegación completa y la bajada, así que **la bajada pasó de 1000 a 1200px**.
- **Accesibilidad del sidebar:** antes, el texto "CSSTV" le daba nombre al link. Con el logo como imagen decorativa, el link se anunciaba solo como "Comunidad Counter-Strike: Source"; lo detectó la e2e nueva. Ahora lleva `aria-label="CM League, ir al inicio"`.

## Ampliación (2026-10-24): naranja del logo en oscuro y favicon según el sistema

Decisiones de Esteban, sobre mi recomendación.

- **`primary` en oscuro = el naranja del logo** (`src/index.css`, bloque `.dark`):
  - `--primary` pasa de `oklch(0.47 0.157 37.304)` (`#9F2D00`) a `oklch(0.705 0.213 47.604)` (`#FF6900`);
  - `--primary-foreground` pasa a `oklch(0.145 0 0)` (`#0A0A0A`), así que el texto de los botones es negro, como la mira del isotipo oscuro;
  - `--sidebar-primary-foreground` también va a negro, para que el token quede bien sobre `#FF6900`; hoy no lo usa ningún componente;
  - el tema claro no cambia.
- **Por qué:** se midió el contraste antes del cambio.

| Uso en oscuro | Antes (`#9F2D00`) | Ahora (`#FF6900`) |
|---|---|---|
| Naranja como texto sobre el fondo (eyebrows, la parte naranja del H1, links: 22 usos en 18 archivos) | 2,7:1 ❌ | 6,9:1 ✅ |
| Botón con su texto encima | 6,9:1 (texto claro) | 6,9:1 (texto negro) |

  Efecto de arrastre: el `LevelBadge` de niveles 8–9 (`bg-sidebar-primary text-primary-foreground`) también tenía texto claro sobre `#FF6900` (2,7:1) y ahora lo tiene negro.
- **Favicon según el tema del sistema:** `public/favicon.svg` combina las dos versiones oficiales del isotipo (misma geometría) con `@media (prefers-color-scheme: dark)`: fondo claro `#F54900` con mira blanca, o fondo oscuro `#FF6900` con mira negra.
  - Sigue el tema del sistema o del navegador, no el botón de la web, porque un favicon no puede leerlo.
  - `favicon.ico` y `apple-touch-icon.png` quedan en la versión clara: son mapas de bits y no pueden cambiar.
- **Verificación:**
  - capturas en oscuro antes y después (landing, login, Home y Mi perfil);
  - el favicon dibujado con el sistema en claro y en oscuro;
  - typecheck, lint, 186 unitarias y 44 e2e en verde.
- **Recuadro de la flecha de "Crear cuenta"** (header de la landing): el velo negro al 15 % (`bg-black/15`) estaba pensado para la flecha clara sobre el naranja quemado. Sobre `#FF6900` con la flecha negra quedaba un cuadrado marrón turbio. Se probaron cuatro variantes sobre el botón real y Esteban aprobó la recomendada: en oscuro, el recuadro es negro con la flecha naranja (`dark:bg-primary-foreground dark:text-primary`), como el isotipo oscuro. En claro no cambia. Es el único botón con ese recuadro.
- **Documentos actualizados:** `CSSTV/desings/CSSTV-sistema-de-diseno.md` (tabla de tokens, modo oscuro y favicon; la nota "pendiente de decisión" pasó a "decidido") y `Downloads/CMLeague-marca.md`.

## Pendientes

- **Mockups de Claude Design:** actualizarlos con `CMLeague-marca.md` (en Descargas).
- ~~**Documento del sistema de diseño:** todavía describe el wordmark provisorio "CSS**TV**".~~ **Hecho el 2026-10-24** en `CSSTV/desings/CSSTV-sistema-de-diseno.md`: nueva sección "Marca".
- **Imagen para compartir en redes** (`og:image`): no está definida; el paquete trae banners que podrían servir.

## Cómo revertir

Todavía no hay commit: alcanza con descartar los cambios de los archivos de arriba y restaurar `Logo.tsx`, `Wordmark.tsx` y el `favicon.svg` anterior.

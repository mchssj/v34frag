# Header flotante y hero de la landing: guía de implementación

## Estado

Implementado y probado en local (2026-10-17) en la rama `feat/frontend-fase-1`. **Sin desplegar**: el frontend nuevo todavía no está en producción.

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/features/landing/LandingHeader.tsx` | Reescrito: barra flotante, nav desde 1000 px, menú desplegable, CTA con chip |
| `src/features/landing/Hero.tsx` | Alto mínimo `calc(88svh - 70px)`, contenido centrado, `py-24` |
| `src/components/brand/ThemeSwitch.tsx` | Nuevo: selector de tema segmentado, con `THEME_MODES` compartido con el menú |
| `src/components/brand/Wordmark.tsx` | Nuevo: texto "CSSTV" separado del `Logo` |
| `src/components/brand/Logo.tsx` | Usa `Wordmark`. Se quitaron la prop `wordmarkClassName` y el ancho fijo `lg:w-[77px]`, que solo servían al header anterior |
| `src/lib/useMediaQuery.ts` | Nuevo: media query en React con `useSyncExternalStore` |
| `src/components/brand/ThemeSwitch.test.tsx` | Nueva prueba unitaria |
| `e2e/landing.spec.ts` | 4 pruebas nuevas del header |
| `CLAUDE.md` | Estructura actualizada |

## Despliegue

No se desplegó. Va con el resto del frontend nuevo en el corte.

## Pruebas

### Unitarias (Vitest)

107 en verde, una nueva: `ThemeSwitch` marca Sistema por defecto y, al elegir Oscuro, cambia `aria-pressed`, aplica la clase `dark` y guarda `csstv-theme`.

### De punta a punta (Playwright)

19 en verde. Las 4 nuevas no gastan logins ni registros:
- a 390 px, el menú lleva a "Servidores", se cierra y deja la sección a la vista; Escape también lo cierra;
- a 390 px, el tema y "Iniciar sesión" están dentro del menú y funcionan;
- al pasar a 1200 px el menú se cierra y aparece la nav, y al volver a 390 px no se reabre solo;
- en escritorio, el tema elegido persiste al recargar.

### Visual y medidas

Capturas y medidas en 1440, 1260, 1000, 999, 768, 640, 639, 390 y 320 px, en claro y oscuro, con y sin el menú abierto:
- **Partido en dos líneas:** ningún elemento de la barra, en ningún ancho.
- **Barra:** 1260 px a 1440, y el ancho de la pantalla menos 32 px por debajo.
- **Menú:** a 0 px del borde derecho interno de la barra y 8 px debajo de ella, como la spec.
- **Hero:** 687 px de alto en una pantalla de 860 (`88% − 70`). A 320 px crece a 717 por el contenido, como estaba previsto con el padding mínimo.
- **Desborde horizontal:** ninguno en 320, 360, 390, 639, 640, 768, 999, 1000 ni 1260 px, en ninguna vista.

## En qué se apartó del plan

- **Umbral del chip del CTA:** se bajó de 400 a 360 px. Sin el tema ni "Iniciar sesión" en la barra, el chip entra desde unos 330 px; con 360 se ve en los teléfonos comunes (360 y 390 px) y solo se quita en los de 320.
- **Tema en el menú:** se usa un grupo de opciones del menú (`DropdownMenuRadioGroup`) en lugar del `ThemeSwitch`. Los botones sueltos dentro de un menú de Radix no se alcanzan con el teclado; las opciones del menú sí.

## Agregados posteriores

- **2026-10-17: banderas.**
  - **Pie:** banderas de Argentina y Colombia junto a "Counter-Strike: Source", con `role="img"` y `aria-label`. Prueba e2e en `e2e/landing.spec.ts`.
  - **Selector de país** de la Bienvenida: bandera en cada opción y en el valor elegido. "Otro" muestra un globo; ahí la bandera es decorativa, porque el nombre va al lado.
  - **Componente:** `src/components/brand/CountryFlag.tsx`, que traduce los nombres de `COUNTRIES` a la bandera.
  - **Dependencia nueva:** `country-flag-icons` 1.6.20 (MIT, sin scripts de instalación). Son SVG y no emojis, porque Windows no dibuja los emojis de banderas (muestra "AR", "CO"). El build incluye solo las 22 banderas usadas, unos 5 KB comprimidos.
  - **Detalle de shadcn:** `Select` y `DropdownMenu` fuerzan `size-4` en los SVG sin `size-` en la clase. La bandera lleva `size-auto` para mantener su 18×12.
  - **Prueba intermitente corregida:** "en pantallas angostas el tema e 'Iniciar sesión' están en el menú" reabría el menú durante su animación de cierre, y la capa que se cerraba tomaba el clic como "afuera". Ahora espera a que el menú se cierre; pasó 15 de 15 repeticiones.

## Cómo revertir

Revertir el commit en `feat/frontend-fase-1`. No hay cambios fuera de `web/frontend` y esta carpeta de la bitácora.

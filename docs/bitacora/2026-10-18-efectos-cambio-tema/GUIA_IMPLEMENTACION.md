# Efectos al cambiar de tema: guía de implementación

## Estado

Implementado y probado en local (2026-10-18) en la rama `feat/frontend-fase-1`. **Sin commit**, por pedido de Esteban, hasta tener sonidos sin riesgo de copyright. Sin desplegar.

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/features/theme-fx/*` | Nuevo: decisión, preferencia, samples, motor, hook, modal y menú contextual, más sus pruebas |
| `src/features/landing/LandingHeader.tsx` | El selector y el menú móvil usan `pickTheme`; menú contextual, "Efectos de tema" en el menú móvil y modal |
| `src/components/brand/ThemeSwitch.tsx` | Prop `onPick` (reemplaza a `setTheme`) |
| `src/components/theme-provider.tsx` | Exporta el tipo `Theme` |
| `src/components/ui/dialog.tsx`, `context-menu.tsx` | Nuevos (`shadcn add`). En `dialog`: textos en español ("Cerrar") y la prop `overlayClassName` |
| `src/components/ui/alert.tsx` | Variante `warning` (ámbar) |
| `src/config/site.ts` | `THEME_FX_SOUNDS` |
| `.gitignore` | Los dos `.wav` de Valve de `public/sounds/` |
| `e2e/theme-fx.spec.ts` | Nuevo: 10 pruebas |
| `e2e/landing.spec.ts` | Las dos pruebas de tema arrancan con los efectos desactivados (prueban el tema, no los efectos) |

## Despliegue

No se desplegó.

**Cuidado:** un `pnpm build` en una máquina que tenga los `.wav` de Valve los copia a `dist/sounds/`. Nunca se debe publicar un build local; el de CI no los tiene.

## Pruebas

### Unitarias (Vitest)

115 en verde. Las nuevas cubren:
- `decideFx` en todos los casos del handoff (flashbang, smoke, preguntar, directo, `off`, efecto en curso, movimiento reducido, `silent`);
- la preferencia (valor desconocido, guardar y avisar, cambio desde otra pestaña).

### De punta a punta (Playwright)

30 en verde, 10 nuevas:
- el primer cambio abre el modal con el foco en "Activar efectos", el aviso y el atajo "Clic derecho"; Escape aplica el tema y no guarda;
- con `silent`, la smoke aparece, el tema pasa a oscuro y el canvas se quita;
- con `off`, el cambio es directo;
- el clic derecho abre "Efectos de tema" con "Con sonido" marcado por defecto y guarda "Desactivados";
- "Activar efectos" guarda `full` y lanza la flashbang: el tema pasa a claro, el overlay se quita y el `filter` del `body` queda limpio;
- con movimiento reducido no hay modal ni efecto;
- en el teléfono, el menú tiene "Efectos de tema", y elegir Oscuro sin preferencia abre el modal;
- en táctil, el modal muestra "Mantén presionado", y la pulsación larga abre el menú sin cambiar el tema.

### Manual

Falta la revisión de Esteban en el navegador: tiempos, sonido con los samples y en claro y oscuro.

## En qué se apartó del plan

- **Aviso de fotosensibilidad:** se mostró como tarjeta ámbar (`Alert` con `warning`) y no como texto suelto. Lo pidió Esteban. Tiene `role="note"`: es información fija y `alert` la anunciaría de golpe.
- **Pie del modal:** chips con ícono según el dispositivo en lugar de "(mantén presionado en móvil)". Lo pidió Esteban.
- **Pulsación larga:** la resuelve Radix, que espera 700 ms y no los 500 ms del handoff. La vibración de 10 ms se agrega al abrir el menú desde táctil. Como Radix bloquea el resto de la página mientras el menú está abierto, el clic posterior a la pulsación no cambia el tema; una prueba e2e lo verifica.
- **Código de la referencia sin usar:** no se portaron `modal()` ni el bus de reverberación (`rv`, `send`), que la referencia define pero nunca llama.
- **Canvas de la smoke:** `width:100%; height:100%` en lugar de `100vw` y `100vh`, para no depender de la barra de scroll ni de la barra de direcciones del móvil.

## Pendientes

- **Sonidos:** reemplazar los `.wav` de Valve por audio CC0 (lo está buscando Esteban) y actualizar `THEME_FX_SOUNDS`. Después se puede hacer el commit.
- **Mi perfil → Preferencias:** la sección del handoff se hace con la pantalla Mi perfil, que todavía no existe. `useThemeFxPref` y `THEME_FX_OPTIONS` ya están listos para usarla.
- **Pedido al backend:** `preferences.theme_fx` (`full`, `silent`, `off` o `null`) en `GET` y `PATCH /api/v1/me/profile`. Al iniciar sesión, el valor del servidor reemplaza al del navegador. **Resuelto el 2026-10-19:** el backend lo entregó y el frontend lo sincroniza (ver `2026-10-19-vinculacion-contrasena`).

## Cómo revertir

Todavía no hay commit: alcanza con descartar los cambios de los archivos de arriba y borrar `public/sounds/`.

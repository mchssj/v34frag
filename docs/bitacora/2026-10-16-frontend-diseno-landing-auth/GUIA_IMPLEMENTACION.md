# Diseño de Landing, Login, Registro y Bienvenida: guía de implementación

## Estado

Implementado y probado en local contra la API real (2026-10-17), en la rama `feat/frontend-fase-1`. **Sin desplegar**: el frontend nuevo todavía no está en producción (ver `2026-10-16-despliegue-vps`).

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/index.css` | Geist Mono, `--win`, radios `lg`, `xl`, `tile` y `hero`, `animate-live`, selección, utilidad `leading-design` |
| `index.html`, `public/theme-init.js`, `public/favicon.svg` | Título y descripción, favicon, tema aplicado antes del render. Se borró `public/vite.svg` |
| `src/components/theme-provider.tsx` | Tema Sistema por defecto, clave `csstv-theme`, sin el atajo "d", lectura y escritura seguras |
| `src/components/ui/button.tsx` | Tamaños `md` (40 px) y `xl` (44 px) |
| `src/components/brand/*` | Nuevos: `Logo`, `ThemeToggle`, `LevelBadge`, `LiveDot`, `SectionHeading` |
| `src/assets/landing-bg.avif`, `.webp` | Imagen del hero convertida desde el PNG del handoff (49 KB y 420 KB) |
| `src/config/site.ts` | Nuevo: servidores, Discord, IP del `!claim` y vencimiento del link de confirmación, todo fijo |
| `src/api/errors.ts` | Copy del diseño, `retryIn`, `isRetryable` |
| `src/auth/guards.ts`, `callback.ts`, `schemas.ts`, `queries.ts` | Rutas nuevas, `redirectIfSignedIn`, email y contraseña del registro |
| `src/features/public/queries.ts` | Nuevo: datos públicos de la landing, el login y el registro |
| `src/features/landing/*`, `src/routes/index.tsx` | Nueva landing |
| `src/features/auth/AuthShell.tsx`, `ui.tsx`, `LoginForm.tsx` | Layout de auth, piezas comunes, login rediseñado |
| `src/features/auth/register/*` | Nuevo registro en 3 pasos |
| `src/features/onboarding/*` | Nueva Bienvenida, criterio compartido y aviso del Home |
| `src/routes/_auth/login.tsx`, `register.tsx`, `welcome.tsx`, `_app/home.tsx` | Rutas nuevas |
| `src/routes/_auth.tsx`, `_app.tsx`, `_app/_admin.tsx`, `src/main.tsx` | Alineados con las rutas y la marca |
| Borrados | `SignupForm`, `TextField`, `FormAlert`, `AliasStatus`, `features/auth/onboarding/*`, rutas `ingresar`, `registro`, `registro_.confirmar`, `panel`, `completar-perfil` |
| Pruebas | Actualizadas: `callback.test.ts`, `guards.test.ts`, `LoginForm.test.tsx`. Nuevas: `register/helpers.test.ts`, `register/RegisterFlow.test.tsx`, `onboarding/queries.test.ts`. e2e: `auth.spec.ts`, `helpers.ts`, `global.setup.ts` |
| `package.json`, `pnpm-lock.yaml` | `@fontsource-variable/geist-mono` |
| `CLAUDE.md` | Sección "Diseño" y estructura actualizada |

## Despliegue

No se desplegó. Es una SPA estática: se publica con el resto del frontend nuevo en el corte.

## Pruebas

### Unitarias (Vitest)

106 pruebas en verde. Cubren:
- el medidor de fuerza y el enmascarado del email;
- los estados locales del alias;
- el criterio de la Bienvenida;
- las guardas, incluida `redirectIfSignedIn`;
- los errores del login, incluido "Reintentar";
- el registro: errores del paso 1, `409` de email y de alias, "Revisa tu correo" y el salto a `/welcome`.

### De punta a punta (Playwright, contra la API local)

15 pruebas en verde, entre ellas:
- registro → Bienvenida (Guardar y seguir, código real, Lo hago después) → aviso "1 de 2" → Continuar vuelve al mismo código;
- ruta protegida → login → Bienvenida → Saltar → aviso "0 de 2";
- la landing con sesión va al Home;
- el link de confirmación termina en `/login?aviso=…` sin tokens en la URL.

### Comparación visual con el prototipo

Capturas con Playwright del prototipo (servido por HTTP) y de `vite preview`, en 1440 y 390 px, claro y oscuro: landing, login, registro, Bienvenida (los dos pasos) y aviso del Home. Además se midió la posición de cada texto en las dos páginas.

- **Resultado:** las posiciones coinciden al píxel en el registro, la Bienvenida, el aviso y la landing.
- **Diferencias esperadas:**
  - los datos reales;
  - en el login, el párrafo "Mockup…" del prototipo, que no va, y la casilla Recordarme, que sí;
  - en el paso 2, el botón "Simular" del prototipo, que no va.

### Desborde horizontal

Ninguna vista se desborda en 320, 360, 390 ni 768 px, tampoco las vistas con sesión ni las tarjetas de puesto.

## En qué se apartó del plan

- **Radios:** en lugar de agregar `--radius-panel`, se redefinió la escala del preset para que coincida con el diseño: `lg` = radius − 2px y `xl` = +4px. Se agregaron `tile` (+2px) y `hero` (+6px).
- **Imagen del hero:** AVIF (calidad 70) y WebP (75) en `image-set`, sin el PNG de 2,9 MB, que todos los navegadores soportados ya no necesitan.
- **Puestos:** son radios nativos con estilo de tarjeta, en lugar de un `radiogroup` con `aria-checked`. El teclado y el lector de pantalla funcionan sin código propio. Se mantienen las 3 columnas del diseño también en móvil, con separación silábica (`hyphens-auto`) para las palabras largas.
- **`leading-design` (no estaba en el plan):** el prototipo deja el `line-height` en `normal`, y con las alturas de Tailwind cada bloque quedaba entre 3 y 8 px más alto. La utilidad se aplica en la raíz de cada vista del handoff.
- **Comparación visual:** el prototipo no carga por `file://`, así que se sirvió por HTTP.
- **Copy y datos:**
  - "Empieza en {n} días" en lugar de "Cierra en": no hay fecha de cierre.
  - El código `!claim` real es de 6 caracteres y vence en 10 minutos, no de 8 y 15. Las casillas y la cuenta regresiva salen del dato real.
  - "Vinculado" muestra el SteamID y el mensaje del servidor, sin el conteo de mixes.
  - El puesto se guarda en `game_role`, que tiene exactamente los mismos valores que el `position` del diseño.
  - "Revisa tu correo" no muestra reenviar ni cambiar email (no hay endpoint).
  - El vencimiento del link de confirmación se muestra como "1 hora" fijo.
  - El paso 1 de "Cómo funciona" dice "En cuatro pasos" (copy final del diseño), aunque el registro ahora tiene 3 pasos más la Bienvenida. Queda para que lo defina diseño.
- **Errores en la landing:** si fallan el torneo o el ranking, se muestra "No se pudo cargar…" en lugar del estado vacío, para no decir que no hay datos cuando sí los hay.
- **Header de la landing:**
  - el wordmark se oculta por debajo de 390 px para que el header entre;
  - desde `lg` toma el ancho del SVG del diseño (77 px), así la navegación queda donde en el prototipo;
  - los 24 px entre botones se aplican también desde `lg`.
- **Botones:** los de shadcn Nova tienen un borde transparente de 1 px, que el sistema usa para el foco, y los del prototipo no. Quedan 2 px más anchos y se aceptó así para no quitar el estilo de foco.

## Pedidos al backend

Para reemplazar los valores fijos o mostrar lo que falta:

1. **Estado público de los servidores:** en línea, mapa, jugadores y ping. Hoy `/api/v1/servers` exige sesión y no tiene estado en vivo.
2. **Reenviar el email de confirmación y cambiar el email** antes de confirmar.
3. **`onboarding_done` y `email_verified`** en el usuario, para no depender de `localStorage`.
4. **Fecha de cierre de inscripción y banner** del torneo.
5. **Conteo de mixes** del SteamID vinculado.
6. **Datos de Discord** (en línea, miembros), si se quiere mostrar el valor real.

## Cómo revertir

Revertir el commit en `feat/frontend-fase-1` (`git revert <sha>`). No hay migraciones ni cambios fuera de `web/frontend` y esta carpeta de la bitácora.

# Términos y privacidad en el frontend nuevo: guía de implementación

## Archivos que cambiaron

Ver la tabla de la documentación. Además, `src/routeTree.gen.ts` (generado por el plugin del router) y `routes/index.tsx` (usa `SiteFooter`).

## Cómo probarlo

```bash
pnpm -C web/frontend dev --port 5174
```

Abrir `/terminos` y `/privacidad`, y mirar el pie de `/` y el texto de abajo de `/register`.

## Cómo se probó (2026-11-03)

- `pnpm typecheck` y `pnpm lint`: sin errores.
- `pnpm test`: 491 de 492. La que falla es `shell/lib/nav.test.ts` ("Administración y sus secciones"), que **ya fallaba antes de este cambio** (se comprobó con los cambios guardados en el stash). Las 4 pruebas nuevas pasan.
- En el navegador: escritorio 1440 px en claro, celular 375 px en oscuro y sin scroll horizontal, links del pie y del registro. Sin errores de consola propios de estas páginas (los que hay son de la landing sin la API local y una advertencia de `key` en `HowItWorks`, que ya estaban).

## Cómo revertir

Borrar `features/legal/`, las dos rutas y `SiteFooter.tsx`, y volver `routes/index.tsx` y `AuthShell.tsx` a su versión anterior.

## Segunda tanda (2026-11-03): centro de ayuda

- Kyan pasó dos capturas: una columna "Legal" para el pie y un menú lateral con Preguntas frecuentes, Soporte, Términos de uso, Privacidad y Seguridad.
- Se sumaron `/ayuda`, `/soporte` y `/seguridad`, el menú en `LegalLayout` (el índice de secciones pasó abajo como "En esta página", solo en pantallas anchas) y la columna **Legal** del pie. "Ayuda" lleva a Preguntas frecuentes.
- Probado: `pnpm typecheck` y `pnpm lint` sin errores, 11 pruebas de `features/legal` en verde, y en el navegador a 1440 y 1280 px en oscuro y a 375 px sin scroll horizontal.

## Pendiente

- Datos completados el 2026-11-03 en las dos copias. Las regiones también: Supabase en el oeste de Estados Unidos (Oregón) y el VPS en Beauharnois (Canadá).
- `config/site.ts`: `DISCORD.inviteUrl` pasó de `https://discord.com` a `https://dsc.gg/v34frag`, así que el botón del Discord de la landing ya lleva al servidor real.
- Avisarle a Esteban: tocó el pie de la landing y `AuthShell`, que son de su área.

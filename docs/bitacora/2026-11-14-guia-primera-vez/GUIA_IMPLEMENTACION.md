# Guía de la web la primera vez: guía de implementación

## Estado

Hecho el 2026-11-14 y commiteado en `kyan/guia` el 2026-11-15. El 2026-11-15 se llevó a `main` (cherry-pick en `feat/guia-primera-vez`, desde `origin/main` `1182f60e`) y se probó el flujo real con una cuenta nueva de la base local. **Web desplegada el 2026-11-15** (`d3cf16b6fa9a`, con `deploy/vps/desplegar.sh web`: 811 pruebas). Falta publicar el changelog (2.9.51).

## Archivos

Rutas relativas a `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/features/onboarding/lib/guide.ts` | Nuevo: pasos (`guideSteps(role)`) y marcas en `localStorage` |
| `src/features/onboarding/lib/guide.test.ts` | Nuevo: 5 pruebas |
| `src/features/onboarding/components/GuideDialog.tsx` | Nuevo: la ventana (sobre el `Dialog` de shadcn) |
| `src/features/onboarding/components/GuideDialog.test.tsx` | Nuevo: 4 pruebas |
| `src/features/onboarding/components/FirstVisitGuide.tsx` | Nuevo: `FirstVisitGuide` (se abre sola) y `useGuide` (desde Ayuda) |
| `src/features/onboarding/pages/WelcomeFlow.tsx` | Marca la guía como pendiente al entrar a la Bienvenida |
| `src/routes/_app.tsx` | Monta `FirstVisitGuide` |
| `src/features/help/pages/HelpIndex.tsx`, `src/routes/_app/help.index.tsx` | Botón **Ver la guía** |
| `src/routes/demo.guia.tsx` | Prototipo, con selector de rol |
| `src/features/onboarding/lib/guideText.ts` | Nuevo: textos en español, portugués e inglés, y el idioma elegido |
| `src/config/site.ts` | `CLIENTMOD.downloadUrl` (`https://clientmod.ru/`, confirmado por Kyan) |
| `docs/manual/jugador/instalar-clientmod.md` (raíz del repo) | Nueva: qué es ClientMod, instalarlo y activar la consola |
| `docs/manual/jugador/crear-cuenta.md` (raíz del repo) | Sección "4. La guía de la web" |

## Despliegue

Solo la web: va con el próximo despliegue del frontend. Sin base, API, plugin ni Worker. Va en `main`, la referencia de producción desde el 2026-11-04 (Daniel, 2026-11-15).

## Pruebas

### Vitest

`pnpm exec vitest run src/features/onboarding src/features/help`: 10 archivos y 41 pruebas (con ClientMod y los idiomas), todas pasan. `pnpm typecheck` y `pnpm lint`, sin errores.

### Navegador

`/demo/guia` con el servidor `frontend-repo`: avanza con el botón y con la flecha del teclado y vuelve con Anterior. "Ir a…" y "Leer en la ayuda" cierran la guía y avisan la ruta. Con el rol Moderador aparece el paso de Administración (`/admin/bans`). En 375 px entra sin scroll horizontal. Con el selector en `PT` la guía pasa a portugués y queda guardado (`csstv.guide-lang = pt`). Sin errores en la consola.

### Flujo real (2026-11-15, Daniel con Claude)

Con una cuenta nueva de la Supabase local y Chromium sin interfaz (Playwright): entrar a `/welcome` y después a `/home` abre la guía sola. Recorre los 8 pasos (Bienvenido, ClientMod, la consola, Busca partida, Vincula tu SteamID, Partidas y ranking, Equipos y torneos, Ayuda), «Listo» la cierra y al recargar no vuelve a abrirse. Sin errores en la página. Web en `main` con la guía: 811 pruebas de Vitest, `tsc -b` y ESLint sin errores, y el manual valida en el build de la API (69 páginas).

## En qué se apartó del plan

- **ClientMod y la consola pasan a ser lo principal** (Kyan, durante la implementación): dos pasos con pregunta de sí o no, después de la bienvenida. Partidas y ranking quedan en un solo paso. Son 8 pasos para el jugador (9 para el staff).
- La vinculación del SteamID tiene su propio paso.
- **La guía en español, portugués e inglés** (Kyan, durante la implementación), con un selector dentro de la ventana. Solo la guía: traducir toda la web sería otro requerimiento.
- Las traducciones al portugués y al inglés no las revisó un hablante nativo.
- El link de descarga de ClientMod (`https://clientmod.ru/`) lo confirmó Kyan el 2026-11-14. **Falta confirmar** los nombres exactos del menú de Opciones de ClientMod en español.

## Cómo revertir

Revertir el commit. Las claves `csstv.guide.*` que queden en los navegadores no molestan.

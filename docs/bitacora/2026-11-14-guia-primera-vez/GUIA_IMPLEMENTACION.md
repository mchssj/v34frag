# Guía de la web la primera vez: guía de implementación

## Estado

Hecho el 2026-11-14 y commiteado en `kyan/guia` el 2026-11-15, **sin desplegar**. Probado con Vitest y en el navegador con el prototipo `/demo/guia` (escritorio y 375 px). **No probado** el flujo real registro → Bienvenida → Para ti con una cuenta nueva: no había API local levantada.

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

Solo la web: va con el próximo despliegue del frontend. Sin base, API, plugin ni Worker. Según `CLAUDE.md`, la web va en `feat/frontend-fase-1`: llevarlo ahí, preguntando antes.

## Pruebas

### Vitest

`pnpm exec vitest run src/features/onboarding src/features/help`: 10 archivos y 41 pruebas (con ClientMod y los idiomas), todas pasan. `pnpm typecheck` y `pnpm lint`, sin errores.

### Navegador

`/demo/guia` con el servidor `frontend-repo`: avanza con el botón y con la flecha del teclado y vuelve con Anterior. "Ir a…" y "Leer en la ayuda" cierran la guía y avisan la ruta. Con el rol Moderador aparece el paso de Administración (`/admin/bans`). En 375 px entra sin scroll horizontal. Con el selector en `PT` la guía pasa a portugués y queda guardado (`csstv.guide-lang = pt`). Sin errores en la consola.

## En qué se apartó del plan

- **ClientMod y la consola pasan a ser lo principal** (Kyan, durante la implementación): dos pasos con pregunta de sí o no, después de la bienvenida. Partidas y ranking quedan en un solo paso. Son 8 pasos para el jugador (9 para el staff).
- La vinculación del SteamID tiene su propio paso.
- **La guía en español, portugués e inglés** (Kyan, durante la implementación), con un selector dentro de la ventana. Solo la guía: traducir toda la web sería otro requerimiento.
- Las traducciones al portugués y al inglés no las revisó un hablante nativo.
- El link de descarga de ClientMod (`https://clientmod.ru/`) lo confirmó Kyan el 2026-11-14. **Falta confirmar** los nombres exactos del menú de Opciones de ClientMod en español.

## Cómo revertir

Revertir el commit. Las claves `csstv.guide.*` que queden en los navegadores no molestan.

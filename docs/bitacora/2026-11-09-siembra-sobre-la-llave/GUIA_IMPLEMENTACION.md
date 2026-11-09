# Siembra sobre la llave: guía de implementación

## Estado

Probado en local el 2026-11-09 (lógica, pruebas de toda la web y la demo en el navegador) y por Daniel en la página real local, con la copia de producción. Commit en `main`; **falta el despliegue de la web**. Solo web: no hay migraciones ni cambios en la API, el VPS ni los servidores.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/admin/events/lib/model.ts` | Nuevos `seedLayout`, `placeTeam`, `fillSlots`, `koRoundName` y los tipos `LayoutSection`, `LayoutCol`, `LayoutBox` y `LayoutSlot` |
| `web/frontend/src/features/admin/events/lib/model.test.ts` | 6 pruebas nuevas (llave con byes, doble, grupos, suizo de 1 y de 2 etapas, poner y completar) |
| `web/frontend/src/features/admin/events/components/SeedingTab.tsx` | Reescrito: columna **Sin ubicar**, la llave del formato como lugar donde soltar, tocar y poner, ×, Vaciar, Completar huecos y la barra de abajo. Sin ▲ ▼ ni la vista previa de la primera ronda |
| `web/frontend/src/routes/demo.siembra.tsx` | Nuevo: `/demo/siembra`, solo en `pnpm dev`, con los cinco formatos y "Simular fixture generado" |
| `web/frontend/src/routeTree.gen.ts` | Regenerado por Vite con la ruta de la demo |
| `docs/manual/organizador/inscripciones-y-fixture.md` | Sección **Siembra** nueva |
| `docs/bitacora/2026-11-09-siembra-sobre-la-llave/` | Esta carpeta, con `pruebas/probar_demo_siembra.cjs` y `CHANGELOG_DISCORD.txt` (2.9.31) |

## Despliegue (pendiente)

1. Commit en `main` (worktree `v34frag-mainwt`): hecho el 2026-11-09, con `docs/bitacora/README.md` y `docs/PENDIENTES.md`. Es solo web: no va a `feat/mm-claim-en-sala`. Si `feat/frontend-fase-1` sigue como copia, se adelanta.
2. Desplegar la web como siempre. No hay orden con otros requerimientos: no depende de ningún replanteo.

## Pruebas

### Lógica (`pnpm test`)

- `model.test.ts`: 16 de 16.
- Toda la web: 117 archivos y 709 pruebas en verde.
- `pnpm exec tsc -b` y `eslint` sin errores.

### En el navegador (`pruebas/probar_demo_siembra.cjs`, Playwright contra `/demo/siembra`)

18 de 18:

- 8 equipos en la llave.
- Arrastrar el #1 sobre el #8 los intercambia y habilita **Guardar siembra**.
- La × deja un hueco: el equipo vuelve a **Sin ubicar**, **Guardar** se bloquea y aparece "Falta 1 equipo por ubicar".
- Tocar y poner.
- **Vaciar**.
- Arrastrar desde la columna a un lugar libre.
- **Completar huecos en orden**.
- Arrastrar un equipo a la columna lo saca.
- **Deshacer cambios**.
- Los dos byes con 6 equipos.
- Los 24 lugares del suizo de 2 etapas.
- Con el fixture generado no hay columna ni botones.
- A 390 px de ancho no hay scroll horizontal de la página.
- Sin errores en la consola.

Se miraron las capturas de cada formato, en tema oscuro y en el celular.

**En la página real:** Daniel la probó en la web local, con la API y la copia de producción (Copa Prueba Apertura), y confirmó que funciona. La llamada es la misma de antes (`PUT /events/{id}/seeds` con la lista completa). Tampoco se probó arrastrar con el dedo en un celular de verdad: el arrastre de HTML no funciona con el tacto, y en el celular la forma es tocar y poner.

## En qué se apartó del plan

- **"Completar huecos en orden" y no "por ranking"**, como ya decía el plan: el ranking lo calcula la API y no hay forma de pedirlo sin guardarlo.
- **Los playoffs de los grupos y la llave inferior de la doble no se dibujan:** salen solo en el texto de la sección. No se siembran, y sus cruces dependen de la configuración y de los resultados.

## Cómo revertir

Revertir el commit. La siembra guardada no cambia de forma, así que no hay nada que deshacer en la base.

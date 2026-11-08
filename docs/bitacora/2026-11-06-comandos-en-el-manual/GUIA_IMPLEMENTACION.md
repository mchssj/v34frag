# Los comandos del servidor en el manual, por rol: guía de implementación

## Estado

Escrito y validado con el build de la API el 2026-11-06 (42 páginas, sin errores). **Desplegado el 2026-11-06 (16:28 UTC)**: API `b0642f948a7e` desde `main` (antes `8670768b56ef`). La web no se redespliega: **Ayuda** pide el manual a la API. Daniel lo revisó en el navegador el mismo día.

## Archivos

| Archivo | Cambio |
|---|---|
| `docs/manual/jugador/jugar-en-el-servidor.md` | Calentamiento, comandos que faltaban, pedir un arma y espectadores |
| `docs/manual/jugador/otros-modos.md` | Nueva |
| `docs/manual/capitan/comandos-en-el-servidor.md` | Nueva |
| `docs/manual/moderador/comandos-en-el-servidor.md` | Nueva |
| `docs/manual/admin/comandos-en-el-servidor.md` | Nueva |
| `docs/manual/README.md` | Sección "Comandos del servidor" con la regla |
| `docs/bitacora/PLANTILLA.md` | La regla en "Qué cambia para cada rol" |
| `CLAUDE.md` | La regla en Convenciones |
| `docs/bitacora/README.md` | Fila nueva |

## Despliegue (hecho el 2026-11-06)

1. Commits `67bc65db` (manual y regla) y `b0642f94` (moderador cype-thor en `PENDIENTES.md`) en `feat/frontend-fase-1`, y `main` adelantado a ese commit (fast-forward).
2. Desde el worktree de `main`: `deploy/vps/desplegar.sh api`. Pruebas, build (el manual, 42 páginas, va a `dist/manual`), `build:check`, subida y `/api/health` con `b0642f948a7e`.
3. Ni la web ni los servidores de juego.

## Pruebas

### Manual

- `pnpm build` en `web/backend`: "Manual de usuario: 42 páginas y 0 capturas", sin errores de encabezado ni de links.
- `pnpm exec vitest run --project unit test/unit/manual.test.ts`: 20 de 20.
- Permisos comprobados en el código de los plugins y en `admin_groups.cfg` y `admin_overrides.cfg` de #1, #2 (flow) y #3, bajados por la API del panel el 2026-11-06. Los tres son iguales.

No se miró en el navegador.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Revertir el commit. Si ya se desplegó, volver a desplegar la API desde el commit anterior.

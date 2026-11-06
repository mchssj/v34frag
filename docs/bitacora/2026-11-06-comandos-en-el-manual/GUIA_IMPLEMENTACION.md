# Los comandos del servidor en el manual, por rol: guía de implementación

## Estado

Escrito y validado con el build de la API el 2026-11-06 (42 páginas, sin errores). **Sin desplegar:** la web lo muestra después del próximo despliegue de la API, que copia `docs/manual` a `dist/manual` en el VPS. Sin commit.

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

## Despliegue

Pendiente. Con el próximo despliegue de la API (desde `main`), el build valida el manual y lo copia a `dist/manual`. No hace falta tocar los servidores de juego.

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

# Bitácora de requerimientos

Cada requerimiento tiene su propia carpeta `AAAA-MM-DD-nombre-corto/`, con la fecha en que se planeó.

| Archivo | Contenido |
|---|---|
| `PLAN.md` | La planeación original, tal como se aprobó. No se edita después. |
| `DOCUMENTACION.md` | Cómo funciona lo que se construyó: reglas, datos, funciones y pantallas. |
| `GUIA_IMPLEMENTACION.md` | Qué archivos cambiaron, cómo desplegarlo, cómo probarlo, cómo revertirlo y en qué se apartó del plan. |
| `pruebas/` | Opcional: scripts de prueba que se usaron. |

## Requerimientos

| Fecha | Requerimiento | Estado |
|---|---|---|
| 2026-10-11 | [ELO de jugadores (TrueSkill + niveles FACEIT)](2026-10-11-elo-jugadores/) | Desplegado (incluidas las migraciones `20261011200000` y `20261011220000`) |
| 2026-10-11 | [Mejoras de calidad de vida en el servidor](2026-10-11-qol-servidor/) | 1.2.0 en el servidor real (reemplazada por la 1.3.0); probado con bots; falta probar con jugadores reales |
| 2026-10-11 | [ELO configurable desde la web](2026-10-11-elo-configurable/) | Desplegado (2026-10-11) |
| 2026-10-11 | [Perfiles automáticos y reclamo desde el servidor (`!claim`)](2026-10-11-reclamo-perfil-servidor/) | Planeado, pendiente de aprobación |
| 2026-10-12 | [Demos en Cloudflare R2 (Worker) y partidas canceladas](2026-10-12-demos-r2-worker/) | Desplegado (2026-10-12): primer mix real con demo en R2, botón en la web y borrado en el servidor activado |

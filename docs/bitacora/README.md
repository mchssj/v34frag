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
| 2026-10-11 | [ELO de jugadores (TrueSkill + niveles FACEIT)](2026-10-11-elo-jugadores/) | Desplegado (incluida la migración `20261011200000`) |
| 2026-10-11 | [Mejoras de calidad de vida en el servidor](2026-10-11-qol-servidor/) | Implementado y probado con bots; falta probar con jugadores reales |

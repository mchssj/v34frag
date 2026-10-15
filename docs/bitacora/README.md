# Bitácora de requerimientos

Cada requerimiento tiene su propia carpeta `AAAA-MM-DD-nombre-corto/`, con la fecha en que se planeó.

| Archivo | Contenido |
|---|---|
| `PLAN.md` | La planeación original, tal como se aprobó. No se edita después. |
| `DOCUMENTACION.md` | Cómo funciona lo que se construyó: reglas, datos, funciones y pantallas. |
| `GUIA_IMPLEMENTACION.md` | Qué archivos cambiaron, cómo desplegarlo, cómo probarlo, cómo revertirlo y en qué se apartó del plan. |
| `pruebas/` | Opcional: scripts de prueba que se usaron. |

El formato detallado de cada archivo está en [PLANTILLA.md](PLANTILLA.md), que también sirve como enunciado para generar los `.md` con otra IA.

## Requerimientos

| Fecha | Requerimiento | Estado |
|---|---|---|
| 2026-10-11 | [ELO de jugadores (TrueSkill + niveles FACEIT)](2026-10-11-elo-jugadores/) | Desplegado (incluidas las migraciones `20261011200000` y `20261011220000`) |
| 2026-10-11 | [Mejoras de calidad de vida en el servidor](2026-10-11-qol-servidor/) | 1.2.0 en el servidor real (reemplazada por la 1.3.0); probado con bots; falta probar con jugadores reales |
| 2026-10-11 | [ELO configurable desde la web](2026-10-11-elo-configurable/) | Desplegado (2026-10-11) |
| 2026-10-11 | [Perfiles automáticos y reclamo desde el servidor (`!claim`)](2026-10-11-reclamo-perfil-servidor/) | Planeado, pendiente de aprobación |
| 2026-10-12 | [Demos en Cloudflare R2 (Worker) y partidas canceladas](2026-10-12-demos-r2-worker/) | Desplegado (2026-10-12): primer mix real con demo en R2, botón en la web y borrado en el servidor activado |
| 2026-10-12 | [QoL del servidor, segunda tanda (cambio de lado, créditos, `!rr`, contador de vivos)](2026-10-12-qol-servidor-2/) | Subido al servidor real (2026-10-12); se carga en el próximo cambio de mapa |
| 2026-10-13 | [Licencia por servidor (el plugin solo funciona con una key válida)](2026-10-13-licencia-servidores/) | Desplegado (2026-10-13): migración, web y 1.5.0 subida al servidor real; se carga en el próximo cambio de mapa |
| 2026-10-13 | [Plugin 1.6.0: menú de admin, cuchillo, `!gg`, resumen, nombres de equipo y reconexión](2026-10-13-plugin-1-6-0/) | Desplegado (2026-10-13): migración, web y 1.6.0 subida al servidor real; se carga en el próximo cambio de mapa |
| 2026-10-13 | [Votación de mapa para jugadores (`!rtv`, `!vote <mapa>`, `!mapas`)](2026-10-13-votacion-de-mapa/) | Desplegado (2026-10-13): 1.7.0 subida al servidor real; se carga en el próximo cambio de mapa |
| 2026-10-14 | [Backend API (Node 24 + Hono + TypeScript): base, Auth y Mi perfil](2026-10-14-backend-base-auth-perfil/) | Fase terminada (2026-10-14), en la rama `feat/backend-api-fase-1` (sin merge) y **sin desplegar**: Auth y Mi perfil con 161 pruebas (cobertura 96 %, mínimo 60 %), probado en local con Node y Workers; hosting decidido: VPS Hostinger |
| 2026-10-14 | [Replantear el modelo de datos (fase 2 del backend): mixes sin equipos, `team_members`, stats desde partidas, `!match` y limpieza](2026-10-14-replanteo-modelo-datos/) | **Aprobado** (2026-10-14), en curso: limpieza, privacidad, borrado del matchmaking viejo y ensayo del ELO (idéntico) hechos en local; siguen los mixes sin equipos y `team_members`. No toca producción hasta el corte |

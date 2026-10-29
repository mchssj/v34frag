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

Lo que quedó sin terminar o sin desplegar está resumido en [`../PENDIENTES.md`](../PENDIENTES.md).

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
| 2026-10-13 | [Servidor de terceros RBK (build licenciado)](2026-10-13-servidor-rbk/) | Instalado (2026-10-13); cargado y con la licencia validada (verificado por SFTP el 2026-10-14). Pasado a SourceMod 1.10, con Accelerator, ClientMod y el plugin 1.8.0 cargados (verificado el 2026-10-14) |
| 2026-10-14 | [ELO proporcional a las rondas jugadas (mínimo 35%, completo desde 90%)](2026-10-14-elo-participacion-y-sourcetv/) | Desplegado (2026-10-14): migración en Supabase e `index.html` publicado; sin commit |
| 2026-10-14 | [Plugin 1.8.0: el inicio por `!ready` empieza con ronda de cuchillo](2026-10-14-ready-con-cuchillo/) | Subido al servidor real y a RBK (2026-10-14); se carga en el próximo cambio de mapa; sin commit |
| 2026-10-14 | [Crashes del servidor real: Accelerator e inventario de plugins externos](2026-10-14-crash-servidor-accelerator/) | Accelerator instalado en el servidor real y en RBK (activo desde el próximo reinicio de cada uno) y en el local; **pendiente el deploy del Worker** (`/crash`); sin commit |
| 2026-10-28 | [Matchmaking con cola en la web y servidor automático](2026-10-28-matchmaking/) | Planeado, pendiente de aprobación. Cola 5v5 sola o en dúo, veto de capitanes, contraseña al azar al terminar cada mix, avisos por WebSocket con `LISTEN/NOTIFY` y polling de respaldo; va con el corte o después |
| 2026-10-28 | [Cosméticos del perfil para la tienda y el VIP (marcos, stickers, temas y nombres)](2026-10-28-cosmeticos-perfil/) | 68 artículos (mitad para todos y mitad VIP en cada tipo) revisados en el navegador (2026-10-29); sin integrar en la web; commiteado en `kyan/pruebas` |
| 2026-10-29 | [Tienda de cosméticos con puntos (backend)](2026-10-29-tienda-puntos-backend/) | Planeado, pendiente de aprobación. Puntos calculados desde los mixes, ×VIP, compras, inventario y equipados; replanteo 34 sobre `feat/backend-api-fase-1` |
| 2026-10-29 | [Colecciones de cosméticos: países sudamericanos y series (VIP)](2026-10-29-cosmeticos-colecciones/) | 80 artículos nuevos (148 en total) revisados en el navegador (2026-10-29); sin integrar en la web; commiteado en `kyan/pruebas` |
| 2026-10-29 | [Más de 300 cosméticos: Latinoamérica y España, mapas, arsenal y series 2](2026-10-29-cosmeticos-300/) | 160 artículos nuevos (308 en total) revisados en el navegador (2026-10-29); sin integrar en la web; commiteado en `kyan/pruebas` |
| 2026-10-29 | [Widget de CM League para streamers (OBS)](2026-10-29-widget-streamers/) | Implementado y probado en local (2026-10-29); **falta** la migración en Supabase, publicar `index.html`, `niveles.js` y `widget.html`, y probarlo en OBS; sin commit |
| 2026-10-29 | [Tienda de cosméticos en la web (puntos, compras, equipados, portada y admin)](2026-10-29-tienda-web/) | Implementada y probada en local con datos de ejemplo (2026-10-29); **falta** correr las migraciones `20261028120000_vip.sql` y `20261029180000_tienda.sql` y publicar `index.html` con `assets/perfil/`; commiteado en `kyan/pruebas` |

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
| 2026-10-29 | [Fondo de miniperfil](2026-10-29-fondo-miniperfil/) | 24 fondos animados (tipo `background`) y cosméticos en el lobby y la sala del matchmaking; probado en los demos del frontend nuevo (2026-10-29); **falta** correr `20261029200000_fondo_miniperfil.sql` y la API; sin commit |
| 2026-10-29 | [Progresión VIP con moneda propia](2026-10-29-vip-progresion/) | Marco Oro VIP con el VIP y monedas VIP configurables para comprar lo VIP; probado en `/demo/tienda` (2026-10-29); **falta** correr `20261029210000_vip_progresion.sql` (después de portar la tienda de la web vieja) y la API; sin commit |
| 2026-10-29 | [Exportar stats en imagen o PDF (VIP)](2026-10-29-exportar-stats/) | Prototipo en `/demo/exportar` del frontend nuevo, probado en el navegador (2026-10-29); **falta** la ruta de stats por período (Daniel) y llevarlo al perfil (Esteban); sin commit |
| 2026-10-29 | [Buscador y filtros avanzados (VIP)](2026-10-29-buscador-avanzado/) | Prototipo en `/demo/buscador` del frontend nuevo, probado en el navegador (2026-10-29); **falta** los filtros en la API con chequeo de VIP (Daniel) y llevarlo a `/players` y mixes (Esteban); sin commit |
| 2026-10-29 | [Desglose de la fórmula de ELO (VIP)](2026-10-29-desglose-elo/) | Prototipo en `/demo/elo` con la fórmula de `elo_apply_match` en TypeScript y 7 tests (2026-10-29); **falta** la ruta con el desglose por mix (Daniel) y llevarlo al perfil (Esteban); sin commit |
| 2026-10-29 | [Vista previa del próximo recálculo de ranking (VIP)](2026-10-29-proximo-recalculo/) | Prototipo en `/demo/recalculo` con las reglas del cierre de temporada y 4 tests (2026-10-29); **falta** la ruta con tu fila de `season_live_standings` (Daniel) y el panel (Esteban); sin commit |
| 2026-10-29 | [Comparador de hasta 5 jugadores (VIP)](2026-10-29-comparador-5/) | Prototipo en `/demo/comparador` probado en el navegador (2026-10-29); **falta** que `players/compare` acepte 5 (Daniel) y llevarlo a `/players/compare` (Esteban); sin commit |
| 2026-10-29 | [Widget para la bio de Twitch y Twitter (VIP)](2026-10-29-widget-bio/) | Prototipo en `/demo/bio` con panel de Twitch, firma y tarjeta del link (2026-10-29); **falta** la imagen dinámica, Open Graph y la página del iframe (Daniel) y el generador en el perfil (Esteban); sin commit |
| 2026-10-29 | [Partidas favoritas (VIP)](2026-10-29-partidas-favoritas/) | Prototipo en `/demo/favoritas` probado en el navegador (2026-10-29); **falta** `match_favorites` y sus rutas (Daniel) y la estrella en mixes (Esteban); plan escrito junto con el prototipo |
| 2026-10-29 | [Créditos de la web con los VIP](2026-10-29-creditos/) | Prototipo en `/demo/creditos` probado en el navegador (2026-10-29); **falta** `GET /credits` y `show_in_credits` (Daniel), la página y el switch (Esteban) y confirmar los roles; plan escrito junto con el prototipo |
| 2026-10-29 | [Stats avanzadas post-torneo antes que nadie (VIP)](2026-10-29-stats-torneo/) | Prototipo en `/demo/torneo-stats` probado en el navegador (2026-10-29); **falta** la ruta con el corte de 24 h, y confirmar entradas y clutches en el plugin (Daniel), y la pestaña del torneo (Esteban); plan escrito junto con el prototipo |
| 2026-10-29 | [Misiones semanales](2026-10-29-misiones-semanales/) | Prototipo en `/demo/misiones` (popout, página y admin) con rotación al azar, 2 semanas de espera y 10 tests (2026-10-29); 58 misiones, 12 esperan datos del plugin nuevo o de otros sistemas; **falta** tablas, progreso, cron y rutas (Daniel) y la web (Esteban) |

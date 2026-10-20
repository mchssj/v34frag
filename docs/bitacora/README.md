# Bitácora de requerimientos

Cada requerimiento tiene su propia carpeta `AAAA-MM-DD-nombre-corto/`, con la fecha en que se planeó.

| Archivo | Contenido |
|---|---|
| `PLAN.md` | La planeación original, tal como se aprobó. No se edita después. |
| `DOCUMENTACION.md` | Cómo funciona lo que se construyó: reglas, datos, funciones y pantallas. |
| `GUIA_IMPLEMENTACION.md` | Qué archivos cambiaron, cómo desplegarlo, cómo probarlo, cómo revertirlo y en qué se apartó del plan. |
| `pruebas/` | Opcional: scripts de prueba que se usaron. |

El formato detallado de cada archivo está en [`PLANTILLA.md`](PLANTILLA.md), que también sirve como enunciado para generar los `.md` con otra IA.

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
| 2026-10-15 | [`!match` (vincular una partida del servidor a un torneo o PCW) y `!status`](2026-10-15-match-y-status/) | Aprobado (2026-10-15). Hecho y **probado con bots** contra la Supabase local: migración `07` revisada y plugin 2.0.0 (`!match` y `!status`). Sin commit; se despliega en el corte (base, servidor real y RBK) |
| 2026-10-15 | [Ajustes manuales de ELO (mix caído del 2026-10-15)](2026-10-15-ajustes-elo/) | Hecho y probado en local (2026-10-15); falta correr la migración y el ajuste en el SQL Editor |
| 2026-10-16 | [Chat de texto para vivos y muertos (`csstv_allchat`)](2026-10-16-chat-vivos-muertos/) | Hecho, probado en local con la 1.8.0 y la 2.0.0 (incluido el `!pause` que tiraba el servidor con el plugin DeadChat) y **subido a los dos servidores** (2026-10-16; 1.0.1: el chat de equipo solo lo lee el propio equipo). Se carga en el próximo cambio de mapa; falta verificarlo con jugadores. Voz: `sm_deadtalk 2` en partida |
| 2026-10-17 | [Mixes en vivo en la web y ELO de un mix interrumpido por una caída](2026-10-17-mixes-en-vivo/) | Hecho y **probado en local** (2026-10-17) con bots y la Supabase local: migración `20261017120000`, plugin 2.1.0 (foto por ronda y recuperación después de una caída) y web vieja ("En vivo" en Mixes y revisión del admin con el 35 %). Ajustadas las `04`, `06` y `10` del replanteo. **Desplegado (2026-10-17)** en la base, la web, el servidor real y RBK; se carga en el próximo cambio de mapa |
| 2026-10-20 | [Anticheat v34FRAGNATION: auditoría y telemetría pasiva](2026-10-20-anticheat-v34fragnation/) | Etapa 0 en rama de trabajo; compilación y pruebas pendientes |

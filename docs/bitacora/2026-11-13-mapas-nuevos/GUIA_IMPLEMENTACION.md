# Mapas nuevos y de_tuscan_ob: guía de implementación

## Estado

Desplegado en #1, #2 y #3 el 2026-11-13: los 9 mapas, el FastDL y el `mapcycle.txt`. La carga se probó en el servidor local v34. **Falta** que Kyan pruebe `de_tuscan_ob` a mano (granadas, luz, huecos) y sumar los mapas al catálogo de la web.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/mapas/README.md` | Guía de las herramientas y de cómo armar un mapa "_ob" |
| `server/mapas/bsp.py`, `brushes.py` | Inspeccionar un `.bsp` (lumps, props, pak, bloques de herramientas) |
| `server/mapas/sprp_v5.py` | Props estáticos v10 → v5 |
| `server/mapas/bsp_unlzma.py` | Descomprimir un `.bsp` con LZMA y pasar props a v5 |
| `server/mapas/sin_techo_vmf.py` | Sacar el cielo de la zona de juego, caja de cielo alta y arreglo de clips |
| `server/mapas/semillas.py` | Control después de `vbsp`: zonas del original que quedaron afuera o rellenas |
| `server/mapas/post_ob.py` | Dejar un compilado del CS:S de Steam listo para v34 |
| `docs/bitacora/2026-11-13-mapas-nuevos/` | Esta carpeta y `CHANGELOG_DISCORD.txt` (CMLeague 2.9.34) |

En los servidores (no está en el repo): `cstrike/maps/` (9 mapas y `de_tuscan_ob.nav`), `cfg/server.cfg` (`sv_downloadurl`) y `mapcycle.txt`.

## Despliegue (hecho el 2026-11-13)

Todo por la API del panel de MVZG (`SFTP_CSS_API_KEY`), sin reiniciar ni cambiar de mapa ningún servidor. Cada archivo se subió y se volvió a bajar para compararlo byte a byte.

1. **Mapas, a #1, #2 y #3:** `de_anubis_css`, `de_anubis_t5`, `de_cbble_go_t1` (pisó la versión v10 que ya estaba), `de_inferno_plus`, `de_nuke_cs2`, `de_strike_mirage`, `de_train_t5`, `de_ancient_css` (en el #2 ya estaba la convertida) y `de_tuscan_ob` con su `.nav`. Antes de subir se comprobó que ninguno fuera el mapa en uso.
2. **FastDL:** en cada `cfg/server.cfg`, solo la línea `sv_downloadurl`, con el uuid de cada servidor (#1 `157703b5-d387-…`, #2 `cd1be322-d7c1-…`, #3 `16c850ff-5eaa-…`) y `/cstrike`. Respaldo en `cfg/server.cfg.bak_fastdl`. Entra en el próximo cambio de mapa.
3. **Mapcycle:** los 8 mapas que faltaban, al final de `mapcycle.txt`, en los tres. Respaldo en `mapcycle.txt.bak_mapas`.

4. **Stripper para `de_strike_mirage`:** el mapa trae de decoración un terrorista agachado (`prop_dynamic` con `models/player/t_phoenix.mdl`, `hammerid` 77047, en `297 -791 -168`). Es sólido y parece un jugador. Se saca con `addons/stripper/maps/de_strike_mirage.cfg`, en los tres:

   ```
   filter:
   {
   "classname" "prop_dynamic"
   "hammerid" "77047"
   "model" "models/player/t_phoenix.mdl"
   }
   ```

## Pruebas

### Carga de los mapas (servidor local `Downloads\cssds`, v34)

Se arrancó sin Metamod (`metamod.vdf` renombrado un momento) para que el reporter no se conectara a nada.

- `de_ancient_css` original: se cae justo al empezar a cargar. Convertido: carga entero.
- Los 7 restantes convertidos: cargan. Los avisos "SOLID_VPHYSICS static prop with no vphysics model" son de props sin colisión, iguales a los de mapas que ya se usan.
- `de_tuscan_ob`: carga, sin errores de props.

### de_tuscan_ob

- Después de `vbsp`: sin leak, sin props "outside the map" y `semillas.py` sin zonas perdidas (un único punto en el borde de un bloque que también está en el original).
- Mismos 195 props y 454 entidades que el original.
- **No probado a mano** todavía. La primera versión (solo editando el `.bsp`) la probó Kyan: las granadas pasaban pero no se veían arriba, y por eso se recompiló.

### FastDL

Por HTTP: `de_ancient_css`, `de_strike_mirage` y `de_mirage_rc1` responden desde la URL nueva de cada servidor. No se probó con un cliente entrando.

## En qué se apartó del plan

- El plan se escribió al cerrar el requerimiento, porque Kyan lo fue pidiendo por partes en la misma sesión.
- Primero `de_tuscan_ob` se armó editando el `.bsp` (el cielo dejaba de ser sólido). Las granadas pasaban pero desaparecían arriba, así que se recompiló.

## Incidentes durante las pruebas

- **El servidor local se traba al lanzarlo desde la terminal** ("CTextConsoleWin32::GetLine: !GetNumberOfConsoleInputEvents"): le salió una ventana de error a Kyan. Desde entonces el proceso se corta apenas aparece "Log file started" en la consola. Por esto no se pudo correr una prueba automática con un plugin.
- **Clips sólidos en la primera compilación:** BSPSource dejó los clips como `toolstrigger` y vbsp descartó 10 props por quedar "fuera del mapa". Se arregló en `sin_techo_vmf.py`.
- **Corte de luz** a mitad de `vvis`: se volvió a correr desde el `.bsp` de `vbsp`.
- El control de seguridad de Claude Code no deja ejecutar BSPSource (código bajado de internet): el descompilado lo corre una persona.

## Cómo revertir

- **Mapas:** borrar los `.bsp` nuevos de `cstrike/maps/` de cada servidor (y `de_tuscan_ob.nav`).
- **Mapcycle:** copiar `mapcycle.txt.bak_mapas` sobre `mapcycle.txt` en cada servidor.
- **FastDL:** copiar `cfg/server.cfg.bak_fastdl` sobre `cfg/server.cfg` (vuelve el FastDL que daba 404).
- **Repo:** revertir el commit.

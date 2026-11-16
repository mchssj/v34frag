# Los mapas del CSS nuevo en los clips grabados con el v34: guía de implementación

## Estado

Hecho y commiteado en `main` el 2026-11-15. Los dos ajustes los probó Daniel a mano en la consola del v34 de la PC (`E:\CSS v34 eXpandedCS`). **No se grabó un clip con el render:** falta comprobarlo en el portátil.

## Archivos

| Archivo | Cambio |
|---|---|
| `render/render_clip.py` | `mat_specular 0; mat_hdr_level 0` en `cmleague_render.cfg` con `"client": "v34"`, antes de `playdemo` |
| `render/revisar_mapas.py` | Nuevo: lista lo que le falta a un mapa en el v34 |
| `render/CONFIGURAR_PORTATIL.md` | Paso 3b, punto 7 (los mapas del CSS nuevo; los siguientes se corren a 8 y 9), y "Texturas o modelos que le faltan a un mapa" en el paso 9 |
| `docs/bitacora/2026-11-15-render-mapas-css-nuevo/` | Esta carpeta, con `pruebas/vtf_a_72.py` |
| `docs/bitacora/README.md` y `docs/PENDIENTES.md` | La fila y la entrada |

## Despliegue

1. Commit en `main` (hecho el 2026-11-15).
2. `git pull` en el portátil, con la tarea "CMLeague clips" sin una corrida a mitad.
3. Grabar en el portátil un clip de `de_tuscan_ob` o `de_strike_mirage` con `"client": "v34"` y mirarlo: sin cuadriculado, sin tono morado en el arma y con un brillo normal.

## Pruebas

### Antes del plan (2026-11-15)

Con el script del scratchpad que pasó a `render/revisar_mapas.py` y pruebas de Daniel en la consola del v34:

1. **Archivos que faltan:** casi ninguno en los cuatro mapas (ver la documentación). No era eso.
2. **Cubemaps:** entre 86 y 130 en VTF 7.4 en cada mapa; en los del v34, 7.1 o 7.2. Daniel: con `mat_specular 0` desaparecen las texturas rotas.
3. **HDR:** tres de los cuatro mapas traen iluminación HDR. Daniel: con `mat_hdr_level 0` "mejora", pero sigue el tono morado en el arma y el cuchillo en algunas zonas.
4. **Cubemaps pasados a 7.2** (`pruebas/vtf_a_72.py`, los 86 de `de_tuscan_ob`, con los mismos archivos en el pakfile): Daniel, "sigue pasando lo mismo". Se descartó y Daniel eligió quedarse con `mat_specular 0` y `mat_hdr_level 0`, globales para el v34.

### Después

- `revisar_mapas.py` con la fuente de ClientMod del render (`D:\CMLeague_Render\ClientMod`), sobre `de_tuscan_ob`, `de_strike_mirage`, `de_ancient_css`, `de_train_t5`, `de_cache` y `de_dust2`: avisa los cubemaps 7.4 en los cuatro primeros, lista los 11 archivos que le faltan a `de_ancient_css` y el que le falta a `de_cache`, y en `de_dust2` no encuentra nada.
- `render_clip.py` compila (`py_compile`).
- **No probado:** una grabación con el render y el v34.

## En qué se apartó del plan

En nada. Al correr el script también apareció que a `de_cache` le falta `nature/blendprodasphaltgrass`, que no estaba en el plan.

## Cómo revertir

Revertir el commit y `git pull` en el portátil. Para prender de nuevo los reflejos o el HDR en una instalación que ya grabó: `mat_specular 1` y `mat_hdr_level 2` en la consola del juego, y volver a cargar el mapa.

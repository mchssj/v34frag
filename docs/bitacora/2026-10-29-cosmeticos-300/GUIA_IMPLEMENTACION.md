# Más de 300 cosméticos: guía de implementación

## Estado

160 artículos nuevos (308 en total), revisados en el navegador el 2026-10-29. Sin integrar en la web ni desplegar. Commiteado en `kyan/pruebas` (2026-10-29).

## Archivos

| Archivo | Cambio |
|---|---|
| `assets/perfil/marcos/` y `stickers/` | 80 SVG nuevos: `pais-{mx,cr,cu,do,pr,pa,gt,hn,sv,es}`, `mapa-*`, `arma-*` y `serie-{dona,zombi,barril,fuga,radiacion,vikingo,elementos,robot,fondo-mar,isla}` |
| `assets/perfil/cosmeticos.css` | Bloque generado con 40 temas y 40 nombres |
| `assets/perfil/catalogo.json` | Versión 6: 308 artículos y cuatro colecciones nuevas en `collections` |
| `assets/perfil/datos-falsos.json` | la_bomba y rata_de_b usan mapas y países nuevos; Kyan usa la AWP Relámpago y la Dona |
| `assets/perfil/vista-previa.html` | Texto de la cabecera (308 artículos, siete colecciones). El filtro lee las colecciones del catálogo |
| `pruebas/generar_paises2.py`, `pruebas/generar_kits.py`, `pruebas/kits.json` | Generadores y lista generada |

## Despliegue

No se desplegó. Es igual que en [`2026-10-28-cosmeticos-perfil`](../2026-10-28-cosmeticos-perfil/GUIA_IMPLEMENTACION.md).

## Pruebas

### Vista previa (navegador del escritorio, `http://localhost:8099/assets/perfil/vista-previa.html`)

- **Catálogo (script de Python):**
  - Los 156 SVG son XML válido, cada `file` existe y cada `css_class` está en `cosmeticos.css`.
  - No hay `id` repetidos.
  - Los 308 artículos están parejos: 40 y 40 marcos, y 38 y 38 de los otros tipos.
- **Datos falsos:** ningún jugador no VIP tiene equipado un artículo VIP.
- **Revisión visual:**
  - Se vieron los 40 marcos y los 40 stickers nuevos en una galería temporal (borrada).
  - En la vista previa se revisaron los marcos de Arsenal y los nombres de Arsenal y Series 2.
  - Los 10 marcos de Arsenal cargan, con `naturalWidth` 256.
- **Filtro:** muestra las ocho opciones con sus cantidades.
- **Consola:** sin errores.
- **No se probó:**
  - En Safari, en el celular ni con el tema claro.
  - Los temas y nombres de `paises2` y `mapas` uno por uno. Salen de la misma plantilla que los de Sudamérica, que sí se vieron.

## En qué se apartó del plan

- **Arsenal:**
  - El arma del marco se veía chica y se agrandó la placa.
  - Los nombres arrancaban oscuros (Lava, Selva, Medianoche) y casi no se leían. Ahora el degradado va del color medio al blanco.
  - "Ak-47 Lava" salía mal capitalizado y se corrigió con una tabla de nombres.
- **Carpeta de la bitácora:** se creó primero con fecha 2026-10-30 y se renombró a 2026-10-29, que es la fecha real.

## Pendiente

- **Revisión de Kyan o Daniel:** que alguno de los dos mire las series 2 antes de publicar, igual que la primera tanda.
- **Plan del backend de la tienda:** [`2026-10-29-tienda-puntos-backend`](../2026-10-29-tienda-puntos-backend/PLAN.md) tiene que contar 308 artículos y las siete colecciones.

## Cómo revertir

Borrar los 80 SVG de la lista de arriba, quitar el bloque generado de `cosmeticos.css` y volver `catalogo.json`, `datos-falsos.json` y `vista-previa.html` al commit `73a9768`.

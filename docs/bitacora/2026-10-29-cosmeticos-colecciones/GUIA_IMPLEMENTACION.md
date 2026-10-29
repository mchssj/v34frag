# Colecciones de cosméticos (países y series): guía de implementación

## Estado

80 artículos nuevos (148 en total), revisados en el navegador el 2026-10-29. Sin integrar en la web ni desplegar. Commiteado en `kyan/pruebas` (2026-10-29). Kyan lo pidió y lo dejó en manos de Claude mientras dormía ("hace lo que sea necesario").

## Archivos

| Archivo | Cambio |
|---|---|
| `assets/perfil/marcos/pais-*.svg` (10) | Marcos de países, generados |
| `assets/perfil/stickers/pais-*.svg` (10) | Stickers de países, generados |
| `assets/perfil/marcos/serie-*.svg` (10) | Marcos de series, animados |
| `assets/perfil/stickers/serie-*.svg` (10) | Stickers de series, animados |
| `assets/perfil/cosmeticos.css` | 10 temas y 10 nombres de países; 10 temas y 10 nombres de series; animaciones `cos-glow`, `cos-ki`, `cos-luz-roja`… |
| `assets/perfil/catalogo.json` | Versión 5: `collection` en cada artículo, `collections` en la raíz y 148 artículos |
| `assets/perfil/datos-falsos.json` | Cinco jugadores usan artículos nuevos |
| `assets/perfil/vista-previa.html` | Filtro por colección |
| `pruebas/generar_paises.py` | Script que genera los marcos y stickers de países |

## Despliegue

No se desplegó. Es igual que en [`2026-10-28-cosmeticos-perfil`](../2026-10-28-cosmeticos-perfil/GUIA_IMPLEMENTACION.md): copiar `assets/perfil/` al frontend, sin `datos-falsos.json` ni `vista-previa.html`.

## Pruebas

### Vista previa (navegador del escritorio, `http://localhost:8099/assets/perfil/vista-previa.html`)

- **Catálogo (script de Python):** los SVG son XML válido, cada `file` existe, cada `css_class` está en `cosmeticos.css` y no hay `id` repetidos. Hay 148 artículos con la misma cantidad para todos que VIP en cada tipo.
- **Datos falsos:** ningún jugador no VIP tiene equipado un artículo VIP.
- **Revisión visual:** se vieron los 20 marcos nuevos, los 20 stickers nuevos, los 10 nombres y los 10 temas de series y los 10 nombres de países.
- **Filtro:** muestra las cantidades correctas (por ejemplo, marcos: 40 en total, 20 de Counter-Strike, 10 de Sudamérica y 10 de series).
- **Bloqueo VIP:** con chiquitoAWP (no VIP), los 10 temas de series quedan bloqueados y tocarlos no cambia el tema.
- **Consola:** sin errores.
- **No se probó** en Safari, en el celular ni con el tema claro.

## En qué se apartó del plan

- **Sticker de Ecuador:** se cambió "ÑAÑO" por **PANA**. Con la fuente Impact, la tilde de la Ñ casi no se veía y se leía "NANO".
- **Marcos de países:** el emblema y la cinta se agrandaron después de la primera revisión, porque se veían chicos.
- **Marcos de series:**
  - En Gorra y navaja, la gorra quedaba cortada arriba y se bajó.
  - En Reinos, la corona era chica y se agrandó.
- **Script de las series:** los SVG de series se escribieron con un script descartable que no quedó en el repo. Los archivos SVG son la fuente.

## Pendiente

- **Revisión de Kyan o Daniel:** que alguno de los dos mire las series y decida si alguna se parece demasiado al original antes de publicarla.
- **Plan del backend de la tienda:** [`2026-10-29-tienda-puntos-backend`](../2026-10-29-tienda-puntos-backend/PLAN.md) tiene que sumar `collection` a `shop_items` y contar 148 artículos.
- **Changelog:** el [`CHANGELOG_DISCORD.txt`](CHANGELOG_DISCORD.txt) queda listo para cuando la tienda salga.

## Cómo revertir

Borrar los archivos `pais-*` y `serie-*` de `marcos/` y `stickers/`, y volver `cosmeticos.css`, `catalogo.json`, `datos-falsos.json` y `vista-previa.html` al commit `235abf3`.

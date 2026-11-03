# Política de privacidad: guía de implementación

## Archivos

| Archivo | Cambio |
|---|---|
| `terms/privacidad.html` | Reescrita. Sigue siendo estática y sin JavaScript, con la misma URL |
| `docs/bitacora/2026-11-03-politica-privacidad/` | Plan, documentación y esta guía |
| `docs/bitacora/README.md` | Fila nueva |
| `docs/PENDIENTES.md` | Se suma al punto de los términos |

No toca la base, la API, los plugins ni los servidores (ni `aurav34`, flow ni MVZG).

## Antes de publicar

1. Que Daniel o Kyan aprueben el texto. Después, revisión de un abogado.
2. Datos completados por Kyan el 2026-11-03: Buenos Aires, `cmleaguev34@gmail.com`, `https://dsc.gg/v34frag`, 13 años, y las regiones: Supabase en el oeste de Estados Unidos (Oregón) y el VPS de OVH en Beauharnois (Canadá).
3. Inscribir la base de datos en el Registro Nacional de Bases de Datos de la AAIP (trámite gratuito, por TAD).
4. Publicar `terms/privacidad.html` y `terms/terminos.html` juntas, y enlazarlas desde el pie de la web y desde el registro.

## Cómo se probó

- Se abrió en el navegador, en escritorio y a 375 px: sin scroll horizontal, con las tablas legibles y con los 13 enlaces del índice apuntando a una sección que existe.

## Cómo revertir

`git show 4ce16b9:privacidad.html` muestra la versión del 2026-10-23, que estaba en la raíz.

## En qué se apartó del plan

- **Carpeta `terms/`** (Kyan, 2026-11-03): la página pasó de la raíz a `terms/privacidad.html`, junto a `terms/terminos.html`. El plan decía "misma URL": ya no lo es. Ver "URL de Google" en la documentación.

- A pedido de Kyan, en la misma tanda se eligió la ley argentina: se completó el responsable (un proyecto independiente, sin razón social), la transferencia internacional (artículo 12), los plazos de respuesta y las leyendas de la AAIP.

# Medallas en la web y demo para darlas desde el admin: documentación

## Qué hace

Las medallas de CM League (la versión con brillo solo en el marco) y los íconos de nivel están en el frontend, en `public/`, con un catálogo en JSON. Las usan dos demos que solo existen en `pnpm dev`:

- `/demo/medallas`: todas las medallas por categoría, cómo se ven en la tarjeta de Logros del perfil y los niveles.
- `/demo/admin-medallas`: una pantalla de Administración para dar medallas eligiendo la medalla, la temporada y los jugadores, y después cambiarlas o quitarlas.

La demo del admin trabaja con datos en memoria: jugadores y temporadas de ejemplo. Para que funcione de verdad hacen falta cambios en la API y en la base (sección "Lo que falta para la versión real").

```mermaid
flowchart LR
    C[catalogo.json] --> M[/demo/medallas]
    C --> A[/demo/admin-medallas]
    A --> P[1. Medalla]
    P --> T[2. Temporada y título]
    T --> J[3. Jugadores:<br/>buscar, pegar lista, top 10]
    J --> D[Dar a todos]
    D --> O[Otorgadas:<br/>cambiar temporada o quitar,<br/>con Deshacer]
```

## Archivos de las medallas

| Qué | Dónde | Cantidad |
|---|---|---|
| Medallas (brillo solo en el marco) | `web/frontend/public/medallas/<carpeta>/<clave>.svg` | 246 |
| Versión bloqueada de cada una | `web/frontend/public/medallas/<carpeta>/bloqueada_<clave>.svg` | 246 |
| Catálogo | `web/frontend/public/medallas/catalogo.json` | 1 |
| Íconos de nivel (anillo, colores de FACEIT) | `web/frontend/public/niveles/nivel_01.svg` … `nivel_10.svg` | 10 |

Las carpetas son las mismas que en `Pictures\CM-League-Logo\CMLeague_medallas_editables_SVG\nuevas\brillo_solo_marco\`: `mejoradas/` (mixes y podio), `perfil/`, `equipos/`, `nuevas/perfil/` y `nuevas/equipos/`.

Cada fila de `catalogo.json` tiene:

| Campo | Qué es |
|---|---|
| `archivo` | Ruta relativa a `/medallas/` |
| `clave` | Identificador único (`awp_500`, `equipo_campeon`, `vip_mes_06`…) |
| `titulo` | Título por defecto |
| `categoria` | Trayectoria, Habilidad, Arsenal y bomba, Mapas, Misiones… |
| `grupo` | `Entregadas` (las que tiene Esteban) o `Nuevas` |
| `nivel` | Metal del marco: `bronce`, `plata`, `oro`, `platino`, `diamante` o `null` (mixes) |
| `equipo` | `true` si es una medalla de equipo |

En el código, `src/features/medals/lib/catalog.ts` tiene `useMedalCatalog()`, `medalSrc(medalla, bloqueada)` y `levelSrc(nivel)`.

## Medallas de misiones

Son nuevas, con forma de portapapeles. El sistema de misiones no se tocó: quedan listas para cuando se haga.

| Medalla | Niveles | Color e ícono |
|---|---|---|
| Misiones completadas | 10, 50, 100, 250 | Celeste, círculo con check |
| Semanas completas | 4, 12, 26, 52 | Violeta, calendario |
| Misiones difíciles | 10, 25, 50 | Rojo, montaña con bandera |
| Semana perfecta | única | Ámbar, estrella con check |
| Primeros pasos completos | única | Verde, camino con un pin |

## Demo de Administración › Medallas

Usa las piezas de Administración (`AdminHeader`, `AdminTabs`, `SplitLayout`, `PanelSection`, `EmptyState`) y los componentes de shadcn.

**Dar medallas** (una sola vista, en tres pasos):

1. **Medalla:** jugador o equipo, buscador y categoría. Se elige con un clic sobre la imagen.
2. **Temporada y título:** la temporada o "Sin temporada (para siempre)", y el título que se ve en el perfil, que arranca con el del catálogo.
3. **A quiénes:** buscar por alias o SteamID y tildar, pegar una lista (un alias o SteamID por línea; los que no encuentra quedan en el cuadro para corregirlos) o el atajo "Top 10 de la temporada".

El panel de la derecha muestra la medalla, la temporada, los jugadores elegidos (se pueden sacar uno por uno), cómo se ve en Logros y el botón "Dar a N jugadores". Si alguien ya tiene esa medalla en esa temporada, se avisa y se saltea.

**Otorgadas:** tabla con buscador y filtro por temporada. Cada fila cambia de temporada con un select o se quita. Se pueden elegir varias para pasarlas a otra temporada o quitarlas juntas. Dar y quitar muestran un aviso con "Deshacer".

## Lo que falta para la versión real

Anotado para el equipo de backend (Daniel) y de frontend (Esteban); la demo no lo cambia.

**Base y API (backend):**

- `player_medals` guarda `title` e `icon` (un emoji). Le falta la clave del catálogo (`medal_key`) para saber qué SVG mostrar.
- La restricción `player_medals_temporada` exige que `season_id`, `rank` y `tier` sean todos nulos o todos no nulos. Una medalla dada a mano no puede tener temporada. Habría que permitir `season_id` sin `rank` ni `tier` en las medallas manuales.
- `POST /api/v1/admin/players/{id}/medals` da una medalla a un jugador por vez y solo recibe título y emoji. Para esta pantalla conviene:
  - `POST /api/v1/admin/medals` con `medal_key`, `title`, `season_id` y una lista de jugadores, que saltee a los que ya la tienen y devuelva cuántas dio.
  - `PATCH /api/v1/admin/medals/{id}` para cambiar la temporada o el título.
  - Quitar varias de una vez (hoy `DELETE /api/v1/admin/medals/{id}` es de a una).
  - Un listado de otorgadas con filtros por temporada, medalla y jugador.
- Medallas de equipo: no hay tabla para darlas.

**Frontend:**

- Pasar la demo a Administración › Medallas con la API real.
- Mostrar en el perfil (Logros) el SVG de la medalla según `medal_key`, en lugar del emoji.
- Reemplazar el `LevelBadge` por el anillo de `public/niveles/` (decidido el 2026-11-03: cortes de FACEIT y números).

## Dónde está cada cosa

| Qué | Archivo / ubicación |
|---|---|
| Medallas y catálogo | `web/frontend/public/medallas/` |
| Íconos de nivel | `web/frontend/public/niveles/` |
| Lectura del catálogo | `web/frontend/src/features/medals/lib/catalog.ts` |
| Datos de ejemplo de la demo del admin | `web/frontend/src/features/medals/lib/demo.ts` |
| Pantalla de la demo del admin | `web/frontend/src/features/medals/pages/AdminMedalsDemo.tsx` |
| Ruta de la demo del admin | `web/frontend/src/routes/demo.admin-medallas.tsx` |
| Demo de medallas (ahora lee de `public/medallas/`) | `web/frontend/src/routes/demo.medallas.tsx` |
| SVG editables originales y generadores | `Pictures\CM-League-Logo\CMLeague_medallas_editables_SVG\` (fuera del repo) |

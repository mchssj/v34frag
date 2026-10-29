# Cosméticos del perfil: guía de implementación

## Estado

68 artículos (la misma cantidad para todos que VIP en cada tipo: 10 y 10 marcos, y 8 y 8 de stickers, temas y nombres), catálogo y datos falsos creados y revisados en el navegador (2026-10-29). Están alineados con el backend de `feat/backend-api-fase-1` y los tokens del frontend de `feat/frontend-fase-1`. Sin integrar en la web ni desplegar. Commiteado en `kyan/pruebas` (2026-10-29). La tienda, la moneda, el inventario, los equipados y la portada necesitan el backend de [`2026-10-29-tienda-puntos-backend`](../2026-10-29-tienda-puntos-backend/PLAN.md).

## Archivos

| Archivo | Cambio |
|---|---|
| `assets/perfil/marcos/` | 20 marcos. Para todos: `mira`, `trazadoras`, `c4`, `circuito`, `fuego`, `camuflaje`, `hielo`, `balas`, `pixel`, `grafiti`. VIP: `kevlar`, `neon`, `oro-vip`, `diamante`, `plasma`, `galaxia`, `holografico`, `laser`, `glitch`, `alas` |
| `assets/perfil/stickers/` | 16 stickers. Para todos: `gg`, `nice-shot`, `rush-b`, `1hp`, `clutch`, `nt`, `eco`, `afk`. VIP (animados): `ace`, `mvp`, `headshot`, `one-tap`, `defused`, `1v5`, `wallbang`, `ninja` |
| `assets/perfil/cosmeticos.css` | `.avf`, 16 temas (tokens de shadcn) y 16 efectos de nombre |
| `assets/perfil/catalogo.json` | 68 artículos, claves en inglés, ordenados por tipo (primero los de todos y después los VIP) |
| `assets/perfil/datos-falsos.json` | 8 jugadores con la forma de `GET /api/v1/players`, más `cosmetics` y `cover_url` (propuestos) |
| `assets/perfil/vista-previa.html` | Perfil con portada, tienda por tipo, mini perfiles y ranking con los datos falsos |
| `.claude/launch.json` | Configuración `web-estatica` (`python -m http.server 8099`) para abrir la vista previa |

## Despliegue

No se desplegó. Cuando se integre en el frontend nuevo, alcanza con copiar `assets/perfil/` a `web/frontend/public/` (sin `datos-falsos.json` ni `vista-previa.html`) e importar `cosmeticos.css`.

## Pruebas

### Vista previa (navegador del escritorio, `http://localhost:8099/assets/perfil/vista-previa.html`)

- Los SVG son XML válido y cada `file` del catálogo existe. El catálogo tiene 5 artículos para todos y 5 VIP por tipo (script de Python).
- Se vieron los 10 marcos, los 10 stickers, los 10 temas y los 10 nombres.
- Con un VIP (`v34|Pepon`) se equipan los artículos VIP y el tema cambia `--primary`.
- Con un no VIP (`chiquitoAWP`), los VIP quedan bloqueados y tocarlos no cambia nada.
- El jugador sin cuenta ni ELO (`nuevito`) muestra "—" y nada equipado.
- La portada (un reemplazo, sin `cover_url`) se ve en el perfil y en los mini perfiles. Sin errores en la consola.
- No se probó en Safari ni en el celular. No se probó el tema claro del frontend nuevo.

`catalogo.json` y `datos-falsos.json` se leen con `fetch`, así que la vista previa necesita un servidor (no anda abriendo el archivo directo).

## En qué se apartó del plan

- **El VIP ya estaba hecho en el backend.** El plan decía que el VIP iba con su propio plan; ya existe en `feat/backend-api-fase-1` (VIP fase 0). Los cosméticos no lo duplican: `vip_only` se compara con el `vip` de la API.
- **Sin precios en puntos.** El backend no tiene moneda ni tienda, así que `price` quedó en `null` en vez de inventar valores.
- **Claves del catálogo en inglés** (`kind`, `file`, `css_class`, `vip_only`…), como el resto de la API.
- **Temas con tokens de shadcn** (`--primary`, `--card`, `--muted`, `--border`) en vez de los de la web vieja: en el frontend nuevo `--accent` es el fondo del hover y cambiarlo rompía los botones.
- **Datos falsos** (`datos-falsos.json`), pedidos por Kyan después del plan, con la forma de la API.
- **Cambios de Kyan del 2026-10-29:**
  - **5 para todos y 5 VIP de cada tipo.**
  - **Sin fondos de perfil ni de mini perfil:** la foto y la portada las sube cada jugador. Se borraron `fondos/` y `mini/`.
  - **Se sacaron los marcos Flashbang y Humo.** Se sumaron Kevlar, Circuito, Diamante, Fuego y Plasma.
  - **ACE pasó a VIP.** Se sumaron MVP, HEADSHOT, ONE TAP y DEFUSED.
  - Se sumaron los temas Hielo, Carmesí, Obsidiana, Diamante, Synthwave y Holográfico, y los nombres Neón, Retro, Contorno, Oro, Fuego, Holográfico y Galaxia.
- **Segunda tanda de Kyan (2026-10-29):** el marco Fuego pasó a ser para todos y Kevlar a VIP. Se sumaron 10 marcos (Camuflaje, Hielo, Cinta de balas, Píxel y Grafiti para todos; Galaxia, Holográfico, Láser, Glitch y Alas VIP), 6 stickers (NT, ECO y AFK; 1v5, WALLBANG y NINJA), 6 temas (Camuflaje, Atardecer y Grafito; Esmeralda, Rubí y Aurora) y 6 nombres (Sombra, Hielo y Píxel; Plasma, Esmeralda y Cromo).
- **El plan de la tienda** ([`2026-10-29-tienda-puntos-backend`](../2026-10-29-tienda-puntos-backend/PLAN.md)) todavía nombra los tipos `background` y `mini` y 27 artículos. Al implementarlo hay que usar los cuatro tipos de ahora, los 68 artículos, y sumar `cover_url` a la cuenta o a la ficha. Los precios por tipo también hay que revisarlos: con más artículos, quizás convenga escalonarlos.

## Incidentes durante las pruebas

- Los casquillos y el marco Humo de la primera tanda se corrigieron antes de borrarse.
- En el sticker RUSH B el texto chocaba con las rayas: se movieron las rayas a la cola de la flecha.
- El marco Circuito tenía el fondo lleno y tapaba el avatar: se cambió por un anillo.
- El nombre Retro se veía sucio en letra chica: la sombra pasó a `em` para que escale con el texto.
- El nombre Galaxia casi no se leía: se aclararon los colores.

## Cómo revertir

Borrar `assets/perfil/` y la configuración `web-estatica` de `.claude/launch.json`. Nada más depende de estos archivos.

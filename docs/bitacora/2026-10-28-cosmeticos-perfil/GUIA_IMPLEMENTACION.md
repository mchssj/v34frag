# Cosméticos del perfil: guía de implementación

## Estado

Assets, catálogo y datos falsos creados y revisados en el navegador (2026-10-28), alineados con el backend de `feat/backend-api-fase-1` y los tokens del frontend de `feat/frontend-fase-1`. Sin integrar en la web, sin desplegar y sin commit. La tienda, la moneda, el inventario y los equipados necesitan su propio plan de backend.

## Archivos

| Archivo | Cambio |
|---|---|
| `assets/perfil/marcos/` | 7 marcos: `mira`, `trazadoras`, `humo`, `flashbang`, `c4`, `neon`, `oro-vip` |
| `assets/perfil/fondos/` | 4 fondos: `desierto`, `casquillos`, `radar`, `neon-nocturno` |
| `assets/perfil/mini/` | 3 mini perfiles: `pulso`, `humo`, `aurora` |
| `assets/perfil/stickers/` | 6 stickers: `gg`, `nice-shot`, `rush-b`, `1hp`, `clutch`, `ace` |
| `assets/perfil/cosmeticos.css` | Nuevo: `.avf`, 4 temas (tokens de shadcn) y 3 efectos de nombre |
| `assets/perfil/catalogo.json` | Nuevo: 27 artículos, claves en inglés |
| `assets/perfil/datos-falsos.json` | Nuevo: 8 jugadores con la forma de `GET /api/v1/players` |
| `assets/perfil/vista-previa.html` | Nuevo: perfil, tienda, mini perfiles y ranking con los datos falsos |
| `.claude/launch.json` | Configuración `web-estatica` (`python -m http.server 8099`) para abrir la vista previa |

## Despliegue

No se desplegó. Cuando se integre en el frontend nuevo, alcanza con copiar `assets/perfil/` a `web/frontend/public/` (sin `datos-falsos.json` ni `vista-previa.html`) e importar `cosmeticos.css`.

## Pruebas

### Vista previa (navegador del escritorio, `http://localhost:8099/assets/perfil/vista-previa.html`)

- Los SVG son XML válido y cada `file` del catálogo existe (script de Python).
- Se vieron todos los marcos, fondos, mini perfiles y stickers, animados.
- Con un VIP (`v34|Pepon`) se equipan los artículos VIP y el tema Oro cambia `--primary`.
- Con un no VIP (`chiquitoAWP`), Neón y Oro VIP quedan bloqueados y tocarlos no cambia nada.
- El jugador sin cuenta ni ELO (`nuevito`) muestra "—" y nada equipado.
- Mini perfiles y ranking con los 8 jugadores. Sin errores en la consola.
- No se probó en Safari ni en el celular. No se probó el tema claro del frontend nuevo.

`catalogo.json` y `datos-falsos.json` se leen con `fetch`, así que la vista previa necesita un servidor (no anda abriendo el archivo directo).

## En qué se apartó del plan

- **El VIP ya estaba hecho en el backend.** El plan decía que el VIP iba con su propio plan; ya existe en `feat/backend-api-fase-1` (VIP fase 0). Los cosméticos no lo duplican: `vip_only` se compara con el `vip` de la API.
- **Sin precios en puntos.** El backend no tiene moneda ni tienda, así que `price` quedó en `null` en vez de inventar valores.
- **Claves del catálogo en inglés** (`kind`, `file`, `css_class`, `vip_only`…), como el resto de la API.
- **Temas con tokens de shadcn** (`--primary`, `--card`, `--muted`, `--border`) en vez de los de la web vieja: en el frontend nuevo `--accent` es el fondo del hover y cambiarlo rompía los botones.
- **Datos falsos** (`datos-falsos.json`), pedidos por Kyan después del plan, con la forma de la API.

## Incidentes durante las pruebas

- El marco Humo usaba manchas grandes que el lienzo recortaba en cuadrado. Se rehízo con una cadena de nubes chicas por el borde.
- Los casquillos se veían diminutos en la miniatura: se agrandaron al doble.
- En el sticker RUSH B el texto chocaba con las rayas: se movieron las rayas a la cola de la flecha.

## Cómo revertir

Borrar `assets/perfil/` y la configuración `web-estatica` de `.claude/launch.json`. Nada más depende de estos archivos.

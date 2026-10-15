# CSSTV – Minimal Esports

Plataforma web de esports para la comunidad de **Counter-Strike: Source (v34)**: partidas en vivo, resultados, torneos con fixture automático, ranking de equipos, perfiles de jugadores, veto de mapas, reporte de resultados por capitanes y búsqueda de prácticas (PCW / PRACC).

Es una **SPA estática** (HTML + CSS + JavaScript vanilla en un solo archivo) que habla directamente con **Supabase** (Postgres, Auth y Storage). No hay servidor propio ni paso de build.

## Estructura del repositorio

| Archivo | Qué contiene |
|---|---|
| `index.html` | Toda la aplicación: estilos (`<style>`), vistas (`<main>` por sección), diálogos y la lógica JS (IIFE al final). |
| `config.js` | URL del proyecto Supabase y su *anon key* pública (`window.CFG`). |
| `.htaccess` | Reescritura Apache: cualquier ruta inexistente sirve `index.html`. |
| `docs/` | Documentación técnica (ver abajo). |
| `server/` | Plugin de SourceMod para el servidor CS:S v34 (código, `.smx` compilado, cfgs) y script alternativo de subida. |
| `supabase/migrations/` | Cambios de base de datos que hay que aplicar en Supabase. |
| `supabase/schema/` | Esquema real de la base volcado (sin datos), para las pruebas y como referencia. |
| `web/backend/` | API REST nueva (Node 24 + Hono + TypeScript), **en construcción**: la web publicada todavía no la usa. Ver [`web/backend/README.md`](web/backend/README.md). |
| `cloudflare/demo-worker/` | Worker de Cloudflare que sube las demos del servidor a R2. |

## Puesta en marcha local

No requiere dependencias. Basta con servir la carpeta por HTTP (abrir el archivo con `file://` puede fallar por CORS en Storage):

```bash
# cualquiera de estas opciones
npx serve .
python -m http.server 8080
```

Luego abrir `http://localhost:8080`.

La librería `@supabase/supabase-js@2.45.4` se carga desde jsDelivr, por lo que hace falta conexión a internet.

## Configuración

`config.js` define:

```js
var CFG = { url: 'https://<proyecto>.supabase.co', key: '<anon key>' };
```

- Si `CFG.url` empieza con `TU_`, la app muestra "Falta configurar Supabase" y no arranca.
- La *anon key* es pública por diseño: **toda la seguridad depende de las políticas RLS de Supabase** (ver [docs/SEGURIDAD.md](docs/SEGURIDAD.md)).

## Despliegue

Cualquier hosting estático sirve (Apache, Nginx, Netlify, GitHub Pages, etc.). El `.htaccess` incluido es para Apache; como la app usa rutas con `#` (hash), la reescritura no es estrictamente necesaria.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md): cómo está organizado el código, ruteo, estado, carga y renderizado.
- [Funcionalidades](docs/FUNCIONALIDADES.md): qué hace cada sección y los flujos clave (torneos, veto, reportes, PCW, verificación de perfiles).
- [Modelo de datos](docs/MODELO_DATOS.md): tablas, funciones RPC y buckets de Supabase que usa el front.
- [Seguridad y observaciones técnicas](docs/SEGURIDAD.md): roles, RLS esperado y deuda técnica detectada.
- [Guía del servidor (Match Reporter)](docs/GUIA_SERVIDOR.md): instalación y uso del plugin que envía los mixes del servidor a la web.

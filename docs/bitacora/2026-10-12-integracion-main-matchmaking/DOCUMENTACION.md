# Documentación: integración de main en matchmaking 5v5

## Resultado

El 2026-10-12 se integró el trabajo seleccionado de `main` en `feat/matchmaking-5v5` mediante el PR [#7](https://github.com/mchssj/v34frag/pull/7). El commit de merge informado por GitHub es `27308e3e098ee746dbde755747916de37d4a09a3`.

## Cambios incorporados

### Worker y demos

Se añadieron los archivos de `cloudflare/demo-worker/`, incluyendo `src/index.js`, `wrangler.toml`, `package.json`, `package-lock.json` y `scripts/dev-vars.py`.

### Supabase

Se añadieron estas migraciones:

- `supabase/migrations/20261012120000_demos_y_canceladas.sql`
- `supabase/migrations/20261012140000_motivo_abandono.sql`

También se incorporaron scripts de prueba para demos, partidas canceladas y abandono.

### SourceMod

Se actualizaron desde `main` los fuentes:

- `server/addons/sourcemod/scripting/csstv_reporter.sp`
- `server/addons/sourcemod/scripting/csstv/json.inc`
- `server/addons/sourcemod/scripting/csstv/qol.inc`

### Documentación

Se sincronizaron `docs/GUIA_SERVIDOR.md`, `docs/MODELO_DATOS.md` y `docs/bitacora/README.md`, y se incorporaron los documentos de la tarea de demos.

## Decisión para evitar pérdida de trabajo

Se conservó el `index.html` de `feat/matchmaking-5v5`, porque contiene el trabajo de la interfaz de matchmaking que no debía ser sustituido por la versión de `main`.

## Límites de esta integración

Integrar archivos en GitHub no significa que todo se haya desplegado ni validado en producción. Las migraciones, el Worker y los cambios del plugin deben verificarse por separado. En particular, el fuente `csstv_reporter.sp` se actualizó; el binario compilado `server/addons/sourcemod/plugins/csstv_reporter.smx` debe comprobarse/compilarse para que corresponda al fuente integrado antes de instalarlo en el servidor.

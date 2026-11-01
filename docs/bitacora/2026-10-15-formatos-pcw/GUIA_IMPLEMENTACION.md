# Formatos de PCW habilitados por el admin: guía de implementación

## Estado

Hecho y probado en local el 2026-10-15: base y backend. **Sin commit y sin desplegar:** la `08` se aplica en el corte del replanteo, y los endpoints salen con el backend. El plugin no cambia.

Daniel aprobó el plan el 2026-10-15, pidiendo implementar solo la parte web y dejar los plugins para el final (ver "Orden de trabajo" en `docs/PENDIENTES.md`).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/08_formatos_pcw.sql` | Nuevo: `pcw_config`, su RLS, `set_pcw_formats` y el chequeo en `create_pcw_post` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/08_formatos_pcw.sql` | Nuevo: inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/08_formatos_pcw.sql` | Nuevo: pruebas de la migración |
| `web/backend/src/routes/pcw.ts` | Nuevo: `GET /api/v1/pcw/formats` y `PUT /api/v1/admin/pcw/formats` |
| `web/backend/src/schemas/pcw.ts` | Nuevo: `PcwFormats` y `PcwFormatsBody` |
| `web/backend/src/app.ts` | Registra las rutas de PCW |
| `web/backend/src/db/types.ts` | Tipos regenerados con la `08` |
| `web/backend/test/unit/pcw-routes.test.ts` | Nuevo: 10 pruebas con PostgREST simulado |
| `web/backend/test/integration/pcw.test.ts` | Nuevo: 3 pruebas contra la Supabase local |
| `supabase/replanteo/README.md` | Fila de la `08` |
| `docs/frontend/2026-10-14-decisiones-para-frontend.md` | Los dos endpoints y la fila "Formato de una PCW" |
| `docs/bitacora/2026-10-15-match-y-status/CHANGELOG_DISCORD.txt` | Una línea para los jugadores (se publica con el corte) |
| `docs/PENDIENTES.md` | El corte pasa a ser 01 a 08 |

## Despliegue (pendiente: va en el corte)

1. **Base:** aplicar `supabase/replanteo/08_formatos_pcw.sql` después de la `07`, con el resto del replanteo.
2. **Backend:** sale con el primer despliegue del backend en el VPS. No necesita variables nuevas.
3. **Web nueva:** el formulario de publicar PCW usa `GET /api/v1/pcw/formats` y Admin → PCW usa el `PUT`.

## Pruebas

### Base (Supabase local)

`pruebas/08_formatos_pcw.sql`, dentro de un rollback:
- La fila inicial tiene `{1,3,5}`.
- Un anónimo lee `pcw_config`, pero no la puede escribir ni ejecutar `set_pcw_formats`.
- Un usuario común no puede cambiar los formatos, ni por la función ni escribiendo la tabla.
- El admin guarda `{3,1,3}` → `{1,3}`, con `updated_by`. Rechaza `{}`, `{2}`, `{1,7}` y `null` sin cambiar nada.
- Con `{1,3}`: publicar BO5 falla con "El formato BO5 no está habilitado para las PCW", y BO3 se publica.
- Un anuncio BO5 publicado antes del cambio se acepta, y la partida queda BO5.

`correr.sh` pasa completo con 01 a 08 (aplicar, segunda aplicación que aborta, inversa idéntica y reaplicar). El **ensayo del ELO** con la copia de producción da **idéntico** con 01 a 08 (32 SteamIDs, 135 filas de mixes, stats de 32 jugadores). Después del ensayo la base local se reseteó (`pnpm db:reset`) para no dejar cargada la copia de producción.

### Backend

- **Unitarias** (`pcw-routes.test.ts`):
  - `GET` ordena los formatos y consulta con la clave pública; sin la fila de configuración responde 500.
  - `PUT`: 401 sin sesión; 403 para un usuario común, sin llamar a la base; 400 con cuerpos inválidos.
  - Admin: llama a `set_pcw_formats` y devuelve lo guardado; un error de la base se devuelve como `BUSINESS_RULE` con su mensaje.
- **Integración** (`pcw.test.ts`): un anónimo lee los formatos; un usuario común recibe 403; el admin cambia a `[1, 3]` y después `create_pcw_post` con BO5 falla con el mensaje de la base. Al final deja `{1,3,5}`.
- **Resultado:** 143 pruebas unitarias y 31 de integración en verde, `pnpm typecheck` sin errores y cobertura total del 96 %.

## En qué se apartó del plan

- **El `check` de la tabla no controla los repetidos:** Postgres no admite subconsultas en un `check`. Los repetidos los limpia `set_pcw_formats`, que es la única forma de escribir la tabla.
- **Un anónimo no puede ejecutar `set_pcw_formats`:** se le quitó el permiso, además del chequeo de admin. El plan solo pedía el chequeo de admin.

## Cómo revertir

- **Antes del corte:** descartar los cambios sin commit.
- **Después del corte:**
  - **Base:** aplicar `reversas/08_formatos_pcw.sql`. Borra `pcw_config` y `set_pcw_formats`, y `create_pcw_post` vuelve a aceptar BO1, BO3 y BO5 sin restricción.
  - **Backend:** sacar `app.route('/', pcw)` (o revertir el commit), porque sin la tabla los endpoints responden error.

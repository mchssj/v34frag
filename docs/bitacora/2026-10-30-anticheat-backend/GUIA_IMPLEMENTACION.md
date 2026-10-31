# Backend del anticheat FRAG: guía de implementación

## Estado

Implementado y probado contra la Supabase local (2026-10-30), en la rama `kyan/anticheat-backend`. **Nada desplegado ni aplicado en producción.** Sin merge a la rama del backend.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/39_anticheat.sql` y su inversa | Nuevos |
| `web/backend/src/routes/anticheat.ts`, `schemas/anticheat.ts` | Nuevos |
| `web/backend/test/integration/anticheat.test.ts` | Nuevo: 16 pruebas |
| `web/backend/src/app.ts`, `env.ts`, `lib/ratelimit.ts`, `.dev.vars.example` | Rutas, `AC_API_SECRET` y límites |
| `web/backend/src/db/types.ts` | Regenerado |
| `supabase/replanteo/README.md`, `docs/bitacora/README.md`, `docs/PENDIENTES.md` | Fila y estado |

## Despliegue (pendiente, con el corte)

1. `39_anticheat.sql` va con el corte, después de la `38`.
2. Generar un secreto de 32 caracteres o más y cargarlo como `AC_API_SECRET` en la API.
3. Guardar su hash en la base:

```sql
update ac_config set api_secret_hash = encode(sha256(convert_to('<secreto>', 'UTF8')), 'hex') where id = 1;
```

4. En el VPS, `CLIENT_IP_HEADER` tiene que estar configurado: **sin él, la IP del agente queda `unknown` y nadie pasa la verificación.**
5. La web tiene que tener `/anticheat/vincular?code=...` y llamar a `POST /api/v1/me/anticheat/approve`. **Esa página no existe todavía.**
6. Activar cada servidor con una fila en `ac_server_policy`. Sin el Bridge, activarlo no hace nada.

Si se usa la alternativa de Workers, hay que agregar `RL_AC_LINK` y `RL_AC_CLAIM` a `wrangler.toml`. Sin esos bindings se cuenta en memoria por instancia. En Node no hace falta.

## Pruebas

Contra la Supabase local:

| Qué | Resultado |
|---|---|
| `pnpm typecheck` | Sin errores |
| `pnpm test` | 392 pasan |
| `pnpm test:int` (incluye las 16 del anticheat) | Pasan |
| `pnpm db:reset` con la `39` | Carga, con los `.sql` en LF (ver incidentes) |
| Inversa y vuelta a aplicar | Sin objetos `ac_*` ni bucket; vuelve a aplicar |

**Sin probar:** el flujo con un agente y un Bridge reales, porque no existen; la página de la web; el proxy del VPS; carga.

## En qué se apartó del plan

- `ac_device_revoke` y la ruta: el 404 lo da la ruta, porque la RLS oculta los equipos ajenos.
- Se usa 400 `BUSINESS_RULE` para las reglas de negocio, como el resto de la API.

## Incidentes durante las pruebas

- **`pnpm db:reset` falla en Windows con `core.autocrlf=true`:** Git deja los `.sql` en CRLF y el replanteo 04 busca texto con LF dentro de las funciones. Afecta también a la rama del backend, no solo a esta. Se resolvió convirtiendo a LF solo para cargar, y se restauraron los archivos. La solución de fondo es `*.sql text eol=lf` en `.gitattributes`: no se hizo porque toca a todo el backend, y es para hablarlo con Daniel.
- La inversa fallaba porque Supabase protege el borrado directo en `storage.buckets`. Se corrigió con `storage.allow_delete_query`, después de comprobar que el bucket está vacío.
- Se reseteó la base local de pruebas: estaba desactualizada. Sus datos locales anteriores se perdieron; producción no se tocó.

## Cómo revertir

Antes del corte, no aplicar la `39`. Después, correr la inversa, que borra sesiones y equipos vinculados, y aborta si `ac-evidence` tiene archivos. En el código, `git revert` del commit.

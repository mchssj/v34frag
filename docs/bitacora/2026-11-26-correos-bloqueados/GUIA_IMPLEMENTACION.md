# Correos temporales bloqueados al registrarse: guía de implementación

## Estado

Desplegado el 2026-11-26: replanteo `148` (19:54 UTC) con la lista pública, web `b983b8960846` y API `7e8d5b843348` (20:04 UTC).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/148_correos_bloqueados.sql` | Tabla, funciones, trigger en `auth.users` y los 2 dominios del cheater |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/148_correos_bloqueados.sql` | Inversa |
| `supabase/replanteo/README.md` | Fila del `148` |
| `pruebas/prueba_148.sql` | 6 grupos de pruebas de la base, en una transacción con `rollback` |
| `pruebas/cargar_lista.py` | Arma el SQL que carga la lista pública (solo agrega los que faltan) |
| `web/backend/src/routes/admin-email-domains.ts`, `src/app.ts` | Rutas de admin |
| `web/backend/src/routes/auth.ts` | El registro revisa el correo antes |
| `web/backend/src/schemas/admin.ts` | Esquemas |
| `web/backend/test/unit/email-domains-routes.test.ts`, `auth-routes.test.ts` | Pruebas |
| `web/frontend/src/api/schema.d.ts` | Tipos de la OpenAPI |
| `web/frontend/src/features/admin/users/` (`EmailDomainsTab.tsx` y su prueba, `api/queries.ts`, `types/index.ts`, `pages/AdminUsersPage.tsx`) | Pestaña **Correos bloqueados** |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `terms/terminos.html` | Correos temporales en "Una persona, una cuenta" |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx` | Solo formato (Prettier) |
| `docs/manual/admin/usuarios-y-fichas.md`, `docs/manual/jugador/crear-cuenta.md` | Manual |

Commit `b983b896`.

## Despliegue (2026-11-26)

1. **Respaldo** `20261126T195425Z` (con `permisos.sql`, en R2).
2. **Prueba contra producción** en una transacción con `rollback` (Docker Desktop no estaba corriendo en la PC, así que no hubo copia local):
   ```bash
   (echo "begin;"; sed '/^begin;$/d; /^commit;$/d' supabase/replanteo/148_correos_bloqueados.sql; \
    cat docs/bitacora/2026-11-26-correos-bloqueados/pruebas/prueba_148.sql) \
    | ssh ubuntu@<VPS_HOST> 'sudo docker exec -i supabase-db psql -X -q -v ON_ERROR_STOP=1 -U supabase_admin -d postgres'
   ```
   Los 6 grupos bien. Otra prueba con la lista cargada, también con `rollback`.
3. **`148`** a las 19:54 UTC, como `supabase_admin`, con una sala en vivo y 6 en la cola (no toca el matchmaking).
4. **Lista pública:** `PYTHONIOENCODING=utf-8 python -I -X utf8 pruebas/cargar_lista.py > lista.sql` y aplicarlo igual: 10.455 dominios, 2 de admins (`anonmart.com` y `afronewz.com`), 0 excepciones.
5. **Web:** `desplegar.sh web` → `b983b8960846` (no reinicia nada).
6. **API:** `desplegar.sh api` → `7e8d5b843348` a las 20:04 UTC, con una partida en vivo y 4 en la cola. Daniel señaló que una partida en vivo no depende de la API (el servidor le habla a la base): reiniciarla solo corta unos segundos los sockets de la web, que se reconectan, y la cola no se pierde. Se evita solo con una sala aceptando o vetando. Sin errores después; la partida siguió.

## Pruebas

### Base (`pruebas/prueba_148.sql`, contra producción con `rollback`)

| # | Qué | Resultado |
|---|---|---|
| 1 | Dominio, subdominio, mayúsculas, sin `@`, `null` y un dominio parecido (`notanonmart.com`) | OK |
| 2 | Una excepción de un subdominio gana sobre el padre bloqueado | OK |
| 3 | Trigger: alta bloqueada, alta normal, cambio de `email` y de `email_change` bloqueados, otro cambio no frena | OK |
| 4 | Admin: bloquear (`@MiDominio-Prueba.com.` queda normalizado), desbloquear uno de admin (se borra) y uno de la lista (excepción), volver a bloquear, dominio inválido | OK |
| 5 | Un usuario que no es admin no puede bloquear (`42501`) | OK |
| 6 | Permisos: `anon` consulta pero no lee la tabla ni bloquea; nadie inserta directo | OK |

### En producción, después de aplicarlo

- `email_domain_blocked`: `anonmart.com`, `a.anonmart.com` y `mailinator.com` sí; `gmail.com` y `hotmail.com` no.
- **Registro directo en Supabase Auth** (`/auth/v1/signup` con la clave anon, sin la API) con `prueba-bloqueo-148@anonmart.com`: respondió `P0001` "No aceptamos correos temporales…" y **no se creó la cuenta**.
- Cuentas que ya usan un dominio bloqueado: 6 (`anonmart.com`, `afronewz.com` y `gonrr.net`).

### API y web

- En producción: `POST /auth/signup` con `@anonmart.com` → 400 `VALIDATION_ERROR` en `email` con el mensaje; `/api/v1/admin/email-domains` sin sesión → 401.

- API: 693 pruebas (8 nuevas en `email-domains-routes.test.ts` y 1 en `auth-routes.test.ts`); typecheck bien.
- Web: typecheck, lint y 897 pruebas (5 nuevas en `EmailDomainsTab.test.tsx`).
- Manual validado (76 páginas).

## En qué se apartó del plan

- **Código del error:** `VALIDATION_ERROR` en el campo `email` en vez de `EMAIL_DOMAIN_BLOCKED`. Es como el alias bloqueado: el formulario de registro ya muestra ese error debajo del campo, sin tocar la web. El trigger lo marca con `hint = EMAIL_DOMAIN_BLOCKED`.
- **Los 2 del cheater** se agregaron como `admin` (con motivo), además de estar en la lista.
- **Prueba contra producción con `rollback`** en vez de la copia local (Docker Desktop apagado).
- **`/privacidad`:** sin cambios de texto.

## Cómo revertir

1. Inversa: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/148_correos_bloqueados.sql`, como `supabase_admin` (borra la lista).
2. API y web: la versión anterior con `desplegar.sh` (o revertir `b983b896`). Sin el `148`, el registro de la API falla al llamar a `email_domain_blocked`: revertir la API junto con la base.
3. Para dejar pasar un dominio sin revertir nada: desbloquearlo desde Administración.

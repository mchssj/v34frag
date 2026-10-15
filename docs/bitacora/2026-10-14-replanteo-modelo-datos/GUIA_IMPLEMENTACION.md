# Replantear el modelo de datos (fase 2 del backend): guía de implementación

## Estado

**En curso.** Plan aprobado el 2026-10-14. **Producción sin tocar:** todo se aplicó y se probó solo en la Supabase local.

| Paso del plan | Estado |
|---|---|
| 1. `supabase/replanteo/` y carga en `db-local.sh` | Hecho |
| 2. Ensayo del ELO: copia mínima de datos y medición "antes" | **Bloqueado:** falta el permiso de Daniel para copiar datos de producción |
| 3. Limpieza (2.6) | Hecho: `01_limpieza.sql` |
| 4. Privacidad (2.4) | Hecho: `02_privacidad.sql` |
| 5. Mixes sin equipos y `winner_side` (2.1) | **Bloqueado:** falta el ensayo del ELO y coordinar con quien desarrolla el matchmaking |
| 6. `team_members` (2.2) | **Bloqueado:** falta coordinar con quien desarrolla el matchmaking (usa `teams.members`) |
| 7. Vistas de stats (2.3) | Pendiente; depende de `winner_side` (paso 5) |
| 8. `!match` (2.5) | Pendiente; depende de `team_members` (paso 6) |
| 9. Plugin con `!match` | Pendiente |
| 10. Ajustes del backend de la fase 1 | Parcial: tipos regenerados con el esquema nuevo; falta `team_members` y marcar `profile-requests` como deprecado |
| 11. Inversas y documentación | Al día para los pasos hechos |

## Paso 1: carpeta y carga local

- **`supabase/replanteo/README.md`:** advierte que las migraciones **no se aplican en producción** hasta el corte, y explica el formato.
- **Formato de cada migración:**
  - Corre en una transacción.
  - Empieza con un bloque que verifica el estado esperado. Si no lo encuentra, aborta sin cambiar nada; por ejemplo, si ya se aplicó o si hay datos que se perderían.
- **`web/backend/scripts/db-local.sh`:** carga `supabase/replanteo/[0-9]*.sql` después de las migraciones pendientes y antes de `local-overrides.sql`. Con `REPLANTEO=0` no las carga, para tener la base con el esquema actual de producción; lo va a usar el ensayo del ELO.
- **Inversas:** en `reversas/`, una por migración, con el mismo nombre.
- **Pruebas:** en `pruebas/`, una por migración, más `estructura.sql` (foto ordenada de columnas, restricciones, políticas, RLS, índices y permisos) y `correr.sh`.

**`pruebas/correr.sh`** (desde la raíz del repo) levanta la base local sin replanteo y, para cada migración:
1. La aplica y corre su prueba.
2. Verifica que una segunda aplicación aborte.
3. Aplica la inversa y compara la estructura con la de antes, que tiene que ser **idéntica**.
4. La vuelve a aplicar.

## Paso 3: `01_limpieza.sql`

| Qué | Verificación previa (si falla, aborta) |
|---|---|
| `drop table player_claims` | Que esté vacía |
| `profiles.player_id`, `player_medals.color`, `matches.demo_url`, `matches.video_url` | Que no tengan datos (salvo `color`, que tiene un valor por defecto y nunca se mostró) |
| Políticas duplicadas: `admin gestiona eventos`, `todos ven eventos`, `admin gestiona partidas`, `todos ven partidas`, `Permitir lectura pública de jugadores` | Se comprobó antes que su `qual` y su `with_check` son idénticos a los de las que quedan |
| `events_format_check`: `playoffs`, `single`, `double`, `rr` o `groups` | Que no haya torneos `swiss` |

**Revisado antes de borrar:**
- Ninguna función usa esas columnas ni tablas.
- La única vista que depende de `profiles` (`public_profiles`) usa solo `id` y `tag`.

## Paso 4: `02_privacidad.sql`

- **`members` pasa a `private`** (no había ninguno), y el check queda en `public` o `private`.
- **La política `perfil: ver segun privacidad` de `profile_details`** se recrea sin la rama de `members`:
  - El dueño y el admin siempre ven los detalles.
  - El resto, solo si el jugador vinculado es público.
  - Una cuenta sin jugador vinculado sigue visible, como antes.
- **La ficha del jugador** (`players`) sigue siendo pública aunque sea privado, como decidió Daniel: privado oculta los datos personales, no las stats.

**Prueba con usuarios simulados** (`request.jwt.claims` y los roles `authenticated` y `anon`, todo dentro de un `rollback`):
- `members` se rechaza.
- **Perfil público:** otro usuario y un anónimo ven los detalles.
- **Perfil privado:**
  - Otro usuario y un anónimo no ven los detalles.
  - El dueño sí los ve.
  - La ficha del jugador sigue visible.
- **La prueba detecta fallas de verdad:** corrida sin la migración, falla con "se aceptó privacy = members".

## Resultado de las pruebas (2026-10-14)

```
== 01_limpieza.sql
   NOTICE:  replanteo 01: ok
   ok: una segunda aplicación aborta
   ok: la inversa deja la estructura idéntica
   ok: se vuelve a aplicar después de la inversa
== 02_privacidad.sql
   NOTICE:  replanteo 02: ok
   ok: una segunda aplicación aborta
   ok: la inversa deja la estructura idéntica
   ok: se vuelve a aplicar después de la inversa
== Todo ok
```

**Backend sobre el esquema nuevo:**
- `pnpm db:types` regeneró `src/db/types.ts` sin las columnas borradas.
- El chequeo de tipos no da errores.
- Pasan las **161 pruebas**, con 96,3 % de sentencias y 88,5 % de ramas.

## Qué falta para seguir

1. **Permiso para la copia mínima de datos de producción** (plan, sección 7): solo lectura, sin datos personales, y queda solo en el Docker local. Sin eso no se puede demostrar que el paso 5 no cambia el ELO.
2. **Contacto con quien desarrolla el matchmaking** (plan, sección 6), antes de los pasos 5 y 6.

# Seguridad y observaciones técnicas

## Modelo de seguridad

La app no tiene backend propio: el navegador usa la *anon key* pública y el JWT del usuario para hablar directo con Supabase. Ocultar botones en la interfaz no protege nada; la protección real está en **RLS**, en las **funciones `SECURITY DEFINER`** y en los **triggers**.

La base está bien planteada: casi todas las escrituras sensibles son sólo para admin (`is_admin()`), y las operaciones de usuario con reglas complejas (PCW, cambio de capitán, tag) pasan por funciones que validan del lado del servidor.

## Políticas RLS vigentes (resumen)

| Tabla | Lectura | Escritura |
|---|---|---|
| `events`, `matches`, `players`, `teams`, `player_medals`, `player_map_stats` | Todos | Sólo admin |
| `pcw_posts` | Todos | Admin; usuarios sólo vía RPC |
| `tournament_registrations` | Todos | Alta: dueño o capitán del equipo, con el torneo en inscripciones y sin fixture. Baja: dueño, capitán o admin |
| `match_vetos` | Todos | Capitán del equipo en turno (`seq` impar → equipo 1), `seq = cantidad + 1`, partida no terminada. Admin todo |
| `result_reports` | Admin, capitanes de la partida, o todos si terminó | Capitán reporta/edita/retira el suyo (mientras no termine). Admin todo. Validado además por `validate_report` |
| `match_chat` | Todos | Insertar con `user_id = auth.uid()`; borrar el propio; admin borra cualquiera |
| `profile_details` | Según la privacidad del jugador vinculado (dueño y admin siempre) | El dueño crea/edita el suyo; admin todo |
| `profile_requests` | Propias (admin: todas) | Crear la propia como `pending` y sólo si el jugador no está vinculado; admin actualiza/borra |
| `team_requests` | Propia o admin | Crear propia `pending`; editar propia dejándola `pending`; admin todo |
| `profiles` | Sólo el propio perfil | Sin políticas de escritura (sólo vía `set_my_tag` / trigger) → `role` no se puede autoasignar ✔ |

## Hallazgos

### Importantes

1. **Confirmar que RLS está habilitado en todas las tablas.** `pg_policies` lista las políticas pero no indica si RLS está activo; si una tabla lo tiene apagado, cualquiera con la anon key puede escribirla. Ver la consulta al final.
2. **La privacidad de jugadores sólo protege `profile_details`.** `players` es legible por todos, así que bio, logros, historial, stats y `user_id` de un perfil "privado" se descargan igual (la app sólo los oculta en pantalla). Si la privacidad debe ser real, hay que restringir esas columnas (vista pública con columnas limitadas o RLS por fila).
3. **El veto no valida la acción ni el mapa.** La política de `match_vetos` controla turno y número de secuencia, pero no que `action` sea la correcta (`ban`/`pick`) según el BO, que `map` pertenezca al pool, que no se repita, ni un máximo de vetos. Un capitán puede insertar a mano un "pick" cuando le tocaba "ban". Convendría un trigger de validación, como `validate_report`.
4. **Carrera en el veto:** dos inserciones simultáneas pueden calcular el mismo `seq`. Agregar `UNIQUE (match_id, seq)` y `UNIQUE (match_id, map)` si no existen.
5. **El cupo del torneo (`max_teams`) sólo se controla en el navegador.** La política de `tournament_registrations` no lo verifica.

### Menores

6. **Políticas duplicadas:** `events` y `matches` tienen dos pares idénticos (`torneos: todos ven` / `todos ven eventos`, etc.) y `players` dos de lectura. Funciona, pero conviene limpiar.
7. **`team_requests`:** un usuario con solicitud aprobada puede volver a hacer `upsert` y dejarla en `pending`; si el admin la aprueba de nuevo se crea un equipo duplicado.
8. **`profile_requests` usa `EXISTS (... profiles.role = 'admin')`** en vez de `is_admin()`; es equivalente, pero conviene unificar.
9. **Archivos huérfanos en Storage:** al reemplazar capturas o avatar se sube un archivo nuevo y el anterior queda; los capitanes no tienen permiso para borrar sus `proofs`.
10. **Columnas y tablas sin uso:** `matches.lineup1/lineup2/played_at`, `match_chat.tag`, `player_medals.color`, `profiles.player_id`, `player_claims`, `match_player_stats`.

## Observaciones del front

1. **Carga completa de todas las tablas** en cada `load()`, que se llama después de casi cada acción. Va a escalar mal; conviene paginar o filtrar por vista.
2. **Escrituras multi-paso no atómicas** desde el cliente: generar fixture (borrar → insertar → actualizar torneo), eliminar torneo, aprobar verificación (dos updates), aprobar equipo. Un fallo a mitad deja datos inconsistentes; candidatas a funciones RPC transaccionales como las de PCW.
3. **`match_chat.user_email` recibe el user id** (`user_email: me`). Existe la columna `tag`, que sería la indicada para mostrar el autor.
4. **Inscripción a torneos:** la política permite inscribir al dueño **o al capitán**, pero el front sólo muestra el botón al dueño (`owner_id`).
5. **`localStorage.pendingTag` es redundante:** el trigger `handle_new_user` ya toma el tag de los metadatos del registro.
6. **Clases CSS sin definir:** `.chat-box` y `.chat-msg`; el chat no tiene altura máxima.
7. **Palmarés:** si `events.champion` es null, el campeón de respaldo sale de la "última" partida del array sin ordenar.
8. **`#match-detail` no es enlazable:** el id de la partida no va en el hash.
9. **Polling cada 5 s** en el detalle de partida (4 consultas); Supabase Realtime lo reemplazaría.
10. **XSS:** el render usa `textContent`/`createElement` (no hay `innerHTML` con datos) y los links externos se validan. Buena base.
11. **Mantenibilidad:** todo en un archivo de ~1500 líneas con nombres muy cortos (`rTA`, `rC`, `mkM`…).
12. **`.idea/`** sin trackear; conviene agregarlo a `.gitignore`.

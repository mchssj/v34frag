# Equipos del matchmaking más parejos con el rating: guía de implementación

## Estado

- **Aprobado por Daniel el 2026-11-04** ("empieza el plan del 1"), con los valores por defecto del plan: no se discutieron otros.
- **Hecho en `main`:** el replanteo 73 con su inversa, el formulario del admin, el manual y los términos.
- **Desplegado el 2026-11-04 desde `main` (`124db682`)**, sin mixes en vivo ni salas activas (6 en la cola): replanteo 73 en la base del VPS (comprobado: `f | 200 | 100 | 5 | 60` y `mm_balance_elos` creada) y web `124db6829ada` (antes `c8fb3662f9ac`; `https://cmleague.lat` responde 200). No toca la API ni el plugin. **Falta:** encender el interruptor (paso 3) y publicar el changelog (paso 4).

## Pruebas

| Qué | Resultado |
|---|---|
| `pruebas/probar_73.sh` en staging (transacción con `rollback`, no deja nada) | Pasa: apagado devuelve null; la cuenta de la base coincide con la cuenta a mano en 10 fichas; tope 0 y ficha sin rating dan ajuste 0; `mm_set_config` guarda los campos y rechaza un tope fuera de rango; `authenticated` no puede llamar a `mm_balance_elos`; la inversa deja `mm_try_build` y `mm_set_config` idénticas (md5) |
| Dos salas reales de `mm_try_build` con las mismas 10 fichas (staging, todas con 1000 de ELO) | Apagado: juntó a los 5 de mejor rating en un equipo (5104 contra 4993 de ELO de armado). Encendido: 5047 contra 5050 |
| Web: `balance.test.ts` (los ejemplos del plan y el tope) y una prueba del formulario en `AdminMatchmaking.test.tsx` (encender, cambiar el tope, el ejemplo se actualiza y se guarda) | Pasan |

Para repetir la prueba de la base:

```bash
# Staging: el pooler pide el usuario postgres.<ref>.
PGPASSWORD="$STAGING_PG_PASSWORD" bash docs/bitacora/2026-11-04-mm-equipos-con-rating/pruebas/probar_73.sh \
  "host=$STAGING_PG_HOST port=$STAGING_PG_PORT user=postgres.<ref> dbname=postgres sslmode=require" \
  <uuid de un admin> <uuid de un servidor con mm_enabled sin sala activa>
```

## Pasos que faltan

1. **Base de producción (VPS), sin un mix en curso.** `alter table mm_config` bloquea la tabla un instante y el worker del matchmaking espera. Por el túnel a `127.0.0.1:5433`:
   ```bash
   psql "host=127.0.0.1 port=5433 user=postgres dbname=postgres" -v ON_ERROR_STOP=1 -f supabase/replanteo/73_mm_equipos_con_rating.sql
   ```
   Comprobar: `select balance_rating, balance_rating_weight, balance_rating_cap, balance_rating_prior_maps, balance_rating_days from mm_config;` → `f | 200 | 100 | 5 | 60`.
2. **Web**: desplegar desde `main`, como la última vez.
3. Encender el interruptor en Administración › Matchmaking › General y revisar las primeras salas:
   ```sql
   select l.created_at, lp.team, sum(lp.elo) elo, sum(lp.balance_elo) armado
     from mm_lobbies l join mm_lobby_players lp on lp.lobby_id = l.id
    where l.created_at > now() - interval '1 day' group by 1, 2 order by 1 desc, 2;
   ```
4. Publicar el changelog (`CHANGELOG_DISCORD.txt`) cuando se encienda.

**Vuelta atrás:** apagar el interruptor alcanza. Para sacarlo de la base, la inversa.

## Cambios respecto al plan

- La API no cambió: la ruta del admin ya pasaba la configuración tal cual a `mm_set_config` y `mm_admin_config`.
- No hizo falta guardar el rating en caché: `mm_balance_elos` se llama solo cuando ya hay 10 jugadores para una sala, no en cada vuelta de `mm_tick`.
- El ejemplo del formulario muestra tres casos (1,40 y 0,80 en 20 mapas, 1,90 en 2) calculados con los valores que se están editando.

# Widget de CM League para streamers: guía de implementación

## Estado

Implementado y probado en local el 2026-10-29. **Pendiente:** aplicar la migración en Supabase, publicar la web y probarlo en OBS. Sin commit, en la rama `kyan/pruebas`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261029120000_widget_streamers.sql` | Nuevo. Función `widget_player` y `grant execute` a `anon` y `authenticated` |
| `widget.html` | Nuevo. Página para OBS con los diseños `mini`, `compacto` y `completo` |
| `niveles.js` | Nuevo. `LV` y `lvlOf`, sacados de `index.html` sin cambios |
| `index.html` | Carga `niveles.js` y borra su copia de `LV` y `lvlOf`. Suma el diálogo `#wdl`, el botón "Widget para stream" en el perfil y la lógica del generador |
| `.claude/launch.json` | Configuración `web-estatica-8101` (servidor estático en el puerto 8101), porque el 8099 lo usaba otra sesión |
| `docs/bitacora/2026-10-29-widget-streamers/` | Plan, esta guía, documentación, changelog y `pruebas/pruebas_widget.sql` |
| `docs/bitacora/README.md`, `docs/PENDIENTES.md` y `docs/MODELO_DATOS.md` | Fila del índice, puntos pendientes y la función nueva |

## Despliegue (pendiente)

Lo hace Daniel o Kyan. El plugin no cambia, así que **no hay nada que subir al servidor real ni a RBK**.

1. **Migración:** Supabase → SQL Editor → pegar `supabase/migrations/20261029120000_widget_streamers.sql` completo → Run. Se puede volver a correr.
2. **Comprobar la función** con el id de un jugador que tenga mixes (está en la URL de la vista previa del generador):
   ```sql
   select widget_player('<players.id>', now() - interval '24 hours');
   ```
3. **Web:** subir al hosting (`FTP_WEB_*`) **juntos** `index.html`, `niveles.js` y `widget.html`. Si se sube `index.html` sin `niveles.js`, la web deja de mostrar los niveles y se rompe el perfil.
4. **OBS:** perfil → "Widget para stream" → Copiar URL → OBS → Fuentes → + → Navegador → pegar la URL con el tamaño que dice el diálogo. Comprobar que el fondo sea transparente y que, después de un mix, se actualice en menos de un minuto.
5. Publicar `CHANGELOG_DISCORD.txt` en Discord.

## Pruebas

### Base de datos (PostgreSQL 18 local, 2026-10-29)

Base vacía en el puerto 55433 con `stub_supabase.sql`, **todas** las migraciones en orden (hasta `20261029120000`) y después `pruebas_widget.sql`:

```bash
initdb -D pgdata -U postgres -A trust -E UTF8
pg_ctl -D pgdata -o "-p 55433" start
psql -p 55433 -U postgres -c "create database t"
psql -p 55433 -U postgres -d t -v ON_ERROR_STOP=1 -f docs/bitacora/2026-10-11-elo-jugadores/pruebas/stub_supabase.sql
for f in supabase/migrations/*.sql; do psql -p 55433 -U postgres -d t -v ON_ERROR_STOP=1 -f "$f"; done
psql -p 55433 -U postgres -d t -f docs/bitacora/2026-10-29-widget-streamers/pruebas/pruebas_widget.sql
pg_ctl -D pgdata stop && rm -rf pgdata
```

Tres mixes reales cargados con `ingest_server_match`: el jugador gana 16-10, pierde 10-16 y empata 15-15.

| # | Prueba | Resultado |
|---|---|---|
| W1 | Todo el historial | 1V 1D 1E, kills 33 y deaths 42. El ELO y el ±ELO coinciden con `player_elo` (987, −13). Últimos: E, D, V. Tag `ALF` del equipo oficial, sin los equipos `MIX` |
| W2 | Período desde entre el mix 1 y el 2 | 0V 1D 1E. `ultimos` sigue mostrando los 3 |
| W3 | Ficha sin SteamID ni mixes | ELO `start_elo` (1000), 0 mixes, todo en 0, `ultimos` vacío y `team_tag` null |
| W4 | Id que no existe | `null` |
| W5 | Filas viejas sin `player_id` (solo `steam_id`) | Cuentan igual: 3 mixes |
| W6 | Llamada como `anon` | Funciona. El stub no da `select` a `anon` como Supabase, así que la prueba se lo da antes |

La migración se volvió a correr sobre la misma base sin errores (es re-ejecutable).

### Web (navegador integrado, servidor estático local, 2026-10-29)

- **`widget.html` contra la Supabase real**: sin `id` muestra "Falta el jugador en la URL". Con `id` muestra "Sin conexión, reintentando…", porque la función todavía no está en producción (la RPC da 404).
- **Los 3 diseños**, con una respuesta simulada que reemplaza el cliente de Supabase: se dibujan bien. Con 1187 de ELO muestra nivel 5 y "faltan 14 ELO" (el 6 empieza en 1201). `v=24h` cambia las etiquetas a "24 h". Sin `bg=1`, el fondo de `html` y `body` es transparente.
- **`index.html` con `niveles.js`**: carga sin errores nuevos. La tabla de jugadores muestra las insignias con el nivel y el color de antes (por ejemplo, nivel 6 con 1239 ELO, amarillo).
- **Generador** en el perfil de un jugador real: abre el diálogo y arma `widget.html?id=…&d=compacto`. Al elegir "Completo" y "24 h" pasa a `&d=completo&v=24h`, con tamaño 420 × 200. Cerrar funciona.
- **No probado:** el widget con datos reales (falta la migración), OBS y el botón Copiar (el portapapeles necesita un clic real del usuario).

## En qué se apartó del plan

- El K/D del período se muestra en `completo` como "K/D hoy" o "K/D 24 h". Sin muertes, muestra las kills en vez de dividir por 0.
- Los tamaños de OBS del plan (220 × 60, 360 × 110 y 420 × 200) eran estimados. Medidos en el navegador, el compacto mide 340 × 141 y se cortaba, así que el generador recomienda **160 × 60, 350 × 150 y 410 × 180**.
- `widget.html?demo=1` dibuja datos de ejemplo sin consultar la base. Sirve para ver los diseños y acomodarlos en OBS antes de tener mixes.
- `widget_player` también devuelve `matches` (total de mixes con ELO). El widget todavía no lo usa.
- Se agregó la configuración `web-estatica-8101` a `.claude/launch.json` para poder probar mientras otra sesión usaba el 8099.

## Cómo revertir

1. **Base:**
   ```sql
   drop function if exists public.widget_player(uuid, timestamptz);
   ```
   No toca ninguna tabla.
2. **Web:** volver a publicar el `index.html` anterior. Ese `index.html` trae su propia copia de `LV` y `lvlOf`, así que `niveles.js` y `widget.html` se pueden dejar o borrar. Si se revierte el commit, borrar los dos del hosting.

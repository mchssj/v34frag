# Para Daniel: lo que se hizo en la base el 2026-11-03

> Lo hizo Kyan con Claude. El detalle está en cada carpeta de la bitácora; acá va lo que te afecta.

## 1. Corte a la base de producción: hecho

- **Producción tiene los replanteos `01` a `69`**, aplicados como dice tu `PLAN.md`: renombres (`geusz_2`, `Thorfinn_2` y `musul_2`), rol `mm_listener` y uno por archivo, sin CR.
- **Respaldo previo:** `pg_dump` completo en la PC de Kyan (`C:\Users\Agus\Documents\respaldos_cmleague\prod_antes_corte_20261103.dump`).
- **ELO idéntico** antes y después, con `foto_elo.sql` dentro de `begin … rollback`: 109 SteamIDs, 95 partidas y 943 filas de stats.
- **Qué no se hizo:** la configuración copiada de staging (2.4), la temporada BETA (2.5), Auth (3) y los servidores (5).
- **El VPS lo pasaste tú.** Confirma que los tres `.env` y `MM_LISTEN_URL` apunten a producción: en los logs de Supabase ya se ven las llamadas de la API a producción.

Detalle en [`GUIA_IMPLEMENTACION.md`](GUIA_IMPLEMENTACION.md).

## 2. Ojo: había CR en 71 funciones de producción

El `04` abortó (sin cambiar nada) porque no encontraba en `csstv_ingest` el texto que reemplaza:

- **71 funciones de `public` tenían CR en el cuerpo**, porque las migraciones se habían aplicado con `psql` desde Windows. El ensayo no lo vio porque arma la base desde el repo, con LF.
- **Cómo se arregló:** se revisó que ningún CR estuviera dentro de un texto entre comillas. Después [`pruebas/sin_cr_funciones.sql`](pruebas/sin_cr_funciones.sql) las volvió a crear con `pg_get_functiondef` sin CR, y se siguió desde el `04`.
- **Para un ensayo con una copia de producción:** correr ese script antes del `04`, o agregarlo a `ensayo_local.sh`.

```mermaid
flowchart LR
  A[01 a 03] --> B{04}
  B -- CR en las funciones --> C[sin_cr_funciones.sql]
  C --> D[04 a 69]
  D --> E[ELO idéntico]
```

## 3. Replanteo `70`: disolver y moderar equipos fallaba

- **Síntoma:** disolver un equipo desde Administración › Equipos daba "Algo salió mal". En los logs de producción aparece `null value in column "category" of relation "notifications"`.
- **Causa:** el `43` sumó `team_staff_action` a `notification_category` reemplazando texto. El **`56` y el `58` rehacen la función completa desde una copia anterior al `43`** y la perdieron. Pasaba en staging y en producción.
- **Qué se rompía:** todas las acciones `team_staff_*` (renombrar, logo, miembros, rol, líder y disolver).
- **Arreglo:** la `70` (`supabase/replanteo/70_aviso_staff_equipos.sql`, con su inversa) la vuelve a sumar con el mismo método que el `43`. **Ya está aplicada en staging y en producción**, y ninguno de los 55 tipos de aviso queda sin categoría.
- **De acá en adelante:** no rehacer `notification_category` desde una copia. Hay que reemplazar texto sobre `pg_get_functiondef`.
- **Falta:**
  - Sumar la fila de la `70` en `supabase/replanteo/README.md` de tu rama.
  - Probar disolver desde la web.

Detalle en [`2026-11-03-aviso-staff-equipos`](../2026-11-03-aviso-staff-equipos/).

## 4. Limpieza en producción

Kyan pidió borrar dos cosas:

- **34 fichas** sin SteamID (ni adicional), sin partidas y sin cuenta. Venom y Ls. piedra quedan.
- **10 equipos** sin ninguna fila en `team_members`, sin partidas ni inscripciones.

Se hizo con un respaldo previo (`prod_antes_limpieza_20261103.dump`) y en una transacción que comprobaba las cantidades. Producción queda con 114 fichas y 17 equipos. Detalle e ids en [`2026-11-03-limpieza-fichas-equipos`](../2026-11-03-limpieza-fichas-equipos/).

## 5. Staging está más abierto que producción

En staging, `anon` y `authenticated` pueden ejecutar **12 funciones internas** (19 permisos en total):

- `csstv_ingest`, `csstv_auth`, `csstv_check_token` y `csstv_request_ip`.
- `demo_auth`, `elo_apply_match`, `elo_set_config` y `elo_weight`.
- `create_server_token`, `create_demo_worker_token`, `rotate_server_token` y `link_steam_id`.

En producción solo las ejecuta `service_role`, como antes del corte. No se tocó. Conviene cerrarlas en staging, porque cualquiera con la clave pública de staging puede llamarlas.

## 6. Lo que queda del corte

1. Configuración copiada de staging (`copiar_config.sh`, sin escribir). Sin ella, el matchmaking de producción no tiene modos, mapas ni sonidos.
2. Temporada BETA y roles.
3. Auth de producción. `SUPABASE_ACCESS_TOKEN_PROD` ya está en el `.env` de Kyan.
4. Servidores, los tres en la misma tanda:
   - **#1 MVZG** a producción.
   - **#2 flow** con el licenciado nuevo.
   - **#3 `aurav34`** con el genérico en `disabled/`.
5. Verificar la ingesta de flow, el Worker de demos y el render de clips contra la base nueva.
6. Bajar `csstv.gamer.gd`, si Kyan no lo hizo.

## Dónde está

En `kyan/pruebas`. Los replanteos `63` a `69` siguen solo en `feat/frontend-fase-1`. La `70` está en `kyan/pruebas` y hay que llevarla a tu rama.

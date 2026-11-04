# deploy/supabase

Supabase instalado en el VPS de OVH, con Docker, en lugar del plan gratis de la nube. Plan y motivo: [`docs/bitacora/2026-11-03-supabase-en-vps/PLAN.md`](../../docs/bitacora/2026-11-03-supabase-en-vps/PLAN.md).

| Archivo | Qué es | Dónde termina en el VPS |
|---|---|---|
| `preparar-env.sh` | Arma `supabase.env` desde la PC: secretos nuevos y, de producción, el JWT secret y las claves | `/etc/cmleague/supabase.env` (root, 600) |
| `supabase.env.example` | Las variables, sin valores | — |
| `instalar.sh` | Docker, el compose oficial en un commit fijo, los ajustes, el comando `sb`, el respaldo diario y el arranque. Se puede repetir | Se corre desde `/tmp` |
| `cmleague.yml` | Ajustes sobre el compose oficial: solo `127.0.0.1`, límites de memoria y sin los servicios que no se usan | `/srv/supabase/cmleague.yml` |
| `roles.sql` | Contraseñas de los roles internos al crear la base | `/srv/supabase/roles.sql` |
| `migrar.sh` y `migrar-vps.sh` | Copia producción (la nube) al VPS y la compara fila a fila | Se corre desde la PC |
| `copiar_storage.py` | Copia los archivos de Storage (lo llama `migrar-vps.sh`) | Ídem |
| `respaldar.sh`, `cmleague-respaldo.service` y `.timer` | Respaldo diario a las 09:00 UTC | `/usr/local/bin/cmleague-respaldar`, `/etc/systemd/system/` |
| `respaldo.env.example` | Credenciales de R2 del respaldo, sin valores | `/etc/cmleague/respaldo.env` (root, 600) |

## Qué corre

| Servicio | Contenedor | Memoria máxima | Para qué |
|---|---|---|---|
| Postgres 17.6 | `supabase-db` | 1,2 GB | La base. Escucha en `127.0.0.1:5432` |
| PostgREST v14.18 | `supabase-rest` | 256 MB | `/rest/v1` |
| GoTrue v2.197.0 | `supabase-auth` | 128 MB | `/auth/v1` |
| Storage v1.81.0 | `supabase-storage` | 256 MB | `/storage/v1`. Los archivos van en `/srv/supabase/oficial/docker/volumes/storage` |
| Kong 3.9.3 | `supabase-kong` | 512 MB | La puerta de entrada, en `127.0.0.1:8000` |

- Con tráfico real usan ~835 MB en total (medido el 2026-11-03; ~460 MB sin tráfico).
- **No corren:** Realtime, Edge Functions, Analytics, Vector, Supavisor ni imgproxy.
- **Studio y postgres-meta** quedan apagados (meta solo lo usa Studio). Se prenden con `sudo sb up -d meta studio`, y se apagan con `sudo sb stop studio meta`. Se entra por túnel: `ssh -L 8000:127.0.0.1:8000 ubuntu@<IP>` y `http://localhost:8000`, con `cmleague` y `SUPABASE_VPS_DASHBOARD_PASSWORD` del `.env`.
- Desde afuera se entra solo por Caddy (`db.cmleague.lat`), y solo a `/rest/v1/`, `/auth/v1/` y `/storage/v1/`.

## Claves

Valen las mismas que en la nube, porque el JWT secret es el mismo:

- Las **opacas** (`sb_publishable_…` y `sb_secret_…`), que usan la API del VPS y el `.env` de la raíz. Kong las cambia por la clave legacy equivalente.
- Las **legacy** (`eyJ…`), que usan el Worker de demos y el render de clips.

Las sesiones nuevas se firman con HS256. Las que firmó la nube (ES256) no valen acá, pero la web las renueva sola con el refresh token, que se migra con los datos.

## Comandos

```bash
sudo sb ps                 # estado
sudo sb arrancar           # levanta los cinco servicios (no los demás del compose oficial)
sudo sb logs -f rest       # logs de un servicio
sudo sb restart auth       # reinicia uno
sudo sb psql               # psql como postgres (para superusuario: docker exec -it supabase-db psql -U supabase_admin)
sudo sb down               # apaga todo (los datos quedan)
```

Desde la PC, por túnel: `ssh -L 5433:127.0.0.1:5432 ubuntu@<IP>`, y después `psql -h localhost -p 5433 -U postgres` con `SUPABASE_VPS_POSTGRES_PASSWORD`.

## Instalar de cero

Desde la raíz del repo, en Git Bash:

```bash
deploy/supabase/preparar-env.sh
scp -r deploy/supabase ubuntu@<IP>:/tmp/cmleague-supabase
scp -r deploy/auth/plantillas ubuntu@<IP>:/tmp/cmleague-supabase/plantillas
ssh ubuntu@<IP> "sed -i 's/\r$//' /tmp/cmleague-supabase/*; sudo bash /tmp/cmleague-supabase/instalar.sh"
deploy/supabase/migrar.sh
```

- **Usa el `ssh` y el `scp` de Windows** (`/c/Windows/System32/OpenSSH/`). El de Git Bash no usa el agente con la llave.
- **No más de 6 conexiones en 30 s:** el `limit` de `ufw` corta la séptima. `migrar.sh` usa una sola.

## Migrar (ensayo y corte)

```bash
deploy/supabase/migrar.sh --desde-cero
```

- Borra la base del VPS y la crea de nuevo.
- Copia de producción:
  - el esquema de `public`;
  - los triggers de `auth.users` y las políticas de `storage`;
  - los datos de `public`, `auth` y `storage`;
  - los archivos.
- Compara las tablas fila a fila con producción, sin los latidos `last_seen_at` y `last_poll_at`.
- Cambia las URLs guardadas a `https://db.cmleague.lat`.
- Solo lee producción. Tarda unos 3 minutos.
- Los volcados quedan en `/srv/supabase/migracion/<fecha>/`.

## Respaldos

- **Cuándo:** todos los días a las 09:00 UTC (`systemctl list-timers cmleague-respaldo.timer`). A mano: `sudo cmleague-respaldar`.
- **Qué se guarda:** `base.dump` (`pg_dump -Fc` de toda la base), `storage.tar.gz` y `SHA256SUMS`, en `/srv/supabase/respaldos/<fecha>/`. Quedan los últimos 7.
- **Copia afuera:** con `/etc/cmleague/respaldo.env` completo (ver `respaldo.env.example`), sube también a R2. Hacen falta:
  - el bucket `cmleague-respaldos`;
  - una regla de ciclo de vida de 14 días;
  - un token de R2 solo para ese bucket.

  Los crea Daniel en Cloudflare.

**Restaurar un respaldo** en una base nueva del VPS:

```bash
sudo sb down -v && sudo rm -rf /srv/supabase/oficial/docker/volumes/db/data && sudo sb arrancar
cat base.dump | sudo docker exec -i supabase-db pg_restore -U supabase_admin -d postgres --clean --if-exists
sudo tar -C /srv/supabase/oficial/docker/volumes -xzf storage.tar.gz
sudo sb restart
```

Probado el 2026-11-03 en una base aparte, con 0 errores y las mismas filas y el mismo ELO.

## Volver a la nube

El proyecto de la nube (`wmzfwsizashpszxlvpeb`) no se borra por al menos 30 días después del corte. Para volver:
1. Respaldo del VPS.
2. Restaurarlo en la nube con el mismo método de `migrar-vps.sh` (esquema, datos y archivos) o con `pg_restore`.
3. Volver a poner las URLs viejas en los `.env` del VPS, en los servidores y en los Workers.

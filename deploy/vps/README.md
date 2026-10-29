# deploy/vps

Todo lo necesario para rehacer el VPS de CMLeague (OVH, Ubuntu 26.04) desde cero. Plan y explicación de cada paso: [`docs/bitacora/2026-10-28-despliegue-vps-ovh/PLAN.md`](../../docs/bitacora/2026-10-28-despliegue-vps-ovh/PLAN.md).

| Archivo | Qué es | Dónde termina en el VPS |
|---|---|---|
| `preparar.sh` | Prepara el servidor (una vez; se puede repetir) | Se corre desde una copia en `/tmp` |
| `desplegar.sh` | Sube una versión de la API o del frontend, con vuelta atrás | Se corre desde la PC |
| `agregar-acceso.sh` | Suma una llave SSH o un usuario nuevo | Ídem |
| `Caddyfile` | Caddy con `cmleague.lat`, `www`, `api` (y `hud`, comentado) | `/etc/caddy/Caddyfile` (con `--dominios`) |
| `Caddyfile.ip` | Caddy por IP, antes de tener el DNS | `/etc/caddy/Caddyfile` |
| `cmleague-api.service` | La API | `/etc/systemd/system/` |
| `cmleague-season.service` y `.timer` | Cierre de temporadas cada 10 minutos | `/etc/systemd/system/` |
| `cmleague-notify.service` y `.timer` | Notificaciones programadas cada 10 minutos (usa `season.env`) | `/etc/systemd/system/` |
| `cmleague-hud.service` | Relay del HUD (apagado) | `/etc/systemd/system/` |
| `cmleague-demos.service` y `.timer` | Demos por SFTP a R2 cada 10 minutos (apagado hasta completar sus variables) | `/etc/systemd/system/` |
| `sudoers-deploy` | Lo único que `deploy` puede hacer con `sudo` | `/etc/sudoers.d/cmleague-deploy` |
| `api.env.example`, `season.env.example` | Variables, sin valores | `/etc/cmleague/api.env` y `season.env` (root, 600) |
| `demos.env.example`, `demos-sftp.json.example` | Variables y credenciales de SFTP de las demos, sin valores (los ids y las huellas sí) | `/etc/cmleague/demos.env` y `demos-sftp.json` (root, 600) |

## Preparar el servidor

Desde la raíz del repo, en la PC de Daniel:

```bash
scp -r deploy/vps ubuntu@<IP>:/tmp/cmleague-vps
ssh ubuntu@<IP> "sudo CONSOLE_PASSWORD_HASH='<hash>' bash /tmp/cmleague-vps/preparar.sh"
```

- `<hash>` sale de `openssl passwd -6` con la contraseña de `VPS_CONSOLE_PASSWORD` del `.env`. Es opcional.
- **Sin cerrar esa sesión**, probar `ssh ubuntu@<IP>` y `ssh deploy@<IP>` desde otra terminal.
- Cuando el DNS apunte al VPS: lo mismo con `--dominios`.

## Sumar una llave

```bash
scp nueva.pub ubuntu@<IP>:/tmp/
ssh ubuntu@<IP> "sudo bash /tmp/cmleague-vps/agregar-acceso.sh <usuario> /tmp/nueva.pub [--sudo]"
```

## Desplegar

Desde la raíz del repo, en Git Bash:

```bash
deploy/vps/desplegar.sh api        # pruebas, build, subida, restart y /api/health; si falla, vuelve a la anterior
deploy/vps/desplegar.sh web        # pruebas, build con VITE_API_URL (por defecto https://api.cmleague.lat) y subida
deploy/vps/desplegar.sh web --sin-pruebas
```

- Entra como `deploy` con el SSH de Windows y abre solo dos conexiones (el `limit` de `ufw` corta la séptima en 30 s).
- Quedan las últimas 5 versiones en `/srv/cmleague/<parte>/releases/`. Volver atrás a mano: `ln -sfn <versión> current.nuevo && mv -T current.nuevo current` y `sudo systemctl restart cmleague-api`.

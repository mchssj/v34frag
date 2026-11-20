# Protección del VPS contra floods HTTP: guía de implementación

## Estado

**Desplegado en el VPS el 2026-11-20 (01:14-01:25 UTC).** Sin cambios sin commitear en el VPS: lo que corre es igual a `deploy/vps/`. No toca los servidores de juego (#1, #2 y #3), ni la base, ni la API, ni la web.

## Diferencias con el plan

- **Segunda caída durante la implementación.** El ataque volvió a las 01:09, apenas se levantó Caddy a mano, y lo volvió a matar a las 01:12:27. El `reload` del despliegue falló porque Caddy estaba caído. Se levantó con `systemctl start` a las ~01:15, ya con el drop-in y el Caddyfile nuevos.
- **`MemorySwapMax=0`**, que no estaba en el plan: en la segunda caída Caddy usó 810 MB de swap antes de morir.
- **Sin `MemoryHigh`.** El plan lo ponía en 800M. Con `MemorySwapMax=0`, el kernel no tenía de dónde liberar memoria: entre ~01:16 y 01:19 UTC Caddy quedó colgado en 968 MB, sin reiniciarse y sin responder (`000` en la web y la API, 342 conexiones abiertas, ninguna petición en el log). Se quitó `MemoryHigh` y se reinició Caddy a las 01:19:40. En el minuto siguiente se mantuvo en 30-50 MB, sin reinicios.
- **No se mandó un aviso de prueba a Discord.** La lógica se probó con el webhook vacío contra un sitio inexistente (ver abajo). El webhook es el mismo que ya usa el respaldo.

## Pasos que se hicieron

1. Subir `Caddyfile`, `caddy-cmleague.conf`, `vigia.sh`, `cmleague-vigia.service` y `cmleague-vigia.timer` a `/tmp/cmleague-ddos/` con `scp`, y quitarles el `\r`.
2. Respaldar `/etc/caddy/Caddyfile` en `/etc/caddy/Caddyfile.anterior-20261120`, instalar el nuevo y validarlo con `caddy validate`.
3. Instalar el drop-in en `/etc/systemd/system/caddy.service.d/cmleague.conf`, el vigía en `/srv/cmleague/vigia.sh` y sus unidades en `/etc/systemd/system/`.
4. Crear `/etc/cmleague/vigia.env` con la línea `DISCORD_UPTIME_WEBHOOK=` de `respaldo.env` (600).
5. `systemctl daemon-reload`, `systemctl start caddy` y `systemctl enable --now cmleague-vigia.timer`.

## Pruebas

| Prueba | Resultado |
|---|---|
| `systemctl show caddy` | `Restart=always`, `MemoryHigh=infinity`, `MemoryMax=1073741824`, `MemorySwapMax=0` |
| `curl -sI https://cmleague.lat/` | Sin `alt-svc`: HTTP/3 apagado |
| Web, API y base | `200`, `302` y `401` |
| Vigía contra `https://noexiste.cmleague.lat/`, 3 pasadas sin webhook | 1.ª `falla1`, 2.ª avisa ("no responde hace 2 minutos"), 3.ª no repite el aviso |
| `cmleague-vigia.service` real | `Result=success` |

**No probado:** que Caddy se reinicie solo al pasar 1 GB. No se forzó, para no cortar la web.

## Para deshacerlo

```bash
sudo rm /etc/systemd/system/caddy.service.d/cmleague.conf
sudo cp /etc/caddy/Caddyfile.anterior-20261120 /etc/caddy/Caddyfile
sudo systemctl daemon-reload && sudo systemctl reload caddy
sudo systemctl disable --now cmleague-vigia.timer
# Los bloqueos de ufw: sudo ufw status numbered y sudo ufw delete <n> los que digan "flood 2026-11-20".
```

## Pendiente (lo largo)

- Pasar el DNS de Namecheap a Cloudflare con proxy, una regla de rate limiting y `ufw` con 80/443 solo para las IPs de Cloudflare. Antes, revisar el ping del WebSocket del matchmaking (<100 s), el límite de 100 MB por subida y `trusted_proxies cloudflare` en Caddy.
- Un chequeo desde afuera del VPS.

## Parte 2: Cloudflare adelante (preparado el 2026-11-20; falta mover el DNS)

### Lo que ya quedó en el VPS

- **Caddyfile** con `trusted_proxies` (rangos de https://www.cloudflare.com/ips/ del 2026-11-20) y `client_ip_headers CF-Connecting-IP`. La API y Kong reciben `X-Forwarded-For {client_ip}`: la IP real del cliente, también detrás de Cloudflare. Probado: un pedido directo con `CF-Connecting-IP: 1.2.3.4` y `X-Forwarded-For: 5.6.7.8` quedó registrado con la IP real de la conexión. `CLIENT_IP_HEADER=x-forwarded-for` en la API no cambia.
- **`/etc/caddy/solo-cloudflare.caddy`**, importado en `cmleague.lat`, `www`, `api` y `db`, hoy con un comentario (sin restricción). `sudo bash /srv/cmleague/solo-cloudflare.sh on` escribe la regla que corta lo que no venga de Cloudflare; `off` la saca. La versión `on` se validó en una copia del Caddyfile.
- **`hud.cmleague.lat` se queda sin proxy ("DNS only")**: los servidores de juego le mandan el HUD por UDP a ese nombre (`csstv_hud_host`, que la API saca de `HUD_BASE_URL`) y el proxy de Cloudflare no pasa UDP. Pasarlo al proxy pide un nombre aparte para el UDP en el #1, el #2 y el #3 y un cambio en la API.
- **Revisado en el código:** el WebSocket del matchmaking manda ping cada 15 s (`MM_PING_MS`), por debajo de los 100 s de Cloudflare, y la subida más grande es de 8 MB (`ANIMATED_MAX_BYTES`), por debajo de los 100 MB del plan gratis.
- **No se pudo leer** la configuración de los servidores de juego: la API del panel de MVZG respondía `DaemonConnectionException` (500) al leer archivos.

### Registros DNS de hoy (Namecheap)

| Nombre | Tipo | Valor | En Cloudflare |
|---|---|---|---|
| `cmleague.lat` | A / AAAA | `148.113.148.184` / `2607:5300:205:200::eb59` | Proxied |
| `www` | CNAME | `cmleague.lat` | Proxied |
| `api` | A / AAAA | igual | Proxied |
| `db` | A / AAAA | igual | Proxied |
| `hud` | A / AAAA | igual | **DNS only** |
| `cmleague.lat` | MX | `mx1.privateemail.com` y `mx2.privateemail.com` (10) | DNS only |
| `cmleague.lat` | TXT | `v=spf1 include:spf.privateemail.com ~all` | — |
| `cmleague.lat` | TXT | `google-site-verification=…` | — |
| `send` | MX | `feedback.forge.rmta.net` (10) | DNS only |
| `send` | TXT | SPF de Resend | — |
| `resend._domainkey` | TXT | DKIM de Resend | — |
| `_dmarc` | TXT | `v=DMARC1; p=none;` | — |

Puede haber otros registros que no se ven desde afuera: se comparan contra el panel de Namecheap.

### Pasos de Daniel o Kyan

1. **Cloudflare › Add a domain › `cmleague.lat` › Free**, en la cuenta del proyecto (la de los Workers). Cloudflare copia los registros: comparar con la tabla y con Namecheap.
2. **Proxy:** nube naranja en `cmleague.lat`, `www`, `api` y `db`; **gris en `hud`**. Los MX y TXT quedan como están.
3. **SSL/TLS › Overview:** `Full (strict)`. **Edge Certificates:** `Always Use HTTPS` **apagado** (Caddy ya redirige y lo necesita apagado para renovar los certificados de Let's Encrypt), `Minimum TLS Version` 1.2.
4. **Security › Bots:** `Bot Fight Mode` **apagado**: bloquearía el reporter de los servidores, los Workers y los clientes que no son navegadores.
5. **Security › WAF › Rate limiting rules** (el plan gratis trae una): `Hostname equals cmleague.lat` y `URI Path does not start with /assets/`; 50 pedidos en 10 segundos por IP; acción `Block` por 10 segundos.
6. **Namecheap › Domain List › cmleague.lat › Manage:** si `DNSSEC` está prendido, apagarlo primero. Después, en `Nameservers`, elegir `Custom DNS` y poner los dos nameservers que da Cloudflare. Guardar.
7. Esperar a que Cloudflare marque el dominio como **Active** (minutos a horas) y avisar.

### Pasos después del cambio (Claude)

1. Comprobar `cf-ray` en `cmleague.lat`, `api` y `db`; que `hud` siga yendo directo al VPS; la web, el login, el matchmaking (socket), el reporter (un `ingest_server_chunk` de un servidor) y el HUD.
2. `sudo bash /srv/cmleague/solo-cloudflare.sh on` y repetir las pruebas. Desde afuera, `curl --resolve cmleague.lat:443:148.113.148.184 https://cmleague.lat/` tiene que cortarse.
3. Comprobar en `/var/log/caddy/api.log` que `client_ip` sea la del cliente y no una de Cloudflare.
4. Quitar la marca "En preparación" de Cloudflare en `/privacidad` (`PrivacyPage.tsx` y `terms/privacidad.html`) y desplegar la web.

### En un ataque

**Security › Configuration Rules:** una regla `Hostname equals cmleague.lat` → `Security Level: I'm Under Attack`. Solo para `cmleague.lat`: en `api` y `db` el desafío rompe el reporter, los Workers y la API.

### Para deshacerlo

`sudo bash /srv/cmleague/solo-cloudflare.sh off` y, en Cloudflare, nube gris en todo (o volver los nameservers de Namecheap a `Namecheap BasicDNS`, con los registros que ya tenía).

## Parte 3: Cloudflare activo y firewall cerrado (2026-11-20)

**Hecho.** Diferencias con la parte 2:

- **Más olas antes de Cloudflare.** Después de la revisión de las 01:34 hubo olas a las 01:35-01:48, 02:19-02:21, 02:35-02:38 y 02:41-02:42 UTC: unos 29.500 `GET /` de 528 IPs, por HTTP/2, directo a la IP. Caddy se reinició 49 veces (límite de 1 GB y `Restart=always`): la web se cortó unos segundos cada vez.
- **Cronología (UTC):** nameservers en Namecheap ~02:45; el registro de `.lat` con `max` y `jill.ns.cloudflare.com` a las 02:50; dominio activo a las 02:53; certificado de Cloudflare (Let's Encrypt, `cmleague.lat` y `*.cmleague.lat`, hasta 2027-02-18) a las 02:56; firewall cerrado a las 03:12.
- **Registros DNS en Cloudflare:** se agregaron `relay` (A y AAAA, DNS only, para pasar el UDP del HUD más adelante) y se pasaron a DNS only `autoconfig`, `autodiscover` y `mail` (correo de Private Email). Regla de rate limiting del plan gratis: solo filtra por ruta, así que cuenta todo menos `/assets/*`, `/api/*`, `/rest/*`, `/auth/*` y `/storage/*`, 50 pedidos en 10 s por IP, bloqueo de 10 s.
- **El corte va en el firewall y no en Caddy.** `solo-cloudflare.sh` ahora pone en `ufw` 80 y 443 solo para los rangos de Cloudflare (22, bajados en el momento) y `190.104.34.3` (MVZG, por el reporter mientras su DNS no veía a Cloudflare), y saca `80/tcp`, `443/tcp` y `443/udp` abiertos a todos. Así lo directo se descarta antes de llegar a Caddy. Se sacaron del Caddyfile los `import /etc/caddy/solo-cloudflare.caddy`: habrían cortado al reporter, que todavía llegaba directo. Respaldo de las reglas: `/etc/ufw/user.rules.anterior-20261120` y `user6.rules.anterior-20261120`.
- **`hud.cmleague.lat` ya no responde** (DNS only con el 443 cerrado): el HUD de las transmisiones queda sin funcionar hasta pasar `csstv_hud_host` de los tres servidores a `relay.cmleague.lat` y `hud` a Proxied.
- **El primer intento de `solo-cloudflare.sh on` falló sin tocar nada** (`grep` sin resultados con `pipefail`); se corrigió. Varias conexiones SSH seguidas activaron el `LIMIT` de `ufw` para el 22 durante unos 30 s.

### Pruebas (03:12-03:15 UTC)

| Prueba | Resultado |
|---|---|
| Web, API, WebSocket del matchmaking y base por Cloudflare | `200`, `200`, `101` y `401` (sin clave) |
| Directo a la IP por IPv4, IPv6 y HTTP | Sin respuesta (`000`) |
| `hud.cmleague.lat` | Sin respuesta (esperado) |
| Reporter de los servidores | `csstv_mm_poll` y `csstv_license` por Cloudflare (`104.23…`, `198.41…`) con `client_ip` `190.104.34.3`, todos `200` |
| IP real | `client_ip` es la del cliente y `remote_ip` la de Cloudflare |
| SSH | Sigue entrando |

**No probado:** un `ingest_server_chunk` (solo sale con una partida en curso) por Cloudflare; va por el mismo camino que `csstv_mm_poll`.

### Para deshacerlo

`sudo bash /srv/cmleague/solo-cloudflare.sh off` (vuelve a abrir 80 y 443 a todos y saca las reglas de Cloudflare y de MVZG).

### Reabierto a las 03:18 UTC

A los pocos minutos Daniel avisó que la web no cargaba. El router de su casa (`192.168.1.1`) todavía tenía en caché el A viejo de `api.cmleague.lat` (`148.113.148.184`), aunque ya habían pasado los 30 minutos del TTL: la web cargaba por Cloudflare y la API se quedaba esperando. Se corrió `solo-cloudflare.sh off` (80 y 443 abiertos a todos; también sacó `443/udp`, que ya no se usa). **Se vuelve a cerrar cuando en los logs no quede tráfico directo**, salvo MVZG y el propio VPS, durante un buen rato (por ejemplo, al otro día). Mientras tanto, la IP sigue expuesta: si vuelve el flood, Caddy se corta y se reinicia como antes.

### Cierre programado (04:31 UTC)

Pedido por Daniel: cerrar el firewall 1 h 10 min después de reabrirlo. `pruebas/cerrar-firewall-programado.sh` (copiado a `/srv/cmleague/`) corre una vez con `systemd-run --on-active=70m --unit=cmleague-cierre-firewall` (timer para las 04:31:09 UTC). Antes de cerrar cuenta las IPs que en los últimos 15 minutos entraron directo a la API o la base, sin Cloudflare, MVZG ni el VPS: con 2 o menos cierra; si no, reintenta cada 30 minutos hasta 6 veces y después deja todo abierto. Después de cerrar, si la web o la API no responden por Cloudflare, lo vuelve a abrir solo. Avisa cada paso por Discord (`DISCORD_UPTIME_WEBHOOK`). A las 03:22 UTC había 8 IPs directas (una era la de Daniel).

Para cancelarlo: `sudo systemctl stop cmleague-cierre-firewall.timer`.

### UDP del HUD solo para MVZG (04:50 UTC)

Pedido por Daniel. `solo-cloudflare.sh on` ahora también deja los puertos 27500-27519/udp (relay del HUD) solo para `PERMITIDOS` y saca la regla abierta a todos; `off` la vuelve a abrir. Con esto, lo único abierto a todo el mundo en la IP del VPS es el SSH (solo con llave, `LIMIT` y fail2ban).

- **`PERMITIDOS` es la lista de las máquinas de los servidores de juego**: hoy solo MVZG (`190.104.34.3`, donde están el #1, el #2 y el #3). **Si se suma un servidor en otra máquina, o MVZG cambia de IP, hay que agregarla en `deploy/vps/solo-cloudflare.sh` y volver a correr `sudo bash /srv/cmleague/solo-cloudflare.sh on`.** Si no, el HUD de ese servidor no llega al relay (y, mientras su DNS no vea a Cloudflare, tampoco su reporter). Quedó anotado en `CLAUDE.md`, en la lista de servidores.
- **No probado:** que lleguen paquetes del HUD con la regla nueva. En 25 s de captura (`tcpdump`) no llegó ninguno (no había un servidor con el HUD transmitiendo) y el relay no registra el origen. Se dio por hecho que salen de `190.104.34.3`, la misma IP del reporter, por IPv4.
- La web, la API y la base siguieron respondiendo por Cloudflare después del cambio.

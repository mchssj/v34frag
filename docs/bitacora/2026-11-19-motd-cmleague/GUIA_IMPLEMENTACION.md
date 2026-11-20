# Pantalla de bienvenida de CMLeague en los servidores: guía de implementación

## Estado

**Desplegado el 2026-11-19** en el #1, el #2 y el #3. Falta verlo dentro del juego.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/public/motd.png` | Nuevo: la imagen de 768×433. |
| `cstrike/motd.txt` (#1, #2 y #3, en los servidores) | `src` de `https://i.imgur.com/QXIgnm2.png` (ExtremeHost) a `https://cmleague.lat/motd.png`. |
| `pruebas/motd-banner.html` y `pruebas/motd.txt` | Fuente de la imagen y copia del MOTD. |

## Despliegue (hecho el 2026-11-19)

1. **Web:** se copió solo `motd.png` a `/srv/cmleague/web/current/` (versión `12e7e71036d3`) por SSH, como `deploy`. No se usó `desplegar.sh web` porque la copia de trabajo tenía cambios sin commit de otros requerimientos (`TermsPage.tsx` y `PrivacyPage.tsx`). Como el PNG está en `public/`, los próximos despliegues lo incluyen.
2. **Servidores:** `POST /api/client/servers/<id>/files/write?file=/cstrike/motd.txt` en `panel-mvzg.com` con `SFTP_CSS_API_KEY`, para `157703b5` (#1), `cd1be322` (#2) y `16c850ff` (#3). Los tres respondieron `204`. Sin reinicio: el juego lee el archivo en cada conexión y cada cambio de mapa.

## Pruebas

- `curl -I https://cmleague.lat/motd.png`: `200`, `image/png`, 73 739 bytes (los mismos del archivo).
- Lectura de `motd.txt` en los tres después de escribirlo: los tres apuntan a `https://cmleague.lat/motd.png`.
- **No probado** dentro del juego.
- `motd_text.txt`: el panel devuelve una página que redirige a `panel-mvzg.com` en vez del archivo. No se tocó (el v34 no lo usa).

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Volver a poner `https://i.imgur.com/QXIgnm2.png` en el `src` de `cstrike/motd.txt` de los tres servidores (no conviene: es la publicidad de ExtremeHost), o cambiar solo la imagen reemplazando `motd.png` en la web.

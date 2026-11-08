# Tarjeta "Comunidad" en Para ti: guía de implementación

## Estado

Hecho en `main` el 2026-11-05. Typecheck, lint y toda la suite en verde (612 pruebas, 101 archivos). **Desplegado el 2026-11-05:** web `ac5d6202b2d2` desde `main` (antes `06c2da7b23db`), con las 612 pruebas en verde dentro de `desplegar.sh web`. `https://cmleague.lat` responde 200 y el chunk de `config/site.ts` en producción trae los dos links nuevos y ya no `dsc.gg/v34frag`. Salió junto con [`2026-11-05-tooltip-elo-perfil`](../2026-11-05-tooltip-elo-perfil/). **Falta:** mirarlo en el navegador y publicar el changelog.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/home/components/SideCards.tsx` | `CommunityCard` nueva |
| `web/frontend/src/features/home/components/CommunityCard.test.tsx` | Nueva: los dos links, en otra pestaña |
| `web/frontend/src/features/home/pages/HomePage.tsx` | Monta `CommunityCard` al final del costado |
| `web/frontend/src/config/site.ts` | `COMMUNITY`; `DISCORD.inviteUrl` la toma de ahí |
| `web/frontend/src/features/legal/pages/TermsPage.tsx` y `PrivacyPage.tsx` | El link del Discord |
| `web/frontend/src/features/legal/lib/meta.ts` | `LEGAL_UPDATED` al 5 de noviembre de 2026 |
| `terms/terminos.html` y `terms/privacidad.html` | El link del Discord y la fecha |
| `docs/manual/jugador/para-ti.md` | Un párrafo en "Al costado" |

## Despliegue (hecho el 2026-11-05, web `ac5d6202b2d2`)

Solo la web, desde `main`. No toca la base, la API ni los servidores de juego (#1, #2 y #3).

1. `v34frag-deploy` en el commit y `pnpm install --frozen-lockfile` en `web/frontend`.
2. `deploy/vps/desplegar.sh web`, con `VPS_HOST` del `.env` de `v34frag`.
3. Comprobar que `https://cmleague.lat` sirva el bundle nuevo.
4. Publicar `CHANGELOG_DISCORD.txt`.

## Pruebas

- `CommunityCard.test.tsx`: la tarjeta se llama "Comunidad", los dos links van a su dirección con `target="_blank"` y `rel="noopener noreferrer"`, y su nombre accesible dice "(abre en otra pestaña)".
- No se revisó en el navegador antes del despliegue. La maqueta del [artifact](https://claude.ai/artifact/RopftvCWw2VY22afQhiThZ) usa los mismos colores y medidas.

## En qué se apartó del plan

En nada.

## Cómo revertir

Revertir el commit. Si solo se quiere volver al Discord viejo, alcanza con `COMMUNITY.discordUrl` y los cuatro links de los legales.

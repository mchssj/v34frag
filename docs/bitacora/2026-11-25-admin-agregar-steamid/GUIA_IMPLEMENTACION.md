# Guía de implementación: agregar un SteamID a mano

## Estado

Hecho en local el 2026-11-25. **Sin commit ni despliegue.** Solo la web: la API y la base no cambian.

## Pruebas

En `web/frontend`:

```bash
pnpm typecheck
pnpm exec eslint src/features/admin/players src/lib
pnpm exec vitest run src/lib/steam.test.ts src/features/admin
```

Corrido el 2026-11-25: typecheck y lint sin errores. Las pruebas de `src/features/admin` (100) pasaron antes de la prueba del diálogo, y `src/features/admin/players` (4, con las 3 nuevas) después.

- `src/lib/steam.test.ts`: el link del perfil y los espacios.
- `features/admin/players/components/AddSteamDialog.test.tsx`: de otra ficha (aviso con el nombre, botón deshabilitado y "Abrir esa ficha"), de nadie (404, se agrega con el link del perfil) y de esta ficha.

No se probó en el navegador ni contra la API local.

## Desplegar

Con el próximo despliegue de la web (`feat/frontend-fase-1` y `main`). No toca los servidores de juego.

## Decisiones durante la implementación

- **Mover en un paso:** no se hizo. Para pasar un SteamID de una ficha a otra se quita en una y se agrega en la otra, y el aviso lleva a la primera con "Abrir esa ficha".
- **Sin changelog para jugadores:** es una herramienta de admin.

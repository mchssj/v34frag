# Guía: los prototipos VIP en el frontend nuevo

## Verlos

1. Bajar la rama: `git fetch origin && git worktree add ../repo-vip kyan/vip`. También sirve un `git switch kyan/vip` en una copia limpia.
2. En `web/frontend`, instalar las dependencias:

   ```bash
   pnpm install --frozen-lockfile
   ```

3. Copiar `.env.local` desde `.env.example`.
4. `pnpm dev`. En la PC de Kyan está la configuración `frontend-vip` de `.claude/launch.json`, en el puerto 5178.
5. Abrir las rutas `/demo/vip`, `/demo/exportar`, `/demo/buscador`, `/demo/elo`, `/demo/recalculo`, `/demo/comparador`, `/demo/bio`, `/demo/favoritas`, `/demo/creditos`, `/demo/torneo-stats`, `/demo/misiones` y `/demo/configs`.

Para correr los tests:

```bash
pnpm exec vitest run src/features/configs src/features/missions src/features/elo src/features/season src/features/search
```

## Cambios respecto del plan

- **Código:** no hubo que ajustar imports. Los prototipos compilaron tal cual con la estructura de `main`.
- **Índice:** `main` ya tenía la fila de las misiones en el índice de la bitácora, pero no su carpeta. Se trajo la carpeta y se sumaron las otras 11 filas.

## Notas

- **Ramas:**
  - `kyan/vip` sale de `main` y no trae lo demás de `kyan/pruebas`: anticheat, retake, repetición y medallas de admin. Solo los 12 prototipos y su bitácora.
  - No se hace merge de esta rama en `main` ni en `feat/frontend-fase-1` sin preguntarle a Kyan.
- **Servidores:** no toca la API, la base ni el plugin, así que no hay nada que desplegar en los servidores.
- **Changelog:** no tiene `CHANGELOG_DISCORD.txt`. Se escribe cuando alguno se implemente de verdad.
- **Revertir:** borrar la rama `kyan/vip`. `main` no cambia.

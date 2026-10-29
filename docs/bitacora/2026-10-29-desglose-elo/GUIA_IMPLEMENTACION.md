# Guía: desglose de la fórmula de ELO (prototipo)

## Verlo

1. Levantar el frontend nuevo con la configuración `frontend-mm-ejemplo` (puerto 5173).
2. Abrir `http://localhost:5173/demo/elo`.

## Cambios respecto del plan

- **Redondeos:** se agregó el redondeo al par (`pgRoundEven`) para los pasos que la base calcula en `double precision`. El plan no lo mencionaba, y sin eso algunos mixes podían dar un punto de diferencia con la base.

## Archivos nuevos

En `repo-mm-ejemplo/web/frontend/src/features/elo/`:

- `formula.ts`
- `formula.test.ts`
- `demo.ts`
- `EloBreakdown.tsx`

Además, `routes/demo.elo.tsx`.

Para correr los tests:

```bash
pnpm exec vitest run src/features/elo
```

## Notas

- No toca el plugin: no hay nada que subir al servidor real ni a RBK.
- No tiene `CHANGELOG_DISCORD.txt`: se escribe cuando Esteban lo publique.
- **Revertir:** borrar los archivos nuevos.

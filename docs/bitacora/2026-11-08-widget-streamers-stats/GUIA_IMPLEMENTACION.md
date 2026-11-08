# Guía: widget para streamers con stats (prototipo)

## Verlo

1. Levantar el frontend de `repo` con la configuración `frontend-repo` (puerto 5174).
2. Abrir `http://localhost:5174/demo/widget`.
3. Arriba están los seis diseños; abajo, el personalizador. Tocar un diseño de arriba lo elige.

Para correr los tests:

```bash
pnpm exec vitest run src/features/widget
```

## Cambios respecto del plan

- **Stats:** quedó de 400 px de ancho (en el plan no había medida), porque a 340 se encimaban el ELO y las stats.
- **Vertical:** el tamaño recomendado es 200 × 500, para que entren las 9 stats.
- **Nivel:** los tres diseños de antes también pasaron al anillo de nivel.
- **Partido perdido:** el cuadradito de los últimos resultados es rojo (antes era naranja).

## Notas

- **Servidores:** no toca el plugin, así que no hay nada que subir a los servidores.
- **Changelog:** no tiene `CHANGELOG_DISCORD.txt`. Se escribe cuando Esteban lo publique.
- **Revertir:** volver `features/widget/StreamWidget.tsx`, `demo.ts` y `routes/demo.widget.tsx` a como estaban, y borrar `features/widget/options.ts` y su test.

# Guía: vista previa del próximo recálculo (prototipo)

## Verlo

1. Levantar el frontend nuevo con la configuración `frontend-mm-ejemplo` (puerto 5173).
2. Abrir `http://localhost:5173/demo/recalculo`.

## Cambios respecto del plan

- Se sumó la tabla **Alrededor tuyo**, que no estaba en el plan.
- La barra Demo tiene tres casos para ver los estados sin tocar los datos.

## Archivos nuevos

Están listados en `DOCUMENTACION.md`. Para correr los tests:

```bash
pnpm exec vitest run src/features/season
```

## Notas

- No toca el plugin: no hay nada que subir al servidor real ni a RBK.
- No tiene `CHANGELOG_DISCORD.txt`: se escribe cuando Esteban lo publique.
- **Revertir:** borrar los archivos nuevos.

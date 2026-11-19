# Guía: configs de los jugadores (prototipo)

## Verlo

1. Levantar el frontend nuevo con la configuración `frontend-mm-ejemplo` (puerto 5173).
2. Abrir `http://localhost:5173/demo/configs`.

En la barra Demo, "Vos" muestra el formulario para subir. Para probar la revisión, conviene un `.zip` con tu carpeta `cfg`.

Para correr los tests:

```bash
pnpm exec vitest run src/features/configs
```

## Cambios respecto del plan

- **Configs en revisión:** no se pueden descargar hasta que un admin las apruebe. El plan no lo decía.
- **Sin VIP:** el contenido borroso es texto de relleno, para que el prototipo no tenga el contenido real en la página sin VIP. La API real tampoco lo va a mandar.
- **Descarga:** se descarga un `.zip` armado a partir de los archivos ya revisados, no el archivo que subió el jugador.

## Notas

- **Sin servidor:** no toca el plugin, así que no hay nada que subir al servidor real ni a RBK.
- **Changelog:** no tiene `CHANGELOG_DISCORD.txt`. Se escribe cuando Esteban lo publique.
- **Revertir:** borrar `features/configs/` y `routes/demo.configs.tsx`.

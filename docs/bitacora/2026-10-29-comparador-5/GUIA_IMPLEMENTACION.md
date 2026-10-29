# Guía: comparador de hasta 5 (prototipo)

## Verlo

1. Levantar el frontend nuevo con la configuración `frontend-mm-ejemplo` (puerto 5173).
2. Abrir `http://localhost:5173/demo/comparador` y tocar **Comparar el top 5**.

## Cambios respecto del plan

- Se sumó la fila **Mejor en**, que no estaba en el plan.
- **Colores:** si se abre un link, cada jugador toma el color que le toca por su orden en el link. Después, al sacar o sumar jugadores, cada uno se queda con su color.

## Notas

- No toca el plugin: no hay nada que subir al servidor real ni a RBK.
- No tiene `CHANGELOG_DISCORD.txt`: se escribe cuando Esteban lo publique.
- **Revertir:** borrar `features/compare5/` y `routes/demo.comparador.tsx`.

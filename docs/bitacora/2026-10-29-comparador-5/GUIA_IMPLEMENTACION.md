# Guía: comparador de hasta 5 (prototipo)

## Verlo

1. Levantar el frontend nuevo con la configuración `frontend-mm-ejemplo` (puerto 5173).
2. Abrir `http://localhost:5173/demo/comparador` y tocar **Comparar el top 5**.

## Cambios respecto del plan

- **Colores:** si se abre un link, cada jugador toma el color que le toca por su orden en el link. Después, al sacar o sumar jugadores, cada uno se queda con su color.

## Cambio pedido por Kyan (2026-10-29)

- La primera versión era una tabla nueva con trofeos y otro gráfico.
- Kyan pidió que fuera igual al comparador que ya existe, solo con más tarjetas de jugador.
- Se rehízo con las mismas piezas: tarjetas, filas de stats, gráfico y "mixes juntos". El detalle está en `DOCUMENTACION.md`.

## Notas

- No toca el plugin: no hay nada que subir al servidor real ni a RBK.
- No tiene `CHANGELOG_DISCORD.txt`: se escribe cuando Esteban lo publique.
- **Revertir:** borrar `features/compare5/` y `routes/demo.comparador.tsx`.

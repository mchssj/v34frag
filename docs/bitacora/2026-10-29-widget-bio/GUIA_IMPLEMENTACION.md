# Guía: widget para la bio (prototipo)

## Verlo

1. Levantar el frontend nuevo con la configuración `frontend-mm-ejemplo` (puerto 5173).
2. Abrir `http://localhost:5173/demo/bio`.

## Cambios respecto del plan

- `features/export/card.ts` ahora exporta sus ayudantes de dibujo (`SANS`, `MONO`, `loadImage`, `levelColors`, `roundRect`, `fitFont` y `Palette`) para no duplicarlos. La tarjeta de "Exportá tus stats" no cambia.
- La firma sumó una segunda opción, una imagen con link, para las páginas que no aceptan iframes.

## Pasar a la versión real

```mermaid
sequenceDiagram
  participant T as Twitch o Twitter
  participant W as cmleague.lat
  participant A as API
  T->>W: Pide la imagen o el link del perfil
  W->>A: card.png del jugador
  A-->>W: PNG con las stats de ahora (caché de minutos)
  W-->>T: Imagen con el link al perfil
```

## Notas

- No toca el plugin: no hay nada que subir al servidor real ni a RBK.
- No tiene `CHANGELOG_DISCORD.txt`: se escribe cuando Esteban lo publique.
- **Revertir:** borrar `features/bio/` y `routes/demo.bio.tsx`, y sacar los `export` de los ayudantes en `card.ts`.

# Guía: stats post-torneo (prototipo)

## Verlo

Levantar el frontend nuevo con la configuración `frontend-mm-ejemplo` (puerto 5173) y abrir `http://localhost:5173/demo/torneo-stats`.

## Notas

- **Plan:** se escribió junto con el prototipo.
- **Sin servidor:** no toca el plugin, así que no hay nada que subir al servidor real ni a RBK. Si hacen falta entradas o clutches nuevos en el plugin, eso sí se despliega en los dos servidores.
- **Changelog:** no tiene `CHANGELOG_DISCORD.txt`. Se escribe cuando Esteban lo publique.
- **Revertir:** borrar `features/vip/TournamentStats.tsx` y `routes/demo.torneo-stats.tsx`.

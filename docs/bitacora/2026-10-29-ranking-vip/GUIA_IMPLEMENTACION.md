# Guía: marcas VIP en el ranking (prototipo)

## Verlo

Levantar el frontend nuevo con la configuración `frontend-mm-ejemplo` (puerto 5173) y abrir `http://localhost:5173/demo/ranking-vip`.

## Notas

- **Plan:** se escribió junto con el prototipo, porque Kyan pidió seguir mientras no estaba.
- **Sin servidor:** no toca el plugin, así que no hay nada que subir al servidor real ni a RBK.
- **Changelog:** no tiene `CHANGELOG_DISCORD.txt`. Se escribe cuando Esteban lo publique.
- **Revertir:** borrar `features/vip/VipName.tsx`, `features/vip/RankingVip.tsx` y `routes/demo.ranking-vip.tsx`. `features/vip/demo.ts` lo usan también los otros tres demos VIP.

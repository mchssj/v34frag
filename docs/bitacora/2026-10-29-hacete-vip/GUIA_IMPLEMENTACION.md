# Guía: página Hacete VIP (prototipo)

## Verlo

1. Levantar el frontend nuevo con la configuración `frontend-mm-ejemplo` (puerto 5173).
2. Abrir `http://localhost:5173/demo/vip`, o tocar **Hacete VIP** en el cartel de cualquier demo VIP.

## Cambios respecto del plan

- La tabla de beneficios suma las configs de los jugadores, que se hicieron en la misma tanda.
- Los avisos con botón (`vipToast`) usan el botón de acción de los avisos que ya tiene la web.

## Notas

- **Sin servidor:** no toca el plugin, así que no hay nada que subir al servidor real ni a RBK.
- **Changelog:** no tiene `CHANGELOG_DISCORD.txt`. Se escribe cuando Esteban lo publique.
- **Revertir:**
  - Borrar `features/vip/plans.ts`, `VipPage.tsx`, `upsell.tsx` y `routes/demo.vip.tsx`.
  - Sacar el botón y `vipToast` de los demos que los usan. El commit `d08a552` de `repo-mm-ejemplo` dice cuáles.

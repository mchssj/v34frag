# `!sell`, vender lo comprado en la ronda: guía de implementación

## Estado

**Hecho y probado con bots en el servidor local** (2026-10-19). **Subido a los dos servidores, el real y RBK, el 2026-10-19** (md5 verificado). Se carga en el próximo cambio de mapa. Falta probar el menú y las compras reales con un jugador.

## Decisiones de la sección 5 del plan (Daniel, 2026-10-19)

| Tema | Decisión |
|---|---|
| El arma que reemplazaste | **(a) No vuelve.** Al vender la Deagle, la USP se queda donde la tiró el juego |
| Disparar en los 5 s | **(a) Se vende igual**, aunque la hayas disparado |
| Las balas | En esta versión **no se compran aparte**: no hay nada que devolver y no se escuchan `buyammo1` ni `buyammo2` |
| Zona de compra | **(a) En cualquier lado** dentro de la ventana |

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_sell.sp` | Nuevo: el plugin |
| `server/addons/sourcemod/plugins/csstv_sell.smx` | Nuevo: compilado sin `SELL_DEBUG` con el `spcomp` 1.8.0.5963 del servidor local |
| `docs/bitacora/2026-10-18-plugin-sell/pruebas/sell.sh` | Pruebas con bots |
| `docs/bitacora/2026-10-18-plugin-sell/pruebas/resultado.txt` | Salida de la última corrida |
| `docs/bitacora/2026-10-18-plugin-sell/CHANGELOG_DISCORD.txt` | Changelog para jugadores |

Compilación:

```
spcomp.exe csstv_sell.sp -i<scripting>/include -o<salida>/csstv_sell.smx
spcomp.exe csstv_sell.sp SELL_DEBUG= -i<scripting>/include -o<salida>/csstv_sell_debug.smx
```

## Despliegue (hecho el 2026-10-19)

**Hecho el 2026-10-19**, en la misma tanda que `csstv_calladmin`, a pedido de Daniel: `csstv_sell.smx` (md5 `b0131aaa2a2bb8d31081384fcf952ccb`) subido a `cstrike/addons/sourcemod/plugins/` del **servidor real** y de **RBK**, bajado de nuevo y comparado. Ningún plugin de los dos servidores registra `sm_sell` (lista de plugins revisada ese día). No se recargó nada: se carga en el próximo cambio de mapa. Falta la verificación del paso 5.

Pasos:

Sin licencia: **el mismo `.smx` va a los dos servidores**, como `csstv_allchat`.

1. Comprobar que ningún plugin registre `sm_sell`. Revisado el 2026-10-19 sobre las copias de los `.smx` de los dos servidores del 2026-10-17: ninguno tiene `sell`. Si se suman plugins antes de subirlo, revisar de nuevo.
2. **Servidor real** (`SFTP_CSS_*`): subir `csstv_sell.smx` a `cstrike/addons/sourcemod/plugins/`, volver a bajarlo y comparar el md5.
3. **RBK** (`SERVER1_*`): lo mismo, con el mismo `.smx`.
4. Las dos subidas en la misma tanda. **Sin recargar nada:** cada servidor lo carga en su próximo cambio de mapa (un `sm plugins load` no corta la partida, pero se espera igual al cambio de mapa).
5. **Verificar en cada servidor:**
   - `sm plugins list` muestra "CSSTV Sell (1.0.0)".
   - Con un jugador: comprar un arma y `!sell`, que la venda y devuelva la plata.
   - El log de errores de SourceMod no tiene excepciones de `csstv_sell.smx`.
6. Publicar `CHANGELOG_DISCORD.txt`.

## Pruebas

### Con bots en el servidor local (2026-10-19)

Servidor local (`E:\CSS DEDICATED SERVER\server`, SourceMod 1.10) con la build `SELL_DEBUG` y **`csstv_reporter` apartado** para no enviar nada a la Supabase real. `pruebas/sell.sh` con 2 bots, `mp_freezetime 15`, `mp_startmoney 15000` y `bot_eco_limit 16000`, para que los bots no compren con su propia IA.

**Los bots no obedecen `buy`**: el comando llega al plugin, con el bot en la zona de compra, pero el juego no les vende nada (solo compran con su IA). Por eso compran con `csstv_sell_fakebuy`, que hace lo mismo que el juego en el mismo frame: el listener saca la foto, el arma de la misma ranura cae al piso (`use` y `drop`), se entrega el ítem y se descuenta su precio. La detección por diferencia de un frame es la misma que con una compra real.

| # | Caso | Resultado |
|---|---|---|
| 1 | Una sola compra (AK) | `Vendiste AK-47: +$2500.` Sin AK y con la plata de antes |
| 2 | Chaleco + casco, HE y 2 flash en el mismo frame | `Vendiste todo: +$1700.` Todo vuelve a 0 |
| 3 | Sin compras | `No compraste nada en esta ronda que puedas vender.` |
| 4 | Deagle del CT, kit y visión nocturna por separado | `Vendiste todo: +$2100.` La USP queda en el piso |
| 5 | Chaleco dañado (100 → 80) y AK | Solo se vende el AK (+$2500). El chaleco se queda en 80 |
| 6 | 2 flash y humo, 1 flash lanzada | `+$500`: 1 flash y el humo |
| 7 | Arma comprada y tirada al piso | No se vende |
| 8 | AWP con la plata en 15 900 | `+$100 (llegaste al tope de $16000)`. Queda en 16 000 |
| 9 | Vender a los 21 s (15 de freezetime + 5) | `Ya no se puede vender: solo hasta 5 s después del freezetime.` |
| 10 | Lo de la ronda anterior | No se vende |
| 11 | Muerto | `Solo los jugadores vivos pueden vender.` |

### Sin probar

- **Compras reales**: menú de compra, `buy` por consola, `autobuy` y `rebuy` (los bots no pueden). Es lo primero que hay que probar con un jugador, sobre todo que el reparto de `autobuy` dé bien.
- **El menú** (los bots no pueden usar menús): que se actualice el tiempo, que se vuelva a abrir después de cada venta y que se cierre al terminar la ventana.
- **La pausa táctica**, que necesita a `csstv_reporter`. La ventana se calcula con `m_fRoundStartTime`, que es lo mismo que mueve la pausa.
- **Un arma levantada por otro jugador.** Los bots con `bot_stop` no se mueven. Es el mismo control que el arma tirada (el dueño de la entidad), que sí se probó.

## En qué se apartó del plan

- **Las balas:** el plan proponía revisar con bots si un arma comprada traía balas. Daniel aclaró que en esta versión las balas no se compran aparte, así que no se escuchan `buyammo1` ni `buyammo2`.
- **Las granadas no se tiran al piso en v34**: solo se pierden lanzándolas. El caso "granada tirada" del plan se probó como granada lanzada.
- **Granadas en el menú:** van en una sola fila por tipo con la cantidad (`Flash (x2) - $200 c/u`) en lugar de una fila por unidad, y cada elección vende una.
- **`!sell todo`** funciona igual que `!sell all`.
- **Prueba de compras con `csstv_sell_fakebuy`** en lugar de `buy`, porque los bots no obedecen `buy`.

## Incidentes durante las pruebas

- **Servidor trabado al arrancarlo desde la terminal:** srcds lanzado desde una consola sin ventana propia se queda en `CTextConsoleWin32::GetLine: !GetNumberOfConsoleInputEvents` y no responde al RCON. Hay que arrancarlo con su propia ventana (`Start-Process` en PowerShell).
- **`SDKHooks_DropWeapon` no está soportado en este motor** (v34): la primera versión de `csstv_sell_fakebuy` lo usaba. Se reemplazó por los comandos `use` y `drop`.

## Cómo revertir

- **Al instante:** `csstv_sell 0` en la consola del panel de cada servidor.
- **Del todo:** mover `csstv_sell.smx` a `plugins/disabled/` en los dos servidores. Se descarga en el próximo cambio de mapa.

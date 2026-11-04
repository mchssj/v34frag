---
titulo: El ELO, las demos y los mixes por revisar
resumen: Las reglas del ELO, los ajustes manuales, los mixes interrumpidos y el estado de las demos.
orden: 2
---

Todo esto está en Administración › [Servidores y ELO](/admin/servers).

## Reglas del ELO

En la pestaña **Reglas del ELO** cambias cuánto se mueve el ELO: el cambio base, el bonus por rendimiento y qué parte de la partida hay que jugar para que cuente (**No cuenta**, **Proporcional**, **Completo**).

- La **vista previa** te muestra cuánto ganaría y perdería un jugador en un partido normal, uno bueno y uno malo, antes y después del cambio.
- **No recalculan el historial:** valen para los mixes que terminen desde que guardas. Para corregir a jugadores puntuales, usa los ajustes manuales.

## Ajustes manuales

En **Ajustes manuales** corriges el ELO de uno o varios jugadores:

1. Busca a los jugadores por alias.
2. Elige el tipo:
   - **Cambio:** suma o resta (negativo para restar).
   - **ELO final:** el jugador queda en ese valor.
3. Escribe el **motivo**. El jugador lo ve en la campana. Por ejemplo: "el mix del 27/10 se cayó con 13–5 a favor".
4. Toca **Aplicar ajuste**.

En el historial puedes **Deshacer** un ajuste. Deshacer un "ELO final" recalcula el ELO de todos para que quede como si el ajuste no hubiera existido.

## Mixes por revisar

La pestaña **Mixes por revisar** tiene dos listas:

- **Mixes interrumpidos:** se cortaron antes de terminar (se cayó el servidor, por ejemplo). Cada uno dice quién iba ganando y cuántas rondas se jugaron. Elige **Aplicar ELO** (cuenta con ese resultado) o **Descartar** (queda cancelado y no mueve el ELO de nadie).
- **Mixes en vivo sin señal:** el servidor dejó de mandar datos. **Cerrar mix** lo guarda con la última foto y lo pasa a interrumpidos para que decidas el ELO.

## Demos

La pestaña **Demos** muestra el estado de la demo de cada partida: **Pendiente**, **Subida**, **Perdida** o **Vencida** (pasados 90 días).

- Cuando una demo se puede volver a buscar, su fila tiene **Reintentar**: el Worker la busca en los próximos 10 minutos.
- Arriba está el Worker de demos: si está en línea y cuándo se vio por última vez. Desde ahí lo revocas, lo reactivas o le generas un token nuevo (hay que cargarlo en Cloudflare con el comando que te da la web).

---
titulo: El ELO, las demos y los mixes por revisar
resumen: Las reglas del ELO, los ajustes manuales, los mixes interrumpidos y el estado de las demos.
orden: 2
---

Todo esto está en Administración › [Servidores y ELO](/admin/servers).

## Reglas del ELO

En la pestaña **Reglas del ELO** cambias cuánto se mueve el ELO. Desde la Temporada 2, lo que da cada mix sale de esa partida: qué equipo era favorito por su ELO promedio y el rating de cada uno en ese mix. El nivel general (con el rating de siempre y el ajuste manual del armado) solo arma los equipos.

| Grupo | Campo | Qué hace |
|---|---|---|
| Por mix | **ELO base** | Lo que gana o pierde cada uno con equipos parejos y rating 1,00 (la mitad de K). Con un favorito, la base baja para él y sube para el otro |
| | **Tope por equipo** | Si a alguien le tocaría más, a todo su equipo se le achica en la misma proporción |
| | **Mínimo por partida** | Lo menos que gana o pierde cada uno en un mix terminado (no pasa el tope). No vale para los mixes interrumpidos que apliques ni para los empates. Quien jugó solo una parte lo recibe en proporción |
| Multiplicador por rating | **Gana: mínimo y máximo** | Al ganar, la base se multiplica por su rating del mix, entre esos dos valores |
| | **Pierde: mínimo y máximo** | Al perder, por 2 − su rating: el que jugó bien pierde menos y el que jugó mal, más |
| Límites | **ELO inicial** y **ELO mínimo** | Con cuánto empieza un jugador nuevo y de cuánto nadie baja |
| Participación | **Mínima** y **Completa** | Qué parte de la partida hay que jugar para que cuente (**No cuenta**, **Proporcional**, **Completo**) |
| Mixes anteriores a la Temporada 2 | **Tope por rendimiento** y **Bonus por punto de rating** | La fórmula vieja. Solo se usan si se recalculan mixes de la BETA |

- La **vista previa** te muestra cuánto ganaría y perdería el que más se mueve de su equipo: partido normal, bueno, muy bueno (1,80) y malo con equipos parejos, y con su equipo favorito o no por 200 de ELO, antes y después del cambio.
- **No recalculan el historial:** valen para los mixes que terminen desde que guardas. Para corregir a jugadores puntuales, usa los ajustes manuales.
- Con el mínimo, el abandono con el equipo ganador nunca pierde menos que ese valor, aunque en Matchmaking figure un mínimo más bajo.

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
  - Si el mix estaba por terminar (por ejemplo, 15-8 en la última foto), puede que haya terminado y que el resultado no haya llegado todavía: el servidor lo guarda y lo reintenta solo. Antes de cerrarlo, pide que miren el servidor. Al cerrarlo, el resultado real ya no entra, porque la web lo toma como ya recibido.

## Demos

La pestaña **Demos** muestra el estado de la demo de cada partida: **Pendiente**, **Subida**, **Perdida** o **Vencida** (pasados 90 días, o antes si el espacio de las demos pasó de 10 GB: se borran las más viejas hasta bajar a 9,5 GB).

- Cuando una demo se puede volver a buscar, su fila tiene **Reintentar**: el Worker la busca en los próximos 10 minutos.
- Arriba está el Worker de demos: si está en línea y cuándo se vio por última vez. Desde ahí lo revocas, lo reactivas o le generas un token nuevo (hay que cargarlo en Cloudflare con el comando que te da la web).

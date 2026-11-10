---
titulo: Configurar el matchmaking
resumen: Abrir y cerrar la cola, los modos, quién puede jugar, los grupos, los tiempos, la ventana de ELO, los reemplazos, las sanciones, los mapas, las contraseñas y las salas.
orden: 3
---

El matchmaking se configura en Administración › [Matchmaking](/admin/matchmaking).

> **Ojo:** los tiempos, el tamaño del grupo y la escalera de sanciones que cambies acá se ven al instante en la ayuda de los jugadores: el manual lee los valores de la configuración.

## General

| Sección | Qué cambias |
|---|---|
| **Cola** | Abierta o cerrada. Cerrarla impide entrar, sin cancelar las salas armadas. También qué modos están habilitados y cuáles dan ELO |
| **Quién puede jugar** | Mixes mínimos jugados y días de cuenta mínimos. En 0 no se exige |
| **Bloqueo de compañeros** | Cuántos jugadores puede bloquear cada cuenta para que no le toquen en su equipo (en contra sí). En 0 está apagado. **Margen de ELO de armado**: si respetar los bloqueos empeora la diferencia entre los equipos más que esto (en total), se ignoran los menos posibles (los más recientes primero) y se le avisa al que bloqueó; un grupo nunca se separa. **Cambios por semana**: cuántas veces puede bloquear a alguien nuevo en 7 días (0: sin límite) |
| **Grupos** | Tamaño máximo (1 = sin grupos; 2 = dúo) y la diferencia de ELO máxima dentro del grupo. Al bajar el máximo, los grupos más grandes se desarman al guardar: los que estaban buscando salen de la cola, y a todos les llega un aviso. Los que están en una sala siguen hasta que la sala termina, y ahí se desarman. Las invitaciones que ya no se pueden aceptar se vencen |
| **Tiempos** | Para aceptar, por turno del veto, para conectarse, esperando servidor, para volver si se desconecta y el cierre de la cola antes de que termine la temporada |
| **Ventana de ELO** | Con qué diferencia de ELO empieza a emparejar, cuánto se abre y cada cuánto, el tope y después de cuánto tiempo se empareja sin límite |
| **Equipos parejos con el rating** | Encendido, los equipos se reparten con un ELO de armado: el ELO más un ajuste por el rating 5v5 de los últimos días. Se elige cuántos puntos da cada 1,00 de rating, el tope del ajuste, los mapas de corrección (acercan a 1,00 el rating de quien jugó poco) y los días que se miran. Valores de entrada desde el 2026-11-07: 400 puntos, tope de 200 y 3 mapas de corrección (con los mixes jugados, así se predice mejor quién gana que con 200, 100 y 5). El formulario muestra un ejemplo con los valores. Quién entra a la sala, el capitán, el veto y el ELO que se gana o pierde siguen con el ELO. Apagado, todo queda como antes |
| **Ajuste manual del armado** | No está en este panel: se pone solo desde la base, y hay que pedírselo a Daniel. Le suma o le resta a un jugador entre 1 y 300 puntos de ELO de armado, después del ajuste por el rating, con un motivo y un vencimiento (30 días por defecto, 180 como máximo). Sirve para una cuenta nueva de alguien conocido, un smurf o alguien que vuelve después de mucho tiempo. Por defecto nadie tiene ajuste. No cambia su ELO, su rating ni lo que gana o pierde, y el jugador no lo ve. Cada alta, cambio o baja queda en un historial por un año |
| **Reemplazos** | Encendido, cuando alguien abandona una sala en vivo sale un aviso en #avisos (el mismo webhook y rol `@player` que el aviso de la cola) con un link de un solo uso para entrar en su lugar. Se elige cuántos minutos dura el link, con cuántas rondas por jugar ya no se llama, y el voto de `!callreplace`: el porcentaje que hace falta (más de), cuánto dura, cuánto espera un equipo entre dos votos y cuántos segundos tiene que llevar desconectado un jugador para que se pueda pedir su reemplazo (90 por defecto: antes no aparece en el menú). Apagado, el abandono funciona como antes y `!callreplace` no se puede usar |
| **ELO del que abandona** | Cuánto ELO pierde quien abandona, según la parte de la partida que no jugó (irse al principio da el máximo, cerca del final el mínimo). Si su equipo ganó, entre un mínimo y un máximo (hoy, {{mm.abandono_ganado_min}} y {{mm.abandono_ganado_max}}). Si perdió o empató, entre otro mínimo y máximo (hoy, {{mm.abandono_perdido_min}} y {{mm.abandono_perdido_max}}), pero nunca menos que una derrota normal, para que irse no salga más barato que perder. La sanción fuerte es la espera de **Sanciones** |
| **Sanciones** | Los minutos de cada escalón, separados por coma. Se baja un escalón cada 7 días sin faltas |

Guarda con **Guardar cambios**. Aquí también cambias la **imagen del MVP**, el fondo de la tarjeta del mejor jugador de cada partida.

## Mapas y sonidos

- **Mapas:** cuáles entran en el veto del matchmaking y en qué orden.
- **Sonidos:** los avisos que suenan en Jugar (partida encontrada, por ejemplo). Puedes subir, escuchar y borrar.

## Servidores y contraseñas

La pestaña **Servidores** muestra cada servidor del matchmaking, su estado (sala asignada, reservado, mix en vivo, sin conexión) y la **contraseña vigente**. Con el servidor libre puedes **Rotar ahora**: el servidor pone una nueva en unos segundos. El historial dice cada contraseña y quién la puso.

Para que un servidor reciba salas, márcalo con el uso **Matchmaking** (ver [Servidores y sus usos](/help/admin/servidores)).

## Salas

La pestaña **Salas** lista las salas en curso, con su modo, estado, mapa y servidor. Puedes cancelar una sala si quedó trabada.

## Reportes y sanciones

- **Reportes:** ver [Revisar reportes del matchmaking](/help/admin/reportes-matchmaking).
- Las sanciones de la cola y las exclusiones están en Administración › Baneos, pestaña **Matchmaking** (ver [Revisar y levantar sanciones del matchmaking](/help/moderador/sanciones-matchmaking)).

## Métricas

La pestaña **Métricas** resume: salas armadas, jugadas, porcentaje de canceladas y por qué (no aceptaron, no se conectaron, sin servidor, por un admin), abandonos, la espera promedio y la diferencia de ELO entre equipos.

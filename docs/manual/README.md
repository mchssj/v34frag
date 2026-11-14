# Manual de usuario

Cómo se usa CMLeague, por rol y por tarea. La web lo muestra en **Ayuda** (`/help`), solo con sesión, y cada cuenta recibe solo las secciones de su rol: la API filtra antes de mandar (plan [`2026-11-02-manual-usuario`](../bitacora/2026-11-02-manual-usuario/PLAN.md)).

El changelog de Discord cuenta las novedades. El manual cuenta cómo funciona hoy.

## Secciones

| Carpeta | Sección | Quién la ve |
|---|---|---|
| `jugador/` | Jugador | Todas las cuentas |
| `capitan/` | Capitán o líder de equipo | Todas las cuentas (capitán es un rol por equipo) |
| `organizador/` | Organizador de torneo | Organizadores, moderadores y admins |
| `soporte/` | Soporte | Soporte, moderadores y admins (el moderador puede todo lo del soporte) |
| `moderador/` | Moderador | Moderadores y admins |
| `admin/` | Admin | Admins |
| `streamer/` | Streamer | Todas las cuentas |
| `servidor-externo/` | Dueño de un servidor externo | Todas las cuentas |

La regla está en la API (`web/backend/src/lib/manual.ts`). Una página o una captura de otra sección responde como si no existiera.

## Una página

Un archivo por tarea: `docs/manual/<sección>/<tarea>.md`, con la tarea en minúsculas y guiones (`buscar-partida.md`). La dirección en la web es `/help/<sección>/<tarea>`.

```markdown
---
titulo: Buscar partida en el matchmaking
resumen: Solo o en grupo, aceptar, el veto y cómo conectarte al servidor.
orden: 3
---

Texto de la página…
```

| Campo | Obligatorio | Qué es |
|---|---|---|
| `titulo` | Sí | Como una tarea: "Buscar partida", "Iniciar una partida de torneo" |
| `resumen` | Sí | Una línea. Se ve en el índice y en el buscador |
| `orden` | Sí | Número: la posición dentro de la sección |
| `oculta` | No | `true` para escribirla sin mostrarla (por ejemplo, PCW mientras esté en "Pronto"). No la recibe nadie, ni el admin |

## Estilo

- **Por tareas, no por reglas.** "Cómo inicio una partida de torneo", con los pasos en orden. Las reglas van dentro del paso donde importan.
- **Corto.** Si una página pasa de una pantalla y media, probablemente son dos tareas.
- **Tuteo y sin términos técnicos.** Nada de tablas, funciones, rutas de la API, versiones del plugin ni nombres de archivos del servidor. Los comandos del chat del juego (`!claim`, `!pw`) sí, entre backticks.
- **Los nombres, como en la pantalla.** Los botones y secciones se escriben igual que en la web, en negrita: **Buscar partida**, Administración › **Servidores**.
- **Nada sensible.** Ni contraseñas, ni claves, ni datos de jugadores reales. Aunque la API filtre por rol, cualquiera con ese rol lo puede copiar.
- **Avisos:** una cita que empieza con `**Ojo:**` se ve como un aviso.

  ```markdown
  > **Ojo:** si no aceptas a tiempo, pierdes el lugar en la cola.
  ```

## Links

- **A otra página del manual:** `[Vincular tu SteamID](/help/jugador/vincular-steamid)`. El build de la API falla si la página no existe, si está oculta o si la ve menos gente que la página que la enlaza.
- **A una pantalla de la web:** la ruta tal cual, `[Jugar](/play)`.
- **Afuera:** la URL completa.

## Valores de la configuración

Un número que un admin cambia desde la web (los segundos para aceptar, el tamaño del grupo, la escalera de sanciones) no se escribe a mano: va un **marcador**, y la API lo reemplaza por el valor vigente de la base al servir la página (plan [`2026-11-03-manual-valores-reales`](../bitacora/2026-11-03-manual-valores-reales/PLAN.md)).

```markdown
Tienes **{{mm.aceptar}}** para tocar **Aceptar**.
```

Se lee "Tienes **20 segundos** para tocar **Aceptar**." El marcador ya trae la unidad, con el singular y el plural bien.

| Marcador | Qué es | Se ve como |
|---|---|---|
| `{{mm.grupo_max}}` | Personas por grupo del matchmaking | 2 |
| `{{mm.grupo_dif_elo}}` | Diferencia de ELO máxima dentro del grupo | 500 |
| `{{mm.aceptar}}` | Tiempo para aceptar la partida | 20 segundos |
| `{{mm.veto}}` | Tiempo por turno del veto | 15 segundos |
| `{{mm.conectar}}` | Tiempo para conectarse al servidor | 5 minutos |
| `{{mm.espera_servidor}}` | Espera de un servidor libre | 3 minutos |
| `{{mm.volver}}` | Tiempo para volver después de desconectarse | 3 minutos |
| `{{mm.sanciones}}` | La escalera de sanciones completa | 5 minutos, 15 minutos, 1 hora y 24 horas |
| `{{mm.sancion_min}}`, `{{mm.sancion_max}}` | El primer y el último escalón | 5 minutos, 24 horas |
| `{{equipo.max_miembros}}` | Integrantes de un equipo | 10 |
| `{{equipo.capitan_max}}` | Equipos que puede capitanear una persona | 1 equipo |
| `{{clips.por_partida}}`, `{{clips.por_jugador}}` | Jugadas destacadas por partida y por jugador | 10, 2 |
| `{{elo.min_pct}}`, `{{elo.full_pct}}` | Parte de la partida desde la que el ELO cuenta en parte y completo | 35 %, 90 % |
| `{{claim.max_steam_ids}}` | Cuentas de Steam por perfil | 3 |

- Solo en el texto: en `titulo` y `resumen` el build lo rechaza (el índice no lee la base).
- Un marcador que no está en la lista hace fallar el build.
- Para sumar uno: la clave en `manual_valores()` (un replanteo) y la entrada en `MARCADORES` (`web/backend/src/lib/manual.ts`).
- Lo que no se configura desde la web (los 7 días de una invitación, los 90 días de una demo, las pausas del servidor) se escribe a mano.

## Capturas

- En `docs/manual/<sección>/img/`, en `.webp`, de 1280 px de ancho como máximo. Cada sección tiene sus capturas: el filtro por rol también las alcanza.
- En la página: `![Botón Buscar partida](img/buscar-partida.webp)`. El texto alternativo describe lo que se ve.
- Se sacan en **staging** con las cuentas de prueba (`daniloev`, `kyan` y, para Administración, `adminprueba`; credenciales en el `.env`, `STAGING_TEST_*`). Nunca con datos de jugadores reales a la vista.

## Cómo se mantiene

Cada `DOCUMENTACION.md` de la bitácora tiene la sección **Qué cambia para cada rol**, con la página del manual que corresponde. Al terminar el requerimiento, esas páginas se crean o se actualizan en el mismo commit que la web (ver [`docs/bitacora/PLANTILLA.md`](../bitacora/PLANTILLA.md)).

Antes de escribir una regla, se comprueba en el código o en la base: la bitácora puede haber quedado vieja.

### Comandos del servidor

Todo plugin nuevo, y todo comando nuevo o cambiado de un plugin, documenta su uso acá, en el mismo commit (Daniel, 2026-11-06). Va en la página del rol que lo usa, según el permiso del comando:

| Quién lo usa | Permiso en el servidor | Página |
|---|---|---|
| Cualquier jugador | Ninguno | `jugador/comandos-en-el-servidor.md` (y, si cambia cómo se juega, `jugador/jugar-en-el-servidor.md`); deathmatch, retake y 2v2 en `jugador/otros-modos.md` |
| El capitán del equipo en el juego | Ninguno, pero solo le responde al capitán | `capitan/comandos-en-el-servidor.md` |
| Moderador (grupo `Moderador`) | `b`, `c`, `d`, `f` o `j` | `moderador/comandos-en-el-servidor.md` |
| Admin | Los demás (`g`, `m`, `z`…) o un override que lo pase a uno de ellos | `admin/comandos-en-el-servidor.md` |

Los comandos de depuración (los que solo existen en las builds de prueba) no van. Organizador, soporte, streamer y dueño de un servidor externo no tienen comandos en el juego.

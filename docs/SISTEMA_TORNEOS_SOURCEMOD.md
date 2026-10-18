# Sistema de Torneos para CS:S v34 - Plugin Sourcemod

## Descripción
Guía para implementar un sistema de torneos en el plugin Sourcemod de CS:S v34 que sigue el mismo patrón que el existente sistema de mixes (csstv_reporter.sp). Este documento explica cómo adaptar la arquitectura de los mixes para soportar torneos organizados.

## Arquitectura y Patrones a Seguir

El sistema de torneos debe seguir exactamente los mismos patrones de diseño y implementación que el sistema de mixes actual:

### 1. Estructura de Archivos Similar a csstv_reporter.sp
- Archivo principal: `csstv_torneos.sp` (similar a csstv_reporter.sp)
- Archivos de inclusión en `csstv/` directory:
  - `torneos.inc` - Funciones principales del sistema de torneos
  - `torneos_queue.inc` - Manejo de cola de resultados de torneos
  - `torneos_http.inc` - Envío de datos a Supabase
  - `torneos_json.inc` - Construcción de payloads JSON
  - `torneos_license.inc` - Validación de licencia (reutilizando la existente)
  - `torneos_menu.inc` - Opciones en el menú de admin
  - Posibles archivos adicionales según necesidad: `torneos_bracket.inc`, `torneos_scheduler.inc`, etc.

### 2. Flujo de Funcionamiento (Similar al de los Mixes)

#### Estado del Torneo
```c
enum TorneoState
{
    Estado_Inactivo = 0,      // No hay torneo activo
    Estado_Inscripciones,     // Torneo creado, aceptando inscripciones
    Estado_Fixture_Generado,  // Fixture creado, esperando primer partido
    Estado_En_Curso,          // Partido en progreso
    Estado_Medio_Tiempo,      // Medio tiempo del partido actual
    Estado_Finalizado         // Torneo terminado
};
```

#### Estado de un Partido Individual dentro del Torneo
```c
enum PartidoEstado
{
    Partido_Listo = 0,        // Esperando inicio
    Partido_En_Vivo,          // Partido en progreso
    Partido_Halftime,         // Medio tiempo
    Partido_Finalizado        // Partido terminado
};
```

#### Variables de Estado Global
```c
// Estado general del torneo
TorneoState g_TorneoState = Estado_Inactivo;

// Datos del torneo actual
char g_sTorneoUid[64];        // UID único del torneo
char g_sTorneoNombre[64];     // Nombre del torneo
int  g_iTorneoFormato;        // Formato (eliminación simple, doble, grupos+playoffs, etc.)
int  g_iTorneoBO;             // Mejor de (1,3,5,7)
int  g_iTorneoCupos;          // Número máximo de equipos
int  g_iTorneoPremio;         // Premio (opcional)
char g_sTorneoFechaInicio[32]; // Fecha de inicio
char g_sTorneoReglas[256];    // Reglas del torneo

// Estado del partido actual dentro del torneo
PartidoEstado g_PartidoEstado = Partido_Listo;
int g_iPartidoNumero;         // Número de partido actual en el bracket
char g_sPartidoUid[64];       // UID del partido actual
int g_iPartidoEquipoA, g_iPartidoEquipoB; // IDs de los equipos
int g_iPartidoRondaActual;    // Ronda actual del partido (para BO3, BO5, etc.)
int g_iPartidoScoreA, g_iPartidoScoreB;   // Score del partido
bool g_bPartidoSurrender;     // ¿El partido terminó por surrender?
```

### 3. Comandos Principales (Similares a !live, !ready, etc.)

#### !torneo: Crear y Gestionar Torneo
- `!torneo crear <nombre> <formato> <BO> <cupos> [premio] [fecha] [reglas]`
  - Crea un nuevo torneo y cambia a Estado_Inscripciones
  - Ejemplo: `!torneo crear "Primavera 2026" elim_simple 3 8 5000 "2026-12-01" "BO3, mapa veto estándar"`

- `!torneo inscribir <equipo_o_jugador>`
  - Inscribe un equipo o jugador al torneo actual
  - Solo funciona en Estado_Inscripciones

- `!torneo iniciar`
  - Genera el fixture y cambia a Estado_Fixture_Generado o Estado_En_Curso
  - Valida mínimos según formato
  - Solo funciona en Estado_Inscripciones

- `!torneo listar`
  - Muestra el estado actual del torneo, equipos inscritos, fixture, etc.

- `!torneo cancelar`
  - Cancela el torneo actual y vuelve a Estado_Inactivo
  - Disponible en cualquier estado

- `!torneo resultados`
  - Muestra los resultados de los partidos jugados hasta el momento

#### Durante un Partido (similar a los comandos de mix)
Mientras un partido del torneo está en progreso (Estado_En_Curso o Estado_Medio_Tiempo), funcionan los comandos normales de mix:
- `!ready` / `!unready` - Para marcarse listo para el partido
- `!score` - Para ver el marcador del partido actual
- `!pause` - Para pausa táctica (si está habilitado)
- Otros comandos de calidad de vida (qol.inc)

### 4. Flujo Detallado (Basado en el Flujo de Torneos de FUNCIONALIDADES.md)

#### A. Creación del Torneo
1. Admin escribe: `!torneo crear "Torneo de Octubre" elim_simple 3 16 10000 "2026-10-25" " estándar"`
2. Sistema:
   - Valida parámetros
   - Genera UID único para el torneo
   - Guarda datos del torneo en memoria
   - Cambia estado a Estado_Inscripciones
   - Anuncia en chat: `[CSSTV] Torneo "Torneo de Octubre" creado. Inscripciones abiertas. Escribí !torneo inscribir <nombre> para participar.`

#### B. Fase de Inscripciones
1. Jugadores/Admin escriben: `!torneo inscribir "Mi Equipo"` o `!torneo inscribir [STEAMID:NICK]`
2. Sistema:
   - Verifica que el torneo esté en Estado_Inscripciones
   - Agrega equipo/jugador a la lista de inscritos
   - Anuncia: `[CSSTV] Equipo "Mi Equipo" inscrito. (5/16)`
3. Cuando se alcanza el mínimo de equipos:
   - Sistema notifica: `[CSSTV] Mínimo de equipos alcanzado. Podés iniciar el torneo con !torneo iniciar`

#### C. Generación del Fixture
1. Admin escribe: `!torneo iniciar`
2. Sistema:
   - Verifica que haya suficientes equipos inscritos
   - Genera el bracket/fixture según el formato:
     - Eliminación simple: árbol de eliminación directa
     - Doble eliminación: brackets de ganadores y perdedores
     - Grupos + playoffs: división en grupos + eliminatoria
   - Asigna números de partido y programación inicial
   - Cambia estado a Estado_Fixture_Generado (o directamente a Estado_En_Curso si se quiere comenzar inmediatamente)
   - Anuncia fixture y primeros partidos

#### D. Gestión de Partidos
1. Cuando llega el hora de un partido (o se inicia manualmente):
   - Sistema cambia a Estado_En_Curso para ese partido
   - Anuncia inicio: `[CSSTV] Partido 3/15: Equipo A vs Equipo B - ¡COMIENZA!`
   - Funcionan comandos normales de mix durante el partido
   - Al finalizar el partido:
     - Sistema registra resultado (score, stats, demo, etc.)
     - Avanzar el bracket según resultado
     - Si hay más partidos: preparar siguiente partido
     - Si no hay más partidos: pasar a siguiente fase o finalizar torneo

#### E. Finalización del Torneo
1. Cuando se define al campeón:
   - Sistema cambia estado a Estado_Finalizado
   - Guarda resultado final del torneo
   - Anuncia campeón: `[CSSTV] ¡TORNEO FINALIZADO! Campeón: "Equipo XYZ" (10000 premio)`
   - Envía datos completos del torneo a Supabase (similar a cómo se envían los mixes)
   - Opcional: generar resumen, estadísticas, etc.

### 5. Envío de Datos a Supabase (Similar a los Mixes)

Al finalizar un torneo, el sistema debe:
1. Construir un JSON completo con:
   - Metadatos del torneo (nombre, formato, fecha, premio, reglas)
   - Lista de equipos inscritos
   - Fixture completo con todos los partidos
   - Resultados de cada partido (score, stats, rondas, etc.)
   - Información de campeones y finalistas
   - Estadísticas generales del torneo
2. Guardar el JSON en la cola local (similar a QueueResult en csstv_reporter.sp)
3. Enviar a Supabase via System2 extension o script Python uploader
4. Los datos serán visibles en la sección "Torneos" de la plataforma CSSTV web

### 6. Implementación Paso a Paso

#### Paso 1: Estructura de Archivos
Crear los siguientes archivos:
```
server/addons/sourcemod/scripting/
├── csstv_torneos.sp          # Archivo principal
└── csstv/
    ├── torneos.inc            # Funciones principales
    ├── torneos_queue.inc      # Manejo de cola
    ├── torneos_http.inc       # Envío HTTP
    ├── torneos_json.inc       # Construcción de JSON
    ├── torneos_license.inc    # (opcional, reutilizar license.inc existente)
    ├── torneos_menu.inc       # Menú de admin
    ├── torneos_bracket.inc    # Generación de brackets (según formato)
    └── torneos_scheduler.inc  # Programación de partidos
```

#### Paso 2: Archivo Principal (csstv_torneos.sp)
Siguiendo el patrón de csstv_reporter.sp:
```c
/**
 * CSSTV Torneo Manager
 *
 * Controla torneos en CS:S v34 (inscripciones, fixture, partidos, resultados),
 * gestiona brackets y envía resultados y estadísticas a CSSTV.
 * Reutiliza componentes de calidad de vida y otros módulos existentes.
 *
 * El resultado del torneo se guarda primero en addons/sourcemod/data/csstv/torneos/queue/<uid>.json
 * y después se envía con la extensión System2 en partes de menos de 2 KB.
 */

#pragma semicolon 1
#pragma newdecls required
#pragma dynamic 262144

#include <sourcemod>
#include <sdktools>
#include <system2>
#include <adminmenu>

// Incluir componentes existentes que se pueden reutilizar
#include "csstv/license.inc"     // Licencia (ya existe)
#include "csstv/qol.inc"         // Calidad de vida (ya existe)
#include "csstv/menu.inc"        // Menú de admin (ya existe)
#include "csstv/json.inc"        // Manejo JSON (ya existe)
#include "csstv/queue.inc"       // Manejo de cola (ya existe)
#include "csstv/http.inc"        // HTTP (ya existe)

// Archivos específicos para torneos (crear nuevos)
#include "csstv/torneos.inc"
#include "csstv/torneos_queue.inc"
#include "csstv/torneos_http.inc"
#include "csstv/torneos_json.inc"
#include "csstv/torneos_bracket.inc"
```

#### Paso 3: Estado y Variables Globales
Definir los enums y variables de estado similares a los del mix plugin pero adaptados para torneos.

#### Paso 4: Funciones Principales
Implementar funciones similares a las del mix plugin:
- `Torneo_Iniciar()` - Similar a `StartMatch()`
- `Torneo_Finalizar()` - Similar a `FinishMatch()`
- `Torneo_Cancelar()` - Similar a `CancelMatch()`
- `Torneo_ProcesarPartido()` - Manejo del flujo de partidos
- `Torneo_GenerarFixture()` - Creación del bracket
- `Torneo_EnviarResultado()` - Envío de datos a Supabase
- `Timer_TorneosCheck()` - Verificación de estados y timeouts
- Manejo de eventos de partida (adaptado para partidos de torneo)

#### Paso 5: Comandos de Console
Registrar comandos similares a los del mix plugin:
- `sm_torneo_crear` - Para crear torneos
- `sm_torneo_inscribir` - Para inscribir equipos
- `sm_torneo_iniciar` - Para iniciar fixture
- `sm_torneo_listar` - Para ver estado
- `sm_torneo_cancelar` - Para cancelar torneo
- `sm_torneo_resultados` - Para ver resultados

### 7. Integración con la Plataforma Web CSSTV

Los datos enviados a Supabase deben seguir el esquema esperado por la sección "Torneos" de la web platform. Según FUNCIONALIDADES.md, la sección de torneos muestra:
- Información del torneo (nombre, formato, fechas, reglas)
- Posiciones (si hay fase de grupos)
- Bracket (visualización del árbol de eliminatorias)
- Equipos y sus planteles
- Partidas (resultado de cada mapa)

Por lo tanto, el JSON enviado debe incluir todos estos componentes.

### 8. Consideraciones Importantes

#### A. Reutilización de Componentes Existentes
Donde sea posible, reutilizar código existente:
- `license.inc` - Para validación de licencia del servidor
- `qol.inc` - Para mejoras de calidad de vida durante los partidos
- `menu.inc` - Para opciones en el menú de admin
- `json.inc` y `queue.inc` - Para manejo de datos y cola
- `http.inc` - Para envío HTTP a Supabase

#### B. Diferencias Clave con los Mixes
Mientras que los mixes tratan con:
- Una sola partida
- Estadísticas individuales de jugadores
- Resultado simple (ganador/perdedor)

Los torneos tratan con:
- Múltiples partidas conectadas en un bracket
- Estadísticas por partido y acumulativas
- Estado complejo (inscripciones, fixture, fases)
- Necesidad de tracking de avance del bracket

#### C. Persistencia y Estado
El sistema debe manejar adecuadamente:
- Estado del torneo entre mapas (usando timers con TIMER_FLAG_NO_MAPCHANGE)
- Recuperación ante crashes o reinicios del servidor
- Limpieza adecuada de recursos al finalizar

### 9. Ejemplo de Uso Esperado

Desde el juego (chat de CS:S v34):
```
[Jugador] !torneo crear "Copa de Octubre" elim_simple 3 8 5000 "2026-10-28" " estándar"
[CSSTV] Torneo "Copa de Octubre" creado. Inscripciones abiertas. Escribí !torneo inscribir <nombre> para participar.

[Jugador] !torneo inscribir "Mi Equipo"
[CSSTV] Equipo "Mi Equipo" inscrito. (2/8)

[Admin] !torneo iniciar
[CSSTV] Fixture generado. Partido 1/7: Equipo A vs Equipo B - ¡COMIENZA en 30 segundos!

[Durante el partido]
[Jugador] !ready
[CSSTV] JugadorX está listo (3/5).

[Al finalizar el partido]
[CSSTV] Partido 1/7 terminado: Equipo A 2 - 1 Equipo B. Avanzando al siguiente partido...

[Cuando termina el torneo]
[CSSTV] ¡TORNEO FINALIZADO! Campeón: "Equipo XYZ" (5000 premio). Resultados enviados a CSSTV.
```

### 10. Pruebas y Validación

#### Pruebas Unitarias (Conceptuales)
- Verificar creación de torneo con parámetros válidos/inválidos
- Probar inscripciones y validación de duplicados
- Test generación de fixture para diferentes formatos
- Simular partidos y verificar avance correcto del bracket
- Validar envío correcto de datos JSON a la cola

#### Pruebas de Integración
- Verificar que los comandos de torneo no interfieren con comandos de mix
- Confirmar que se pueden tener mixes normales entre partidos de torneo
- Probar que el sistema se recupera correctamente tras cambio de mapa
- Validar que los datos enviados a Supabase son correctos y completos

### 11. Archivo de Ejemplo: Estructura Básica

Para dar un punto de partida, aquí está cómo podría verse el inicio de `csstv_torneos.sp`:

```c
/**
 * CSSTV Torneo Manager
 * Controla torneos en CS:S v34 y envía resultados a CSSTV
 */

#pragma semicolon 1
#pragma newdecls required
#pragma dynamic 262144

#include <sourcemod>
#include <sdktools>
#include <system2>
#include <adminmenu>

// Componentes reutilizables existentes
#include "csstv/license.inc"
#include "csstv/qol.inc"
#include "csstv/menu.inc"
#include "csstv/json.inc"
#include "csstv/queue.inc"
#include "csstv/http.inc"

// Nuevos componentes para torneos
#include "csstv/torneos.inc"
#include "csstv/torneos_queue.inc"
#include "csstv/torneos_http.inc"
#include "csstv/torneos_json.inc"
#include "csstv/torneos_bracket.inc"

// Definición del plugin
public Plugin myinfo =
{
    name = "CSSTV Torneo Manager",
    author = "CSSTV",
    description = "Controla torneos y envía resultados a CSSTV",
    version = "1.0.0",
    url = ""
};

// [El resto sigue el patrón de csstv_reporter.sp con adaptaciones para torneos]
```

## Conclusión

Este documento proporciona una guía completa para implementar un sistema de torneos en el plugin Sourcemod de CS:S v34 que sigue el mismo patrón de diseño, implementación y arquitectura que el existente sistema de mixes. Al seguir estas directrices:

1. **Se aprovecha el código existente** donde es posible (license, qol, menu, json, queue, http)
2. **Se mantiene consistencia** con la arquitectura actual del proyecto
3. **Se proporciona una experiencia familiar** para administradores y usuarios acostumbrados al sistema de mixes
4. **Se asegura la compatibilidad** con la plataforma web CSSTV
5. **Se permite una implementación modular y escalable**

El resultado será un sistema de torneos robusto que permite crear, gestionar y finalizar torneos completos directamente desde el servidor de juego, con los resultados estando disponibles en la plataforma CSSTV de la misma manera que lo están los resultados de los mixes actuales.

---
*Documento diseñado para guiar la implementación de un sistema de torneos en el plugin Sourcemod de CS:S v34 siguiendo los patrones establecidos por el sistema de mixes existente.*
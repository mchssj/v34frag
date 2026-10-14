# Plantilla de documentación por requerimiento

Este archivo describe cómo se documenta cada requerimiento. También sirve como enunciado para pedirle a otra IA (ChatGPT, etc.) que genere los `.md`: se copia completo y se llena la sección final, **Lo que te voy a pasar**.

---

Vas a documentar un requerimiento del proyecto v34frag (web + servidor de Counter-Strike: Source + Supabase + Cloudflare). Sigue al pie de la letra este formato.

## Estructura de carpetas

Cada requerimiento tiene su propia carpeta dentro de `docs/bitacora/`, nombrada con la fecha en que se planeó y un nombre corto en kebab-case:

```
docs/bitacora/
├── README.md                          ← índice general (se le agrega una fila)
├── PLANTILLA.md                       ← este archivo
└── AAAA-MM-DD-nombre-corto/           ← ej: 2026-10-12-demos-r2-worker
    ├── PLAN.md                        ← obligatorio
    ├── DOCUMENTACION.md               ← obligatorio al terminar
    ├── GUIA_IMPLEMENTACION.md         ← obligatorio al terminar
    └── pruebas/                       ← opcional: scripts usados (.sql, .sh, .py, .sp)
```

## Reglas generales

- Todo en español, con un lenguaje claro y directo. Párrafos cortos, tablas cuando haya varias opciones o campos, y bloques de código con el lenguaje indicado.
- Los nombres de archivos, tablas, columnas, funciones, comandos y variables van entre `backticks`.
- Usa diagramas Mermaid (` ```mermaid `) fáciles de entender: `sequenceDiagram` para flujos entre sistemas, `flowchart` para decisiones y `stateDiagram-v2` para estados. Etiquetas cortas y en español.
- Las fechas van en formato AAAA-MM-DD.
- No inventes datos: si algo no se hizo o no se probó, dilo explícitamente.

## PLAN.md: la planeación original

Se escribe ANTES de implementar y después NO se edita (los cambios se anotan en la guía).

```
# Plan: <nombre del requerimiento>

> Planeación original. Estado: **propuesta**, pendiente de aprobación.

## Decisiones tomadas
(tabla | Tema | Decisión | con cada decisión importante y su porqué)

## 1. El flujo completo
(diagrama Mermaid + explicación breve)

## 2..N. Una sección por cada parte del cambio
(ej: cambios en la base de datos, en el plugin, en la web, en el Worker…)

## N+1. Requisitos antes de empezar
(credenciales, accesos, cuentas, etc.)

## N+2. Orden de implementación
(lista numerada de pasos)
```

## DOCUMENTACION.md: cómo funciona lo construido

Describe el resultado final (no el proceso). Debe servirle a alguien que no participó.

```
# <Nombre del requerimiento>: documentación

## Qué hace
(resumen en 2-4 párrafos + diagrama Mermaid del flujo)

## <Una sección por concepto o regla>
(reglas de negocio, estados con su diagrama, datos/tablas/columnas,
 funciones de Supabase, componentes, comandos del servidor, pantallas)

## Dónde está cada cosa
(tabla | Qué | Archivo / ubicación |)
```

## GUIA_IMPLEMENTACION.md: cómo se implementó

```
# <Nombre del requerimiento>: guía de implementación

## Estado
(una línea: desplegado / probado con bots / pendiente de X, con fecha)

## Archivos
(tabla | Archivo | Cambio | con cada archivo creado o modificado)

## Despliegue (hecho el AAAA-MM-DD)
(pasos exactos y comandos, en orden: migraciones, plugin, web, Worker…)

## Pruebas
### <Componente> (dónde y cómo se probó; referencia a pruebas/ si aplica)
(qué se probó y con qué resultado)

## En qué se apartó del plan
(lista de diferencias con el PLAN.md y el porqué de cada una; "Ninguno" si no hubo)

## Incidentes durante las pruebas
(opcional: problemas encontrados y cómo se resolvieron)

## Cómo revertir
(pasos concretos para deshacer el cambio: SQL, versión anterior del plugin, revert del commit…)
```

## README.md (índice)

Agrega una fila al final de la tabla "Requerimientos" de `docs/bitacora/README.md`:

```
| AAAA-MM-DD | [Nombre del requerimiento](AAAA-MM-DD-nombre-corto/) | Estado |
```

El estado es una frase corta, por ejemplo: "Planeado, pendiente de aprobación", "Probado con bots" o "Desplegado (AAAA-MM-DD)". Actualízalo cuando el requerimiento avance.

## Lo que te voy a pasar

<describe aquí el requerimiento, las decisiones, los archivos cambiados, etc.>

Genera el contenido completo de cada .md, cada uno en su propio bloque de código y con su ruta como título.

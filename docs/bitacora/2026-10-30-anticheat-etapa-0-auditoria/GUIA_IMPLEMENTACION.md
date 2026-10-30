# Anticheat v34FRAGNATION, etapa 0: guía

## Estado

Auditoría entregada para revisión el 2026-10-30. Solo documentación: no se implementó el agente, no se corrieron migraciones y no se desplegó nada.

## Archivos

| Archivo | Cambio |
|---|---|
| `docs/bitacora/2026-10-30-anticheat-etapa-0-auditoria/DOCUMENTACION.md` | Informe de auditoría |
| `docs/bitacora/2026-10-30-anticheat-etapa-0-auditoria/PLAN.md` | Propuesta de etapas y archivos |
| `docs/bitacora/2026-10-30-anticheat-etapa-0-auditoria/GUIA_IMPLEMENTACION.md` | Esta guía |
| `docs/bitacora/README.md`, `docs/PENDIENTES.md` | Fila y punto nuevos |

## Despliegue

No aplica. Nada llegó al servidor real, a RBK ni a Supabase.

## Pruebas

Solo lectura de ramas, de la instalación local y de documentación pública. El método está en el encabezado de `DOCUMENTACION.md`. **No se ejecutó ninguna prueba funcional**: ninguna captura, ningún plugin compilado, ninguna consulta a producción.

## Decisiones que esperan respuesta

Hay que responderlas antes de empezar la etapa 0b o la 1.

| # | Pregunta | Quién | Recomendación |
|---|---|---|---|
| 1 | ¿Se sigue con el agente, sabiendo que ClientMod ya trae EAC? | Respondida por Kyan el 2026-10-30 | Sí, e independiente de EAC. La captura ya se probó en pantalla completa |
| 2 | ¿La API se construye sobre `web/backend` y espera al corte, o va antes con RPC directas? | Daniel | Sobre `web/backend` |
| 3 | ¿Qué pasa con quien juega sin el agente en la v1? | Kyan y Daniel | Mostrarlo en el panel y en el mix, sin sancionar |
| 4 | ¿Quién responde legalmente y qué retención se usa? | Kyan y Daniel | Consultar a un abogado antes de la etapa 3; 30 días como punto de partida a revisar |
| 5 | ¿El Bridge y el agente van también a RBK? | Kyan y Daniel | No en la beta, como excepción escrita; sumarlo cuando RBK acepte por escrito |
| 6 | ¿Quién hace cada parte? Daniel lleva backend y plugins, y Esteban el frontend | Kyan y Daniel | Kyan lleva la prueba de captura y el agente; acordar el resto con ellos |
| 7 | ¿Qué hacer con `origin/feat/anticheat-etapa-0`? | mchssj y Kyan | Dejarla sin merge y reutilizar la checklist |

## En qué se apartó del plan

- **Rama:** el brief pedía partir de `main` con rama propia. Se usó `kyan/pruebas`, porque `CLAUDE.md` solo permite commitear en las ramas de Kyan.
- **Documentación:** se usó la plantilla del proyecto en vez de `README.md`.
- **Supabase:** se auditó el volcado del repo y no la base real.
- **ClientMod:** no se pudo leer el repositorio de la API.

## Cómo revertir

Hacer `git revert` del commit de esta bitácora.

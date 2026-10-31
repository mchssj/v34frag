# Vinculación y panel del anticheat: guía de implementación

## Estado

Probado en el navegador contra la API local el 2026-10-30, con datos inventados. Nada desplegado.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/routes/_app/anticheat.vincular.tsx`, `admin.anticheat.tsx` | Nuevos |
| `web/frontend/src/features/anticheat/`, `features/admin/anticheat/` | Nuevos |
| `web/frontend/src/auth/permissions.ts`, `features/shell/nav.ts` | Sección Anticheat, solo admin |
| `web/frontend/src/routeTree.gen.ts` | Generado |

## Despliegue

Necesita mezclar `kyan/anticheat-backend`. Después, correr `pnpm gen:api` y pasar `queries.ts` al cliente tipado.

## Pruebas

| Qué | Resultado |
|---|---|
| `tsc -b`, `eslint` de los archivos nuevos, 378 pruebas | Pasan |
| Panel, evidencia con procesos de ejemplo y página de vinculación, en el navegador | Sin errores en consola |

**Sin probar en el navegador:** ver una captura, pedirla, abrir los mixes y aprobar un código real. Las rutas sí están probadas en el backend. No hay pruebas de componentes nuevas.

**A revisar:** un jugador nuevo puede pasar por la bienvenida (`/welcome`) al iniciar sesión, y no se comprobó que vuelva al código.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Hacer `git revert` del commit.

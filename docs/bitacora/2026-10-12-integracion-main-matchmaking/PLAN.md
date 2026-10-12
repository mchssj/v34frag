# Plan: integrar los cambios de `main` en matchmaking 5v5

> Fecha: 2026-10-12. Estado: **integrado en `feat/matchmaking-5v5` mediante el PR #7**.

## Objetivo

Incorporar el trabajo reciente de `main` relacionado con la subida automática de demos, Cloudflare R2, partidas canceladas y su documentación, sin perder la interfaz y las funciones de matchmaking desarrolladas en `feat/matchmaking-5v5`.

## Alcance

- Añadir `cloudflare/demo-worker/` y sus dependencias.
- Añadir las migraciones de demos/cancelaciones y motivo de abandono.
- Incorporar los scripts de pruebas y la documentación relacionada.
- Actualizar la documentación de servidor, modelo de datos y bitácora.
- Incorporar las versiones de `main` de `csstv_reporter.sp`, `json.inc` y `qol.inc`.
- Conservar el `index.html` de la rama de matchmaking.

## Criterios de aceptación

- Los cambios se integran en `feat/matchmaking-5v5` sin reemplazar su interfaz de matchmaking.
- La integración queda registrada en un PR y en esta bitácora.
- Se documentan las validaciones pendientes antes de desplegar el código integrado.

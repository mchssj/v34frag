# Avisar que el email ya tiene cuenta al registrarse: guía de implementación

## Estado

- **Commiteado el 2026-11-04 en `main`:** la API y sus pruebas (`test/unit/auth-routes.test.ts`: 48 pasan; `tsc --noEmit` sin errores).
- **Sin desplegar:** falta la API del VPS. La web no cambia.
- No toca la base, el plugin ni los servidores.

## Pasos que faltan

1. ~~Commitear~~ (hecho en `main`).
2. Desplegar la API en el VPS **sin un mix en curso** (el 2026-11-04 se dejó para después por eso), igual que la última vez (API desplegada desde la rama, ver [`2026-11-04-rama-igual-a-produccion`](../2026-11-04-rama-igual-a-produccion/)).
3. Probar en producción: registrarse con un email que ya tiene una cuenta confirmada tiene que mostrar "Ya hay una cuenta con ese email." en el campo del email, y no mandar ningún correo.

## Cambios respecto al plan

Ninguno.

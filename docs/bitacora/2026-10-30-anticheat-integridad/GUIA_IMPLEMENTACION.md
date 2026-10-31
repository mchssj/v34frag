# Integridad y retención del anticheat: guía de implementación

## Estado

Implementado y probado en local el 2026-10-30. Nada desplegado.

## Despliegue (pendiente, con el corte)

1. `41_anticheat_integridad.sql`, después de la `40`.
2. Cron diario en el VPS: `pnpm anticheat:tick`, con `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`.

## Pruebas

| Qué | Resultado |
|---|---|
| Ejecutable real: la sesión completa da `verified` | Pasa |
| Alterar una fila de procesos, un archivo y una entrada | Detectado; queda registrado |
| Firma falsa, y otra clave para el mismo equipo | Rechazadas |
| Retención: borra lo vencido, respeta lo abierto y lo conservado; `anon` no puede llamarla | Pasa |
| Inversa `41` y volver a aplicar | Pasa |
| Instalar y desinstalar la 0.3.0 | Pasa, sin dejar rastro |
| Bridge en `cssds`: carga, `sm_ac_status`, `cml_ac_mix`, `sm_ac_open` por RCON | Pasa. **Sin jugador real no se probó expulsar.** Se retiró después |

**Sin probar:** el cron en un VPS y la expulsión con un jugador real.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Antes del corte, no aplicar la `41`. Después, correr su inversa. La aplicación sigue enviando las cabeceras y la API las ignoraría solo al revertir también el código: revertir los dos juntos con `git revert`.

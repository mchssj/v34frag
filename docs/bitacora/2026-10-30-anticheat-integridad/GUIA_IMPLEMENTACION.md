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
| Bridge en `cssds`, con Kyan conectado y la base local | Sin SteamID y sin aplicación: expulsa unos 15 a 20 s después de empezar el mix. Con la aplicación abierta: sigue jugando. Aplicación cerrada en partida: expulsa unos 2 min 15 s después del último latido. El SteamID se simuló con `BRIDGE_DEBUG=`, porque un servidor LAN no da uno. Se retiró después |

**Sin probar:** el cron en un VPS y el Bridge con un SteamID real, en un servidor con validación.

## En qué se apartó del plan

Ninguno.

## Incidentes durante las pruebas

- El Bridge saltaba la comprobación si el jugador no tenía SteamID válido, y nunca lo expulsaba. Corregido: en un mix cuenta como no verificado.
- Con `sv_lan 0`, `cssds` rechaza a ClientMod por validación de Steam. Por eso la prueba usó la compilación de depuración.

## Cómo revertir

Antes del corte, no aplicar la `41`. Después, correr su inversa. La aplicación sigue enviando las cabeceras y la API las ignoraría solo al revertir también el código: revertir los dos juntos con `git revert`.

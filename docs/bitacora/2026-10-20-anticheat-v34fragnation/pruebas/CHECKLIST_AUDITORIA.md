# Checklist de auditoría — anticheat v34FRAGNATION

Fecha de preparación: 2026-10-20  
Entorno declarado: CS:S v34 / Linux / SourceMod 1.10.x / ClientMod  
Estado: **pendiente de ejecución en el servidor real**. No pegar tokens, claves ni contraseñas en este archivo.

## A. Motor y servidor

- [ ] Registrar distribución y versión de Linux: `uname -a`, `cat /etc/os-release`.
- [ ] Confirmar build de CS:S v34 y ruta real del servidor.
- [ ] Ejecutar `version` y `status` desde la consola del juego.
- [ ] Ejecutar `meta version` y guardar versión de Metamod:Source.
- [ ] Ejecutar `sm version` y guardar versión/build completa de SourceMod.
- [ ] Ejecutar `sm plugins list`; identificar plugins con `Error`, `Bad Load` o duplicados.
- [ ] Confirmar versión de ClientMod y cualquier extensión requerida.
- [ ] Registrar arquitectura del servidor (x86/x64) y disponibilidad de símbolos/herramientas de diagnóstico.
- [ ] Confirmar que hay servidor de pruebas y ventana de reinicio autorizada.

## B. Compilación SourcePawn

- [ ] Confirmar versión de `spcomp` y directorio `include/`.
- [ ] Compilar `server/addons/sourcemod/scripting/v34frag_anticheat.sp` con el compilador de SourceMod 1.10.x.
- [ ] Guardar salida de compilación completa; resolver todos los errores y revisar warnings.
- [ ] No copiar el plugin a producción antes de pasar pruebas en servidor aislado.

Comando de referencia desde la carpeta `scripting` cuando el compilador es nativo Linux:

```bash
./spcomp v34frag_anticheat.sp -o v34frag_anticheat.smx
```

Si solo hay un compilador Windows, compilar con la distribución 1.10.x correspondiente y luego transferir el `.smx` a Linux. No mezclar includes de distintas versiones.

## C. Eventos disponibles en CS:S v34

- [ ] Confirmar que `weapon_fire` se engancha.
- [ ] Confirmar que `player_hurt` se engancha y sus claves contienen datos válidos.
- [ ] Confirmar que `player_death` se engancha y si existen las claves `headshot` y `weapon`.
- [ ] Confirmar `round_start` y `round_end`.
- [ ] Si un evento no está disponible, comprobar que el plugin sigue cargando y lo informa en el log.
- [ ] Verificar que los eventos no generan duplicados evidentes por disparo o impacto.
- [ ] Probar jugadores humanos y bots; los bots deben poder excluirse de telemetría de jugadores reales.

## D. Sistema de archivos y operación Linux

- [ ] Confirmar permisos de escritura del usuario del servidor en `addons/sourcemod/logs/`.
- [ ] Confirmar espacio disponible, propiedad y permisos del directorio.
- [ ] Cargar el plugin solo en pruebas y ejecutar `sm_ac_status`.
- [ ] Ejecutar `sm_ac_testlog` y verificar la creación de `v34frag_anticheat.log` en los logs de SourceMod.
- [ ] Verificar eventos de conexión, disparo, daño, muerte y ronda.
- [ ] Reiniciar el servidor de pruebas y confirmar que el log vuelve a escribirse.
- [ ] Confirmar que el plugin no modifica movimiento, armas, daño, rondas, equipo ni acceso al servidor.
- [ ] Confirmar que no existen comandos de kick/ban ni sanciones automáticas.

## E. Supabase y seguridad (sin aplicar cambios en producción)

- [ ] Identificar el proyecto de pruebas y el proyecto de producción; anotar solo referencias no secretas.
- [ ] Revisar migraciones existentes y esquema actual antes de diseñar nuevas tablas.
- [ ] Definir credencial individual por servidor/agente, con revocación y rotación.
- [ ] Confirmar que ninguna clave `service_role`/secret se incorpora a SourcePawn, cliente o JavaScript público.
- [ ] Exigir validación de autenticación, tamaño, esquema y límites de frecuencia en la ingesta.
- [ ] Definir identificador de evento único y comportamiento idempotente ante reintentos.
- [ ] Habilitar RLS y permisos mínimos en tablas expuestas.
- [ ] Probar lectura/escritura permitida y denegada con roles reales.
- [ ] Simular Supabase fuera de servicio y verificar que la partida y el log local siguen funcionando.
- [ ] No ejecutar migración ni despliegue de Edge Function en producción durante la etapa 0.

## F. ClientMod y cliente anticheat

- [ ] Identificar versión exacta de ClientMod y documentación/API pública disponible.
- [ ] Confirmar compatibilidad con el cliente CS:S v34 usado por la plataforma.
- [ ] No asumir que el cliente reporta datos confiables ni usar su falta como prueba de cheat.
- [ ] No instalar driver de kernel ni realizar escaneo invasivo en la primera versión.
- [ ] Documentar consentimiento, datos recogidos, almacenamiento y retención antes de distribuir un agente.

## G. Evidencia de cierre de auditoría

Adjuntar en el ticket/bitácora, no en el repositorio público si contiene datos sensibles:

- [ ] Salidas de versiones sin IPs, tokens ni datos privados.
- [ ] Log de compilación.
- [ ] Log de carga y prueba del plugin.
- [ ] Lista de eventos disponibles y ausentes.
- [ ] Resultado de pruebas de reinicio, permisos y fallo de red.
- [ ] Confirmación de que no se aplicaron cambios en producción.
- [ ] Lista de incompatibilidades y decisión de continuar/detenerse.

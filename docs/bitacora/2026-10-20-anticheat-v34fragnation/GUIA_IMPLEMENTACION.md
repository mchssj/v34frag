# Anticheat v34FRAGNATION: guía de implementación

## Estado

**Etapa 0 documentada; implementación y pruebas en servidor pendientes (2026-10-20).** No se ha desplegado ningún cambio a servidores competitivos ni aplicado una migración de Supabase.

## Archivos

| Archivo | Cambio |
|---|---|
| `docs/bitacora/2026-10-20-anticheat-v34fragnation/PLAN.md` | Checklist, arquitectura, criterios de aceptación y orden de trabajo |
| `docs/bitacora/2026-10-20-anticheat-v34fragnation/DOCUMENTACION.md` | Estado, módulos previstos, seguridad y ubicaciones |
| `docs/bitacora/2026-10-20-anticheat-v34fragnation/GUIA_IMPLEMENTACION.md` | Esta guía |
| `server/addons/sourcemod/scripting/v34frag_anticheat.sp` | Prototipo de observación; verificar compilación antes de cargar |

## Auditoría pendiente

Ejecutar desde consola del servidor:

```text
sm version
sm plugins list
meta version
status
version
```

Guardar la salida en un archivo de auditoría, eliminando IPs, tokens y otros secretos antes de compartirla. Confirmar además la versión/build del motor, arquitectura, rutas y permisos de logs. Si un comando no está disponible, registrar literalmente el resultado.

En el equipo de compilación, confirmar que `spcomp` y sus includes son de SourceMod 1.10.x. No usar una compilación previa como prueba de compatibilidad.

## Compilación del prototipo

Desde la carpeta de scripting del SourceMod 1.10.x, usando el compilador correspondiente:

```bash
./spcomp v34frag_anticheat.sp -o v34frag_anticheat.smx
```

El comando depende de la plataforma del compilador instalado. Si el compilador disponible es Windows, compilar allí con el `spcomp.exe` de la misma distribución y copiar el resultado al servidor Linux.

Antes de cargar:
1. Confirmar que no haya errores ni warnings relevantes.
2. Copiar el `.smx` a una carpeta de staging.
3. Cargar solo en servidor de pruebas.
4. Revisar `addons/sourcemod/logs/` y la consola.
5. Probar conexión/desconexión, disparos y cambio de ronda.
6. Confirmar que el plugin no altera movimiento, daño, rondas ni sanciones.

## Supabase

No aplicar DDL a producción durante la etapa 0. Primero inspeccionar migraciones y políticas existentes. La migración propuesta deberá revisarse en una base de pruebas y verificarse con consultas de prueba para accesos permitidos y denegados.

La Edge Function de ingesta no debe aceptar peticiones anónimas sin una validación propia. No colocar `service_role`, claves secretas ni tokens duraderos dentro de SourcePawn, JavaScript del navegador o el ejecutable cliente.

## Pruebas de aceptación

- [ ] Compilación con SourceMod 1.10.x verificada.
- [ ] Carga sin errores en CS:S v34 de pruebas.
- [ ] Eventos no disponibles se omiten sin impedir el inicio del plugin.
- [ ] Logs locales creados y legibles por el usuario del servidor.
- [ ] Reinicio del servidor no corrompe el log.
- [ ] El fallo de red no afecta la partida.
- [ ] Ningún comando de ban/kick ni sanción automática.
- [ ] Migración y RLS probadas en base aislada antes de producción.
- [ ] Ingesta rechaza credenciales inválidas y eventos malformados.
- [ ] Eventos repetidos no se duplican al reintentar.
- [ ] Solo administradores autorizados pueden ver expedientes y evidencias.

## En qué se apartó del plan

La implementación completa del cliente, detectores avanzados, migración y panel queda pendiente. No es seguro afirmar compatibilidad de ClientMod ni disponibilidad de eventos del motor sin ejecutar pruebas sobre la instalación exacta.

## Cómo revertir

Durante esta etapa, retirar el prototipo del servidor de pruebas con:

```text
sm plugins unload v34frag_anticheat.smx
```

Luego quitar el archivo `.smx` de la carpeta de plugins. No se requiere revertir base de datos porque no se aplicó ninguna migración. Para revertir los archivos de documentación, revertir el commit de la rama de trabajo; no modificar `main` hasta aprobar y revisar el cambio.

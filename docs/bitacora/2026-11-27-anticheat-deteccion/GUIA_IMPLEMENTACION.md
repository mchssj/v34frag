# Anticheat: detección, robustez, panel, ban por máquina y aim: guía de implementación

## Estado

Implementado en la rama `kyan/ac` (commit `d4f998ed`, 2026-11-27): agente 0.5.0, replanteos `156` a `158`, API, panel, Bridge 1.2.0 y `cml_aimstats` 1.0.0. **Nada desplegado.**

- **Sin probar** con el juego abierto.
- **Sin aplicar** contra una base.
- **Sin compilar** el Bridge ni `cml_aimstats`.

Kyan dejó esas pruebas (el "0"), y la mezcla en `main` con la revisión legal (el "5"), para el final.

## Antes de usarlo con jugadores

| Falta | Por qué |
|---|---|
| Probar con ClientMod abierto | Ver si el agente encuentra `CMLauncher.exe`, si el EAC deja listar los módulos y duplicar los handles, y si la captura toma todo el monitor |
| Aplicar `155` a `158` en una base local y probarlas, con sus inversas | Ningún SQL se corrió: no había Postgres ni Docker. Docker ya está instalado en la PC de Kyan |
| Compilar el Bridge 1.2.0 y `cml_aimstats` | Hace falta `spcomp` 1.8 (en el servidor de pruebas de Daniel) |
| Certificado de firma de código | Lo tiene que comprar el equipo. Sin él, SmartScreen y los antivirus advierten |
| `/privacidad`, `/terminos` y la revisión legal | Ver "Términos y privacidad" en la [documentación](DOCUMENTACION.md) |
| Hashes `good` de ClientMod | Sin ellos, `game_file_unknown` no marca nada |
| Manual del jugador | Solo los códigos y qué hacer, sin decir qué se detecta |

## Archivos

| Archivo | Cambio |
|---|---|
| `agent/src/detect.cpp` | **Nuevo.** Handles, overlays, drivers, archivos del juego, puertos e identificadores de la máquina |
| `agent/src/obf.h` | **Nuevo.** `OBF()`: cadenas cifradas con XOR en tiempo de compilación |
| `agent/src/core.h` | Versión 0.5.0, `AgentConfig`, `DetectItem`, `HttpGet`, `FileSha256`, `TextSha256`, `SignText`, `EvidenceEnsureKey` |
| `agent/src/evidence.cpp` | Configuración remota, la clave apenas se vincula, los eventos nuevos con `detail`, `QueueFindings`, capturas de todo el monitor a 1280 px y calidad 60 |
| `agent/src/main.cpp` | Latido firmado (`SignedHeaders`) con `game`, `ports`, `agent_sha` y `hw`; `ApplyConfig`; `TryUpdate`; `hw` en la vinculación y `AC-5`; `--detect` |
| `agent/src/net.cpp`, `agent/src/ui.cpp` | `HttpGet` y la ventana ([`2026-11-27-anticheat-ventana-nueva`](../2026-11-27-anticheat-ventana-nueva/GUIA_IMPLEMENTACION.md)) |
| `agent/build.bat` | Suma `detect.cpp` |
| `supabase/replanteo/156_anticheat_deteccion.sql` | Eventos nuevos, `ac_signatures`, `ac_flags` con su trigger, configuración remota, latido firmado, Bridge con `p_port`, funciones del panel y retención de capturas |
| `supabase/replanteo/157_anticheat_maquinas.sql` | Máquinas, identificadores, baneos, excepciones, intentos bloqueados, ban por evasión y vinculación con `hw` |
| `supabase/replanteo/158_anticheat_aim.sql` | `ac_aim_stats` y `ac_aim_report` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/156…158` | Inversas |
| `web/backend/src/services/anticheat.ts` | **Nuevo.** `sha256Hex`, `signatureOk`, `heartbeatText` y `hashMachine` |
| `web/backend/src/routes/anticheat.ts` | Verifica la firma, HMAC de la huella y `403` con `AC-5` |
| `web/backend/src/routes/anticheat-staff.ts` | **Nuevo.** Marcas, revisión, buscar un hash, firmas, configuración del agente y máquinas. Solo admin |
| `web/backend/src/routes/anticheat-evidence.ts` | Los tipos nuevos, `detail` y `screenshot_expired` |
| `web/backend/src/jobs/anticheat-retention.ts`, `scripts/anticheat-tick.mts` | `runScreenshotRetention` |
| `web/backend/src/env.ts`, `.dev.vars.example` | `AC_HWID_SALT` |
| `web/backend/src/schemas/anticheat.ts`, `src/db/types.ts`, `src/app.ts` | Esquemas, tipos de las RPC y el registro de las rutas |
| `web/backend/test/unit/anticheat-service.test.ts` | **Nuevo.** 7 pruebas de la firma y el HMAC |
| `web/frontend/src/features/admin/anticheat/AdminAnticheatTools.tsx` | **Nuevo.** Marcas, buscar hash, firmas, Agente y el bloque Máquina |
| `web/frontend/src/features/admin/anticheat/AdminAnticheatPage.tsx` | Las pestañas, la columna Marcas y las secciones nuevas de la evidencia |
| `web/frontend/src/features/anticheat/queries.ts`, `src/api/schema.d.ts` | Tipos y llamadas |
| `server/addons/sourcemod/scripting/cml_anticheat_bridge.sp` | 1.2.0: `p_port`, `AC-4` y `AC-5` |
| `server/addons/sourcemod/scripting/cml_aimstats.sp` | **Nuevo.** 1.0.0 |
| `docs/manual/admin/anticheat.md` | **Nuevo.** El panel para el admin |

## Despliegue (pendiente)

En este orden, cuando esté probado y Daniel decida la mezcla en `main`:

1. **Variable de la API.** En el VPS, generar la sal y agregarla a `/etc/cmleague/api.env`. **No se cambia nunca después:** con otra sal, ninguna máquina coincide con las que ya están guardadas.

   ```bash
   echo "AC_HWID_SALT=$(openssl rand -hex 32)" | sudo tee -a /etc/cmleague/api.env
   ```

2. **Base.** Por el túnel de `PG_*`, en orden: `155_anticheat_juego.sql`, `156_anticheat_deteccion.sql`, `157_anticheat_maquinas.sql` y `158_anticheat_aim.sql`.
3. **API y web.** Desplegar la API (con la sal ya cargada) y la web desde `main`.
4. **Agente.** Compilar con `agent\build.bat`, firmarlo con el certificado y subirlo a `cmleague.lat`. En Administración › Anticheat › **Agente**, cargar:
   - su `sha256` en los hashes permitidos;
   - `agent_latest`, con la versión, la URL y el hash;
   - la versión mínima, recién cuando la mayoría haya actualizado.
5. **Firmas.** En **Firmas y hashes**, cargar como `good` los hashes de los archivos originales de ClientMod.
6. **Servidores, en la misma tanda: #1, #2 y #3** (y el de retake, si todavía existe, en `plugins/disabled/`):
   - subir `cml_anticheat_bridge.smx` 1.2.0 y `cml_aimstats.smx` 1.0.0 por SFTP;
   - **nunca con un mix en curso**: se cargan en el próximo cambio de mapa, sin recargar el plugin;
   - `cml_aimstats` usa la configuración del Bridge (`cfg/sourcemod/cml_anticheat.cfg`): no hace falta un cfg propio.

## Pruebas

| Qué | Resultado |
|---|---|
| Compilación del agente (`/W4 /WX`, Build Tools de VS 18) | Sin advertencias |
| `--detect` en la PC de Kyan | Ve los drivers (158 con `EnumServicesStatusEx`), los identificadores de la máquina y los puertos |
| Handles | Detectó un proceso de prueba que abrió a otro (`ping`) con permiso de lectura |
| Nombres en el binario | `CMLauncher.exe` y las rutas no aparecen en claro |
| API: tipos y pruebas unitarias | Pasan las 580, con las 7 nuevas |
| Web: tipos, lint y pruebas del admin | Pasan las 74 |
| Panel con datos de ejemplo | Revisado en imágenes: [`capturas/`](capturas/) (de `01-sesiones.jpg` a `07-agente.jpg`). Se armó con una página temporal, ya borrada |
| **Con el juego abierto** | **No se probó** |
| **Replanteos `155` a `158` y sus inversas** | **No se aplicaron** |
| **Bridge 1.2.0 y `cml_aimstats`** | **No se compilaron** |
| Pruebas de integración de la API (latido firmado, ban por máquina) | **No se escribieron:** necesitan la base local |

## En qué se apartó del plan

- **Drivers:** el plan los listaba como drivers cargados. En Windows 11 24H2, `EnumDeviceDrivers` sin privilegios solo devolvió 1, así que se leen los drivers registrados como servicios (`EnumServicesStatusEx`).
- **Handles:** la exclusión de los procesos de Windows por carpeta (`System32`) escondía todo. Ahora es por nombre, y solo si están en `System32`.
- **Capturas:** el plan decía una cada 30 a 35 s. Se sumó la retención de 7 días en el servidor (`runScreenshotRetention`), que no estaba.
- **Archivos del juego:** el plan decía `bin` y `cstrike/bin`. Quedaron los de ClientMod (`CMLauncher.exe`, `ClientModEAC.exe`, `bin\clientmod*.dll` y `bin_clientmod\ClientModNetwork.dll`), y se cambian desde el panel.
- Con un `401` por firma inválida, el agente **no** renueva el token: si no, un agente falso podría seguir pidiendo tokens.

## Incidentes durante las pruebas

- Una prueba abrió el Bloc de notas con un `.txt` de Kyan. Desde entonces, los procesos de prueba se abren ocultos.

## Cómo revertir

- **Base**, en orden inverso, con las inversas de `reversas/`: `158`, `157`, `156` y, si hace falta, `155`.
  - La de la `157` deja los baneos por evasión como `source = 'web'`, todavía activos: hay que levantarlos a mano si corresponde.
  - Las capturas ya borradas por vencimiento no vuelven.
- **API:** volver a la versión anterior **antes** de la inversa de la `156`. La API nueva llama al latido con los parámetros nuevos.
- **Agente:** con la `156` aplicada, un agente viejo con clave registrada no puede latir sin firma. Revertir la base y el agente juntos.
- **Servidores:** volver a poner el Bridge anterior y sacar `cml_aimstats.smx` de #1, #2 y #3, en el próximo cambio de mapa.
- **Código:** `git revert` de los commits en `kyan/ac`.

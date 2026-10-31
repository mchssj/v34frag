# Procesos, capturas y Bridge del anticheat: guía de implementación

## Estado

Implementado y probado en local el 2026-10-30, sin jugadores reales. **No distribuir todavía:** ver "Antes de usarlo con jugadores". Nada desplegado.

## Antes de usarlo con jugadores

| Falta | Por qué |
|---|---|
| **Revisión legal** | Capturas y procesos de personas identificadas, varios países y posibles menores |
| **Borrado a los 30 días** | **La aplicación promete 30 días y todavía no hay tarea que borre.** Falta el cron de filas y archivos |
| Pruebas de campo | Tirones al capturar, Alt+Tab, superposiciones, modos ventana y sin bordes, Windows 11, otras placas |
| Certificado de firma | Sin él, SmartScreen y los antivirus lo van a advertir |
| Bridge en `cssds` | Solo se compiló. **No se cargó en ningún servidor** |
| Etapa 5 | Cadena de hashes, manifiestos firmados y retención inmutable: no están hechos |

## Despliegue (pendiente, con el corte)

1. `40_anticheat_evidencia.sql`, después de la `39`.
2. `SUPABASE_SERVICE_KEY` y `AC_API_SECRET` en la API. **Nunca en la aplicación ni en el plugin.**
3. Bridge: en `cfg/sourcemod/cml_anticheat.cfg`, `cml_ac_api_url` (termina en `/rest/v1/rpc/`), `cml_ac_api_key` y `cml_ac_server_token`. Junto con `live.cfg`, `end.cfg` y `warmup.cfg`.
4. Activar en el servidor real con `ac_server_policy`, primero con `enforce_mixes` en `false`.

**Excepción a la regla de despliegue de `CLAUDE.md`:** RBK queda afuera por ahora, por decisión de Kyan del 2026-10-30. Si se lo suma, necesita acuerdo escrito y build propio. Sin plugin, un servidor sin política nunca expulsa.

## Pruebas

| Qué | Resultado |
|---|---|
| Compilación `/W4 /WX`, real y de pruebas | Sin advertencias |
| Opciones de prueba en la versión real | Ausentes (comprobado en el binario) |
| Ejecutable real contra la API local: nada antes de la sesión, inventario, captura automática, captura pedida, hash verificado, sin acceso sin URL firmada, se detiene al cerrar | Pasa |
| Hash incorrecto, no JPEG, fecha fuera de sesión, otro equipo, reintentos | Pasa |
| Permisos: público, jugador, admin | Pasa |
| Instalar y desinstalar | Pasa, sin dejar rastro (versión anterior; el proceso no cambió) |
| Bridge | **Solo compila** con spcomp 1.8, y no con el de 1.10 |
| Captura en el juego | **No se probó con esta aplicación.** Los mismos métodos funcionaron con el capturador de prueba |

## En qué se apartó del plan

- El plan se escribió junto con el código, por el pedido de hacer todo seguido.
- Sin Realtime: el panel consulta cada 15 segundos.
- Con el servicio caído, el Bridge da 5 minutos antes de expulsar, para no cortar de golpe una partida.

## Incidentes durante las pruebas

- **Una captura de la prueba mostró otra cosa de la pantalla de Kyan**, porque la versión de pruebas no exige primer plano. Se borró de la carpeta temporal y de la base local. Por eso esa opción solo existe en la versión de pruebas, y **la prueba automática sigue capturando la pantalla de quien la corre**: las imágenes se borran al terminar, solo en la base local.
- Con un token vencido, la cola borraba lo pendiente. Corregido: 401 y 403 se reintentan.

## Cómo revertir

Antes del corte, no aplicar la `40`. Después, vaciar `ac-evidence` y correr su inversa. Sacar `cml_anticheat_bridge.smx` en el próximo cambio de mapa. En el código, `git revert`.

# Plan: instalar el plugin en el servidor de terceros RBK

> No hubo plan previo aprobado: Daniel pidió la instalación directamente el 2026-10-13 (crear el servidor en la web, pasar las credenciales e instalar el plugin compilado). Este archivo resume lo que se decidió en el momento.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Build | **Licenciado** con `server/build_licenciado.sh` y el UUID del servidor (`be0fd76c-6bdc-477e-a843-6efc309b5ca9`): solo acepta el token de RBK y lleva su ID adentro. |
| System2 | La misma `system2.ext.so` de nuestro servidor (mismo panel ExtremeHost, Linux). |
| Demos | `csstv_demo 0`: el Worker de R2 baja las demos por la API del panel de **nuestro** servidor; las de RBK quedarían "pendientes" para siempre. |
| Archivos de RBK | No se pisa nada: el script aborta si algún archivo ya existe. |
| Secretos | El cfg con el token se arma fuera del repo y solo se sube al servidor. |

## Orden

1. Validar el token con `csstv_license` y obtener el UUID.
2. Compilar el build licenciado.
3. Subir System2, plugin, `csstv_reporter.cfg` y `cfg/csstv/` por SFTP, verificando md5.
4. Verificar en el próximo cambio de mapa.

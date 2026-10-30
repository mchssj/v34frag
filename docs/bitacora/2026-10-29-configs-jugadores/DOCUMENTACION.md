# Configs de los jugadores (prototipo VIP)

Prototipo de Kyan para que lo terminen Daniel (backend) y Esteban (frontend). Está en el frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), en `/demo/configs`, solo con `pnpm dev`.

Es una pestaña **Config** del perfil: cualquiera sube la suya, y solo los VIP ven el contenido y descargan las de los demás. Como es del perfil, la versión real la lleva Esteban.

## Subir

El jugador elige un `.rar` o un `.zip` con su carpeta `cstrike/cfg`, la carpeta directo, o archivos sueltos. Antes de publicar ve un informe:

| Revisión | Qué hace |
|---|---|
| Tipos de archivo | Solo `.cfg`, `.vdf`, `.scr`, `.rc` y `.txt`. Si un `.rar` o un `.zip` trae otra cosa (un `.exe`, un `.dll`), **se rechaza entero** y dice qué archivo, porque puede esconder un ejecutable. Sueltos, los prohibidos no se suben y el resto sí |
| Tamaño | Hasta 2 MB y 100 archivos |
| Contraseñas | Si una línea tiene `rcon_password`, `password` o `sv_password` con un valor, avisa en qué archivo y en qué línea, sin mostrar la contraseña. Al publicar, esas líneas se sacan |
| Scripts | Si el nombre parece de un script (`norecoil`, `aimbot`, `trigger`, `bhop`…), si hay un alias que dispara en bucle con `wait` o si mueve la mira con `wait`, avisa. Se publica, pero queda **en revisión** para que la vea un admin |

Subir otra config reemplaza la anterior.

**El `.rar` no se abre en el prototipo:** el navegador no puede sin una librería, así que el demo dice que lo abre el servidor. El `.zip`, comprimido o no, y los archivos sueltos sí se revisan de verdad en el navegador.

## Ver y descargar

- **Todos:** la lista de archivos con su tamaño, la fecha de subida y la marca "En revisión: puede tener scripts". Los archivos marcados llevan un ícono de aviso.
- **VIP:**
  - El contenido de cada archivo al tocarlo.
  - **Descargar .zip**, con la carpeta `cfg` entera.
  - Una config en revisión no se puede descargar hasta que la apruebe un admin: si se pudiera, la revisión no serviría de nada.
- **Sin VIP:** el contenido se ve borroso con un cartel y el botón **Hacete VIP**. El texto borroso es de relleno, porque sin VIP la API no manda el contenido.
- **Tu config:** la ves entera aunque no seas VIP.

## Archivos (en `web/frontend/src/`)

| Archivo | Qué tiene |
|---|---|
| `features/configs/check.ts` | `checkConfig` (tipos, tamaño, contraseñas y scripts) y `stripSecrets`. Las mismas reglas tienen que correr en el servidor |
| `features/configs/zip.ts` | `readZip` (sin comprimir y deflate, con el `DecompressionStream` del navegador), `writeZip` (para la descarga), `isZip` e `isRar` |
| `features/configs/check.test.ts` | 7 tests: tipos aceptados, `.exe` dentro de un comprimido, sueltos, contraseñas, scripts, tamaño, y armar y leer un `.zip` |
| `features/configs/demo.ts` | Tres configs de ejemplo. La de `gunk` tiene `norecoil.cfg` y un alias en bucle, y queda en revisión |
| `features/configs/ConfigsTab.tsx` | La pestaña: subir, informe, lista, contenido y descarga |
| `routes/demo.configs.tsx` | La ruta con la barra Demo ("Ser VIP" y de qué jugador es el perfil) |

## Lo que falta para la versión real

- **Daniel:**
  - **Storage:** un bucket para las configs, uno por jugador; la nueva reemplaza la anterior.
  - **Revisión en el servidor:** abrir `.rar` y `.zip` (por ejemplo con 7-Zip o `unrar`, sin ejecutar nada de adentro), con las mismas reglas de `check.ts`. No hay que confiar en la revisión del navegador: se puede saltear.
  - Guardar la config ya limpia (sin las líneas con contraseñas) y, mejor, como `.zip` armado por el servidor. Así lo que se baja nunca es el archivo original que subió el jugador.
  - **Rutas:** subir, ver la lista (pública), ver el contenido y descargar (solo VIP, y no si está en revisión).
  - **Moderación:** una cola en el admin para aprobar o borrar las configs en revisión.
- **Esteban:** la pestaña Config en el perfil.
- **Kyan o un admin:**
  - Qué scripts están prohibidos.
  - Si `aim.cfg` (que suele traer el ClientMod) tiene que marcarse. Hoy no se marca por el nombre solo.

## Pruebas (2026-10-29)

- **Tests:** los 7 pasan.
- **En el navegador, con `.zip` comprimidos (deflate) armados en el momento:**
  - Uno con `rcon_password` y `norecoil.cfg` avisó la contraseña (línea 3, sin mostrarla) y marcó el script. Al publicar, la línea de la contraseña ya no estaba y la config quedó "En revisión".
  - Uno con `loader.exe` se rechazó y el botón Publicar quedó deshabilitado.
  - Un `.rar` mostró que lo abre el servidor.
- **Configs de los demás:**
  - Sin VIP, el contenido real no está en la página.
  - Con VIP, la de `gunk` no se puede descargar (en revisión) y la de `kako1` se descarga como `cmleague-config-kako1.zip`.
- **Consola:** no hubo errores.
- **Sin revisar:** el modo claro y el celular.

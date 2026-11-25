# El reporter de los servidores, en main: guía de implementación

## Estado

En `main` desde el 2026-11-25. No se desplegó nada en los servidores: #1, #2 y #3 ya tenían la 2.10.2. El manual sale con el próximo despliegue de la API.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv_reporter.sp`, `csstv/claim.inc`, `csstv/knife.inc` | Los dos parches |
| `server/addons/sourcemod/scripting/csstv/webnick.inc`, `csstv/autoready.inc` | Nuevos, iguales a los del commit `7c0567ae` |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | El de los servidores |
| `docs/bitacora/2026-11-12-cuchillo-por-vida-y-nombre-web/`, `2026-11-13-ready-automatico/` | Copiadas de `kyan/pruebas`, sin `.smx` |
| `docs/manual/jugador/` y `capitan/` | Cuatro páginas |

## Pruebas

### Código contra binario

- Los `.smx` de los tres servidores, bajados por la API del panel, tienen el mismo md5 (`c3862c08…`), que es el de `build_2.10.2` en `kyan/pruebas`.
- Los dos parches se aplican sobre `main` sin rechazos.
- El código compila con `spcomp` 1.8.0.5963. Contra el binario de los servidores (`spcomp` 1.10.0.6490): los mismos textos del plugin y las mismas funciones públicas. Solo difieren el compilador, la fecha y lo que cada compilador agrega. El `.code` no se puede comparar byte a byte con otro compilador.
- No se probó el plugin en un servidor: es el mismo binario que ya corre.

## En qué se apartó del plan

Ninguno.

## Pendiente

- **Antes de subir otro reporter:** que salga de esta versión. El 2.11.0 sin commit salía de la 2.10.0 y borraba el cuchillo por vida y el `!ready` automático.
- **Replanteo `134`:** sin él no funciona el nombre de la web.
- **`csstv_flash`** está solo en `kyan/pruebas`, y **`csstv_ff`** no está en ninguna rama. Los dos corren en #1, #2 y #3.

## Cómo revertir

Revertir el commit. Los servidores no cambian.

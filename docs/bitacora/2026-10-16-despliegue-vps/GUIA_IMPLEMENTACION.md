# Despliegue de la web nueva en el VPS: guía de implementación

## Estado

**Sin implementar.** El plan sigue sin aprobar. Esta guía, por ahora, solo anota los cambios al plan decididos antes de implementarlo (2026-10-25).

## En qué se apartó del plan

### 1. Proveedor: OVH en vez de Hostinger (2026-10-25, decisión de Daniel)

| | Plan (Hostinger KVM 1) | Ahora (OVH VPS-1) |
|---|---|---|
| vCPU / RAM / disco | 1 / 4 GB / 50 GB NVMe | 2 / 4 GB / 40 GB NVMe |
| Tráfico | 4 TB | Ilimitado (500 Mbps) |
| Backup incluido | Semanal | Diario (guarda los últimos 7) |
| Precio | 6,49 USD/mes pagando 2 años, renueva a 11,99 | Desde 4,54 USD/mes (más impuestos; parece ser con pago anual) |
| Datacenter | Boston (el más cercano en EE. UU.) | **Hillsboro, Oregón** |

Por qué:

- **Latencia hacia la base.** La Supabase de producción está en `us-west-2` (Oregón). Cada pedido a la API hace una o varias consultas a Supabase, y desde Hillsboro cada una tarda unos pocos milisegundos (desde Boston eran unos 70 ms). Los jugadores, en su mayoría de Argentina, pagan la distancia una sola vez por pedido, no una vez por consulta.
- **Más por menos:** el doble de vCPU, backup diario y tráfico ilimitado, más barato que Hostinger después del primer período.
- Los 40 GB alcanzan de sobra: el VPS no guarda estado.

Cuidados al contratarlo:

- Hillsboro se contrata en **`us.ovhcloud.com`**, que es OVH US: una empresa y una cuenta aparte de ovhcloud.com.
- Elegir un **VPS de datacenter**, no de Local Zone: las Local Zones no tienen NVMe ni IPs adicionales, y ninguna está en Latinoamérica.
- Imagen **sin panel** (sin Plesk, cPanel ni Docker), con la llave SSH de Daniel cargada al crearlo.
- Antes de pagar, revisar en el configurador el precio mes a mes y la permanencia.

Qué cambia en el plan:

- **Decisiones y sección 1:** "VPS Hostinger" pasa a ser "VPS OVH (Hillsboro)".
- **Sección 2, paso 1:** el sistema se instala desde el panel de OVH.
- **Sección 6:** OVH da IPv6, así que el registro `AAAA` va con la IPv6 del VPS.
- **Dominio:** ya no está atado a Hostinger. Puede registrarse en OVH o en cualquier otro lado, apuntando el DNS a la IP del VPS. El correo sigue con Resend.
- No cambia nada más: Caddy, systemd, el pipeline, las variables, el ensayo y el corte quedan igual.

### 2. Ubuntu 26.04 LTS en vez de 24.04 (2026-10-25, decisión de Daniel)

- **Ubuntu 26.04 LTS**, con soporte hasta 2031 (la 24.04 lo tiene hasta 2029).
- **Si OVH todavía no ofrece la imagen de 26.04 para VPS, se instala la 24.04.** Al 2026-10-25 no estaba confirmado: el equipo de OVH dijo en su foro que llegaba "en las próximas semanas". Después se pasa con `do-release-upgrade` o se rehace el VPS con `deploy/vps/preparar.sh`.
- **Node 24 sigue saliendo de NodeSource.** Su repositorio usa la suite `nodistro` y funciona en 26.04. El paquete propio de Ubuntu 26.04 es Node 22 y no sirve.
- **Caddy**, desde su repositorio oficial, que no depende de la versión de Ubuntu.
- `preparar.sh` no tiene que depender del nombre de la versión (`noble` o la de 26.04): tiene que funcionar en las dos.

# Página "Hacete VIP" (prototipo)

Prototipo de Kyan para que lo terminen Daniel (pagos y backend) y Esteban (frontend). Está en el frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), en `/demo/vip`, solo con `pnpm dev`.

## Qué tiene

| Parte | Qué muestra |
|---|---|
| Encabezado | Qué es el VIP y que con lo que se paga se mantienen los servidores |
| Tu VIP | Según el estado: activo, por vencer (5 días o menos), en gracia o vencido, con un link para renovar o sumar meses. Sin VIP no aparece |
| Planes | 1 mes a $3.000, 3 meses a $8.100 (−10 %) y 6 meses a $15.300 (−15 %). **Precios de ejemplo.** Si ya sos VIP, los meses se suman a los que te quedan |
| Qué tenés con VIP | Tabla de beneficios con y sin VIP, en tres grupos (web; juego, misiones y tienda; comunidad). Cada beneficio lleva a su demo. Los que todavía no existen dicen "Próximamente" |
| Si se vence | Los 3 días de gracia y qué pasa con cada beneficio después, marcado como **Decidido** o **Propuesto** |
| Elegir un plan | Abre el resumen (plan, precio y descuento) y dice que el medio de pago está por definir. El botón **Pagar** está deshabilitado: el prototipo no cobra |

La barra Demo cambia el estado del VIP: sin VIP, activo, por vencer, en gracia y vencido.

**Candados conectados:** todos los carteles de "es para VIP" de los demás demos tienen ahora un botón **Hacete VIP**, y los avisos un botón **Hacete VIP** en el mensaje. Los dos llevan a esta página. Están en:

- El desglose de ELO, el buscador, el próximo recálculo y las stats del torneo.
- El widget de la bio, las favoritas y exportar stats.
- Las configs de los jugadores.

## Qué pasa cuando se vence

| Beneficio | Qué pasa | Estado |
|---|---|---|
| Monedas VIP y cosméticos VIP | Quedan congelados: no se pierden y vuelven si renovás | Decidido (progresión VIP) |
| Marco Oro VIP y medalla VIP | Dejan de mostrarse hasta que renueves | Propuesto |
| Partidas favoritas | Se siguen viendo, pero no se pueden marcar nuevas | Propuesto |
| Búsquedas guardadas | Se guardan, pero sin los filtros avanzados | Propuesto |
| Widget de la bio | La imagen sigue andando, con marca de agua | Propuesto |
| Misiones VIP | Dejan de salir. Lo completo y sin reclamar se puede reclamar hasta el lunes | Propuesto |
| Comparador | Vuelve a 2 jugadores | Propuesto |
| Configs | Tu config sigue publicada; dejás de descargar las de los demás | Propuesto |
| Créditos | Salís de la lista | Propuesto |

## Archivos (en `web/frontend/src/`)

| Archivo | Qué tiene |
|---|---|
| `features/vip/plans.ts` | `MONTH_PRICE`, `PLANS`, `GRACE_DAYS`, `BENEFITS` y `ON_EXPIRY`. Todo lo que se cambia está acá |
| `features/vip/VipPage.tsx` | La página |
| `features/vip/upsell.tsx` | `HaceteVipButton`, `vipToast` y `VIP_URL`. En la web real, `VIP_URL` pasa a ser `/vip` |
| `routes/demo.vip.tsx` | La ruta con la barra Demo |

## Lo que falta para la versión real

- **Kyan:**
  - Los precios.
  - Si Premium y VIP son dos niveles o uno.
  - Los días de gracia.
  - Confirmar lo "Propuesto" de la tabla de vencimiento.
- **Daniel:**
  - **Pago:** el medio de pago (Mercado Pago, transferencia, alta manual…), con los comprobantes y las devoluciones.
  - **Suscripción:** una tabla de suscripciones (`user_id`, plan, inicio, fin, estado) y su historial.
  - **Chequeo:** una sola función "¿es VIP?" que usen todas las rutas, que también cuente los días de gracia.
  - **Admin:** el alta y la baja manual desde el admin.
  - **Avisos:** un aviso cuando falten 5 días y cuando se venza.
- **Esteban:**
  - La página `/vip`.
  - "Mi suscripción" en la configuración de la cuenta: vencimiento, renovar e historial de pagos.
  - Cambiar `VIP_URL` por `/vip`.

## Pruebas (2026-10-29)

- Se vieron los cinco estados. En "por vencer" dice "Tu VIP se vence en 3 días".
- El plan de 3 meses abre el resumen con "$ 8.100 (10% de descuento). Se suma a los días que te quedan" y el botón Pagar deshabilitado.
- La tabla tiene las 20 filas (17 beneficios y los 3 títulos de grupo).
- En `/demo/elo` sin VIP, el botón **Hacete VIP** del cartel lleva a `/demo/vip`.
- No hubo errores en la consola. No se revisó en modo claro ni en el celular.

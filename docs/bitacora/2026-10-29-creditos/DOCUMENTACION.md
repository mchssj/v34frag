# Créditos de la web con los VIP (prototipo)

Está en `/demo/creditos` del frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), solo con `pnpm dev`.

## Qué hace

- **Hecho por:** tres tarjetas, cada una con su rol.
  - Kyan: ideas, diseño y prototipos.
  - Daniel: backend, servidores y plugins del juego.
  - Esteban (Killuaz): frontend y perfil de jugador.
- **Gracias a los VIP:** los VIP ordenados por meses.
  - Los de 12 meses o más van en tarjetas con avatar en la sección "Más de un año".
  - El resto va en una lista con la medalla VIP y los meses.
- **Barra Demo:**
  - **Ser VIP (3 meses):** suma a "tu.nick", resaltado.
  - **Aparecer en los créditos:** simula la preferencia de la cuenta.

## Archivos (en `web/frontend/src/`)

- `features/vip/Credits.tsx`
- `routes/demo.creditos.tsx`

## Lo que falta para la versión real

- **Daniel:**
  - `GET /api/v1/credits` (pública), con los VIP activos con `show_in_credits = true` y sus meses de VIP.
  - La preferencia `show_in_credits` en la cuenta, prendida por defecto.
- **Esteban:**
  - La página `/creditos`, con un link desde el pie de página.
  - El switch en Perfil → Preferencias. Es parte del perfil, así que es de Esteban.
- **Revisar:** los roles de "Hecho por" los puse yo según lo que dijo Kyan. Hay que confirmarlos con Daniel y Esteban antes de publicarlos.

## Pruebas (2026-10-29)

- En el navegador se ven las dos secciones, y "tu.nick" aparece y desaparece con el switch.
- No hubo errores en la consola.

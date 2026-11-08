# Plan: la página del Equipo (replanteo 87)

> Planeación original. Estado: **aprobada por Daniel el 2026-11-07** (diseño en el lienzo "Equipo y visitas al perfil", tablero "Página Equipo").

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Para qué | Que la gente sepa quiénes están detrás del proyecto | Lo pidió Daniel |
| Secciones | **Administración** (los admins, tarjetas grandes), **Moderación** (los moderadores, tarjetas chicas) y **Gracias a los VIP** | Admins son el equipo principal; moderadores, un escalón abajo |
| Tarjeta | Avatar, nick, rol y botones a su perfil y a Discord. Sin "Qué hace" (Daniel) | Lo pidió Daniel |
| De dónde sale | Sola, del rol de cada cuenta y del VIP activo. Sin lista a mano | Al cambiar un rol se actualiza |
| Sin ficha | Las cuentas del staff sin ficha de jugador no se muestran | No tienen nick ni perfil |
| VIP | Los VIP activos, sin los admins (Daniel), por antigüedad ("VIP desde"). Cada VIP puede ocultarse desde su perfil | Agradecer sin obligar a aparecer |
| Cómo ser VIP | Una ventana: "Comunícate con uno de nuestros administradores" y el botón al Discord de la comunidad (Daniel) | Todavía no hay una forma definida |
| Dónde | `/equipo`, dentro de la web con sesión, con su link en **Comunidad** del menú | Como el resto de las páginas de la comunidad |

## 1. Base de datos (`supabase/replanteo/87_pagina_equipo.sql`)

- `staff_public()`: `{ admins, moderators, vips }`, cada uno con `player_id`, `nick`, `photo_url` y `level`; los VIP con `since`. Para cualquiera con sesión.
- `vip_list_hidden_set(p_hidden)` y `vip_list_me()`: ocultarse de la lista (en `user_preferences.preferences.vip_list_hidden`) y saber si eres VIP y si estás oculto.
- Inversa y `probar_87.sh` con `prueba_87.sql`.

## 2. API

- `GET /api/v1/staff`.
- `GET /api/v1/me/vip-list` y `PUT /api/v1/me/vip-list` (`{ hidden }`).

## 3. Web

- Ruta `/equipo` con las tres secciones y la ventana "Cómo ser VIP".
- En **Perfil › Privacidad**, solo para VIP: "Aparecer en la lista de VIP de la página del Equipo".

## 4. Manual, términos y privacidad

- Manual: una línea en la página del jugador sobre la página del Equipo y cómo ocultarse si es VIP.
- Privacidad: si eres VIP, tu nick aparece en la página del Equipo salvo que te ocultes.

## 5. Orden

1. La 87, su inversa y sus pruebas. 2. API. 3. Web. 4. Manual, privacidad y documentación.

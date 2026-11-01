# Fichas que perdieron el vínculo con su cuenta: documentación

## Qué hace

Una **cuenta** es donde alguien se registra; una **ficha** (`players`) es el jugador, con su SteamID, partidas y ELO. Las une un solo dato: `players.user_id`. Lo leen igual la web vieja (`myPlayer()`, "✓ Este es tu perfil reclamado") y la API nueva (`/me/profile`, `GET /me/claim-code`).

El 2026-10-25, Daniel vio en Mi perfil → Privacidad de la web nueva "Se aplica cuando vincules tu jugador", aunque su reclamo estaba aprobado desde el 2026-10-12. En producción había **10 fichas** con el reclamo aprobado y `user_id` vacío: juanma, Lukas, vodka, notions, instt, rbk, odreaz, daniloev, always y aksev. Todas se aprobaron entre el 2026-10-06 y el 2026-10-13, todas tienen SteamID y ninguna de esas cuentas tiene otra ficha. Desde el 2026-10-14 no se perdió ninguna.

La migración `15` ahora las vuelve a vincular en el corte y la base local ya está corregida. La web vieja no se toca (decisión de Daniel), así que hasta el corte su panel puede seguir desvinculando fichas: la migración también levanta esas, si el reclamo sigue aprobado.

```mermaid
flowchart LR
  C[Cuenta] -. players.user_id .-> F[Ficha: SteamID, partidas, ELO]
  R[Reclamo aprobado] -->|lo aplicaba el admin| C
  P[Panel viejo: Editar ficha + Guardar] -->|con el buscador filtrado| X[user_id = null]
```

## Causa

Se descartaron:

| Posible causa | Resultado |
|---|---|
| La copia de producción a local | No: producción está igual |
| Una función o trigger de la base | No: ninguna función de producción pone `players.user_id` en null y `players` no tiene triggers propios |
| Rechazar, revocar o borrar el reclamo | No: cambian el estado del reclamo, y los 10 siguen "aprobados" con una sola solicitud por ficha |

Queda el formulario de fichas del panel de admin viejo (`index.html`). El selector "Cuenta vinculada" tiene un buscador que filtra las opciones (`selApply`) y **no se limpiaba al apretar "Editar" en otra ficha**. Si la cuenta de esa ficha no coincidía con el filtro, `select.value` quedaba en "Sin cuenta vinculada" y "Guardar" mandaba `user_id: null`. Encaja con que las 10 tienen SteamID (se cargaban editando la ficha). La base no guarda quién editó cada ficha, así que no está probado al 100 %.

## Reglas del arreglo en el corte (`15_claim.sql`, sección 10)

Una ficha se vincula a la cuenta de su reclamo aprobado si:
- la ficha sigue sin cuenta;
- la cuenta existe en `auth.users` y no tiene otra ficha;
- nadie más tiene un reclamo aprobado de esa ficha.

Si una cuenta tiene varios reclamos aprobados que cumplen, gana el más reciente. Lo que queda sin vincular sale como `NOTICE` con la cantidad, para revisarlo a mano. Después, como antes, los reclamos pasan a `claim_log` y se borra `profile_requests`.

## Dónde está cada cosa

| Qué | Archivo / ubicación |
|---|---|
| Vínculo en el corte | `supabase/replanteo/15_claim.sql`, sección 10 |
| Panel viejo (causa, sin cambios) | `index.html`: `selApply`, botón "Editar" de fichas y guardado (`$('pa').onclick`) |
| Vínculo de la cuenta en la API | `web/backend/src/routes/me.ts` y `routes/claim.ts` (`players.user_id`) |
| Texto de Privacidad | `web/frontend/src/features/profile/sections/PrivacySection.tsx` |

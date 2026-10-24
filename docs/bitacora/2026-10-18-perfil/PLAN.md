# Plan: Bienvenida de 4 pasos y Mi perfil

> Planeación original. Estado: **aprobado** el 2026-10-18.

Handoff: `CSSTV/desings/handoff_perfil/` (`README.md`, `Pedidos al backend.md`, `referencia-visual/Auth.dc.html`, `MyProfile.dc.html` y `Home.dc.html`).

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Bienvenida | 4 pasos posibles (Foto y nombre, Estilo, Contactos, Vinculación), pero **solo se muestran los que faltan**; el último dice "Guardar y terminar" | Respuesta de Esteban: mantener la decisión del 2026-10-18. Desvío del handoff ("paso N de 4") |
| Rutas | `/profile` (Perfil), `/profile/privacy`, `/profile/link`, `/profile/preferences` y `/profile/account`, en lugar de `/me` y `/me/vincular` | URLs en inglés; cada sección se puede enlazar (el aviso del Home y "Vincular" abren `/profile/link`) |
| Privacidad | Las dos opciones con la actual marcada (sale de `GET /players/{id}` del jugador vinculado), **deshabilitadas**, con la nota "Muy pronto vas a poder cambiarla desde acá" | Respuesta de Esteban: hoy solo la cambia un admin. Se pide el endpoint |
| Íconos de marca | `@icons-pack/react-simple-icons` (Steam, Discord, FACEIT) | Respuesta de Esteban. Verificado: MIT, sin dependencias ni scripts de instalación, todas sus versiones con procedencia, última de agosto |
| "Hecho" de Foto y Contactos | Hay dato cargado (avatar o nombre; algún contacto) **o** se tocó "Guardar y seguir" en ese paso. Esto último se guarda por usuario en `localStorage` (`csstv.onboarding.<id>`) | El handoff cuenta "guardar vacío" como hecho y la API no tiene progreso por paso. Pedido al backend (`onboarding` en `/auth/me`) |
| Preferencias | Tema y efectos de tema (handoff de efectos, sección 5): segmentados, aviso de fotosensibilidad y bloqueo con movimiento reducido. Sin "Probar efecto" (opcional) | Ya existe `useThemeFxPref` |
| Cerrar sesión | Pasa de la página provisoria a la sección Cuenta | Handoff |

## 1. El flujo

```mermaid
flowchart TD
    L[Primer login] --> W{¿Falta algún paso<br/>y no vio la Bienvenida?}
    W -->|Sí| B[Bienvenida: solo los pasos pendientes]
    W -->|No| H[Home]
    B --> H
    H -->|Aviso "Completa tu perfil · N de 4"| B
    H -->|Pie del sidebar| P[Mi perfil]
    P --> S1[Perfil: alias y datos]
    P --> S2[Privacidad]
    P --> S3[Vinculación: !claim y cuentas]
    P --> S4[Preferencias: tema y efectos]
    P --> S5[Cuenta: datos y cerrar sesión]
```

## 2. Bienvenida (`/welcome`)

- **Pasos:** `welcomeSteps` pasa a cuatro pasos: `photo`, `style`, `contacts` y `link`. Devuelve los pendientes en orden; si no falta ninguno (entrada por la URL), los tres editables.
- **Paso 1, Foto y nombre:**
  - chip "Email confirmado · hola, {alias}";
  - dropzone circular de 88 px (arrastrar o clic), con recorte cuadrado (`cropAvatar` de `lib/image.ts`) y subida (`useUploadAvatar`);
  - "Nombre real · opcional", con su ayuda, y la vista previa con avatar o inicial, alias y la línea de visibilidad.
- **Paso 2, Estilo:** sin cambios (`PlayStyleStep`).
- **Paso 3, Contactos:**
  - una tarjeta con Discord, Steam y FACEIT: ícono de marca de 40 px, label, input y ayuda;
  - la nota "Visibles para usuarios con sesión iniciada…".
- **Paso 4, Vinculación:** sin cambios (`ClaimStep`).
- **Textos:** tarjeta lateral y toasts de cada paso según el handoff.

## 3. Aviso del Home

Cuatro ítems ("Foto y nombre", "Puesto y país", "Contactos", "Jugador vinculado") y "Completa tu perfil · {hechos} de 4". `onboardingFrom` y `needsWelcome` pasan a contar los cuatro.

## 4. Mi perfil (`/profile/*`)

- **Layout:**
  - H1 "Mi perfil" con su descripción, y "Ver perfil público" (`/player/{nick}`, solo con jugador vinculado);
  - nav lateral sticky de 200 px y contenido de 720 px como máximo. En el teléfono, la nav pasa a una fila horizontal con scroll;
  - Vinculación lleva un punto `primary` si no hay jugador vinculado.
- **Perfil:**
  - **Alias:** input con ícono de estado (`at-sign`, `circle-check`, `circle-x` o `lock`). Disponibilidad en vivo, reutilizando `useAliasStatus` del registro. "Cambiar alias" usa `PUT /me/alias`. Los mensajes son los exactos del prototipo y las respuestas `409` o `400 BUSINESS_RULE` se muestran. El chip "Último cambio…" o "Podrás cambiarlo el…" sale de la respuesta del `PUT`; al cargar, la API todavía no lo da (pedido).
  - **Datos:** avatar de 72 px, Email (deshabilitado), Nombre real, País (con banderas) y Puesto. "Guardar cambios" hace `PATCH /me/profile`.
- **Privacidad:** dos radio-cards deshabilitadas con la actual marcada y la nota. Sin jugador vinculado: "Se aplica cuando vincules tu jugador".
- **Vinculación:**
  - **Jugador:** estado vinculado (nick, SteamID y partidas asociadas, de `matches_played`) o no vinculado; "Generar código" / "Generar otro código", la caja `!claim {código}` con "Copiar" y el chip "Provisorio". Reutiliza `useCreateClaimCode` y `steamStatusOptions`.
  - **Cuentas conectadas:** Steam en solo lectura con badge "Verificado" si está vinculado (SteamID principal), o input si no; Discord y FACEIT. "Guardar cuentas" muestra el toast "Cuentas guardadas".
- **Preferencias:** segmentados de Tema y de Efectos; aviso de fotosensibilidad en un bloque `muted`; con movimiento reducido, Efectos deshabilitado con su texto; toast "Preferencia guardada".
- **Cuenta:** Registrado (`user.created_at`), Última conexión (`details.last_seen`), Rol de cuenta, Equipos actuales (`teams`), Partidas jugadas (`matches_played`) y "Cerrar sesión".
- **Shell:** el breadcrumb pasa a "Mi perfil › {sección}" y el pie del sidebar sigue activo en todas las secciones.

## 5. Validaciones (`features/profile/schemas.ts`)

| Campo | Regla |
|---|---|
| Nombre real | Opcional, hasta 60 caracteres (se mantiene) |
| Discord | 2 a 32 caracteres: minúsculas, números, `_` y `.`. Si pega `usuario#1234`, se quita el `#1234` |
| Steam | SteamID64, `steamcommunity.com/profiles/{id}`, `steamcommunity.com/id/{vanity}` o nombre (el backend lo resuelve) |
| FACEIT | Nick o `faceit.com/{lang}/players/{nick}`; se guarda el nick |
| Avatar | JPEG, PNG o WebP, hasta 1 MB, recorte a 256×256 (`lib/image.ts`, sin cambios) |

## 6. Pruebas

- **Unitarias:**
  - `welcomeSteps` y `onboardingFrom` con los 4 pasos y las marcas de "guardado vacío";
  - validaciones de Discord (normaliza `#1234`), FACEIT (extrae el nick del link) y Steam;
  - mensajes del alias (bloqueado, disponible, tomado).
- **Componente:**
  - `WelcomeFlow`: solo los pasos que faltan con 4 posibles;
  - Mi perfil: guardar datos y guardar cuentas (MSW).
- **Playwright:**
  - registro → Bienvenida con los 4 pasos (foto subida con un archivo de prueba, estilo, contactos, "Lo hago después" en la vinculación) → aviso "3 de 4";
  - Mi perfil: navegar las secciones, guardar datos, cambiar la preferencia de efectos, "Generar código" y cerrar sesión desde Cuenta;
  - el cambio de alias se prueba con una cuenta nueva, porque bloquea 15 días.
- **Visual:** capturas contra `MyProfile.dc.html` y `Auth.dc.html` en 1440 y 390 px, en claro y oscuro.

## 7. Pedidos al backend

1. Privacidad editable por el usuario (`privacy` en `PATCH /me/profile` o un endpoint propio) y su valor en `GET /me/profile`.
2. `alias_changed_at` y `next_change_at` en `GET /me/profile`.
3. `DELETE /me/avatar`.
4. Progreso de la Bienvenida por paso (`onboarding: { profile, style, contacts, link }`) y `onboarding_done`.
5. Al vincular con `!claim`: completar `steam` con el SteamID verificado si estaba vacío, y marcarlo como verificado.
6. Opcional: nivel de FACEIT.

## 8. Requisitos

- Instalar `@icons-pack/react-simple-icons` (ya verificado).
- Componentes de shadcn que falten (`radio-group`, si hace falta).

## 9. Orden de implementación

1. Validaciones y la lógica de 4 pasos (`welcomeSteps`, `onboardingFrom`, marcas), con sus pruebas.
2. Pasos Foto y Contactos de la Bienvenida y el aviso de 4 ítems.
3. Rutas de Mi perfil y su layout.
4. Secciones: Perfil, Vinculación, Preferencias, Cuenta y Privacidad.
5. Shell (breadcrumbs y link del aviso).
6. Pruebas, capturas y verificación completa.
7. `DOCUMENTACION.md`, `GUIA_IMPLEMENTACION.md` y la fila del README.

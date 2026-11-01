# Bienvenida de 4 pasos y Mi perfil: guía de implementación

## Estado

Implementado y probado en local (2026-10-18) en la rama `feat/frontend-fase-1`. Sin commit y sin desplegar.

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/features/onboarding/queries.ts` | 4 pasos (`photo`, `style`, `contacts`, `link`), marcas de "guardado vacío" (`markStepSaved`) y `welcomeSteps` |
| `src/features/onboarding/WelcomeFlow.tsx` | Los 4 pasos posibles, con el formulario de contactos |
| `src/features/onboarding/PhotoStep.tsx`, `ContactsStep.tsx`, `Greeting.tsx`, `claim.ts` | Nuevos. `claim.ts` reúne la lógica del código que antes estaba dentro de `ClaimStep` |
| `src/features/onboarding/PlayStyleStep.tsx`, `ClaimStep.tsx`, `ProfileBanner.tsx` | El saludo va solo en el primer paso; `ClaimStep` usa `claim.ts`; el aviso pasa a 4 ítems |
| `src/features/profile/schemas.ts` | Validaciones de Discord, Steam y FACEIT del handoff, con normalización |
| `src/features/profile/queries.ts` | `playerDetailOptions` y `useChangeAlias` |
| `src/features/profile/ProfileLayout.tsx`, `sections/*`, `ui.tsx`, `alias.ts`, `AvatarPicker.tsx`, `ContactFields.tsx` | Nuevos: Mi perfil |
| `src/routes/_app/profile.tsx` y `profile.*.tsx` | Layout y 5 secciones (reemplaza a la página provisoria) |
| `src/components/brand/BrandTile.tsx` | Nuevo: íconos de Steam, Discord y FACEIT |
| `src/features/shell/nav.ts`, `queries.ts` | Breadcrumbs de las secciones; el nivel del pie sale de `playerDetailOptions` (misma caché que Mi perfil) |
| `src/features/auth/ui.tsx` | `AuthField` acepta un label con formato |
| `src/auth/tokenStore.test.ts` | Corrección de una prueba intermitente (ver "Incidentes") |
| `package.json`, `pnpm-lock.yaml` | `@icons-pack/react-simple-icons` 13.15.1 |
| Pruebas | Nuevas: `profile/schemas.test.ts`, `profile/alias.test.ts`. Reescritas: `onboarding/queries.test.ts`, `onboarding/WelcomeFlow.test.tsx`. E2E: `e2e/profile.spec.ts` (nuevo), `e2e/auth.spec.ts` y `e2e/helpers.ts` |

## Despliegue

No se desplegó.

## Pruebas

### Unitarias (Vitest)

145 en verde. Cubren:
- los 4 pasos y las marcas de "guardado vacío" por cuenta;
- `welcomeSteps` con todas las combinaciones;
- Discord (quita el `#1234`), FACEIT (extrae el nick del link) y Steam (formatos válidos e inválidos);
- los mensajes del alias (disponible, en uso, corto, palabra no permitida, bloqueado y "Último cambio hace N días");
- la Bienvenida: solo falta el estilo, guardar vacío sin pedir nada a la API, y Contactos con Discord normalizado;
- los breadcrumbs de Mi perfil.

### De punta a punta (Playwright)

38 en verde:
- **Registro → Bienvenida con los 4 pasos:**
  - sube una foto real (se ve en el avatar) y carga nombre, puesto, país y Discord `Zeta.CS#1234`;
  - en Vinculación toca "Lo hago después" y el aviso dice "3 de 4";
  - la API confirma `real_name`, `game_role`, `country`, `discord: "zeta.cs"` y `avatar_url`;
  - al volver desde el aviso queda solo "Vinculación".
- **Mi perfil, con una cuenta nueva** (1 registro por la API, sin gastar un login):
  - guarda los datos;
  - cambia el alias, que queda bloqueado con "Podrás cambiarlo el…";
  - genera un código `!claim`;
  - guarda FACEIT desde un link, recarga y queda el nick;
  - cierra sesión desde Cuenta.
- **Preferencias y Privacidad, con la sesión compartida:** guarda tema y efectos; Privacidad se muestra sin edición.

### Visual y desborde

- **Capturas:** las 5 secciones y la Bienvenida en 1440 px (claro y oscuro) y en 390 px. Se ajustaron los textos del avatar en Mi perfil ("Avatar" en lugar de "Foto de perfil").
- **Desborde horizontal:** ninguno en 320 a 1260 px, en ninguna sección.

## En qué se apartó del plan y del handoff

- **Bienvenida:** solo los pasos que faltan y "Guardar y terminar" (decisión de Esteban), en lugar de siempre "paso N de 4".
- **Rutas:** `/profile/*` en lugar de `/me` y `/me/vincular`.
- **Privacidad:** se muestra sin poder editarla, porque la API no tiene endpoint para el usuario.
- **Alias:** el chip "Último cambio hace N días" o "Podrás cambiarlo el…" aparece después de cambiarlo; al cargar, la API no da la fecha.
- **Encuadre del avatar (2026-10-19, pedido de Esteban):** al elegir la foto se abre "Encuadra tu foto" (`AvatarCropDialog`, con `react-easy-crop` 6.2.4: MIT, con procedencia y 13 días de antigüedad). Se puede arrastrar y hacer zoom con mouse, rueda, pellizco o teclado, dentro de un círculo que ocupa el marco; el zoom usa el `Slider` de shadcn. Recién al confirmar, `cropAvatar` recorta esa área a 256×256 y la sube; "Cancelar" no sube nada. Vale para Mi perfil y la Bienvenida. Los estilos de la librería se importan por CSS (sin inyectarlos en tiempo de ejecución, compatible con la CSP), y al `Slider` se le agregó el nombre accesible en el control que se mueve.
- **Texto de Steam en Mi perfil:** la ayuda quedó en "El link de tu perfil".
- **Steam (2026-10-19, pedido de Esteban):** el campo es solo el link del perfil, como dato informativo, y no tiene relación con el SteamID de `!claim`. Ya no acepta SteamID64 ni nombre, y en Cuentas conectadas no se muestra "Verificado" (el SteamID vinculado se ve en la tarjeta del jugador). El handoff lo trataba como SteamID verificable.
- **Sin "Probar efecto"** en Preferencias (era opcional).

## Incidentes

- **Prueba intermitente en `tokenStore.test.ts`** ("una pestaña nueva pide la sesión a las demás"):
  - **Síntoma:** falló una vez con la suite completa y pasó al repetirla.
  - **Causa:** el ida y vuelta por el bus simulado (dos `setTimeout`) competía con un plazo de espera de 30 ms en tiempo real. Con la máquina cargada, el plazo vencía antes de que llegara la respuesta.
  - **Corrección:** esa prueba usa un plazo de 5 s. No la vuelve más lenta, porque `ready()` se resuelve con la respuesta. El plazo corto queda en la prueba de "nadie responde".

## Pedidos al backend

1. Privacidad editable por el usuario y su valor en `GET /me/profile`.
2. `alias_changed_at` y `next_change_at` en `GET /me/profile`.
3. `DELETE /me/avatar`.
4. Progreso de la Bienvenida por paso (`onboarding: { profile, style, contacts, link }`) y `onboarding_done`.
5. Opcional: nivel de FACEIT.

(El pedido del handoff de completar `steam` con el SteamID verificado al vincular quedó descartado: el campo es solo el link informativo.)

## Cómo revertir

Todavía no hay commit: alcanza con descartar los cambios de los archivos de arriba.

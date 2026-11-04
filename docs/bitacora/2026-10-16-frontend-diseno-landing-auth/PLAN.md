# Plan: diseño de Landing, Login, Registro y Bienvenida (handoff `design_handoff_landing_auth`)

> Planeación original. Estado: **aprobado** el 2026-10-16. No se edita: los cambios durante la implementación van en [GUIA_IMPLEMENTACION.md](GUIA_IMPLEMENTACION.md).

## Contexto

La lógica del auth está terminada y probada (bitácora `2026-10-15-frontend-auth`). Ahora se aplica el diseño de alta fidelidad del handoff (`CSSTV/desings/design_handoff_landing_auth/`, revisado el 2026-10-16):
- Landing;
- Login;
- Registro (3 pasos, sin sesión);
- Bienvenida `/welcome` (2 pasos, con sesión, en el primer login);
- aviso "Completa tu perfil" del Home.

Copy, colores, tipografía, espaciado y estados son finales. Se recrean con shadcn (preset Nova), Lucide, Inter y Geist Mono, sin copiar estilos *inline*. La lógica existente (sesión, guardas, errores por `code`, alias en vivo, `!claim`, perfil) se reutiliza.

## Decisiones confirmadas

| Tema | Decisión |
|---|---|
| Rutas | Las del diseño: `/` (solo visitantes; con sesión → `/home`), `/login`, `/register`, `/welcome` (con sesión), `/home` (reemplaza a `/panel`) |
| Recordarme | Se mantiene, con el estilo del diseño: casilla discreta bajo la contraseña, marcada por defecto. Único agregado al diseño |
| Datos que la API no expone | Valores fijos en un solo archivo de configuración, marcados para reemplazar |
| Flujo del registro | El del handoff nuevo: 3 pasos sin sesión, la Bienvenida en el primer login y el aviso en el Home |

## Cómo se mapea el diseño a la API real

| El diseño dice | La API tiene | Qué se hace |
|---|---|---|
| `POST /auth/register` | `POST /auth/signup` | Se usa `signup` |
| `position` (puesto preferido) | `game_role`, con exactamente los mismos valores (IGL, AWPer, Entry fragger, Rifler, Support, Lurker, Otro) | Se guarda en `game_role`. El pedido de un campo `position` aparte queda resuelto con lo que ya existe |
| País con códigos (AR, CL…) | Lista de nombres (`COUNTRIES` del backend) | Se usa la lista del backend, con Argentina por defecto |
| Código `!claim` de 8 caracteres, 15 minutos | `POST /api/v1/me/claim-code`: 6 caracteres, 10 minutos; `GET /api/v1/me/claim-code` cada 5 s | Las casillas salen del largo real del código, y "Vence en …" usa una cuenta regresiva real con `expires_at` |
| "Vinculado: SteamID 7656… · {n} mixes" | `steam_ids` y `last_code.result` | Se muestra el SteamID principal (abreviado) y el mensaje del servidor. El conteo de mixes queda como pedido |
| `connect <ip>` | `/api/v1/servers` exige sesión y no tiene estado en vivo | La IP sale de la configuración fija |
| `onboarding_done`, `email_verified` | No existen | Se usa el criterio provisorio del diseño: mostrar `/welcome` si falta `game_role` o no hay SteamID vinculado, y guardar en localStorage (por usuario) que ya se mostró |
| Reenviar email, cambiar email | No existen | Esos botones **no se muestran** hasta que existan (no se puede simular una acción). Quedan en los pedidos al backend |
| Error "email sin confirmar" | `EMAIL_NOT_CONFIRMED` | Mensaje del diseño, sin la acción "Reenviar email" |
| Contraseña de 8 o más con medidor de fuerza | El backend acepta desde 6 | El frontend exige 8 (más estricto, no rompe nada) |

## Datos de la landing

| Elemento | Fuente |
|---|---|
| Partidas en vivo (pill) | Real: `GET /api/v1/matches?status=live&per=1` → `total` |
| Jugadores en el servidor, servidores (en línea, mapa, jugadores, ping), "jugando ahora", Discord (en línea, miembros, canales, invite) | Fijo en `src/config/site.ts` |
| Próximo torneo | Real: `GET /api/v1/events?status=registration&per=1`. "Cierra en": no hay fecha de cierre → "Empieza en {n} días" con `starts_on`, anotado como desvío. El banner usa el rayado del diseño |
| Top 5 por ELO | Real: `GET /api/v1/players?sort=elo&order=desc&per=5` |
| Tarjeta del login | Real si hay una partida oficial en vivo (`matches?status=live&kind=official&per=1`); si no, un texto fijo del diseño |
| "Más de N mixes" (registro) | Real: `matches?kind=mix&status=finished&per=1` → `total` |

Mientras cargan los datos, los elementos se dibujan con *skeletons* del mismo tamaño, para que la página no salte. Si fallan, se ocultan sin romper la landing.

## Paso 1: sistema visual (base)

`src/index.css` y `src/components/`:
- **Tokens:** se agrega `--win` (claro y oscuro) y `--color-win` en `@theme`. Se agregan los radios del diseño como tokens:
  - `--radius-tile`: `radius + 2px`;
  - `--radius-panel`: `radius + 4px`;
  - `--radius-hero`: `radius + 6px`.
  El resto de los colores ya coincide exactamente con el preset.
- **Tipografía:** Geist Mono (`@fontsource-variable/geist-mono`, respetando la política de 7 días) como `--font-mono`; `antialiased`.
- **Estilos globales:** selección `primary` al 30%; animación `live-pulse` (1 → 0,35 de opacidad, 1,6 s) que se desactiva con `prefers-reduced-motion`.
- **Tema:**
  - `ThemeProvider` arranca en **Sistema** y guarda la preferencia con la clave `csstv-theme`.
  - Se quita el atajo de teclado "d" de la plantilla, que no está en el diseño.
  - Botón `ThemeToggle` que cicla Sistema → Claro → Oscuro, con los iconos `monitor`, `sun` y `moon`.
- **Componentes de marca reutilizables:** `Logo` (cuadro TV y wordmark), `LevelBadge` (colores por nivel de `data.js`: 10 → `primary`, 8 y 9 → `sidebar-primary`, 4 a 7 → `foreground`, 1 a 3 → `muted-foreground`), `LiveDot`, `Eyebrow`, `SectionHeading`.
- **Tamaños:** se agregan a `button` los tamaños `xl` (44 px) y `md` (40 px); los inputs del auth van a 36 px. Son ajustes puntuales en `ui/`, permitidos por el CLAUDE.md.
- **Imagen del hero:** `landing-bg.png` (2,9 MB) se convierte a WebP una sola vez (`pnpm dlx sharp-cli`, sin agregar dependencia), con el PNG como respaldo en `image-set`. Va en `src/assets/`.

## Paso 2: Landing (`/`)

`src/features/landing/`: `LandingHeader`, `Hero`, `HowItWorks`, `ServersSection` (tabla y `DiscordCard`), `CompetitionSection` (`NextTournament`, `TopPlayers`), `LandingFooter` y `queries.ts`.
- Medidas y textos exactos del README.
- **Header sticky** con fondo al 80% y desenfoque. La navegación hace scroll suave a cada sección (`scroll-margin-top: 60px`).
- **Hero:** imagen con los filtros de claro y oscuro, y el degradado encima.
- **Servidores:**
  - copiar `connect <ip>` con un toast "IP copiada";
  - "Conectar" abre `steam://connect/<ip>`;
  - la fila *offline* se ve atenuada.
- **`/` es solo para visitantes:** con sesión, `beforeLoad` redirige a `/home`.

## Paso 3: layout de Auth y Login

- **`AuthShell` (`src/features/auth/AuthShell.tsx`):**
  - grilla responsive del diseño: el panel de imagen baja debajo del formulario en pantallas angostas;
  - arriba, el logo (lleva a `/`) y un botón que alterna según la vista ("Crear cuenta", "Iniciar sesión" o "Saltar por ahora");
  - abajo, el pie "Al continuar aceptas las reglas de la comunidad.";
  - panel lateral: fondo `muted` (la imagen está pendiente) y tarjeta flotante con el texto de cada vista o paso, que se oculta si no hay texto.
- **Login (`/login`):**
  - ancho máximo de 360 px, títulos del diseño, Email y Contraseña (Enter envía) y la casilla Recordarme;
  - el botón dice "Iniciar sesión" y pasa a "Entrando…" mientras carga.
- **Errores** en el `Alert` destructivo del diseño (borde al 40%, fondo al 8%), que se limpian al escribir:

  | Error | Mensaje |
  |---|---|
  | Credenciales incorrectas | El del diseño |
  | Email sin confirmar | "Confirma tu email. Te enviamos un link al registrarte." |
  | Límite de intentos | "Espera {n} segundos…", con la cuenta regresiva existente |
  | Error del servidor (5xx) | "Algo salió mal. Código de seguimiento: {requestId}", con la acción "Reintentar", que reenvía el formulario |

- **Al entrar:** si corresponde la Bienvenida y todavía no se mostró, va a `/welcome`; si no, al `redirect` seguro o a `/home`.

## Paso 4: Registro (`/register`, 3 pasos)

`src/features/auth/register/` (un componente por paso, con el estado en el contenedor):
- **Progreso:** 3 barras y "Paso {n} de 3 · {nombre}". "← Atrás" solo en el paso 2. El botón queda atenuado mientras el paso no es válido.
- **Paso 1:**
  - email con la expresión del diseño; el error aparece recién después del primer intento;
  - contraseña de 8 o más con un medidor de 4 barras: puntaje y etiquetas del diseño, barras en `win` desde 3 puntos y en `sidebar-primary` por debajo.
- **Paso 2:**
  - alias en un input de 40 px en Geist Mono;
  - estado dentro del input ("Disponible", "En uso", "Muy corto", "No permitido") y borde verde o rojo, con el endpoint real de disponibilidad (espera de 300 ms);
  - ayuda "{n}/24 · …" y la vista previa "Así te verán" con el nivel 4;
  - "Crear cuenta" llama a `signup`. Un `409` en el email vuelve al paso 1 con el campo marcado; un `409` o un `400` en el alias muestra "En uso" o "No permitido".
- **Paso 3, "Revisa tu correo":**
  - email enmascarado y la tarjeta "Al entrar por primera vez";
  - sin los botones de reenviar o cambiar email (no hay endpoint);
  - la contraseña se borra del estado al crear la cuenta.
- **Si la API no pidió confirmación** (la respuesta trae sesión, como en local): se salta el paso 3 y va a `/welcome`.

## Paso 5: Bienvenida (`/welcome`, 2 pasos) y aviso del Home

- **Ruta:** con sesión (`requireAuth`) y dentro de `AuthShell`. El botón de la derecha dice "Saltar por ahora" y lleva a `/home`. Arranca en el primer paso pendiente.
- **Paso 1:**
  - eyebrow `win` "Email confirmado · hola, {alias}";
  - 6 tarjetas de puesto como `radiogroup` accesible (Rifler por defecto) y el select de País;
  - "Guardar y seguir" hace `PATCH /me/profile` (`game_role`, `country`) y muestra el toast "Perfil actualizado";
  - "Lo hago después" pasa al paso 2.
- **Paso 2:**
  - código `!claim` en casillas, cuenta regresiva y lista numerada con `connect <ip>` y `!claim <código>`;
  - estado "Esperando…" con el punto animado, que pasa a "Vinculado…" en `win` (consulta cada 5 s, se detiene al vincular o al salir);
  - "Terminar" se habilita al vincular (toast "¡Listo! Ya puedes jugar tu primer mix.");
  - "Lo hago después" muestra el toast "Puedes vincular tu jugador desde Mi perfil" y lleva al Home.
- **Criterio compartido:** `useOnboardingStatus()` (`src/features/onboarding/`) combina `GET /me/profile` (`game_role`) y `GET /me/claim-code` (`steam_ids`). Lo usan la redirección del login, `/welcome` y el aviso.
- **`/home`:** reemplaza a `/panel`. Por ahora tiene el saludo y el aviso "Completa tu perfil · {hechos} de 2" (estilos del diseño, sin botón de cierre) mientras falte algo. El resto del Home es otro handoff.
- **Se elimina `/completar-perfil`** con sus pasos de redes y avatar: el diseño no los incluye y van a "Mi perfil" más adelante. `features/profile` (consultas, esquemas, recorte de avatar) se conserva para esa pantalla.

## Paso 6: rutas, guardas y lo que cambia de nombre

- **Archivos de rutas:** `_auth/login.tsx`, `_auth/register.tsx`, `welcome.tsx`, `_app/home.tsx`. Se borran `_auth/ingresar.tsx`, `_auth/registro.tsx`, `_auth/registro_.confirmar.tsx` y `_app/panel.tsx`.
- **Guardas:** `requireAuth` manda a `/login`. `callback.ts` lleva a `/login?aviso=…`. `requireGuest` sale a `/home`.
- **El layout `_app`** (vistas internas sin diseño todavía) solo se alinea con `Logo` y `ThemeToggle`.

## Accesibilidad y calidad

- **Teclado:** todo navegable con Tab y con el anillo de foco visible del preset.
- **Mensajes dinámicos:** el estado del alias, el del `!claim` y los errores usan `aria-live`.
- **Formularios:** las tarjetas de puesto son un `radiogroup` con `aria-checked`, y los inputs tienen `label` asociado.
- **Movimiento y contraste:** el punto animado respeta `prefers-reduced-motion`, y el contraste de `win` y `muted-foreground` se verifica en los dos temas.
- **Comentarios** en español y cortos (regla del CLAUDE.md).

## Pruebas y verificación

- **Unitarias (Vitest):**
  - medidor de fuerza;
  - enmascarado del email;
  - criterio de la Bienvenida;
  - estados del alias;
  - login con los errores del diseño (5xx con "Reintentar");
  - registro: paso 1 → 2, `409` de email que vuelve al paso 1, y salto a `/welcome` cuando hay sesión.
- **Playwright:** se actualizan rutas y textos ("Iniciar sesión", "Crear cuenta", `/home`) y se agregan:
  - registro → `/welcome` → Saltar o Guardar y seguir → aviso en el Home con el conteo correcto;
  - `/` con sesión → `/home`.
  La suite sigue respetando el límite de 10 intentos por minuto.
- **Comparación visual:**
  - un script de Playwright saca capturas del prototipo (`CSSTV.dc.html` por `file://`) y de nuestra app, en escritorio (1440 px) y móvil (390 px), en claro y oscuro;
  - las reviso lado a lado y te las muestro;
  - las capturas quedan en el scratchpad, sin datos personales (con la copia de producción solo se ven alias públicos del top 5).
- **Verificación final:** typecheck, lint, build, `pnpm test` y `pnpm test:e2e` en verde. El frontend queda levantado para que lo revises.

## Bitácora y entrega

- **Bitácora:** `docs/bitacora/2026-10-16-frontend-diseno-landing-auth/`, con `PLAN.md` (este plan), `DOCUMENTACION.md`, `GUIA_IMPLEMENTACION.md` y una fila en el README.
- **Pedidos al backend:** se suman a la guía:
  - estado público de servidores;
  - reenvío y cambio de email;
  - `onboarding_done` y `email_verified`;
  - fecha de cierre y banner del torneo;
  - conteo de mixes del SteamID vinculado.
- **CLAUDE.md:** se agrega dónde están los tokens, los componentes de marca y `src/config/site.ts`.
- **Commit** en `feat/frontend-fase-1` al terminar, con tu visto bueno sobre las capturas.

## Orden de trabajo

1. Sistema visual: tokens, fuentes, tema, componentes de marca e imagen.
2. Rutas nuevas y guardas.
3. `AuthShell` y Login.
4. Registro.
5. Bienvenida, `useOnboardingStatus` y `/home` con el aviso.
6. Landing con sus datos y la configuración fija.
7. Pruebas, comparación visual con el prototipo, bitácora y commit.

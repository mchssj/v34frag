# Plan: términos y privacidad al día con la plataforma

> Planeación original. Estado: **pedido por Daniel** el 2026-11-03 ("agrega lo que falta, desactiva lo que sobra y deja documentado que lo nuevo puede afectar estas páginas y el manual").

Los textos de [`2026-11-03-terminos-y-condiciones`](../2026-11-03-terminos-y-condiciones/) y [`2026-11-03-politica-privacidad`](../2026-11-03-politica-privacidad/) (de kyan, traídos a `feat/frontend-fase-1` en `db27c0c3`) se revisaron contra el código de hoy (web nueva, API, base, plugin y Worker). Casi todo coincide, pero hay frases que describen cosas planteadas y todavía no hechas, y una que falta.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Lo planteado y no hecho | Se deja en el texto con la marca "En preparación" (`Wip` en la web, `<span class="pending">` en los `.html`) | Daniel: son cosas que sí se planean. La marca ya existe y la introducción avisa que hay funciones que todavía no están |
| Lo que no coincide con cómo funciona | Se reescribe para que diga lo que pasa hoy | Un texto legal no puede describir algo distinto a lo real |
| Lo que falta | Se agrega | Que la privacidad nombre todo lo que se publica |
| Los dos formatos | Cada cambio va en la página de la web (`features/legal/pages/`) y en su `.html` de `terms/` | Los dos tienen que decir lo mismo (comentario en cada página) |
| Regla nueva | Cada requerimiento revisa si cambia lo que dicen `/terminos`, `/privacidad` y el manual de usuario, y los actualiza en el mismo commit | Daniel: lo nuevo puede afectar estas páginas |

## 1. Qué cambia en los textos

| # | Dónde | Hoy dice | Qué pasa en realidad | Cambio |
|---|---|---|---|---|
| 1 | Privacidad › Qué datos | "tus partidas favoritas y tus búsquedas guardadas" | No existen (están planteadas para el VIP) | "En preparación" |
| 2 | Términos › Moderación | "La lista de baneos es pública" | La API la sirve sin sesión, pero no hay página pública | "En preparación" |
| 3 | Términos › Mixes | "las reglas publicadas en la web" | Las reglas solo se ven en Administración › Servidores | "que vamos a publicar en la web", con "En preparación" |
| 4 | Términos › Torneos | Las PCW "no cuentan para el ranking" | Las PCW están en "Pronto" en el menú. No mueven el ELO de los jugadores, pero sí cuentan para el ranking de equipos (`team_results`, replanteo `27`) | "En preparación" y la frase corregida |
| 5 | Privacidad › Con quién | Discord: `!calladmin` y clips | También publica el aviso de la cola del matchmaking en #avisos, con el tag de quien avisa (replanteo `57`) | Se agrega |
| 6 | Términos › Torneos; Privacidad › Lo que subes | "Los capitanes reportan los resultados con capturas" | Desde el replanteo `56` el resultado lo manda el servidor reservado. La web nueva no tiene reportes con capturas | Se reescribe: lo registra el servidor y, si falla, decide un administrador. Las capturas de reportes, "En preparación" |

## 2. La regla nueva

```mermaid
flowchart LR
  R[Requerimiento nuevo] --> Q{¿Cambia lo que hace<br/>o guarda la plataforma?}
  Q -->|Datos, servicios externos,<br/>sanciones, pagos, publicación| L[Actualizar /terminos y /privacidad<br/>y sus .html]
  Q -->|Lo que ve o hace un rol| M[Actualizar el manual<br/>docs/manual/]
  Q -->|Nada| N[Una línea en DOCUMENTACION:<br/>"Sin cambios en los legales"]
  L --> C[Mismo commit que el cambio]
  M --> C
```

- `CLAUDE.md`: regla al lado de la del manual.
- `docs/bitacora/PLANTILLA.md`: sección "Términos y privacidad" en `DOCUMENTACION.md`.
- Al sacar algo de "En preparación" (cuando se implementa), se quita la marca en los dos formatos.

## 3. Orden de implementación

1. Los seis cambios en `TermsPage.tsx`, `PrivacyPage.tsx`, `terms/terminos.html` y `terms/privacidad.html`.
2. La regla en `CLAUDE.md` y en la plantilla.
3. Typecheck y pruebas de la web.
4. `DOCUMENTACION.md`, `GUIA_IMPLEMENTACION.md`, fila en el índice y `PENDIENTES.md`.

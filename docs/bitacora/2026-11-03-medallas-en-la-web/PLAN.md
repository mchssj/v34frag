# Plan: medallas en la web y demo para darlas desde el admin

> Planeación original. Estado: **propuesta**, pedida por Kyan el 2026-11-03.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Qué medallas se suben | La versión con brillo solo en el marco (elegida por Kyan el 2026-10-30) de todas: mixes y podio, perfil, equipos y la tanda nueva, con sus bloqueadas | Es la versión que combina con el frontend |
| Medallas de misiones | Se diseñan ahora, pero el sistema de misiones no se toca | Kyan: "hacelas, pero todavía no vamos a hacer las misiones" |
| Íconos de nivel | Los 10 anillos con número y colores de FACEIT | Decidido el 2026-11-03 (cortes de FACEIT y números) |
| Dónde | `web/frontend/public/medallas/` y `web/frontend/public/niveles/`, con un `catalogo.json` | Kyan eligió subirlas al frontend, no a Supabase Storage |
| Dar medallas | Una **demo** (`/demo/admin-medallas`) con datos de ejemplo, para que Killuaz (pantalla) y Daniel (API y base) la hagan bien | Kyan eligió demo, no la versión real |
| La demo de medallas que ya existe | Pasa a leer de `public/medallas/` y se borra `public/demo-medallas/` | No tener los mismos SVG dos veces |

## 1. El flujo completo

```mermaid
flowchart LR
    A[SVG en Pictures<br/>brillo solo en el marco] --> B[public/medallas<br/>+ catalogo.json]
    N[Anillos de nivel] --> C[public/niveles]
    B --> D[/demo/medallas]
    B --> E[/demo/admin-medallas]
    E --> F[Elegir medalla]
    F --> G[Elegir temporada]
    G --> H[Elegir jugadores]
    H --> I[Dar a todos de una]
    I --> J[Lista de otorgadas<br/>editar temporada o quitar]
```

## 2. Medallas de misiones

Forma nueva (portapapeles, porque las misiones son una lista de tareas) y el mismo sistema de siempre: metal = nivel, color e ícono = tipo.

| Medalla | Niveles |
|---|---|
| Misiones completadas | 10, 50, 100, 250 |
| Semanas completas (todas las semanales de una semana) | 4, 12, 26, 52 |
| Misiones difíciles | 10, 25, 50 |
| Semana perfecta (todas las semanales y el bonus) | única |
| Primeros pasos completos | única |

## 3. Archivos en el frontend

- `public/medallas/<carpeta>/<nombre>.svg` y `bloqueada_<nombre>.svg`, con las mismas carpetas que en Pictures.
- `public/medallas/catalogo.json`: una fila por medalla con archivo, clave, título, categoría, grupo, nivel (metal) y si es de equipo.
- `public/niveles/nivel_01.svg` a `nivel_10.svg`.

## 4. Demo de Administración › Medallas

Pantalla con el estilo de Administración (`AdminHeader`, tarjetas, tablas), en tres pasos en una misma vista:

1. **Medalla:** buscador y filtros por categoría sobre el catálogo, con la imagen. El título se puede editar.
2. **Temporada:** sin temporada o una de la lista.
3. **A quién:** buscar jugadores por nick o SteamID, pegar una lista (una por línea) y atajos (por ejemplo, el top 10 de la temporada elegida).

Botón "Dar a N jugadores", vista previa de cómo se ve en Logros y una tabla de otorgadas con filtros, cambio de temporada y quitar (individual o en grupo), con "Deshacer".

## 5. Lo que necesita la versión real (para Daniel)

Se anota en `docs/MEDALLAS_DATOS_REPORTER.md`: hoy `POST /api/v1/admin/players/{id}/medals` recibe solo título y emoji, y `player_medals` no deja guardar temporada en una medalla dada a mano (`player_medals_temporada`).

## 6. Requisitos antes de empezar

Ninguno: todo es local y en `kyan/pruebas`.

## 7. Orden de implementación

1. Diseñar las medallas de misiones y aplicarles el brillo solo en el marco.
2. Copiar todo a `public/medallas/` y `public/niveles/` con el catálogo.
3. Pasar `/demo/medallas` a la carpeta nueva.
4. Hacer `/demo/admin-medallas`.
5. Probar en el navegador, `tsc` y `eslint`.
6. Documentar y commitear lo que Kyan apruebe.

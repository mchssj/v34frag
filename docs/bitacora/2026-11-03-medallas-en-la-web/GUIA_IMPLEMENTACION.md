# Medallas en la web y demo para darlas desde el admin: guía de implementación

## Estado

| Parte | Estado |
|---|---|
| Medallas de misiones (diseño) | **Hecho** el 2026-11-03, en Pictures (`nuevas/perfil/` y `nuevas/brillo_solo_marco/nuevas/perfil/`) |
| Medallas, catálogo e íconos de nivel en `web/frontend/public/` | **Hecho** |
| `/demo/medallas` lee de `public/medallas/` y se borró `public/demo-medallas/` | **Hecho** |
| `/demo/admin-medallas` | **Hecho**, probado en el navegador en local |
| Versión real (API, base y pantalla de Administración) | **Pendiente**: ver "Lo que falta para la versión real" en la documentación |

## Cómo se hizo

1. **Medallas de misiones:** se sumó un bloque al generador de la tanda nueva (`nuevas/generar_medallas_nuevas.py` en Pictures) con la forma de portapapeles, cinco tipos y sus colores. Después se les aplicó el brillo solo en el marco con `aplanar.py --marco`.
2. **Catálogo:** se armó con los datos de los generadores (título, categoría, grupo, metal y si es de equipo) y se sumaron a mano las 9 de `mejoradas/` (mixes y podio).
3. **Copia al frontend:** las 246 medallas y sus bloqueadas desde `nuevas/brillo_solo_marco/`, más los 10 anillos de `nuevas/niveles/`. Son las últimas versiones: brillo solo en el marco, la USP sola en pistolas y la AK-47 sola en AK/M4.
4. **Demo de medallas:** cambió de `/demo-medallas/manifiesto.json` a `/medallas/catalogo.json` y de `/demo-medallas/niveles/` a `/niveles/`.
5. **Demo del admin:** módulo `src/features/medals/` (catálogo, datos de ejemplo y página) y la ruta `demo.admin-medallas.tsx`.

## Cambios respecto del plan

- El plan decía anotar lo que necesita el backend en `docs/MEDALLAS_DATOS_REPORTER.md`. Se anotó en la `DOCUMENTACION.md` de esta bitácora, porque el `CLAUDE.md` del frontend pide no tocar el resto de `docs/` cuando se trabaja en el frontend.
- En la prueba, el filtro de temporada de "Otorgadas" marcaba "Todas" y "Sin temporada" a la vez (las dos usaban un valor vacío) y la fecha salía en UTC. Se corrigieron antes de terminar.

## Pruebas

- `pnpm exec tsc -p tsconfig.app.json --noEmit` y `eslint` sobre los archivos nuevos: sin errores.
- En el navegador (`http://localhost:5175`, configuración `frontend-repo`):
  - `/demo/medallas` carga las 246 medallas del catálogo nuevo.
  - `/demo/admin-medallas`: se eligió "Victorias 50", se agregó el top 10 y se dio a 10 jugadores. Aparecieron en "Otorgadas" con la temporada BETA y el filtro por temporada funciona.
- No se probó en el teléfono ni en tema claro.

## Para volver atrás

Borrar `web/frontend/public/medallas/`, `public/niveles/`, `src/features/medals/` y `src/routes/demo.admin-medallas.tsx`, y restaurar `public/demo-medallas/` y `src/routes/demo.medallas.tsx` desde el commit anterior.

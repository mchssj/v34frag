# Administración › Temporadas, Clips y Ranking de equipos: guía de implementación

## Estado

Implementado y probado en local el 2026-10-29, sin commit, en la rama `feat/frontend-fase-1`. Sin desplegar.

## Archivos

Todo en `web/frontend/`:

| Archivo | Cambio |
|---|---|
| `src/auth/permissions.ts` | Secciones `seasons`, `clips` y `ranking` (solo admin) |
| `src/features/shell/nav.ts` y `nav.test.ts` | Ítems "Temporadas", "Clips" (contador `adminClips`) y "Ranking de equipos", con sus títulos |
| `src/features/shell/queries.ts` y `AppSidebar.tsx` | Contador de clips para revisar |
| `src/features/admin/ui.tsx` | `SaveBar` compartida |
| `src/features/admin/maps/AdminMapsPage.tsx` | Usa `SaveBar` |
| `src/features/admin/seasons/` | Nueva, con `seasons.test.ts` |
| `src/features/admin/clips/` | Nueva, con `clips.test.ts` |
| `src/features/admin/ranking/` | Nueva, con `ranking.test.ts` |
| `src/features/admin/rules.test.ts` | Permisos de las tres secciones |
| `src/routes/_app/admin.seasons.tsx`, `admin.clips.tsx` y `admin.ranking.tsx` | Nuevas |
| `src/routeTree.gen.ts` | Regenerado por el plugin del router |

## Despliegue

Pendiente, con el resto del frontend nuevo (`docs/bitacora/2026-10-28-despliegue-vps-ovh/`). La API ya tiene los endpoints.

## Pruebas

### Automáticas

- `pnpm typecheck`, `pnpm lint` y `pnpm build`: en verde.
- `pnpm test`: 47 archivos y 329 pruebas en verde. Las nuevas cubren:
  - el reinicio con los ejemplos del contrato y la hora de cierre (06:00 de Argentina);
  - los tramos: sin huecos, dentro del top, y agregar, quitar y cambiar el fin;
  - el `PATCH` de la temporada y el de los clips, que llevan solo lo que cambió;
  - los rangos de los formularios;
  - qué clips se mostrarían, con los topes y el VIP aparte;
  - el desempate del ranking con otros puntos;
  - permisos y títulos de las secciones.

### Contra la API local

Con un script de Playwright, guardado fuera del repo, y una cuenta admin `@test.local`:

1. **Temporadas:** se cambió el nombre de la temporada activa desde la web y se guardó; la API lo devolvió cambiado. Se vieron la prueba del reinicio (2200 → 2021), la vista previa con datos reales de la base local, Próxima temporada, Historial y el diálogo de Terminar temporada con su resumen. **No se terminó la temporada:** el diálogo se cerró sin confirmar.
2. **Clips:** "Para revisar" (vacío en la base local) y Reglas: se cambiaron los clips por partida y la prioridad de 3K, y se guardaron; la API los devolvió así.
3. **Ranking de equipos:** se cambió el valor de torneo a 40 y se guardó.
4. Captura a 390 px en tema claro. Sin errores en la consola.

Al terminar, el script volvió a dejar el nombre de la temporada, las reglas de los clips y los puntos del ranking como estaban, y comprobó que la configuración de la próxima temporada no cambió. Se borraron la cuenta de prueba y las capturas, que tenían nicks de la base local.

Sin probar con datos: un clip reprocesado en "Para revisar" (la base local no tiene ninguno) y terminar una temporada de verdad.

## Cómo revertir

Todavía no hay commit y algunos de estos archivos también tienen cambios sin commit de otros requerimientos. Hay que deshacer a mano los cambios de la tabla y borrar `src/features/admin/seasons/`, `clips/`, `ranking/` y las tres rutas.

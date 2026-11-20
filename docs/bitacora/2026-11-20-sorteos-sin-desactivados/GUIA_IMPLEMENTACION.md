# Los sorteos no dan artículos desactivados: guía de implementación

## Qué se hizo

1. `131_sorteos_sin_desactivados.sql`: `create or replace` de `admin_code_create`, copiada de la `126` con un script (líneas 423 a 494) y una validación más después de la de `vip_reward`. La inversa es la función de la `126` tal cual.
2. `AdminCodesSection.tsx`: la búsqueda pide `active: "true"` (el filtro de la API es texto) y se quitó el aviso "No está en la tienda" del artículo elegido.
3. `AdminCodesSection.test.tsx`: el artículo de prueba es activo y el servidor de prueba devuelve la lista vacía si la búsqueda no pide solo activos.
4. Manual del admin: `admin/tienda-y-puntos.md`, paso de **Artículo de la tienda**.

## Pruebas

- Base local: con la sesión de un admin, `admin_code_create('item', 'marco-fuego')` (inactivo) falla con "Ese artículo no está en la tienda: actívalo para sortearlo" y `admin_code_create('item', 'nombre-c4')` crea el código. Dentro de una transacción con `rollback`.
- `pnpm exec vitest run src/features/shop`: 46 de 46. `tsc` sin errores.

## Despliegue

**Sin desplegar.** La `131` en la base de producción y la web, en cualquier orden: con la web vieja, el admin vería los inactivos pero la base los rechazaría.

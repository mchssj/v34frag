# Colección Equipo táctico y otros nombres y temas: guía de implementación

## Qué se hizo

1. CSS de los 22 artículos en `cosmeticos.css`, con su cuadro fijo para movimiento reducido.
2. `COLLECTIONS.tactico` en `types.ts` y los 22 en `catalogo.json` (versión 15). Se generaron con un script de una sola lista que también escribió la migración y la inversa, para que digan lo mismo.
3. `130_tienda_equipo_tactico.sql`: inserta los 22 en `shop_items` (orden 3700 a 3910, después del último del catálogo). Falla si alguno ya existe.
4. Inversa: borra los 22 (lo comprado se borra en cascada y lo equipado queda en `null`). No borra nada si un código canjeable (`126`) da uno de estos artículos.

## Cambios respecto del plan

- En la primera revisión, Flashbang en modo claro casi no se veía y Headshot se iba poniendo rojo antes del impacto: una animación de `color` interpola desde el principio de la vuelta. Se pasó el blanco y el rojo a una copia con `::after` que solo aparece en el destello o el impacto.
- El barrido del tema Radar se veía tenue: la parte brillante del degradado cónico pasó del 30 % al 45 % del giro.
- Daniel notó (2026-11-20) que el tema animaba solo la tarjeta de la foto y el nombre. Ahora cada regla de tema que anima, brilla o dibuja algo (51 reglas, de todos los temas, y la del fondo de Visión nocturna) también vale para las tarjetas de la página del jugador que no van dentro de otra tarjeta. Con movimiento reducido, esas tarjetas quedan quietas. Se revisaron todas las reglas `.tema-*` que dibujan algo: ninguna quedó solo en la primera tarjeta. Revisado con capturas (Visión nocturna, Radar y C4, con una tarjeta anidada). Las reglas de series y armas están en el bloque de `generar_kits.py`: si alguien vuelve a generarlo, pierde estos selectores. Con un tema Radar, las tarjetas de abajo quedan rellenas con el color del tema (el borde giratorio lo necesita).
- `119_tienda.sql` todavía comprueba que haya 369 artículos al cargar el catálogo; los 22 nuevos los agrega la 130, no la 119. Si alguien vuelve a generar el bloque de la 119 desde `catalogo.json`, tiene que dejar afuera estos 22.

## Pruebas

- Capturas con Playwright sobre el Vite local (5173), con los estilos de la app: los 10 nombres a 24 px y 14 px y los 12 temas en una tarjeta, en modo oscuro, en modo claro y con movimiento reducido. Sin errores en la página.
- `130` aplicada en la base local (`supabase_db_v34frag-api`): quedan 6 nombres y 6 temas en `tactico`, y 4 nombres y 6 temas en `cs`.
- Inversa probada en la base local dentro de una transacción con `rollback`: borra los 22.
- `pnpm exec vitest run src/features/shop`: 46 de 46. `tsc` sin errores.
- No se probó comprar y equipar con una cuenta, ni el perfil con uno de los temas nuevos puesto. No se probó en Safari ni en Firefox (el borde de Radar usa `@property`, que Firefox soporta desde la versión 128).

## Despliegue

**Sin desplegar.** Va en este orden:

1. La web (`web/frontend`): el CSS tiene que estar antes que los artículos, o se verían sin efecto.
2. `130_tienda_equipo_tactico.sql` en la base de producción (VPS, por túnel).

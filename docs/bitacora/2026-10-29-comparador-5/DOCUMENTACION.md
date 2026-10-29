# Comparador de hasta 5 jugadores (prototipo VIP)

Prototipo de Kyan para que lo terminen Daniel (backend) y Esteban (frontend). Está en el frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), en `/demo/comparador`, solo con `pnpm dev`.

## Qué hace

- **Cuántos:** sin VIP se comparan hasta 2 jugadores, como en el comparador actual. Con VIP, hasta 5.
- **Agregar y sacar:** los jugadores se suman con **Agregar jugador**, un buscador por alias. Cada uno aparece como chip y se saca con la X.
- **Tabla:** tiene una fila por métrica y una columna por jugador. Las métricas son ELO, ELO máximo, Rating, K/D, HS %, ADR, % de victorias y mixes.
  - El mejor de cada fila lleva un trofeo.
  - Cada valor tiene una barra con el color del jugador.
  - La última fila dice en cuántas métricas es el mejor cada uno.
- **Gráfico:** muestra el ELO de los últimos 30 mixes, con una línea por jugador y el nick al final de cada línea. Al pasar el mouse aparece una línea vertical con los valores de todos en ese mix.
- **URL:** los jugadores van en la URL (`?p=fako99,daook,…`).
- **Sin VIP:** si el link trae más de 2 jugadores, se comparan los primeros 2 y aparece un aviso.

## Colores

Los 5 colores son los primeros de la paleta categórica de la skill de dataviz: azul, naranja, aqua, amarillo y magenta, con un tono para claro y otro para oscuro. Se validaron con su script en los dos modos:

- Pasan las pruebas de separación para daltonismo.
- En modo claro, aqua, amarillo y magenta quedan por debajo de 3:1 de contraste contra el fondo. Por eso el color nunca va solo: siempre va con el nick al lado, y la tabla es la vista accesible.

El color **sigue al jugador**: si sacás a uno, los demás no cambian de color, y el que entra toma el color libre más bajo.

## Archivos (en `web/frontend/src/`)

- `features/compare5/demo.ts`: los jugadores del buscador más ADR, victorias, ELO máximo e historial.
- `features/compare5/MultiCompare.tsx`
- `routes/demo.comparador.tsx`

## Lo que falta para la versión real

- **Daniel:** que `GET /api/v1/players/compare` acepte hasta 5 jugadores (hoy recibe `a` y `b`), con el VIP chequeado del lado del servidor.
- **Esteban:** reemplazar `/players/compare` por este comparador, o sumarle los jugadores.

## Pruebas (2026-10-29)

- Con "Comparar el top 5" se ven los 5 jugadores, cada uno con su color, y los trofeos repartidos (3, 0, 3, 1 y 1 de 8).
- El tooltip del gráfico muestra los 5 valores ordenados.
- No hubo errores en la consola.
- No se revisó en modo claro.

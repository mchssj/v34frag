---
titulo: Vincular tu SteamID
resumen: Une tu cuenta de la web con tu cuenta de Steam con el comando !claim, en el chat de tu primera partida.
orden: 2
---

Vincular tu SteamID le dice a CM League que esa cuenta de Steam es tuya. Desde ese momento, todo lo que juegas suma a tu perfil y a tu ELO.

No hace falta vincularlo antes de jugar: lo haces en tu primera partida.

## Paso a paso

1. Busca partida en [Jugar](/play) (ver [Buscar partida en el matchmaking](/help/jugador/buscar-partida)).
2. Cuando entres al servidor de la partida, la sala de la web te muestra el comando con tu código, por ejemplo `!claim ABC123`. También lo puedes generar en **Mi perfil** › [Vinculación](/profile/link).
3. Escríbelo en el chat del juego.
4. El servidor te responde en el chat y la web se actualiza sola: tu cuenta aparece en **Cuentas de juego**.

> **Ojo:** el código dura 10 minutos y se usa una sola vez. Si se vence, genera otro. Puedes generar hasta 5 por hora.

## Si ya jugabas antes de vincular

No pierdes nada. Si jugaste con esa cuenta de Steam antes de tener cuenta en la web, al vincularla se suman a tu perfil todas esas partidas y tu ELO se calcula con ellas.

## Si juegas desde otra PC

En v34 tu SteamID puede cambiar de una PC a otra. Si entras a una partida con un SteamID que no está vinculado, el servidor te deja de espectador y te pide el `!claim`:

1. Genera un código en **Mi perfil** › [Vinculación](/profile/link).
2. Escribe `!claim` y el código en el chat de la partida.
3. El SteamID nuevo se suma a tu perfil al instante y pasas a tu equipo.

Puedes tener hasta {{claim.max_steam_ids}} cuentas de Steam en tu perfil. Si llegaste al máximo, desvincula una (**Desvincular**, en su fila) o pídele a un admin que te suba el tope.

## Qué significa cada respuesta del servidor

| Mensaje | Qué pasó y qué hacer |
|---|---|
| Listo: tu cuenta quedó vinculada | Todo bien |
| Listo: sumamos este SteamID a tu ficha | Era una cuenta extra y ya quedó sumada |
| Código inválido o vencido | Genera otro código en la web |
| Ese SteamID pertenece a otra cuenta | Esa cuenta de Steam ya está vinculada a otra cuenta de la web. Si es tuya, habla con un admin |
| Ese SteamID es de otra ficha | Esa cuenta de Steam tiene historial en otro perfil. Pídele a un admin que lo revise |
| Llegaste al máximo de SteamID | Ya tienes {{claim.max_steam_ids}} cuentas: desvincula una o habla con un admin |
| Demasiados intentos | Espera unos minutos y vuelve a probar |

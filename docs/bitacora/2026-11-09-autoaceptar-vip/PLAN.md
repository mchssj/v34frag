# Plan: autoaceptar partida para VIP

> Planeación original (Kyan, 2026-11-09). Estado: **aprobada** en el mismo pedido: "que los vips puedan dejar en el matchmaking para autoaceptar partida" y "que se active en la pestaña de configuración".

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Dónde se prende | Jugar › **Configuración**, la ventana que hasta ahora era solo del sonido. Pasa a llamarse "Configuración" y suma el interruptor arriba | Pedido de Kyan, con captura |
| Quién | Solo VIP. Sin VIP, el interruptor se ve con candado y ofrece hacerse VIP | Es una ventaja de comodidad, como el sonido propio |
| Quién acepta | La base, al armar la sala: un trigger en `mm_lobby_players` marca `accepted_at` | Funciona aunque la pestaña esté cerrada o en segundo plano. Si lo hiciera la web, dependería de que esté abierta |
| VIP vencido | La preferencia queda guardada, pero no se aplica | Igual que el modo oculto de las visitas |
| Sanciones | Sin cambios: si no se conecta a tiempo, se sanciona como siempre | El VIP nunca da ventaja sobre las sanciones (términos) |
| Aviso | Igual suena y salta la ventana, que dice "Aceptada sola" | Que el jugador sepa que tiene partida |
| Dónde se guarda | `user_preferences.preferences.mm_auto_accept` | Como `profile_incognito` |

## 1. El flujo completo

```mermaid
sequenceDiagram
  participant T as mm_tick
  participant B as Base
  participant W as Web
  T->>B: arma la sala (accepting)
  B->>B: insert mm_lobby_players
  B->>B: trigger: VIP con autoaceptar → accepted_at = now()
  B-->>W: lobby.found
  W->>W: suena; la ventana dice "Aceptada sola"
```

## 2. Base (replanteo 89)

- `mm_auto_accept_on(user)`.
- `mm_set_auto_accept(p_on)`, que pide VIP para prenderlo.
- El trigger `mm_lobby_players_auto_accept`.
- `mm_my_profile` suma `auto_accept: { enabled, allowed }`.

## 3. API

`PUT /api/v1/mm/auto-accept { enabled }`, que devuelve el estado completo.

## 4. Web

- `MmState.auto_accept`.
- `source.setAutoAccept`, con la demo incluida.
- `AutoAcceptSetting` en `SoundSettingsDialog` ("Configuración").
- `AcceptDialog` con `auto`.

## 5. Ramas

Es matchmaking: la base y la API van en `feat/frontend-fase-1` y en `feat/mm-claim-en-sala`, y la web solo en `feat/frontend-fase-1` (`CLAUDE.md`). Hoy se hace en `kyan/pruebas`. Pasarlo a esas ramas lo decide Daniel o Kyan.

## 6. Orden de implementación

1. La web y la demo.
2. La migración y la inversa.
3. La ruta.
4. Las pruebas, el manual y los términos.

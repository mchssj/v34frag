# Plan: `!banlist` en los servidores

> Planeación original. Pedido por Daniel el 2026-11-26 ("agrega el !banlist en los servidores").

En el juego no había forma de ver la lista de baneos: solo `sm_csstv_bans` (cuántos tiene la copia) y `csstv_bans_test` (si alguien entraría). La lista completa está en la web.

## Decisiones

| Tema | Decisión |
|---|---|
| Comando | `!banlist [texto]` (`sm_banlist`), con el texto como filtro (SteamID, IP, nombre o motivo) |
| Quién | Moderadores y admins (flag `b`, como `!ban`) |
| De dónde | De la web en el momento (`csstv_ban_list`, replanteo `154`), no de la copia local: la copia no tiene nombres ni motivos |
| Qué muestra | En la consola de quien lo pide: SteamID o IP, hasta cuándo (o permanente), nombre y motivo, los más nuevos primero, como mucho 200. En el chat, cuántos |
| Formato | Texto compacto (`;` y `\|`, sin comillas ni barras), como la copia local: el plugin no lee JSON |
| Versión | Reporter 2.12.1, a #1, #2 y #3 |

```mermaid
sequenceDiagram
    participant M as Moderador
    participant S as Servidor
    participant B as Base
    M->>S: !banlist cheater
    S->>B: csstv_ban_list(token)
    B-->>S: s|STEAM|vence|nombre|motivo|origen;i|IP|...
    S-->>M: Lista filtrada en la consola
```

Manual: `moderador/comandos-en-el-servidor.md`. Términos y privacidad: sin cambios.

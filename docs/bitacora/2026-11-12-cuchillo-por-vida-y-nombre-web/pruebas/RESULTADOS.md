# Pruebas en el servidor local (2026-11-12)

Reporter 2.12.0 en `C:\Users\Agus\Downloads\cssds`, con `csstv_send 0`, `csstv_include_bots 1` y 4 bots quietos (`bot_zombie 1`).

| Prueba | Qué se hizo | Resultado |
|---|---|---|
| Cuchillo por tiempo | `sm_live knife`; `sm_slap` a un T (60) y a un CT (30 + 50); se dejó correr el reloj (1:45) | El juego dio la ronda a los CT, el plugin la dio al T: `vida CT 120 (2 vivos) contra T 140 (2 vivos)` |
| Nombre de la web | `csstv_webnick_fake 4 "Kyan Ñandú"` | El bot pasó a llamarse `Kyan Ñandú` (UTF-8 bien) |
| No se puede cambiar | `sm_rename #4 OtroNombre` | Volvió a `Kyan Ñandú` en el cuadro siguiente |
| VIP | `csstv_webnick_fake 5 "NickWeb" 1` y `sm_rename #5 ElVip` | No se le tocó el nombre y pudo cambiarlo |

Sin probar todavía: `csstv_web_nick` en una base (Docker no estaba corriendo) y un jugador real cambiándose el nombre desde la consola (`name …`).

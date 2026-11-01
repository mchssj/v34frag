#!/usr/bin/env bash
# Pruebas de csstv_calladmin con bots: servidor local con la build CALLADMIN_DEBUG, el grupo "Moderador" en
# admin_groups.cfg, "sm_cancelmatch" "g" en admin_overrides.cfg y csstv_reporter cargado con csstv_send 0.
# Uso: bash calladmin.sh   (ADDR=192.168.1.113:27016 por defecto)
# OJO: manda 3 reportes [PRUEBA] al canal real de Discord y cambia de mapa varias veces.
# Después: borrar de data/csstv/queue/ la partida de la prueba y volver csstv_include_bots a 0.
set -u
source "$(dirname "$0")/lib.sh"

setup() {   # 4 bots: 0 moderador, 1 root, 2 y 3 sin permisos
  B=($(bots))
  role "${B[0]}" Moderador >/dev/null; role "${B[1]}" root >/dev/null
  Q "csstv_send 0" "csstv_include_bots 1" >/dev/null
}
Q "mp_autoteambalance 0" "mp_limitteams 0" "bot_join_after_player 0" "bot_kick" "bot_quota 0" \
  "bot_add_ct" "bot_add_ct" "bot_add_t" "bot_add_t" >/dev/null
sleep 3; setup

echo "1. Permisos del moderador (1 = tiene acceso):"
for c in sm_cancelmatch sm_live sm_swap sm_map sm_kick sm_ban sm_unban sm_mute sm_slay sm_rcon sm_cvar sm_votekick sm_admin csstv_mod_map; do
  Q "csstv_calladmin_access $(uid "${B[0]}") $c" | grep -av "^>" | sed 's/^/  /'
done

echo "2. Sin permisos y root: el plugin no se mete (sigue basecommands):"
mark; cmd "${B[2]}" "sm_map de_nada"; cmd "${B[1]}" "sm_map de_nada"; since "calladmin\]\|respuesta" | sed 's/^/  /'

echo "3. Mix en vivo: el moderador no cambia el mapa (sm_map, !map, /map y sin mapa):"
Q "bot_stop 0" "sm_live" >/dev/null; sleep 10
mark; for c in "sm_map de_dust" "say !map de_dust" "say /map de_dust" "sm_map"; do cmd "${B[0]}" "$c"; done
sleep 4; since "respuesta\|changed map" | sed 's/^/  /'; echo "  mapa: $(map)"

echo "4. Reportes a Discord con mix en curso (texto con @everyone y markdown, menú con reportado y 'Otro'):"
Q "csstv_calladmin_global_cooldown 0" >/dev/null; mark
cmd "${B[3]}" 'sm_calladmin hay un cheater @everyone **negrita** _x_ [link](http://x.com) <@&123> \ barra ñandú 🚀'; sleep 3
Q "csstv_calladmin_menu $(uid "${B[2]}") $(uid "${B[3]}") cheats" >/dev/null; sleep 3
Q "csstv_calladmin_menu $(uid "${B[1]}") $(uid "${B[3]}") otro" >/dev/null; cmd "${B[1]}" "say grita por el micro todo el mix"; sleep 3
cmd "${B[1]}" "sm_calladmin otra vez"
since "respuesta\|Discord" | sed 's/^/  /'

echo "5. Cooldown global, cancelar, webhook inválido y vacío:"
WH="$(sed -n 's/^DISCORD_CALLADMIN_WEBHOOK=//p' "E:/Css V34 Web/v34frag/.env")"; mark
Q "csstv_calladmin_global_cooldown 30" >/dev/null; cmd "${B[0]}" "sm_calladmin no se envía"
Q "csstv_calladmin_global_cooldown 0" "csstv_calladmin_cooldown 0" >/dev/null
Q "csstv_calladmin_menu $(uid "${B[3]}") 0 otro" >/dev/null; cmd "${B[3]}" "say cancelar"
Q 'csstv_calladmin_webhook "https://discord.com/api/webhooks/1/invalido"' >/dev/null; cmd "${B[3]}" "sm_calladmin webhook malo"; sleep 3
Q 'csstv_calladmin_webhook ""' >/dev/null; cmd "${B[3]}" "sm_calladmin sin webhook"
Q "csstv_calladmin_webhook \"$WH\"" "csstv_calladmin_cooldown 120" "csstv_calladmin_global_cooldown 30" >/dev/null
since "respuesta a ${B[3]}\|respuesta a ${B[0]}" | sed 's/^/  /'; tail -1 "$LOGS/calladmin.log" | sed 's/^/  /'

echo "6. Empieza un mix en los 3 s del cambio de mapa del moderador: se cancela:"
Q "sm_cancelmatch" >/dev/null; sleep 2; mark; cmd "${B[0]}" "sm_map de_dust"; Q "sm_live" >/dev/null; sleep 5
since "changed map\|cancelado" | sed 's/^/  /'; echo "  mapa: $(map)"; Q "sm_cancelmatch" >/dev/null; sleep 2

echo "7. Consola: sm_map lo hace basecommands, el plugin no aparece:"
mark; Q "sm_map de_dust" >/dev/null; sleep 1; since "changed map\|calladmin\]" | sed 's/^/  /'; waitmap de_dust; setup

echo "8. !map del moderador sin mix, con parte del nombre (mirage -> de_mirage_rc1):"
mark; cmd "${B[0]}" "say !map mirage"; since "changed map" | sed 's/^/  /'; waitmap de_mirage_rc1; echo "  mapa: $(map)"

Q "bot_kick" "csstv_include_bots 0" >/dev/null

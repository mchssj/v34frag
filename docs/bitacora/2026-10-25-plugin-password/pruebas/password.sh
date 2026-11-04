#!/usr/bin/env bash
# Pruebas de csstv_password con bots: servidor local con la build PW_DEBUG y el grupo "Moderador" en
# admin_groups.cfg. Sin csstv_reporter cargado (así no se envía nada a la Supabase real).
# Uso: bash password.sh   (ADDR=192.168.1.113:27016 por defecto)
# Cambia sv_password en server.cfg para las pruebas 8 a 10 y lo deja como estaba. Cambia de mapa varias veces.
set -u
RCON="E:/Css V34 Web/v34frag/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
SRV="E:/CSS DEDICATED SERVER/server/cstrike"
ADDR="${ADDR:-192.168.1.113:27016}"
PASS="$(sed -n 's/^rcon_password "\(.*\)"/\1/p' "$SRV/cfg/server.cfg")"
LOGS="$SRV/addons/sourcemod/logs"
Q() { python "$RCON" "$ADDR" "$PASS" "$@" 2>&1 | grep -av "rcon from"; }

bots() { Q status | sed -n 's/^# *[0-9]* "\([^"]*\)" BOT.*/\1/p' | grep -v '^SourceTV$'; }
uid() { Q status | sed -n "s/^# *\([0-9]*\) \"$1\" BOT.*/\1/p"; }
cmd() { Q "csstv_pw_fakecmd $(uid "$1") $2" >/dev/null; sleep 0.5; }
role() { Q "csstv_pw_setadmin $(uid "$1") $2" | grep -av "^>"; }
state() { Q csstv_pw_state | grep -a "estado=" | sed 's/^/  /'; }
map() { Q status | sed -n 's/^map *: *\([^ ]*\).*/\1/p'; }
mark() { sleep 0.3; LAST="$(ls -t "$LOGS"/L*.log | head -1)"; LINES="$(wc -l < "$LAST")";
  GLAST="$(ls -t "$SRV"/logs/[Ll]*.log | head -1)"; GLINES="$(wc -l < "$GLAST")"; }
since() { tail -n +"$((LINES + 1))" "$LAST" | grep -a "$1" | sed 's/^L [^:]*:[^:]*:[^:]*: //; s/^\[csstv_password[^]]*\] //' | sed 's/^/  /'; }
# Lo que llegó al chat de todos (log del motor): no tiene que aparecer la contraseña.
chat() { tail -n +"$((GLINES + 1))" "$GLAST" | grep -a ' say\(_team\)\? "' | sed 's/^L [^:]*:[^:]*:[^:]*: //' | sed 's/^/  chat: /'; }
waitmap() { for _ in $(seq 1 40); do sleep 1; [ "$(map)" = "$1" ] && [ "$(bots | wc -l)" -ge 4 ] && return 0; done; echo "  (el mapa no cambió a $1)"; return 1; }
setup() {   # 4 bots: 0 y 1 moderadores, 2 root, 3 sin permisos
  B=($(bots))
  role "${B[0]}" Moderador >/dev/null; role "${B[1]}" Moderador >/dev/null; role "${B[2]}" root >/dev/null
}
setcfgpw() { sed -i "s/^sv_password .*/sv_password \"$1\"/" "$SRV/cfg/server.cfg"; }

Q "mp_autoteambalance 0" "mp_limitteams 0" "bot_join_after_player 0" "bot_kick" "bot_quota 0" \
  "bot_add_ct" "bot_add_ct" "bot_add_t" "bot_add_t" >/dev/null
sleep 3; setup
echo "Bots: 0=${B[0]} (mod) 1=${B[1]} (mod) 2=${B[2]} (root) 3=${B[3]} (sin permisos)"

echo "1. Sin permisos: !pw abc, sm_npw y sm_rpw"
mark; cmd "${B[3]}" "say !pw abc"; cmd "${B[3]}" "sm_npw"; cmd "${B[3]}" "sm_rpw"; sleep 0.5; since "respuesta"; state; chat

echo "2. Moderador: !pw abc (solo él ve el valor)"
mark; cmd "${B[0]}" "say !pw abc"; since "respuesta"; state; chat

echo "3. Con comillas: !pw \"abc2\" y por consola sm_pw \"abc3\""
mark; cmd "${B[0]}" 'say !pw "abc2"'; state; cmd "${B[0]}" 'sm_pw "abc3"'; since "respuesta a ${B[0]}"; state; chat

echo "4. Inválidas: con espacio, 33 caracteres, con ; y con ñ (no cambia)"
mark; cmd "${B[0]}" "say !pw con espacio"; cmd "${B[0]}" "say !pw $(printf 'a%.0s' $(seq 1 33))"
cmd "${B[0]}" 'sm_pw "a;b"'; cmd "${B[0]}" "sm_pw cañon"; since "respuesta a ${B[0]}"; state

echo "5. !rpw (root): 6 caracteres sin 0 o 1 l i"
mark; cmd "${B[2]}" "say !rpw"; since "respuesta"; state; chat

echo "6. !pw sin texto: el que la puso y otro moderador; /pw silencioso"
mark; cmd "${B[2]}" "say !pw"; cmd "${B[1]}" "say /pw"; since "respuesta"; chat

echo "7. !npw del moderador 1 y !npw otra vez"
mark; cmd "${B[1]}" "say !npw"; since "respuesta"; state; mark; cmd "${B[1]}" "say !npw"; since "respuesta"; state

echo "8. server.cfg con contraseña base y !pw del plugin: cambio de mapa (queda la del plugin)"
setcfgpw "base123"; cmd "${B[0]}" "sm_pw plugin1"; mark; Q "changelevel de_cbble" >/dev/null; waitmap de_cbble; setup; state; since "por fuera"

echo "9. !npw y cambio de mapa con server.cfg con contraseña (queda sin contraseña)"
cmd "${B[0]}" "sm_npw"; Q "changelevel de_dust2" >/dev/null; waitmap de_dust2; setup; state

echo "10. !pw, cambio por rcon y cambio de mapa (manda el server.cfg)"
cmd "${B[0]}" "sm_pw plugin2"; mark; Q "sv_password rcon1" >/dev/null; sleep 0.5; since "por fuera"; state
Q "changelevel de_cbble" >/dev/null; waitmap de_cbble; setup; state

echo "11. Lo pone un bot, se va y vuelve con el mismo nombre (en la build de depuración se lo reconoce por nombre)"
N="${B[0]}"; cmd "$N" "sm_pw vuelve1"; Q "kick \"$N\"" >/dev/null; sleep 1; Q "bot_add_ct" >/dev/null; sleep 3
NEW="$(bots | grep -vxF -e "${B[1]}" -e "${B[2]}" -e "${B[3]}" | head -1)"; Q "sm_rename \"#$(uid "$NEW")\" $N" >/dev/null; sleep 2
role "$N" Moderador >/dev/null; mark; cmd "$N" "say !pw"; cmd "${B[1]}" "say !pw"; since "respuesta a"; setup

echo "12. csstv_pw_enabled 0 en el cfg: desactivado y no se reaplica en el cambio de mapa (vuelve base123)"
PCFG="$SRV/cfg/sourcemod/csstv_password.cfg"; cp "$PCFG" "$PCFG.bak"
sed -i 's/^csstv_pw_enabled .*/csstv_pw_enabled "0"/' "$PCFG"; Q "csstv_pw_enabled 0" >/dev/null
mark; cmd "${B[1]}" "sm_pw nada"; since "respuesta a ${B[1]}"
Q "changelevel de_dust2" >/dev/null; waitmap de_dust2; setup; state; mv "$PCFG.bak" "$PCFG"; Q "csstv_pw_enabled 1" >/dev/null

echo "13. Log de SourceMod (LogAction): quién y qué, sin la contraseña"
grep -a "contraseña al servidor" "$LOGS"/L*.log | grep -av "respuesta a" | tail -6 | sed 's/^.*: "/  "/'

setcfgpw ""; Q "sv_password \"\"" "bot_kick" >/dev/null
echo "Listo: server.cfg con sv_password vacío."

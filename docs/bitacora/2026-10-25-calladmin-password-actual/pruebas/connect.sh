#!/usr/bin/env bash
# Pruebas de la contraseña en el connect de !calladmin: servidor local con las builds CALLADMIN_DEBUG y PW_DEBUG,
# sin csstv_reporter. El webhook apunta a una URL inválida: no sale nada a Discord. El cuerpo queda en el log.
# Uso: ADDR=172.24.0.1:27016 bash connect.sh   (no cambia de mapa)
set -u
source "$(dirname "$0")/../../2026-10-19-calladmin-moderadores/pruebas/lib.sh"
pw() { Q "csstv_pw_fakecmd $(uid "$1") $2" >/dev/null; sleep 0.5; }
pwrole() { Q "csstv_pw_setadmin $(uid "$1") $2" >/dev/null; }
body() { sleep 1; since "cuerpo" | grep -ao '"name":"Servidor","value":"[^}]*' | sed 's/^/  /'; }

Q 'csstv_calladmin_webhook "https://discord.com/api/webhooks/1/invalido"' "csstv_calladmin_cooldown 0" \
  "csstv_calladmin_global_cooldown 0" "csstv_include_bots 1" "bot_kick" "bot_quota 0" "bot_join_after_player 0" \
  "bot_add_ct" "bot_add_t" >/dev/null
sleep 3; B=($(bots | grep -v '^SourceTV$')); pwrole "${B[0]}" Moderador

echo "1. Sin contraseña"
Q 'csstv_calladmin_address "1.2.3.4:27015"' 'sv_password ""' >/dev/null; mark; cmd "${B[1]}" "sm_calladmin prueba 1"; body

echo "2. Con !pw abc de csstv_password"
pw "${B[0]}" "sm_pw abc"; mark; cmd "${B[1]}" "sm_calladmin prueba 2"; body

echo "3. Dirección vieja con '; password vieja' y sv_password nueva"
Q 'csstv_calladmin_address "1.2.3.4:27015; password vieja"' 'sv_password "nueva"' >/dev/null; mark; cmd "${B[1]}" "sm_calladmin prueba 3"; body

echo "4. sv_password con comillas y barra (JSON válido)"
Q 'sv_password a\b"c' >/dev/null; Q "sv_password" | grep -a '"sv_password"' | sed 's/^/  consola: /'
mark; cmd "${B[1]}" "sm_calladmin prueba 4"; sleep 1
since "cuerpo" | sed 's/^.*cuerpo ([0-9]* bytes): //' | PYTHONIOENCODING=utf-8 python -c "import sys,json; d=json.loads(sys.stdin.read()); print('  JSON válido:', [f['value'] for f in d['embeds'][0]['fields'] if f['name']=='Servidor'])"

echo "5. !npw"
pw "${B[0]}" "sm_npw"; mark; cmd "${B[1]}" "sm_calladmin prueba 5"; body

Q 'sv_password ""' 'csstv_calladmin_address ""' "bot_kick" "csstv_include_bots 0" >/dev/null

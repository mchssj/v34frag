#!/usr/bin/env bash
# Prueba local del nick de la web con los mismos plugins que el #1 y la 134, contra la base LOCAL (nunca la real).
#
#   bash prueba_local.sh preparar  <repo>        respalda, baja los .smx del #1, aplica la 134, arranca y prueba con bots
#   bash prueba_local.sh ficha     <repo> <steam64> <nick> [vip|privada]   ficha de prueba para un SteamID (la de Daniel)
#   bash prueba_local.sh status    <repo>        jugadores conectados (para leer el SteamID)
#   bash prueba_local.sh restaurar <repo>        apaga el servidor y deja plugins, cfg, cola y base local como estaban
#
# El respaldo queda en E:\CSS DEDICATED SERVER\respaldo_prueba_134 hasta "restaurar" (sobrevive a un reinicio de la PC).
set -u
CMD="${1:?preparar | ficha | status | restaurar}"
REPO="${2:?falta la carpeta del repo}"
SV="/e/CSS DEDICATED SERVER/server"
CS="$SV/cstrike"
SM="$CS/addons/sourcemod"
BK="/e/CSS DEDICATED SERVER/respaldo_prueba_134"
DB=supabase_db_v34frag-api
CFG="$CS/cfg/sourcemod/csstv_reporter.cfg"
PORT=27016
A=127.0.0.1:$PORT
RC="$REPO/docs/bitacora/2026-10-11-qol-servidor/pruebas/rcon.py"
PW=$(grep -a -m1 '^rcon_password' "$CS/cfg/server.cfg" | sed -E 's/^rcon_password *"?([^" ]*)"?.*/\1/' | tr -d '\r')
TOKEN="tok-e2e134-local"
SRV=e2e13400-0000-4000-8000-000000000001
U_VIP=e2e13400-0000-4000-8000-000000000002
U_COM=e2e13400-0000-4000-8000-000000000003
U_PRI=e2e13400-0000-4000-8000-000000000004
U_DAN=e2e13400-0000-4000-8000-000000000005
SEED="'$U_VIP', '$U_COM', '$U_PRI', '$U_DAN'"
OK=0; FALLAS=0

sql() { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qtA "$@"; }
rcon() { python "$RC" "$A" "$PW" "$1" 2>/dev/null; }
R() { for c in "$@"; do rcon "$c" >/dev/null || echo "  (rcon falló: $c)"; done; }
paso() { printf '\n== %s\n' "$*"; }
ok() { OK=$((OK + 1)); echo "  OK: $*"; }
falla() { FALLAS=$((FALLAS + 1)); echo "  FALLA: $*"; }
nota() { echo "  NOTA: $*"; }
esta() { rcon status | grep -a -q -F "\"$1\""; }
nombre() { # nombre <descripción> <nombre esperado> [segundos]
  local i
  for i in $(seq 1 "${3:-10}"); do esta "$2" && { ok "$1 ($2)"; return 0; }; sleep 1; done
  falla "$1: no aparece '$2'. status: $(rcon status | grep -a -o -E '"[^"]+" +BOT' | tr '\n' ' ')"
}
uid() { rcon status | grep -a -E "\"$1\" +BOT" | sed -E 's/^# *([0-9]+) .*/\1/'; }
rpc() { # rpc <steam>: respuesta de csstv_web_nick por PostgREST, como la pide el plugin
  curl -s -X POST "http://127.0.0.1:54321/rest/v1/rpc/csstv_web_nick" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
    -H "Content-Type: application/json" -d "{\"p_token\":\"$TOKEN\",\"p_steam\":\"$1\"}"; }
anon() { (cd "$REPO/web/backend" && pnpm exec supabase status -o env 2>/dev/null | sed -n -E 's/^ANON_KEY="?([^"]*)"?/\1/p'); }

restaurar() {
  paso "Restauración"
  taskkill //IM srcds.exe //F >/dev/null 2>&1; sleep 2
  if [ -d "$BK/plugins" ]; then
    find "$SM/plugins" -maxdepth 1 -name '*.smx' -delete
    cp "$BK"/plugins/*.smx "$SM/plugins/"
    cp "$BK/csstv_reporter.cfg" "$CFG"
    # cfg que crearon los plugins del #1 y el local no tenía
    for f in "$CS"/cfg/sourcemod/*.cfg; do grep -qxF "$(basename "$f")" "$BK/cfgs.txt" || { rm -f "$f"; echo "  borrado $(basename "$f") (lo creó la prueba)"; }; done
    echo "  plugins y cfg del local de vuelta ($(ls "$SM"/plugins/*.smx | wc -l) .smx)"
  else
    echo "  no hay respaldo en $BK: no se tocan los plugins"
  fi
  rm -f "$SM"/data/csstv/queue/* 2>/dev/null
  sql >/dev/null <<SQL
delete from vip_memberships where user_id in ($SEED);
delete from players where user_id in ($SEED);
delete from auth.users where id in ($SEED);
-- las partidas de bots que mandó el servidor de prueba (con csstv_send 1 van a la base local); lo demás, en cascada
delete from matches where server_id = '$SRV';
delete from game_servers where id = '$SRV';
SQL
  sql < "$REPO/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/134_nick_de_la_web.sql" >/dev/null
  sql -c "notify pgrst, 'reload schema'" >/dev/null
  echo "  base local: sin lo sembrado y sin la 134 (csstv_web_nick: $(sql -c "select to_regprocedure('public.csstv_web_nick(text,text)') is not null"))"
  [ -d "$BK/plugins" ] && rm -rf "$BK"
}

case "$CMD" in
restaurar) restaurar; exit 0 ;;
status) rcon status | grep -a -E '^#'; exit 0 ;;
ficha)
  STEAM="${3:?falta el steam64}"; NICK="${4:?falta el nick}"; TIPO="${5:-}"
  PRIV=public; [ "$TIPO" = privada ] && PRIV=private
  sql >/dev/null <<SQL
delete from vip_memberships where user_id = '$U_DAN';
delete from players where user_id = '$U_DAN';
delete from auth.users where id = '$U_DAN';
insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
  values ('$U_DAN', 'daniel@e2e134.local', now(), now(), 'authenticated', 'authenticated');
-- Si la copia ya tiene una ficha con ese SteamID, se le saca para que la de prueba sea la dueña.
update players set steam_id = null where steam_id = '$STEAM' and user_id is distinct from '$U_DAN';
insert into players (nick, steam_id, user_id, privacy) values ('x', '$STEAM', '$U_DAN', '$PRIV');
update profiles set tag = '$NICK' where id = '$U_DAN';
SQL
  [ "$TIPO" = vip ] && sql -c "insert into vip_memberships (user_id, source, starts_at, ends_at) values ('$U_DAN', 'manual', now() - interval '1 day', now() + interval '1 day')" >/dev/null
  ANON=$(anon)
  echo "Ficha de prueba: $(sql -c "select nick || ' (' || privacy || ')' from players where user_id = '$U_DAN'"). La base responde: $(rpc "$STEAM")"
  echo "Para que la vuelva a pedir: 'retry' en tu consola (o reconectar)."
  exit 0 ;;
preparar) ;;
*) echo "comando desconocido: $CMD"; exit 1 ;;
esac

paso "Preparación"
tasklist 2>/dev/null | grep -qi srcds && { echo "Hay un srcds corriendo: apágalo antes."; exit 1; }
[ -d "$BK" ] && { echo "Ya hay un respaldo en $BK: corre 'restaurar' antes."; exit 1; }
[ "$(sql -c "select to_regprocedure('public.csstv_web_nick(text,text)') is not null")" = f ] || { echo "La base local ya tiene csstv_web_nick."; exit 1; }
ANON=$(anon); [ -n "$ANON" ] || { echo "No se pudo leer la clave pública de la base local."; exit 1; }
KEY=$(grep -a '^SFTP_CSS_API_KEY=' "$REPO/.env" | cut -d= -f2- | tr -d '\r"')

mkdir -p "$BK/plugins" "$BK/prod"
cp "$SM"/plugins/*.smx "$BK/plugins/"
cp "$CFG" "$BK/csstv_reporter.cfg"
ls "$CS"/cfg/sourcemod/*.cfg | xargs -n1 basename > "$BK/cfgs.txt"
rm -f "$SM"/data/csstv/queue/* 2>/dev/null
echo "  respaldo: $(ls "$BK"/plugins | wc -l) .smx del local y su csstv_reporter.cfg"

API="https://panel-mvzg.com/api/client/servers/157703b5/files"
LISTA=$(curl -s -H "Authorization: Bearer $KEY" -H "Accept: application/json" "$API/list?directory=/cstrike/addons/sourcemod/plugins" \
  | python -c "import sys,json; print('\n'.join(f\"{x['attributes']['name']} {x['attributes']['size']}\" for x in json.load(sys.stdin)['data'] if x['attributes']['name'].endswith('.smx')))" | tr -d '\r')
while read -r f size; do
  curl -s -H "Authorization: Bearer $KEY" "$API/contents?file=/cstrike/addons/sourcemod/plugins/$f" -o "$BK/prod/$f"
  [ "$(stat -c %s "$BK/prod/$f")" = "$size" ] || { echo "  $f bajó con otro tamaño: se cancela"; rm -rf "$BK"; exit 1; }
done <<< "$LISTA"
find "$SM/plugins" -maxdepth 1 -name '*.smx' -delete
cp "$BK"/prod/*.smx "$SM/plugins/"
# El local (Windows) necesita el emulador para que entre un cliente de ClientMod; en el #1 lo hace el lado del servidor de Linux.
cp "$BK/plugins/clientmod_emulator.smx" "$SM/plugins/"
echo "  plugins del #1 puestos en el local: $(ls "$SM"/plugins/*.smx | wc -l)"
trap 'echo; echo "Algo falló: corre \"bash $0 restaurar $REPO\"."' ERR

sql < "$REPO/supabase/replanteo/134_nick_de_la_web.sql" >/dev/null
sql >/dev/null <<SQL
insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
  values ('$U_VIP', 'vip@e2e134.local', now(), now(), 'authenticated', 'authenticated'),
         ('$U_COM', 'comun@e2e134.local', now(), now(), 'authenticated', 'authenticated'),
         ('$U_PRI', 'privada@e2e134.local', now(), now(), 'authenticated', 'authenticated');
insert into players (nick, steam_id, user_id, privacy) values
  ('x', '76561199990001341', '$U_VIP', 'public'), ('x', '76561199990001342', '$U_COM', 'public'), ('x', '76561199990001343', '$U_PRI', 'private');
update profiles set tag = 'FichaVip' where id = '$U_VIP';
update profiles set tag = 'FichaComun' where id = '$U_COM';
update profiles set tag = 'FichaPrivada' where id = '$U_PRI';
insert into vip_memberships (user_id, source, starts_at, ends_at) values ('$U_VIP', 'manual', now() - interval '1 day', now() + interval '1 day');
insert into game_servers (id, name, token_hash, active) values ('$SRV', 'E2E 134', encode(sha256(convert_to('$TOKEN', 'UTF8')), 'hex'), true);
notify pgrst, 'reload schema';
SQL
sleep 2

paso "Base local: csstv_web_nick por PostgREST"
r=$(rpc 76561199990001342); echo "$r" | grep -q '"nick": *"FichaComun"' && echo "$r" | grep -q '"vip": *false' && ok "ficha común: nick y sin VIP" || falla "ficha común: $r"
r=$(rpc STEAM_0:0:1014867807); echo "$r" | grep -q '"FichaComun"' && ok "la misma, con SteamID de 32 bits" || falla "SteamID de 32 bits: $r"
r=$(rpc 76561199990001341); echo "$r" | grep -q '"vip": *true' && ok "ficha VIP: vip true" || falla "ficha VIP: $r"
r=$(rpc 76561199990001343); echo "$r" | grep -q '"ok": *false' && ok "ficha privada: ok false" || falla "ficha privada: $r"
r=$(rpc 76561199990009999); echo "$r" | grep -q '"ok": *false' && ok "sin ficha: ok false" || falla "sin ficha: $r"
r=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:54321/rest/v1/rpc/csstv_web_nick" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{"p_token":"malo","p_steam":"76561199990001342"}')
[ "$r" != 200 ] && ok "token inválido: HTTP $r" || falla "token inválido respondió 200"

python - "$CFG" "$ANON" "$TOKEN" <<'PY'
import sys, re
p, anon, tok = sys.argv[1:]
s = open(p, encoding='utf-8', errors='replace').read()
want = {
  'csstv_api_url': 'http://127.0.0.1:54321/rest/v1/rpc/ingest_server_chunk', 'csstv_api_key': anon, 'csstv_server_token': tok,
  'csstv_send': '1', 'csstv_include_bots': '1', 'csstv_min_players': '1', 'csstv_mm': '0', 'csstv_demo': '0', 'csstv_clips': '0',
  'csstv_claim': '0', 'csstv_ready_knife': '0', 'csstv_overtime': '0', 'csstv_lo3': '0', 'csstv_server_tag': 'e2e', 'csstv_web_names': '1', 'csstv_auto_ready': '0',
}
for k, v in want.items():
    line = f'{k} "{v}"'
    s, n = re.subn(rf'^{k} .*$', line, s, flags=re.M)
    if n == 0:
        s += '\n' + line
open(p, 'w', encoding='utf-8').write(s + '\n')
PY

paso "Servidor local (los argumentos de start_server.bat, en 127.0.0.1)"
WD=$(cd "$SV" && pwd -W)
powershell.exe -NoProfile -Command "Start-Process -FilePath '$WD/srcds.exe' -WorkingDirectory '$WD' -ArgumentList '-console -game cstrike -ip 127.0.0.1 -port $PORT +maxplayers 20 +tv_enable 1 +map de_dust2 -tickrate 66 -insecure'"
for i in $(seq 1 90); do rcon "csstv_reporter_version" | grep -q 2.10.2 && break; sleep 1; done
[ "$i" = 90 ] && { falla "el servidor no arrancó o no cargó el reporter 2.10.2"; exit 1; }
ok "reporter 2.10.2 cargado"
echo "  Plugins que no cargaron (en el #1 sí):"
rcon "sm plugins list" | grep -a -i -E "error|failed|<" | sed 's/^/    /'
R "bot_quota_mode normal" "bot_join_after_player 0" "bot_chatter off" "mp_autoteambalance 0" "mp_limitteams 0" "bot_stop 1"
[ "$(rcon sv_password | grep -a -o '"sv_password" = "[^"]*"')" = '"sv_password" = ""' ] || nota "el servidor quedó con contraseña: $(rcon sv_password | head -1)"

paso "Calentamiento: el nick de la web (simulado con csstv_webnick_fake: los bots no piden a la base)"
R "bot_add_ct Brett" "bot_add_ct Arnold" "bot_add_t Kurt"; sleep 3
R "csstv_webnick_fake $(uid Brett) FichaBrett" "csstv_webnick_fake $(uid Arnold) FichaArnold 1" "csstv_webnick_fake $(uid Kurt) \"\""
nombre "Brett (ficha) pasa al de su ficha" FichaBrett
nombre "Arnold (VIP) conserva el suyo" Arnold
nombre "Kurt (sin ficha) conserva el suyo" Kurt
R "sm_rename FichaBrett BrettNuevo"; sleep 3
nombre "Brett vuelve al de su ficha" FichaBrett
R "sm_rename Arnold ArnoldVip"; sleep 3
nombre "Arnold (VIP) se lo cambia" ArnoldVip

paso "En vivo"
R "sm_live mr2"; sleep 10
rcon "csstv_state" | grep -a -o '"csstv_state" = "[^"]*"' | sed 's/^/  /'
R "sm_rename FichaBrett BrettVivo"; sleep 3
nombre "en vivo, Brett vuelve al de su ficha" FichaBrett
R "sm_rename ArnoldVip ArnoldVivo"; sleep 3
if esta ArnoldVivo; then ok "en vivo, Arnold (VIP) se lo cambia"
else nota "en vivo, Arnold (VIP) NO se lo pudo cambiar: lo bloquea csstv_qol 1.4.0 (bloqueo en vivo para todos)"; fi
R "sm_rename Kurt KurtVivo"; sleep 3
esta Kurt && ok "en vivo, Kurt (sin ficha) sigue bloqueado por csstv_qol" || nota "en vivo, Kurt (sin ficha) se lo cambió"

printf '\n== Bots: %d bien, %d fallas\n' "$OK" "$FALLAS"
cat <<TXT

Listo para entrar: connect 127.0.0.1:$PORT  (sin contraseña; la partida de bots sigue en vivo).
  1. bash $0 status $REPO                              -> tu SteamID
  2. bash $0 ficha  $REPO <steam64> <nick>             -> ficha sin VIP; 'retry' en la consola
  3. bash $0 ficha  $REPO <steam64> <nick> vip         -> con VIP;      'retry'
  4. bash $0 restaurar $REPO                           -> al terminar (obligatorio)
TXT

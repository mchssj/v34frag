#!/usr/bin/env bash
# Plugin 1.3.0 con bots (build CSSTV_DEBUG) en el servidor local de Daniel.
#   A: !cancelmatch con rondas jugadas  => cola con status cancelled, motivo admin, demo true; el demo se conserva.
#   B: !cancelmatch sin rondas          => no se guarda nada y el demo se borra.
#   C: cambio de mapa a mitad           => cola con status cancelled, motivo map_change.
#   D: partida completa                 => cola con status finished, demo true.
# Uso: escenario_canceladas.sh <host:puerto> <rcon_password>
# OJO: el cambio de mapa vuelve a cargar csstv_reporter.cfg; csstv_send 0 se repite después, si no los
# resultados de prueba se envían a la Supabase configurada (pasó el 2026-10-12).
Q="$(dirname "$0")/../../2026-10-11-qol-servidor/pruebas"
SRV="E:/CSS DEDICATED SERVER/server/cstrike"
C="$SRV/addons/sourcemod/logs/L$(date +%Y%m%d).log"   # log de SourceMod (console.log llega con retraso)
QUEUE="$SRV/addons/sourcemod/data/csstv/queue"
OFF=0
R() { OFF=$(stat -c %s "$C"); python "$Q/rcon.py" "$1" "$2" "${@:3}" >/dev/null 2>&1 || echo "RCON falló: ${*:3}"; }
wait_for() {
  local end=$(( $(date +%s) + $2 )) pos
  until pos=$(tail -c +$((OFF + 1)) "$C" | grep -abo "$1" | head -1 | cut -d: -f1) && [ -n "$pos" ]; do
    [ "$(date +%s)" -ge "$end" ] && { echo "TIMEOUT: $1"; return 1; }
    sleep 1
  done
  OFF=$((OFF + pos + 1))
  echo "OK: $1"
}
H="$1"; P="$2"
show() { f=$(ls -t "$QUEUE"/*.json 2>/dev/null | head -1); [ -n "$f" ] && python -c "import json,sys; d=json.load(open(sys.argv[1],encoding='utf-8')); print('   cola:', d['match_uid'], d.get('status'), d.get('cancel_reason'), d.get('cancelled_by'), 'demo=', d.get('demo'), 'marcador', d['score'], 'winner', d['winner'], 'jugadores', len(d['players']))" "$f"; }
LIVE() {
  R "$H" "$P" "sm_live force"
  wait_for "Grabando demo" 30 || exit 1
  UID_=$(tail -c 3000 "$C" | grep -o "Grabando demo csstv_demos/[^ ]*\.dem" | tail -1 | sed 's#.*/##; s#\.dem##')
  echo "   uid: $UID_"
}

R "$H" "$P" "sm_cancelmatch" "csstv_send 0" "csstv_include_bots 1" "csstv_maxrounds 2" "csstv_overtime 0" "csstv_lo3 0" \
  "bot_join_after_player 0" "bot_quota 6" "mp_roundtime 1" "mp_freezetime 1"
sleep 3

echo "== A: cancelar con rondas jugadas"
LIVE
wait_for "Ronda 2/2" 200 || exit 1
R "$H" "$P" "sm_cancelmatch"
wait_for "cancelada por un admin" 10 || exit 1
show; sleep 4; ls "$SRV/csstv_demos" | grep -qi "$UID_" && echo "   demo conservado" || echo "   FALLA: demo borrado"
sleep 3

echo "== B: cancelar sin rondas"
LIVE
R "$H" "$P" "sm_cancelmatch"
wait_for "sin rondas jugadas" 10 || exit 1
sleep 5; ls "$SRV/csstv_demos" | grep -qi "$UID_" && echo "   FALLA: demo sigue" || echo "   demo borrado"

echo "== C: cambio de mapa a mitad"
LIVE
wait_for "Ronda 2/2" 200 || exit 1
R "$H" "$P" "changelevel de_dust2"
wait_for "cancelada por cambio de mapa" 30 || exit 1
show
sleep 25                                            # carga del mapa nuevo
R "$H" "$P" "csstv_send 0" "csstv_include_bots 1" "csstv_maxrounds 2" "csstv_overtime 0" "csstv_lo3 0" "bot_quota 6" "mp_roundtime 1" "mp_freezetime 1"
sleep 3

echo "== D: partida completa"
LIVE
wait_for "terminada" 400 || exit 1
show

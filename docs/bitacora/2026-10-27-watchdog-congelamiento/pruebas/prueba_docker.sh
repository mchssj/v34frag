#!/bin/bash
# Prueba de watchdog.sh dentro de la imagen del panel del #1 (ulisesadrian/debian7-css:v34), con el srcds_run real
# del #1 (parcheado con parchear_srcds_run.py) y el juego falso. Tiempos cortos por variables de entorno.
# Uso (desde la raíz del repo, en Git Bash):
#   MSYS_NO_PATHCONV=1 docker run --rm -v "<carpeta con srcds_run parcheado>:/srv:ro" -v "<repo>:/repo:ro" \
#     --entrypoint "" ulisesadrian/debian7-css:v34 bash /repo/docs/bitacora/2026-10-27-watchdog-congelamiento/pruebas/prueba_docker.sh
set -u
cd /home/container
P=/repo/docs/bitacora/2026-10-27-watchdog-congelamiento/pruebas
cp /srv/srcds_run . && cp /repo/server/watchdog/watchdog.sh . && chmod +x srcds_run watchdog.sh
for b in srcds_i686 srcds_i486 srcds_amd; do cp "$P/juego_falso.pl" $b; chmod +x $b; done
mkdir -p cstrike/addons/sourcemod/logs cstrike/addons/sourcemod/data cstrike/cfg/csstv
LOG=cstrike/addons/sourcemod/logs/watchdog.log
C=cstrike/cfg/csstv
export WATCHDOG_INTERVAL=2 WATCHDOG_LIMIT=10 WATCHDOG_GRACE=6 WATCHDOG_KILL_AFTER=5

fallas=0
falla() { echo "FALLA: $1"; fallas=$((fallas + 1)); }
# Espera (hasta $3 s, 30 por defecto) a que el log tenga $1.
ok() {
  for _ in $(seq "${3:-30}"); do grep -q -- "$1" "$LOG" && { echo "OK: $2"; return; }; sleep 1; done
  falla "$2 (no está: $1)"
}
game() { pidof -x srcds_i686 srcds_i486 srcds_amd | awk '{print $1}'; }
stopped() { awk '{print $3}' "/proc/$1/stat" 2>/dev/null; }
# Espera un proceso del juego distinto de $1 y lo devuelve.
next_game() { for _ in $(seq 30); do g=$(game); test -n "$g" && test "$g" != "$1" && { echo "$g"; return; }; sleep 1; done; }

# Como el panel: el comando de inicio, sin -debug (RESTART viene prendido). -timeout 2: reinicio rápido.
./srcds_run -game cstrike -console -port 27062 -tickrate 101 -timeout 2 > srcds.out 2>&1 &
RUN=$!
ok "arranca (pid" "el watchdog arranca con srcds_run"
G1=$(next_game "")
ok "juego nuevo: pid $G1, puerto 27062" "encuentra el juego y su puerto"
ok "el juego contesta (pid $G1, 0 jugadores)" "el juego contesta A2S_INFO; SourceTV no cuenta como jugador"
./watchdog.sh; sleep 1
test "$(grep -c 'arranca (pid' "$LOG")" -eq 1 && echo "OK: uno solo por contenedor" || falla "dos watchdogs"
sleep 6   # pasa el margen del arranque

echo "-- modo de prueba"
touch $C/watchdog_dry
ok "modo dry" "anota el cambio de modo"
kill -USR1 "$G1"
ok "modo de prueba: habría mandado SIGABRT" "modo de prueba: solo anota"
kill -0 "$G1" && echo "OK: modo de prueba: el juego sigue vivo" || falla "lo mató en modo de prueba"
kill -USR2 "$G1"
ok "volvió a contestar después de" "anota cuánto duró el congelamiento"

echo "-- disparador con jugadores"
echo 2 > jugadores_falsos; touch $C/watchdog_test
ok "prueba cancelada: hay 2 jugadores" "no congela con jugadores"
test ! -f $C/watchdog_test && echo "OK: borra el disparador" || falla "el disparador sigue ahí"
test "$(stopped "$G1")" != T && echo "OK: el juego sigue andando" || falla "lo detuvo con jugadores"
rm jugadores_falsos

echo "-- disparador apagado por el medio"
touch $C/watchdog_test
ok "prueba: SIGSTOP al pid $G1" "congela con el servidor vacío"
sleep 1; test "$(stopped "$G1")" = T && echo "OK: el juego quedó detenido" || falla "no quedó detenido"
touch $C/watchdog_off
ok "prueba cancelada (apagado): SIGCONT al pid $G1" "apagarlo a mitad de la prueba lo descongela"
sleep 1; test "$(stopped "$G1")" != T && echo "OK: el juego siguió" || falla "quedó detenido"
touch $C/watchdog_test
ok "prueba ignorada: el watchdog está apagado" "apagado, ignora el disparador"
rm $C/watchdog_off

echo "-- disparador en modo de prueba: de punta a punta"
touch $C/watchdog_test
ok "SIGABRT al pid $G1 (Accelerator escribe el volcado) \[prueba\]" "actúa aunque esté en modo de prueba" 40
ok "terminó a los" "el proceso terminó"
test -f "volcado_$G1.txt" && echo "OK: el juego escribió el volcado (estaba detenido: recibió la señal con SIGCONT)" || falla "sin volcado"
G2=$(next_game "$G1")
test -n "$G2" && echo "OK: srcds_run lo reinició (pid $G2)" || falla "no se reinició"
ok "juego nuevo: pid $G2" "sigue con el proceso nuevo"
ok "el juego contesta (pid $G2" "el proceso nuevo contesta"
sleep 6

echo "-- modo normal: congelamiento real"
rm $C/watchdog_dry
ok "modo on" "anota el modo normal"
kill -USR1 "$G2"
ok "SIGABRT al pid $G2 (Accelerator escribe el volcado)$" "manda SIGABRT a los 10 s" 40
test -f "volcado_$G2.txt" && echo "OK: volcado" || falla "sin volcado"
G3=$(next_game "$G2")
ok "el juego contesta (pid $G3" "reinició y contesta"
sleep 6

echo "-- proceso que no muere con SIGABRT"
kill -HUP "$G3"; sleep 1; kill -USR1 "$G3"
ok "SIGKILL (sin volcado)" "a los 5 s sin morir, SIGKILL" 45
G4=$(next_game "$G3")
test -n "$G4" && echo "OK: reinició después del SIGKILL (pid $G4)" || falla "no reinició"

echo "-- fin de srcds_run"
kill "$RUN"; kill "$(game)"
ok "srcds_run terminó: el watchdog también" "el watchdog termina con srcds_run" 15

echo; echo "== watchdog.log"; cat "$LOG"
echo "== fallas: $fallas"
exit $fallas

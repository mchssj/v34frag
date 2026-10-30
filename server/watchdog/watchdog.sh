#!/bin/bash
# Watchdog del servidor real (#1): si el juego deja de contestar A2S_INFO por 30 s seguidos, le manda SIGABRT para
# que Accelerator escriba un volcado con la pila de todos los hilos (dónde estaba trabado). srcds_run lo reinicia y
# Accelerator sube el volcado al arrancar. Plan: docs/bitacora/2026-10-27-watchdog-congelamiento/PLAN.md
#
# Lo lanza srcds_run (una línea antes de "run") desde /home/container. Corre afuera del proceso del juego: no le suma
# carga ni se traba con él. Necesita bash con /dev/udp, timeout, pidof y kill (están en ulisesadrian/debian7-css:v34).
#
# Interruptores por SFTP (se leen en cada vuelta, sin reiniciar):
#   cstrike/cfg/csstv/watchdog_off   no hace nada
#   cstrike/cfg/csstv/watchdog_dry   modo de prueba: anota, pero no manda señales
#   cstrike/cfg/csstv/watchdog_test  prueba de punta a punta, una vez: si el servidor está vacío, congela el juego
#                                    (SIGSTOP) y actúa como ante un congelamiento real, también en modo de prueba
# Log: cstrike/addons/sourcemod/logs/watchdog.log (solo cambios de estado; una línea cada 5 s nunca).

cd "$(dirname "$0")" || exit 1

INTERVAL=${WATCHDOG_INTERVAL:-5}   # segundos entre consultas
LIMIT=${WATCHDOG_LIMIT:-30}        # segundos sin respuesta para actuar
GRACE=${WATCHDOG_GRACE:-120}       # segundos sin contar desde que aparece un proceso nuevo
KILL_AFTER=${WATCHDOG_KILL_AFTER:-60}

LOG=cstrike/addons/sourcemod/logs/watchdog.log
OFF=cstrike/cfg/csstv/watchdog_off
DRY=cstrike/cfg/csstv/watchdog_dry
TEST=cstrike/cfg/csstv/watchdog_test
LOCK=cstrike/addons/sourcemod/data/watchdog.pid
BINARIES="srcds_i686 srcds_i486 srcds_amd"
PARENT=$PPID

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

# Uno solo por contenedor.
if test -f "$LOCK" && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null \
   && grep -q watchdog "/proc/$(cat "$LOCK")/cmdline" 2>/dev/null; then
  exit 0
fi
echo $$ > "$LOCK"

# Proceso del juego (el primero de los binarios de la v34 que esté vivo).
game_pid() { pidof -x $BINARIES 2>/dev/null | awk '{print $1}'; }

# Puerto del juego: -port de su línea de comandos (27015 si no tiene).
game_port() {
  tr '\0' '\n' < "/proc/$1/cmdline" 2>/dev/null | awk 'p { print; exit } $0 == "-port" { p = 1 }' | grep -E '^[0-9]+$' || echo 27015
}

# 0 si el juego contesta A2S_INFO en 2 s (el hilo principal del motor es el que contesta), y escribe los jugadores
# humanos: jugadores menos bots (SourceTV cuenta como bot). Respuesta: FFFFFFFF 'I', protocolo, nombre, mapa, carpeta y
# juego (terminados en 0), appid (2 bytes), jugadores, máximo, bots.
a2s() {
  timeout 2 bash -c 'exec 3<>/dev/udp/127.0.0.1/'"$1"' || exit 1
    printf "\xff\xff\xff\xffTSource Engine Query\x00" >&3
    dd bs=1400 count=1 <&3 2> /dev/null' 2> /dev/null | od -An -tu1 -v | awk '
    { for (i = 1; i <= NF; i++) b[n++] = $i }
    END {
      if (n < 5) exit 1
      i = 6
      for (k = 0; k < 4 && i < n; k++) { while (i < n && b[i] != 0) i++; i++ }
      i += 2
      if (i + 2 < n) print b[i] - b[i + 2]; else print "?"
    }'
}

mode() {
  if test -f "$OFF"; then echo off; elif test -f "$DRY"; then echo dry; else echo on; fi
}

log "arranca (pid $$, modo $(mode), cada ${INTERVAL} s, actúa a los ${LIMIT} s)"

pid=""; port=""; seen=""; started=0; last_ok=0; down=""; acted=""; testing=""; last_mode=$(mode)
while kill -0 "$PARENT" 2> /dev/null; do
  sleep "$INTERVAL"
  m=$(mode)
  if test "$m" != "$last_mode"; then log "modo $m"; last_mode=$m; fi
  if test "$m" = off; then
    down=""
    test -f "$TEST" && { rm -f "$TEST"; log "prueba ignorada: el watchdog está apagado"; }
    if test -n "$testing"; then kill -CONT "$testing" 2>/dev/null; log "prueba cancelada (apagado): SIGCONT al pid $testing"; testing=""; fi
    continue
  fi

  p=$(game_pid)
  if test -z "$p"; then
    pid=""; down=""
    continue
  fi
  now=$(date +%s)
  if test "$p" != "$pid"; then
    pid=$p; port=$(game_port "$p"); seen=""; down=""; acted=""; testing=""; started=$now; last_ok=$now
    log "juego nuevo: pid $pid, puerto $port"
  fi
  # Después de actuar (en serio) sobre un proceso, se espera al siguiente.
  test "$acted" = "$pid" && test "$m" = on && continue

  if humans=$(a2s "$port"); then
    test -z "$seen" && { seen=1; log "el juego contesta (pid $pid, ${humans} jugadores)"; }
    test -n "$down" && log "volvió a contestar después de $(( $(date +%s) - last_ok )) s sin respuesta"
    last_ok=$(date +%s); down=""
    test "$m" = dry && acted=""
    if test -f "$TEST"; then
      rm -f "$TEST"
      if test "$humans" = 0; then
        log "prueba: SIGSTOP al pid $pid (servidor vacío); a los ${LIMIT} s tiene que actuar, aunque esté en modo de prueba"
        testing=$pid
        kill -STOP "$pid"
      else
        log "prueba cancelada: hay ${humans} jugadores"
      fi
    fi
    continue
  fi

  # Sin contar: el arranque y el primer mapa, y un juego que nunca contestó (puerto equivocado, por ejemplo).
  test $(( now - started )) -lt "$GRACE" && { last_ok=$now; continue; }
  test -z "$seen" && continue

  silent=$(( $(date +%s) - last_ok ))
  test -z "$down" && { down=1; log "sin respuesta (pid $pid)"; }
  test "$silent" -lt "$LIMIT" && continue
  test "$acted" = "$pid" && continue

  acted=$pid
  if test "$m" = dry && test "$testing" != "$pid"; then
    log "modo de prueba: habría mandado SIGABRT (${silent} s sin respuesta, pid $pid)"
    continue
  fi

  log "${silent} s sin respuesta: SIGABRT al pid $pid (Accelerator escribe el volcado)$(test -n "$testing" && echo ' [prueba]')"
  kill -ABRT "$pid" 2>/dev/null
  # Si estaba detenido (la prueba), recién recibe la señal al continuar.
  kill -CONT "$pid" 2>/dev/null
  testing=""
  waited=0
  while kill -0 "$pid" 2>/dev/null && test "$waited" -lt "$KILL_AFTER"; do sleep 1; waited=$(( waited + 1 )); done
  if kill -0 "$pid" 2>/dev/null; then
    log "sigue vivo después de ${KILL_AFTER} s: SIGKILL (sin volcado)"
    kill -KILL "$pid" 2>/dev/null
  else
    log "terminó a los ${waited} s; srcds_run lo reinicia"
  fi
done

log "srcds_run terminó: el watchdog también"
rm -f "$LOCK"

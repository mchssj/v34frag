#!/usr/bin/env bash
# Suma una llave SSH al VPS (plan docs/bitacora/2026-10-28-despliegue-vps-ovh, sección 3.5). Se corre en el servidor:
#
#   sudo bash agregar-acceso.sh ubuntu daniel-portatil.pub         otra llave para un usuario que ya existe
#   sudo bash agregar-acceso.sh kyan kyan.pub [--sudo]             usuario nuevo con su llave (y sudo si hace falta)
#
# Quitar un acceso: borrar la línea de la llave en ~usuario/.ssh/authorized_keys, o `sudo gpasswd -d usuario cmleague-ssh`.

set -euo pipefail

SSH_GROUP=cmleague-ssh
usuario="${1:-}"; llave="${2:-}"; conSudo="${3:-}"
falla() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || falla "correr con sudo"
[[ "$usuario" =~ ^[a-z][a-z0-9_-]{1,31}$ ]] || falla "uso: agregar-acceso.sh <usuario> <archivo.pub> [--sudo]"
[[ -f "$llave" ]] || falla "no existe $llave"
[[ -z "$conSudo" || "$conSudo" == --sudo ]] || falla "el tercer argumento solo puede ser --sudo"
[[ "$usuario" != cmleague && "$usuario" != root ]] || falla "$usuario no puede entrar por SSH"
# Una sola línea, y que sea una llave pública válida (nunca una privada).
[[ $(grep -c . "$llave") -eq 1 ]] || falla "$llave tiene que tener una sola línea"
grep -q 'PRIVATE KEY' "$llave" && falla "$llave es una llave PRIVADA: hay que mandar la .pub"
ssh-keygen -lf "$llave" >/dev/null 2>&1 || falla "$llave no es una llave pública SSH"

if ! id "$usuario" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$usuario"
  passwd -l "$usuario" >/dev/null
  echo "Usuario $usuario creado"
fi
casa=$(getent passwd "$usuario" | cut -d: -f6)
install -d -m 700 -o "$usuario" -g "$usuario" "$casa/.ssh"
touch "$casa/.ssh/authorized_keys"
if grep -qF "$(cut -d' ' -f2 "$llave")" "$casa/.ssh/authorized_keys"; then
  echo "La llave ya estaba"
else
  cat "$llave" >> "$casa/.ssh/authorized_keys"
  echo "Llave agregada: $(ssh-keygen -lf "$llave")"
fi
chown "$usuario:$usuario" "$casa/.ssh/authorized_keys"
chmod 600 "$casa/.ssh/authorized_keys"
usermod -aG "$SSH_GROUP" "$usuario"

if [[ "$conSudo" == --sudo ]]; then
  # Sin contraseña, como ubuntu: los usuarios nuevos no tienen contraseña.
  echo "$usuario ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$usuario.tmp"
  chmod 440 "/etc/sudoers.d/90-$usuario.tmp"
  visudo -c -f "/etc/sudoers.d/90-$usuario.tmp" >/dev/null || { rm -f "/etc/sudoers.d/90-$usuario.tmp"; falla "sudoers no valida"; }
  mv "/etc/sudoers.d/90-$usuario.tmp" "/etc/sudoers.d/90-$usuario"
  echo "$usuario tiene sudo"
fi
echo "Listo: $usuario puede entrar con ssh $usuario@<IP del VPS>"

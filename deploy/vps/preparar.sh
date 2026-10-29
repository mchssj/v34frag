#!/usr/bin/env bash
# Prepara el VPS de OVH para la web de CMLeague (plan docs/bitacora/2026-10-28-despliegue-vps-ovh, sección 3).
# Se corre una vez con sudo, desde la carpeta deploy/vps copiada al servidor:
#
#   sudo CONSOLE_PASSWORD_HASH='<hash>' bash preparar.sh            servidor por IP ("en construcción")
#   sudo bash preparar.sh --dominios                                  Caddy con cmleague.lat y sus subdominios
#
# Se puede volver a correr: cada paso revisa si ya está hecho. No carga secretos, no despliega la aplicación,
# no toca el DNS y no reinicia el servidor.
#
# CONSOLE_PASSWORD_HASH (opcional): hash SHA-512 (openssl passwd -6) de la contraseña de emergencia de `ubuntu`.
# Sirve solo en la consola KVM del panel de OVH: SSH no acepta contraseñas.

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
APP=cmleague
SRV=/srv/$APP
ETC=/etc/$APP
SSH_GROUP=$APP-ssh
ADMIN=ubuntu
DOMINIOS=0
[[ "${1:-}" == "--dominios" ]] && DOMINIOS=1

paso() { printf '\n== %s\n' "$*"; }
falla() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# --- 3.1 Comprobaciones previas -------------------------------------------------------------------------------------
paso "3.1 Comprobaciones previas"
[[ $EUID -eq 0 ]] || falla "correr con sudo"
. /etc/os-release
[[ "$ID" == ubuntu && ( "$VERSION_ID" == 24.04 || "$VERSION_ID" == 26.04 ) ]] || falla "solo Ubuntu 24.04 o 26.04 (es $PRETTY_NAME)"
id "$ADMIN" >/dev/null 2>&1 || falla "no existe el usuario $ADMIN"
grep -qE '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-)' "/home/$ADMIN/.ssh/authorized_keys" 2>/dev/null \
  || falla "$ADMIN no tiene ninguna llave SSH: sin llave, apagar las contraseñas deja el servidor sin acceso"
for f in Caddyfile Caddyfile.ip cmleague-api.service cmleague-season.service cmleague-season.timer cmleague-notify.service \
         cmleague-notify.timer cmleague-hud.service cmleague-demos.service cmleague-demos.timer sudoers-deploy api.env.example season.env.example \
         demos.env.example demos-sftp.json.example; do
  [[ -f "$DIR/$f" ]] || falla "falta $f al lado del script"
done
echo "OK: $PRETTY_NAME, $ADMIN con llave"

# --- 3.2 Actualizar el sistema --------------------------------------------------------------------------------------
paso "3.2 Actualizar el sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get full-upgrade -y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold
apt-get install -y -q curl gnupg ca-certificates ufw fail2ban unattended-upgrades rsync

# --- 3.3 Swap de 2 GB -----------------------------------------------------------------------------------------------
paso "3.3 Swap de 2 GB"
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  [[ -f /swapfile ]] || { fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile >/dev/null; }
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/90-$APP-swap.conf
sysctl -q -p /etc/sysctl.d/90-$APP-swap.conf

# --- 3.4 Usuarios ---------------------------------------------------------------------------------------------------
paso "3.4 Usuarios"
getent group "$SSH_GROUP" >/dev/null || groupadd "$SSH_GROUP"
# Quien corre los servicios: sin shell, sin carpeta personal y sin SSH.
id "$APP" >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$APP"
# Quien sube las versiones: solo con llave. Arranca con las llaves de $ADMIN (la PC de Daniel).
if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
  passwd -l deploy >/dev/null
fi
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
[[ -s /home/deploy/.ssh/authorized_keys ]] || install -m 600 -o deploy -g deploy "/home/$ADMIN/.ssh/authorized_keys" /home/deploy/.ssh/authorized_keys
# Los dos entran por el grupo. Tiene que pasar antes de 3.5 (AllowGroups), o $ADMIN queda afuera.
usermod -aG "$SSH_GROUP" "$ADMIN"
usermod -aG "$SSH_GROUP" deploy
# Contraseña de emergencia para la consola de OVH (SSH no la acepta).
if [[ -n "${CONSOLE_PASSWORD_HASH:-}" ]]; then
  [[ "$CONSOLE_PASSWORD_HASH" == '$6$'* ]] || falla "CONSOLE_PASSWORD_HASH tiene que ser SHA-512 (openssl passwd -6)"
  usermod -p "$CONSOLE_PASSWORD_HASH" "$ADMIN"
  echo "Contraseña de consola de $ADMIN: cargada"
else
  echo "Contraseña de consola de $ADMIN: sin cambios (no vino CONSOLE_PASSWORD_HASH)"
fi

# --- 3.5 SSH: solo llaves -------------------------------------------------------------------------------------------
paso "3.5 SSH: solo llaves"
# 00- para ganarle a 50-cloud-init.conf: sshd se queda con el primer valor que lee.
cat > /etc/ssh/sshd_config.d/00-$APP.conf <<EOF
# CMLeague (deploy/vps/preparar.sh). Solo llaves, sin root, solo el grupo $SSH_GROUP.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowGroups $SSH_GROUP
MaxAuthTries 3
EOF
sshd -t || { rm -f /etc/ssh/sshd_config.d/00-$APP.conf; falla "sshd -t rechazó la configuración: se quitó y SSH quedó como estaba"; }
efectivo=$(sshd -T -C user=$ADMIN,host=localhost,addr=127.0.0.1 | grep -E '^(passwordauthentication|permitrootlogin|allowgroups) ' | tr '\n' ' ')
echo "Efectivo: $efectivo"
[[ "$efectivo" == *"passwordauthentication no"* ]] || falla "las contraseñas siguen prendidas: revisar /etc/ssh/sshd_config.d/"
systemctl try-reload-or-restart ssh.service
echo "OK. NO cerrar esta sesión hasta probar entrar desde otra."

# --- 3.6 Firewall ---------------------------------------------------------------------------------------------------
paso "3.6 Firewall (ufw)"
sed -i 's/^IPV6=.*/IPV6=yes/' /etc/default/ufw
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw limit 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP (certificados y redireccion)' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw allow 443/udp comment 'HTTP/3' >/dev/null
# 27500/udp (relay del HUD) se abre recién cuando el relay se mude al VPS (plan, 4.3).
ufw --force enable >/dev/null
ufw status verbose

# --- 3.7 fail2ban ---------------------------------------------------------------------------------------------------
paso "3.7 fail2ban"
cat > /etc/fail2ban/jail.d/$APP.conf <<'EOF'
# CMLeague (deploy/vps/preparar.sh): 7 fallos en 10 minutos, bloqueo de una hora.
[DEFAULT]
backend = systemd
findtime = 10m
maxretry = 7
bantime = 1h

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban >/dev/null 2>&1
systemctl restart fail2ban

# --- 3.8 Actualizaciones automáticas de seguridad -------------------------------------------------------------------
paso "3.8 Actualizaciones automáticas"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52$APP-unattended <<'EOF'
// CMLeague (deploy/vps/preparar.sh). Además de la seguridad de Ubuntu: Node 24 y Caddy de sus repositorios.
Unattended-Upgrade::Origins-Pattern {
  "site=deb.nodesource.com";
  "site=dl.cloudsmith.io";
};
// La hora es la del sistema (UTC): 10:00 UTC son las 07:00 de Argentina, sin mixes y después del cierre de temporada.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "10:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1

# --- 3.9 Node 24 ----------------------------------------------------------------------------------------------------
paso "3.9 Node 24"
install -d -m 755 /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/nodesource.gpg ]]; then
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
fi
echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main' \
  > /etc/apt/sources.list.d/nodesource.list
# Que nunca gane el Node 22 de Ubuntu 26.04.
cat > /etc/apt/preferences.d/nodejs <<'EOF'
Package: nodejs
Pin: origin deb.nodesource.com
Pin-Priority: 600
EOF

# --- 3.10 Caddy -----------------------------------------------------------------------------------------------------
paso "3.10 Caddy"
if [[ ! -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg ]]; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
fi
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -q
apt-get install -y -q nodejs caddy
node --version | grep -q '^v24\.' || falla "quedó instalado Node $(node --version), no el 24"

install -d -m 755 /var/log/caddy
chown caddy:caddy /var/log/caddy
# Acceso al frontend: durante el ensayo, usuario y contraseña (lo carga Daniel); después del corte, vacío.
[[ -f /etc/caddy/acceso-web.caddy ]] || echo '# Sin restricción. Durante el ensayo: basic_auth (plan, 4.2).' > /etc/caddy/acceso-web.caddy
origen="$DIR/Caddyfile.ip"
(( DOMINIOS )) && origen="$DIR/Caddyfile"
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.anterior 2>/dev/null || true
install -m 644 "$origen" /etc/caddy/Caddyfile
if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  # validate (como root) crea los .log de /var/log/caddy con dueño root, y Caddy (usuario caddy) después no los puede
  # abrir: el reload falla con "opening log writer". Pasó el 2026-10-28 con --dominios.
  chown -R caddy:caddy /var/log/caddy
  systemctl enable caddy >/dev/null 2>&1
  systemctl reload-or-restart caddy
  echo "Caddy: $(basename "$origen") cargado"
else
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile || true
  [[ -f /etc/caddy/Caddyfile.anterior ]] && cp /etc/caddy/Caddyfile.anterior /etc/caddy/Caddyfile
  falla "el Caddyfile no valida: se dejó el anterior"
fi

# --- 3.11 Carpetas y archivos de variables --------------------------------------------------------------------------
paso "3.11 Carpetas"
install -d -m 755 -o root -g root "$SRV"
for parte in api web hud; do
  install -d -m 755 -o deploy -g deploy "$SRV/$parte" "$SRV/$parte/releases"
done
# Los secretos van fuera de /srv: deploy es dueño de esas carpetas y podría reemplazarlos.
install -d -m 750 -o root -g "$APP" "$ETC"
[[ -f "$ETC/api.env" ]] || install -m 600 -o root -g root "$DIR/api.env.example" "$ETC/api.env"
[[ -f "$ETC/season.env" ]] || install -m 600 -o root -g root "$DIR/season.env.example" "$ETC/season.env"
# Demos por SFTP: las variables y las credenciales de cada servidor (las lee systemd como root; ver cmleague-demos.service).
[[ -f "$ETC/demos.env" ]] || install -m 600 -o root -g root "$DIR/demos.env.example" "$ETC/demos.env"
[[ -f "$ETC/demos-sftp.json" ]] || install -m 600 -o root -g root "$DIR/demos-sftp.json.example" "$ETC/demos-sftp.json"
ls -la "$ETC"

# --- 3.12 Servicios -------------------------------------------------------------------------------------------------
paso "3.12 Servicios de systemd"
for u in cmleague-api.service cmleague-season.service cmleague-season.timer cmleague-notify.service cmleague-notify.timer \
         cmleague-hud.service cmleague-demos.service cmleague-demos.timer; do
  install -m 644 "$DIR/$u" "/etc/systemd/system/$u"
done
systemctl daemon-reload
systemctl enable cmleague-api.service cmleague-season.timer cmleague-notify.timer >/dev/null 2>&1
systemctl start cmleague-season.timer cmleague-notify.timer
# cmleague-hud queda instalado y apagado hasta que el relay se mude (plan, 4.3).
# cmleague-demos.timer también queda apagado: se prende a mano después de completar demos.env y demos-sftp.json
# (systemctl enable --now cmleague-demos.timer; ver docs/bitacora/2026-10-28-demos-servidores-externos).

# --- 3.13 Permisos de deploy ----------------------------------------------------------------------------------------
paso "3.13 sudoers de deploy"
install -m 440 -o root -g root "$DIR/sudoers-deploy" /etc/sudoers.d/$APP-deploy.tmp
if visudo -c -f /etc/sudoers.d/$APP-deploy.tmp >/dev/null; then
  mv /etc/sudoers.d/$APP-deploy.tmp /etc/sudoers.d/$APP-deploy
else
  rm -f /etc/sudoers.d/$APP-deploy.tmp
  falla "sudoers-deploy no valida: no se instaló"
fi

# --- 3.14 Logs ------------------------------------------------------------------------------------------------------
paso "3.14 journald"
install -d -m 755 /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/$APP.conf <<'EOF'
[Journal]
Storage=persistent
SystemMaxUse=500M
EOF
systemctl restart systemd-journald

# --- 3.15 Resumen ---------------------------------------------------------------------------------------------------
paso "3.15 Resumen"
ok() { if eval "$2" >/dev/null 2>&1; then printf '  [OK]  %s\n' "$1"; else printf '  [!!]  %s\n' "$1"; fi; }
ok "SSH sin contraseñas"                 "sshd -T -C user=$ADMIN,host=localhost,addr=127.0.0.1 | grep -x 'passwordauthentication no'"
ok "SSH sin root"                        "sshd -T -C user=$ADMIN,host=localhost,addr=127.0.0.1 | grep -x 'permitrootlogin no'"
ok "$ADMIN y deploy en $SSH_GROUP"       "id -nG $ADMIN | grep -qw $SSH_GROUP && id -nG deploy | grep -qw $SSH_GROUP"
ok "Firewall activo"                     "ufw status | grep -q 'Status: active'"
ok "fail2ban vigilando SSH"              "fail2ban-client status sshd"
ok "Actualizaciones automáticas"         "systemctl is-active unattended-upgrades"
ok "Swap activo"                         "swapon --show=NAME --noheadings | grep -qx /swapfile"
ok "Node 24"                             "node --version | grep -q '^v24\.'"
ok "Caddy corriendo"                     "systemctl is-active caddy"
ok "Timer de temporadas"                 "systemctl is-active cmleague-season.timer"
ok "Timer de notificaciones"             "systemctl is-active cmleague-notify.timer"
ok "sudoers de deploy"                   "test -f /etc/sudoers.d/$APP-deploy"
echo "  Node $(node --version), $(caddy version | cut -d' ' -f1)"
if [[ -f /var/run/reboot-required ]]; then
  echo "  [!!]  Hace falta reiniciar (sudo reboot) cuando se haya probado SSH desde otra sesión."
fi

#!/usr/bin/perl
# Servidor de juego falso para probar watchdog.sh (se copia como srcds_i686, srcds_i486 y srcds_amd).
# - Contesta A2S_INFO en 127.0.0.1:<-port> como la v34 (tipo I, protocolo 7, appid 240, SourceTV como bot).
# - Jugadores humanos: el número del archivo jugadores_falsos (0 si no está).
# - Con SIGUSR1 se "congela": deja de contestar y se queda ocupando la CPU (como el #1), sin dejar de atender señales.
# - Con SIGUSR2 se descongela.
# - Con SIGABRT hace lo que Accelerator: escribe volcado_<pid>.txt y muere por la señal (srcds_run ve el crash).
# - Con SIGHUP pasa a ignorar SIGABRT (para probar el SIGKILL del watchdog).
use strict;
use warnings;
use IO::Socket::INET;

my $port = 27015;
for my $i (0 .. $#ARGV) { $port = $ARGV[$i + 1] if $ARGV[$i] eq '-port'; }
my $sock = IO::Socket::INET->new(LocalAddr => '127.0.0.1', LocalPort => $port, Proto => 'udp') or die "udp: $!";
my $frozen = 0;
my $ignore_abrt = 0;
$| = 1;
print "juego falso $$ en el puerto $port\n";

$SIG{USR1} = sub { $frozen = 1; print "congelado\n"; };
$SIG{USR2} = sub { $frozen = 0; print "descongelado\n"; };
$SIG{HUP} = sub { $ignore_abrt = 1; print "ignora SIGABRT\n"; };
$SIG{ABRT} = sub {
  return if $ignore_abrt;
  open(my $f, '>', "volcado_$$.txt"); print $f "volcado de prueba (congelado=$frozen)\n"; close $f;
  $SIG{ABRT} = 'DEFAULT';
  kill 'ABRT', $$;
};

while (1) {
  if ($frozen) { my $x = 0; $x++ while $frozen; next; }
  my $rin = ''; vec($rin, fileno($sock), 1) = 1;
  next unless select(my $rout = $rin, undef, undef, 0.2);
  my $from = $sock->recv(my $buf, 1400) or next;
  next unless $buf =~ /^\xff\xff\xff\xffTSource Engine Query/;
  my $humans = 0;
  if (open(my $f, '<', 'jugadores_falsos')) { $humans = int(<$f> // 0); close $f; }
  $sock->send("\xff\xff\xff\xffI\x07" . "juego falso\0de_dust2_ob\0cstrike\0ExtremeHost.com.ar\0" . pack('v', 240)
              . chr($humans + 1) . chr(12) . chr(1) . "dl\0\0", 0, $from);
}

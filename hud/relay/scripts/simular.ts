// Simula una partida y le manda al relay los mismos paquetes que csstv_hud, para ver el HUD sin servidor.
// Uso: pnpm simular [segundos de tv_delay, por defecto 3] [host:puerto, por defecto 127.0.0.1:<udpPort de relay.json>]
//                   [clave, por defecto la de relay.json; en el modo VPS, la del servidor (hud_key)]

import { createSocket } from "node:dgram";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const config = (process.argv[4] && process.argv[3]
  ? { key: process.argv[4], udpPort: 0 }
  : JSON.parse(readFileSync(join(process.cwd(), "relay.json"), "utf8"))) as { key: string; udpPort: number };
const tvDelay = Number(process.argv[2] ?? 3);
const [host = "127.0.0.1", port = String(config.udpPort)] = (process.argv[3] ?? "").split(":").filter(Boolean);

const T = 2;
const CT = 3;
const NAMES = ["kyansuke", "flow", "honzzq", "rbk", "traica", "juanma", "mecha", "kyan", "damper", "kalle"];
const PRIMARY_CT = ["m4a1", "m4a1", "awp", "famas", "m4a1"];
const PRIMARY_T = ["ak47", "ak47", "awp", "galil", "ak47"];

interface P {
  uid: number;
  team: number;
  alive: boolean;
  hp: number;
  armor: number;
  helmet: boolean;
  defuser: boolean;
  money: number;
  primary: string;
  secondary: string;
  active: string;
  he: number;
  flash: number;
  smoke: number;
  bomb: boolean;
  kills: number;
  deaths: number;
  damage: number;
}

const players: P[] = NAMES.map((_, i) => ({
  uid: i + 2,
  team: i < 5 ? CT : T,
  alive: true,
  hp: 100,
  armor: 100,
  helmet: true,
  defuser: i === 0,
  money: 4500,
  primary: "",
  secondary: i < 5 ? "usp" : "glock",
  active: i < 5 ? "usp" : "glock",
  he: 0,
  flash: 0,
  smoke: 0,
  bomb: i === 5,
  kills: 0,
  deaths: 0,
  damage: 0,
}));

const sock = createSocket("udp4");
let seq = 0;
let scoreT = 0;
let scoreCT = 0;
let phase = "freeze";
let phaseEnd = Date.now() + 5000;
const sent = new Map<number, string>();

const line = (p: P): string =>
  [p.uid, p.team, +p.alive, p.hp, p.armor, +p.helmet, +p.defuser, p.money, p.primary, p.secondary, p.active, p.he, p.flash, p.smoke, +p.bomb, p.kills, p.deaths, p.damage].join(",");

function send(type: string, body: string): void {
  sock.send(`CMH1|${config.key}|${++seq}|${type}|${body}`, Number(port), host);
}

function seconds(): number {
  if (phase === "over") return -1;
  return Math.max(0, Math.ceil((phaseEnd - Date.now()) / 1000));
}

function full(): void {
  send("N", players.map((p) => `${p.uid},STEAM_0:0:${p.uid * 1000},${NAMES[p.uid - 2]}`).join(";"));
  send("F", [tvDelay, "de_dust2", scoreT + scoreCT + 1, scoreT, scoreCT, phase, seconds(), players.map(line).join(";")].join("|"));
  for (const p of players) sent.set(p.uid, line(p));
}

function delta(): void {
  const changed = players.filter((p) => sent.get(p.uid) !== line(p));
  if (changed.length === 0) return;
  for (const p of changed) sent.set(p.uid, line(p));
  send("D", changed.map(line).join(";"));
}

function setPhase(p: string, secs: number): void {
  phase = p;
  phaseEnd = Date.now() + secs * 1000;
  send("E", `phase|${p}|${secs}`);
}

const pick = <X>(a: X[]): X => a[Math.floor(Math.random() * a.length)]!;

function startRound(): void {
  for (const p of players) {
    const i = (p.uid - 2) % 5;
    Object.assign(p, {
      alive: true, hp: 100, armor: 100, helmet: true, damage: 0, money: Math.max(0, p.money - 3700),
      primary: p.team === CT ? PRIMARY_CT[i] : PRIMARY_T[i], he: 1, flash: 2, smoke: 1,
    });
    p.active = p.primary;
  }
  setPhase("freeze", 5);
  full();
  setTimeout(() => setPhase("live", 105), 5000);
}

function fight(): void {
  if (phase !== "live" && phase !== "planted") return;
  const ct = players.filter((p) => p.alive && p.team === CT);
  const t = players.filter((p) => p.alive && p.team === T);
  if (ct.length === 0 || t.length === 0) return endRound(ct.length ? CT : T);
  const attacker = pick([...ct, ...t]);
  const victim = pick(attacker.team === CT ? t : ct);
  const dmg = Math.min(victim.hp, 20 + Math.floor(Math.random() * 60));
  victim.hp -= dmg;
  victim.armor = Math.max(0, victim.armor - 10);
  attacker.damage += dmg;
  if (Math.random() < 0.2 && attacker.he) attacker.he--;
  if (victim.hp <= 0) {
    victim.alive = false;
    victim.deaths++;
    attacker.kills++;
    attacker.money += 300;
    // Lo que agrega clientmod_deathnotice: asistente (a veces con flash), paredes, ciego, humo y no scope.
    const mate = pick(players.filter((p) => p.alive && p.team === attacker.team && p !== attacker).concat(attacker));
    const assister = mate !== attacker && Math.random() < 0.4 ? mate.uid : 0;
    const chance = (p: number): number => (Math.random() < p ? 1 : 0);
    const sniper = ["awp", "scout"].includes(attacker.active);
    send(
      "E",
      `kill|${attacker.uid}|${victim.uid}|${attacker.active}|${chance(0.4)}|${assister}|${assister ? chance(0.5) : 0}|${chance(0.2)}|${chance(0.1)}|${chance(0.15)}|${sniper ? chance(0.5) : 0}`,
    );
    if (victim.bomb) {
      victim.bomb = false;
      const heir = t.find((p) => p.alive && p !== victim);
      if (heir) heir.bomb = true;
    }
  }
  if (phase === "live" && Math.random() < 0.05) {
    const carrier = players.find((p) => p.bomb && p.alive);
    if (carrier) {
      carrier.bomb = false;
      send("E", `bomb|plant|${carrier.uid}`);
      setPhase("planted", 45);
    }
  }
}

function endRound(winner: number): void {
  if (winner === CT) scoreCT++;
  else scoreT++;
  if (phase === "planted") send("E", winner === CT ? `bomb|defuse|2` : `bomb|explode|0`);
  setPhase("over", -1);
  send("E", `end|${winner}|${winner === CT ? 8 : 9}`);
  for (const p of players) p.money = Math.min(16000, p.money + (p.team === winner ? 3250 : 1900));
  players[5]!.bomb = true;
  full();
  setTimeout(startRound, 5000);
}

console.log(`Simulando una partida hacia ${host}:${port} con tv_delay ${tvDelay} s. Ctrl+C para cortar.`);
startRound();
setInterval(fight, 900);
setInterval(() => {
  if (phase === "planted" && seconds() === 0) endRound(T);
  else if (phase === "live" && seconds() === 0) endRound(CT);
  delta();
}, 250);
setInterval(full, 3000);

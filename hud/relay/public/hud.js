// HUD para OBS. Recibe del relay el estado ya retrasado y lo dibuja; el reloj corre solo entre paquetes.
import { TEAM_CT, TEAM_T, clock, connect, el, weaponName } from "/common.js";

const KILL_MS = 5000;
const BANNER_MS = 5000;

let state = null;
let control = null;
let killsKey = "";

const $ = (id) => document.getElementById(id);

function playerSide(p) {
  return p.team === TEAM_CT ? "ct" : "t";
}

function nades(p) {
  const out = [];
  if (p.he) out.push(p.he > 1 ? `H×${p.he}` : "H");
  if (p.flash) out.push(p.flash > 1 ? `F×${p.flash}` : "F");
  if (p.smoke) out.push(p.smoke > 1 ? `S×${p.smoke}` : "S");
  return out.join(" ");
}

function armorText(p) {
  if (!p.armor) return "";
  return p.helmet ? "Chaleco + casco" : "Chaleco";
}

function playerCard(p) {
  const focused = control?.focus === p.uid;
  return el(
    "div",
    { class: `player${p.alive ? "" : " dead"}${focused ? " focused" : ""}` },
    el("div", { class: "bar", style: `width:${p.alive ? p.hp : 0}%` }),
    el(
      "div",
      { class: "top" },
      el("span", { class: `hp${p.alive && p.hp <= 25 ? " low" : ""}` }, p.alive ? String(p.hp) : "✕"),
      el("span", { class: "name" }, p.name),
      el("span", { class: "kd" }, `${p.kills} / ${p.deaths}`),
    ),
    el(
      "div",
      { class: "bottom" },
      el("span", { class: "money" }, `$${p.money}`),
      el("span", { class: "weapon" }, p.alive ? weaponName(p.primary || p.secondary) : ""),
      p.alive && p.armor ? el("span", { class: "tag" }, p.helmet ? "A+H" : "A") : null,
      p.alive && p.bomb ? el("span", { class: "tag c4" }, "C4") : null,
      p.alive && p.defuser ? el("span", { class: "tag kit" }, "KIT") : null,
      p.alive ? el("span", { class: "nades" }, nades(p)) : null,
      el("span", {}, p.damage ? `${p.damage} dmg` : ""),
    ),
  );
}

function renderPlayers() {
  const show = control?.showPlayers !== false;
  for (const [id, team] of [["side-ct", TEAM_CT], ["side-t", TEAM_T]]) {
    const box = $(id);
    box.classList.toggle("hidden", !show);
    box.replaceChildren(...(state?.players ?? []).filter((p) => p.team === team).slice(0, 5).map(playerCard));
  }
}

function renderFocus() {
  const box = $("focus");
  const p = state?.players.find((x) => x.uid === control?.focus);
  if (!p || control?.showFocus === false) {
    box.classList.add("hidden");
    return;
  }
  box.className = playerSide(p);
  box.replaceChildren(
    el("div", { class: "head" }, el("span", { class: "name" }, p.name), el("span", { class: "kd" }, `${p.kills} K · ${p.deaths} D · ${p.damage} dmg`)),
    el(
      "div",
      { class: "body" },
      el("span", { class: `hp${p.alive && p.hp <= 25 ? " low" : ""}` }, p.alive ? String(p.hp) : "✕"),
      el("span", { class: "armor" }, p.alive ? armorText(p) : "Muerto"),
      el("span", { class: "weapon" }, p.alive ? weaponName(p.active) : ""),
      el("span", { class: "nades" }, p.alive ? nades(p) : ""),
      el("span", { class: "money" }, `$${p.money}`),
    ),
  );
}

function renderScore() {
  const box = $("score");
  box.classList.toggle("hidden", control?.showScore === false || !state?.map);
  if (!state) return;
  const planted = state.phase === "planted";
  box.replaceChildren(
    el("div", { class: "team ct" }, control?.teamCT ?? "CT"),
    el("div", { class: "pts ct" }, String(state.scoreCT)),
    el(
      "div",
      { class: `mid${planted ? " planted" : ""}` },
      el("span", { class: "time", id: "time" }, ""),
      el("span", { class: "round" }, planted ? "Bomba plantada" : state.phase === "freeze" ? `Ronda ${state.round} · compra` : `Ronda ${state.round}`),
    ),
    el("div", { class: "pts t" }, String(state.scoreT)),
    el("div", { class: "team t" }, control?.teamT ?? "T"),
  );
  tick();
}

function renderKills() {
  const box = $("kills");
  box.classList.toggle("hidden", control?.showKills === false);
  const now = Date.now();
  const visible = (state?.kills ?? []).filter((k) => now - k.at < KILL_MS);
  // Solo se redibuja si cambió la lista; si no, la animación de entrada se repetiría cada 250 ms.
  const key = visible.map((k) => `${k.at}:${k.victim}`).join(",");
  if (key === killsKey) return;
  killsKey = key;
  const byUid = new Map((state?.players ?? []).map((p) => [p.uid, p]));
  const items = visible.map((k) => {
    const a = byUid.get(k.attacker);
    const v = byUid.get(k.victim);
    return el(
      "div",
      { class: "kill" },
      a && k.attacker !== k.victim ? el("span", { class: playerSide(a) }, a.name) : null,
      el("span", { class: "weapon" }, weaponName(k.weapon)),
      k.headshot ? el("span", { class: "hs" }, "HS") : null,
      el("span", { class: v ? playerSide(v) : "" }, v?.name ?? ""),
    );
  });
  box.replaceChildren(...items);
}

function renderBanner() {
  const box = $("banner");
  const end = state?.lastEnd;
  if (!end || Date.now() - end.at > BANNER_MS || (end.winner !== TEAM_CT && end.winner !== TEAM_T)) {
    box.classList.remove("show");
    return;
  }
  const ct = end.winner === TEAM_CT;
  const name = ct ? control?.teamCT ?? "CT" : control?.teamT ?? "T";
  const bomb = state.bomb?.what === "explode" ? " · La bomba explotó" : state.bomb?.what === "defuse" ? " · Bomba desactivada" : "";
  box.className = `show ${ct ? "ct" : "t"}`;
  box.textContent = `Gana ${name}${bomb}`;
}

function tick() {
  const t = document.getElementById("time");
  if (t) t.textContent = state?.phaseEndsAt ? clock(state.phaseEndsAt - Date.now()) : "";
}

function render() {
  renderScore();
  renderPlayers();
  renderFocus();
  renderKills();
  renderBanner();
}

connect({
  onState: (s) => {
    state = s;
    render();
  },
  onControl: (c) => {
    control = c;
    render();
  },
  onStatus: (ok) => $("offline").classList.toggle("show", !ok),
});

// Reloj, kills que vencen y cartel de fin de ronda, aunque no lleguen paquetes.
setInterval(() => {
  tick();
  renderKills();
  renderBanner();
}, 250);

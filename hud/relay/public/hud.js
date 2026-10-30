// HUD para OBS, versión 2 (docs/bitacora/2026-10-30-hud-version-2). Recibe del relay el estado ya retrasado y lo
// dibuja; el reloj corre solo entre paquetes.
import { DEFUSER, EQUIP, ICON, TEAM_CT, TEAM_T, clock, connect, el, weaponGlyph, weaponName } from "./common.js";

const KILL_MS = 5000;
const BANNER_MS = 5000;
// Alto del cuerpo de la tarjeta (sin la franja del equipamiento): lo que llena la vida.
const CARD_BODY = 202;

let state = null;
let control = null;
let killsKey = "";
// Si el relay encontró las fuentes del juego, el HUD va con íconos; si no, con los nombres de las armas.
let icons = false; // clientmodkillfeed.ttf: armas, agregados del feed, chaleco, granadas y C4
let kitIcon = false; // cs.ttf: el kit de desactivación
function loadFont(family, url, onLoad) {
  new FontFace(family, `url(${url})`)
    .load()
    .then((f) => {
      document.fonts.add(f);
      onLoad();
      killsKey = "";
      render();
    })
    .catch(() => {});
}
loadFont("cmkill", "font/killfeed.ttf", () => (icons = true));
loadFont("csicons", "font/cs.ttf", () => (kitIcon = true));

const icon = (glyph, cls = "") => el("span", { class: `icon ${cls}` }, glyph);

// Íconos dibujados (no están en las fuentes): la mira de las kills y la cruz de la vida.
const SVG_PATHS = {
  kills: "M8 2.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 1 1 0-11z M8 4.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z M7 0h2v2.5H7z M7 13.5h2V16H7z M0 7h2.5v2H0z M13.5 7H16v2h-2.5z",
  hp: "M6 0h4v6h6v4h-6v6H6v-6H0V6h6z",
};
function svgIcon(name, size) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "currentColor");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", SVG_PATHS[name]);
  path.setAttribute("fill-rule", "evenodd");
  svg.append(path);
  return svg;
}

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Number(n).toLocaleString("en-US")}`;

function playerSide(p) {
  return p.team === TEAM_CT ? "ct" : "t";
}

const teamName = (team) => (team === TEAM_CT ? control?.teamCT || "CT" : control?.teamT || "T");

// Sigla para el cuadrado del logo: las iniciales si el nombre tiene varias palabras, si no, sus tres primeras letras.
export function teamTag(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length > 1) return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  return words[0].slice(0, 3).toUpperCase();
}

// Los jugadores de cada lado, en el mismo orden que las teclas de /control: 1-5 CT, 6-9 y 0 T.
function sidePlayers(team) {
  return (state?.players ?? []).filter((p) => p.team === team).slice(0, 5);
}
function keyOf(p) {
  const i = sidePlayers(p.team).findIndex((x) => x.uid === p.uid);
  return i < 0 ? "" : String(p.team === TEAM_CT ? i + 1 : (i + 6) % 10);
}

// La flash y el humo son dos latas casi iguales en la fuente: se distinguen por la franja y el borde.
const NADE_CLASS = { flashbang: "flash", smokegrenade: "smoke" };

function nadesText(p) {
  const out = [];
  if (p.he) out.push(p.he > 1 ? `H×${p.he}` : "H");
  if (p.flash) out.push(p.flash > 1 ? `F×${p.flash}` : "F");
  if (p.smoke) out.push(p.smoke > 1 ? `S×${p.smoke}` : "S");
  return out.join(" ");
}

// Una granada por ícono, como en el juego: dos flashes son dos íconos.
function nadeIcons(p) {
  if (!icons) return [el("span", { class: "wname" }, nadesText(p))];
  const out = [];
  for (const [n, glyph, cls] of [[p.he, EQUIP.he, ""], [p.flash, EQUIP.flash, "flash"], [p.smoke, EQUIP.smoke, "smoke"]])
    for (let i = 0; i < n; i++) out.push(icon(glyph, `nade ${cls}`));
  return out;
}

function armorIcon(p) {
  if (!p.armor) return null;
  return icons ? icon(p.helmet ? EQUIP.kevlarHelmet : EQUIP.kevlar, "armor") : el("span", { class: "tag" }, p.helmet ? "A+H" : "A");
}
const c4Icon = () => (icons ? icon(EQUIP.c4, "c4") : el("span", { class: "tag c4" }, "C4"));
const kitIconEl = () => (kitIcon ? icon(DEFUSER, "cs kit") : el("span", { class: "tag kit" }, "KIT"));

function gunEl(cls, cssClass = "") {
  if (!cls) return el("span");
  return icons ? icon(weaponGlyph(cls), `gun ${NADE_CLASS[cls] ?? ""} ${cssClass}`) : el("span", { class: `wname ${cssClass}` }, weaponName(cls));
}

function kd(p) {
  return el(
    "div",
    { class: "kd" },
    el("span", {}, svgIcon("kills", 13), ` ${p.kills}`),
    el("span", {}, icons ? icon(ICON.skull, "sk") : el("b", {}, "D"), ` ${p.deaths}`),
  );
}

function playerCard(p) {
  const focused = control?.focus === p.uid;
  const num = el("div", { class: "num" }, keyOf(p));
  if (!p.alive)
    return el(
      "div",
      { class: `player dead${focused ? " focused" : ""}` },
      num,
      el("div", { class: "name" }, p.name),
      kd(p),
      el("div", { class: "money" }, money(p.money)),
      el("div", { class: "dmg" }, el("small", {}, "DAÑO EN LA RONDA"), el("b", {}, String(p.damage))),
      el("div", { class: "gear" }, "MUERTO"),
    );

  const fill = Math.round((CARD_BODY * Math.max(0, Math.min(100, p.hp))) / 100);
  const gun = p.primary || p.secondary || "knife";
  const corner = [p.bomb ? el("span", {}, c4Icon()) : null, p.defuser ? el("span", {}, kitIconEl()) : null].filter(Boolean);
  return el(
    "div",
    { class: `player${focused ? " focused" : ""}` },
    el("div", { class: "fill", style: `height:${fill}px` }),
    el("div", { class: "av" }),
    // La vida perdida oscurece la tarjeta desde arriba, también sobre la foto.
    el("div", { class: `lost${fill >= CARD_BODY ? " none" : ""}`, style: `height:${CARD_BODY - fill}px` }),
    num,
    corner.length ? el("div", { class: "corner" }, ...corner) : null,
    el("div", { class: `hp${p.hp <= 25 ? " low" : ""}` }, String(p.hp), armorIcon(p)),
    el("div", { class: "name" }, p.name),
    kd(p),
    el("div", { class: "money" }, money(p.money)),
    el("div", { class: "gear" }, gunEl(gun, p.active && p.active !== gun ? "idle" : ""), el("span", { class: "nades" }, ...nadeIcons(p))),
  );
}

function renderPlayers() {
  const show = control?.showPlayers !== false;
  for (const [id, team] of [["side-ct", TEAM_CT], ["side-t", TEAM_T]]) {
    const box = $(id);
    box.classList.toggle("hidden", !show);
    box.replaceChildren(...sidePlayers(team).map(playerCard));
  }
}

function renderFocus() {
  const box = $("focus");
  const p = state?.players.find((x) => x.uid === control?.focus);
  if (!p || !p.alive || control?.showFocus === false) {
    box.className = "hidden";
    return;
  }
  const active = p.active || p.primary || p.secondary || "knife";
  box.className = playerSide(p);
  box.replaceChildren(
    el("div", { class: "pic" }, el("div", { class: "av" })),
    el(
      "div",
      { class: "body" },
      el(
        "div",
        { class: "top" },
        el("div", { class: "pname" }, el("em", {}, keyOf(p)), p.name),
        el("div", { class: "wpn" }, icons ? gunEl(active) : null, el("small", {}, weaponName(active))),
      ),
      el(
        "div",
        { class: "stats" },
        el("span", {}, svgIcon("kills", 14), ` ${p.kills}`),
        el("span", {}, icons ? icon(ICON.skull) : "D", ` ${p.deaths}`),
        el("span", {}, `DAÑO ${p.damage}`),
        el("span", { class: "m" }, money(p.money)),
      ),
      el(
        "div",
        { class: "bot" },
        el(
          "div",
          { class: "vit" },
          el("span", { class: p.hp <= 25 ? "low" : "" }, svgIcon("hp", 20), String(p.hp)),
          p.armor ? el("span", {}, armorIcon(p), String(p.armor)) : null,
        ),
        el("div", { class: "gear" }, p.defuser ? kitIconEl() : null, p.bomb ? c4Icon() : null, ...nadeIcons(p)),
      ),
      el("div", { class: "hpbar" }, el("i", { style: `width:${Math.max(0, Math.min(100, p.hp))}%` })),
    ),
  );
}

const PHASE_LABEL = { freeze: "Compra", live: "Ronda en juego", planted: "Bomba plantada", over: "Fin de ronda" };

function renderScore() {
  const box = $("score");
  const info = $("info");
  const show = control?.showScore !== false && !!state?.map;
  box.classList.toggle("hidden", !show);
  info.classList.toggle("hidden", !show);
  if (!state) return;
  const planted = state.phase === "planted";
  const team = (side, name) =>
    el("div", { class: `team ${side}` }, seriesPips(side), el("div", { class: "logo" }, teamTag(name)), el("div", { class: "name" }, name));
  box.replaceChildren(
    el("div", { class: "round" }, `RONDA ${state.round}`),
    el(
      "div",
      { class: "row" },
      team("ct", teamName(TEAM_CT)),
      el(
        "div",
        { class: "pts" },
        el("span", { class: state.scoreCT > state.scoreT ? "lead" : "" }, String(state.scoreCT)),
        el("span", { class: state.scoreT > state.scoreCT ? "lead" : "" }, String(state.scoreT)),
      ),
      team("t", teamName(TEAM_T)),
    ),
    el(
      "div",
      { class: `clock${planted ? " planted" : state.phase === "freeze" ? " buy" : ""}` },
      el("b", {}, planted && icons ? icon(EQUIP.c4) : null, el("span", { id: "time" }, "")),
      el("small", {}, PHASE_LABEL[state.phase] ?? ""),
    ),
  );
  info.replaceChildren(...infoParts());
  tick();
}

// Serie de mapas (docs/bitacora/2026-10-30-hud-serie-mapas): lo carga el streamer en /control. pick y win van por lado.
function series() {
  const s = control?.series;
  return control?.showSeries !== false && s ? s : null;
}

function infoParts() {
  const sep = () => el("i", {}, "|");
  const s = series();
  if (!s) return ["CMLEAGUE", sep(), state.map];
  const current = s.maps.slice(0, s.bo).find((m) => m.map !== "" && m.map.toLowerCase() === state.map.toLowerCase());
  let pick = null;
  if (current?.pick === "decider") pick = el("span", { class: "pick" }, "Decider");
  else if (current?.pick === "ct" || current?.pick === "t")
    pick = el("span", { class: `pick ${current.pick}` }, "Pick de ", el("b", {}, teamName(current.pick === "ct" ? TEAM_CT : TEAM_T)));
  return ["CMLEAGUE", sep(), el("b", {}, `BO${s.bo}`), sep(), "Jugando en ", el("span", { class: "map" }, state.map), ...(pick ? [sep(), pick] : [])];
}

// Rayitas de los mapas ganados: tantas como hacen falta para ganar la serie. En BO1 no hay.
function seriesPips(side) {
  const s = series();
  if (!s || s.bo < 2) return null;
  const won = s.maps.slice(0, s.bo).filter((m) => m.win === side).length;
  return el("div", { class: "pips" }, ...Array.from({ length: Math.ceil(s.bo / 2) }, (_, i) => el("i", { class: i < won ? "won" : "" })));
}

function renderAlive() {
  const box = $("alive");
  const show = control?.showScore !== false && !!state?.map;
  box.classList.toggle("hidden", !show);
  if (!show) return;
  const ct = sidePlayers(TEAM_CT).filter((p) => p.alive).length;
  const t = sidePlayers(TEAM_T).filter((p) => p.alive).length;
  const clutch = (ct === 1 && t > 1) || (t === 1 && ct > 1);
  box.replaceChildren(
    ...[el("div", { class: "count" }, el("span", { class: "ct" }, String(ct)), el("span", { class: "vs" }, "VS"), el("span", { class: "t" }, String(t))),
    clutch && state.phase !== "over" ? el("div", { class: "clutch" }, "CLUTCH") : null].filter(Boolean),
  );
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
    const killer = a && k.attacker !== k.victim;
    const as = k.assister && k.assister !== k.attacker ? byUid.get(k.assister) : undefined;
    if (!icons)
      return el(
        "div",
        { class: "kill" },
        killer ? el("span", { class: playerSide(a) }, a.name) : null,
        as ? el("span", { class: playerSide(as) }, `+ ${as.name}`) : null,
        el("span", { class: "weapon" }, weaponName(k.weapon)),
        k.headshot ? el("span", { class: "hs" }, "HS") : null,
        el("span", { class: v ? playerSide(v) : "" }, v?.name ?? ""),
      );
    // El mismo orden que el kill feed de ClientMod.
    return el(
      "div",
      { class: "kill" },
      killer && k.blind ? icon(ICON.blind) : null,
      killer ? el("span", { class: playerSide(a) }, a.name) : null,
      as ? el("span", { class: "plus" }, "+") : null,
      as && k.flashAssist ? icon(ICON.flashAssist) : null,
      as ? el("span", { class: playerSide(as) }, as.name) : null,
      icon(weaponGlyph(k.weapon), "weapon-icon"),
      k.noscope ? icon(ICON.noscope) : null,
      k.smoke ? icon(ICON.smoke) : null,
      k.penetrated ? icon(ICON.penetrated) : null,
      k.headshot ? icon(ICON.headshot) : null,
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
  // El motivo solo si la bomba explotó o la desactivaron al cerrar esta ronda.
  const bomb = state.bomb && Math.abs(end.at - state.bomb.at) < 15000 ? state.bomb.what : null;
  const why = bomb === "explode" ? "La bomba explotó" : bomb === "defuse" ? "Desactivaron la bomba" : "";
  box.className = `show ${ct ? "ct" : "t"}`;
  box.replaceChildren(el("b", {}, `${teamName(end.winner)} gana la ronda`), ...(why ? [el("small", {}, why)] : []));
}

function tick() {
  const t = document.getElementById("time");
  if (t) t.textContent = state?.phaseEndsAt ? clock(state.phaseEndsAt - Date.now()) : "";
}

function render() {
  renderScore();
  renderAlive();
  renderPlayers();
  renderFocus();
  renderKills();
  renderBanner();
}

connect({
  page: "hud",
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

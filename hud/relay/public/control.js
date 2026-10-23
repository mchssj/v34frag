// Página de control del streamer: nombres de los equipos, jugador enfocado y qué partes del HUD se ven.
import { TEAM_CT, TEAM_T, connect, el, weaponName } from "/common.js";

const TOGGLES = [
  ["showScore", "Marcador"],
  ["showPlayers", "Jugadores"],
  ["showFocus", "Jugador enfocado"],
  ["showKills", "Kills"],
];

let state = null;
let control = null;
let order = []; // uid por tecla: 1-5 CT, 6-9 y 0 T

const $ = (id) => document.getElementById(id);

async function send(change) {
  await fetch("/api/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(change) });
}

function renderPlayers() {
  const ct = (state?.players ?? []).filter((p) => p.team === TEAM_CT).slice(0, 5);
  const t = (state?.players ?? []).filter((p) => p.team === TEAM_T).slice(0, 5);
  order = [...ct.map((p) => p.uid), ...Array(5 - ct.length).fill(null), ...t.map((p) => p.uid)];
  const button = (p, i) =>
    el(
      "button",
      { class: `${control?.focus === p.uid ? "on" : ""}${p.alive ? "" : " dead"}`, onclick: () => send({ focus: p.uid }) },
      el("span", { class: "key" }, String((i + 1) % 10)),
      el("span", {}, `${p.name} · ${p.alive ? `${p.hp} HP · ${weaponName(p.active)}` : "muerto"}`),
    );
  $("players").replaceChildren(
    el("div", { class: "ct" }, el("h3", {}, control?.teamCT || "CT"), ...ct.map((p, i) => button(p, i))),
    el("div", { class: "t" }, el("h3", {}, control?.teamT || "T"), ...t.map((p, i) => button(p, i + 5))),
  );
}

function renderControl() {
  // No pisar lo que el streamer está escribiendo.
  for (const id of ["teamCT", "teamT"]) if (document.activeElement !== $(id)) $(id).value = control[id];
  $("toggles").replaceChildren(
    ...TOGGLES.map(([k, label]) => el("button", { class: control[k] ? "on" : "", onclick: () => send({ [k]: !control[k] }) }, label)),
  );
  renderPlayers();
}

for (const id of ["teamCT", "teamT"]) {
  let timer;
  $(id).addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => send({ [id]: $(id).value }), 300);
  });
}
$("swap").addEventListener("click", () => send({ swap: true }));
$("nofocus").addEventListener("click", () => send({ focus: null }));

document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === "Escape") return void send({ focus: null });
  if (!/^[0-9]$/.test(e.key)) return;
  const uid = order[e.key === "0" ? 9 : Number(e.key) - 1];
  if (uid) send({ focus: uid });
});

let connected = false;
async function refreshStatus() {
  const box = $("status");
  if (!connected) {
    box.innerHTML = '<b class="bad">Sin conexión con el relay.</b> ¿Está abierto relay.exe?';
    return;
  }
  try {
    const s = await (await fetch("/api/status")).json();
    const ago = s.lastPacketMsAgo;
    const recv = ago === null ? '<b class="bad">todavía no llegó ningún paquete del servidor</b>' : ago > 15000 ? `<b class="bad">sin paquetes hace ${Math.round(ago / 1000)} s</b>` : '<b class="ok">recibiendo datos del servidor</b>';
    box.innerHTML = `Relay ${s.version} · ${recv} · retraso ${s.delaySeconds} s · HUD abiertos: ${s.clients - 1}`;
  } catch {
    box.innerHTML = '<b class="bad">Sin conexión con el relay.</b>';
  }
}
setInterval(refreshStatus, 2000);

connect({
  onState: (s) => {
    state = s;
    if (control) renderPlayers();
  },
  onControl: (c) => {
    control = c;
    renderControl();
  },
  onStatus: (ok) => {
    connected = ok;
    refreshStatus();
  },
});

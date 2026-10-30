// Página de control del streamer: servidor (en el VPS), nombres de los equipos, jugador enfocado y qué partes del HUD
// se ven. Todo con rutas relativas: sirve en / (modo local) y en /s/<token>/ (VPS).
import { TEAM_CT, TEAM_T, connect, el, weaponName } from "./common.js";

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
  await fetch("api/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(change) });
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

const receiving = (ago) =>
  ago === null
    ? el("b", { class: "bad" }, "todavía no llegó ningún paquete del servidor")
    : ago > 15000
      ? el("b", { class: "bad" }, `sin paquetes hace ${Math.round(ago / 1000)} s`)
      : el("b", { class: "ok" }, "recibiendo datos del servidor");

/** Modo VPS: un botón por servidor con HUD activo, quién más lo transmite y el connect de su SourceTV. */
function renderServers(s) {
  $("server-section").hidden = false;
  if (!s.servers.length) {
    $("servers").replaceChildren(el("div", { class: "hint" }, "Ningún servidor tiene el HUD activo. Pedile a un admin que lo active."));
    return;
  }
  const chosen = s.servers.find((x) => x.id === s.selected);
  $("servers").replaceChildren(
    el(
      "div",
      { class: "toggles" },
      ...s.servers.map((x) =>
        el(
          "button",
          { class: x.id === s.selected ? "on" : "", onclick: () => send({ server: x.id }) },
          `${x.receiving ? "● " : "○ "}${x.name}`,
        ),
      ),
    ),
    chosen?.streaming.length ? el("div", { class: "hint warn" }, `También lo está transmitiendo: ${chosen.streaming.join(", ")}.`) : null,
    chosen?.tvAddress
      ? el(
          "div",
          { class: "connect" },
          el("code", {}, `connect ${chosen.tvAddress}`),
          el("button", { onclick: (e) => copy(`connect ${chosen.tvAddress}`, e.currentTarget) }, "Copiar"),
        )
      : null,
    chosen ? null : el("div", { class: "hint" }, "Elegí el servidor que vas a transmitir."),
  );
}

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copiado";
    setTimeout(() => (button.textContent = "Copiar"), 1500);
  } catch {
    // Sin permiso del portapapeles: el texto queda a la vista para copiarlo a mano.
  }
}

let connected = false;
async function refreshStatus() {
  const box = $("status");
  if (!connected) {
    box.replaceChildren(el("b", { class: "bad" }, "Sin conexión con el relay."), " ¿Está abierto el relay?");
    return;
  }
  try {
    const s = await (await fetch("api/status")).json();
    if (s.mode === "vps") {
      renderServers(s);
      const chosen = s.servers.find((x) => x.id === s.selected);
      box.replaceChildren(
        `Relay ${s.version} · ${s.alias} · `,
        chosen ? receiving(chosen.lastPacketMsAgo) : el("b", { class: "bad" }, "sin servidor elegido"),
        chosen ? ` · retraso ${s.delaySeconds} s` : "",
        ` · tus HUD abiertos: ${s.hudOpen}`,
      );
    } else {
      box.replaceChildren(`Relay ${s.version} · `, receiving(s.lastPacketMsAgo), ` · retraso ${s.delaySeconds} s · HUD abiertos: ${s.hudOpen}`);
    }
  } catch {
    box.replaceChildren(el("b", { class: "bad" }, "Sin conexión con el relay."));
  }
}
setInterval(refreshStatus, 2000);

connect({
  page: "control",
  onState: (s) => {
    state = s;
    if (control) renderPlayers();
  },
  onControl: (c) => {
    control = c;
    renderControl();
    refreshStatus();
  },
  onStatus: (ok) => {
    connected = ok;
    refreshStatus();
  },
});

// Compartido por el HUD y la página de control: conexión con el relay y nombres de las armas.

export const TEAM_T = 2;
export const TEAM_CT = 3;

const WEAPONS = {
  glock: "Glock", usp: "USP", p228: "P228", deagle: "Desert Eagle", elite: "Dual Elites", fiveseven: "Five-SeveN",
  m3: "M3", xm1014: "XM1014", mac10: "MAC-10", tmp: "TMP", mp5navy: "MP5", ump45: "UMP45", p90: "P90",
  galil: "Galil", famas: "FAMAS", ak47: "AK-47", m4a1: "M4A1", sg552: "SG 552", aug: "AUG", scout: "Scout",
  awp: "AWP", g3sg1: "G3SG1", sg550: "SG 550", m249: "M249", knife: "Cuchillo", hegrenade: "HE",
  flashbang: "Flash", smokegrenade: "Humo", c4: "Bomba", world: "Mundo", worldspawn: "Mundo",
  player: "Mundo", point_hurt: "Mundo", trigger_hurt: "Mundo", env_explosion: "Bomba",
};

// Letra de cada ícono en clientmodkillfeed.ttf (la fuente del kill feed de ClientMod; la sirve el relay).
const KILL_GLYPHS = {
  usp: "a", ak47: "b", glock: "c", tmp: "d", aug: "e", deagle: "f", hegrenade: "h", g3sg1: "i", knife: "j", m3: "k",
  mac10: "l", p90: "m", scout: "n", sg550: "o", ump45: "q", awp: "r", elite: "s", famas: "t", fiveseven: "u", galil: "v",
  m4a1: "w", mp5navy: "x", p228: "y", m249: "z", sg552: "A", xm1014: "B", c4: "I", env_explosion: "I",
};
export const ICON = { skull: "C", headshot: "D", penetrated: "!", flashAssist: '"', blind: "#", smoke: "$", noscope: "%" };

/** El ícono del arma; la calavera si no hay uno (caída, trigger_hurt, el mundo). */
export function weaponGlyph(cls) {
  return KILL_GLYPHS[cls] ?? ICON.skull;
}

export function weaponName(cls) {
  if (!cls) return "";
  return WEAPONS[cls] ?? cls.toUpperCase();
}

/** Se conecta a /events y vuelve a conectar solo si el relay se reinicia. */
export function connect({ onState, onControl, onStatus }) {
  let es;
  const open = () => {
    es = new EventSource("/events");
    es.addEventListener("open", () => onStatus?.(true));
    es.addEventListener("error", () => onStatus?.(false));
    es.addEventListener("state", (e) => onState?.(JSON.parse(e.data)));
    es.addEventListener("control", (e) => onControl?.(JSON.parse(e.data)));
  };
  open();
  return () => es.close();
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

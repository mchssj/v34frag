// Lo que elige el streamer en /control. No viene del servidor, así que no pasa por el retraso.
// Se guarda en disco para que sobreviva a un reinicio del relay: en el modo local, relay-control.json; en el VPS, uno
// por streamer (ControlStore).

import { existsSync, readFileSync, writeFileSync } from "node:fs";

/** Un mapa de la serie. pick y win van por lado (ct o t): "Intercambiar" los da vuelta junto con los nombres. */
export interface SeriesMap {
  map: string;
  pick: "" | "ct" | "t" | "decider";
  win: "" | "ct" | "t";
}

export interface Series {
  bo: 1 | 3 | 5;
  /** Siempre SERIES_MAPS renglones, aunque el formato use menos: pasar de BO5 a BO3 no borra nada. */
  maps: SeriesMap[];
}

export const SERIES_MAPS = 5;

export interface Control {
  /** Modo VPS: el servidor que transmite (id de game_servers). null: todavía no eligió. */
  server: string | null;
  teamCT: string;
  teamT: string;
  focus: number | null; // uid del jugador de la tarjeta grande
  showPlayers: boolean;
  showFocus: boolean;
  showKills: boolean;
  showScore: boolean;
  showSeries: boolean;
  series: Series;
}

const emptySeries = (): Series => ({ bo: 1, maps: Array.from({ length: SERIES_MAPS }, () => ({ map: "", pick: "", win: "" })) });

export const DEFAULT_CONTROL: Control = {
  server: null,
  teamCT: "CT",
  teamT: "T",
  focus: null,
  showPlayers: true,
  showFocus: true,
  showKills: true,
  showScore: true,
  showSeries: true,
  series: emptySeries(),
};

const BOOLS = ["showPlayers", "showFocus", "showKills", "showScore", "showSeries"] as const;
const PICKS = new Set(["", "ct", "t", "decider"]);
const WINS = new Set(["", "ct", "t"]);
const flip = <T extends string>(v: T): T => (v === "ct" ? "t" : v === "t" ? "ct" : v) as T;

/** Aplica un cambio parcial de la serie: { bo } y/o { maps: [{ map, pick, win }, …] } (los renglones que falten no cambian). */
function mergeSeries(current: Series, input: unknown): Series {
  if (typeof input !== "object" || input === null) return current;
  const i = input as Record<string, unknown>;
  const next: Series = { bo: current.bo, maps: current.maps.map((m) => ({ ...m })) };
  if (i.bo === 1 || i.bo === 3 || i.bo === 5) next.bo = i.bo;
  if (Array.isArray(i.maps))
    i.maps.slice(0, SERIES_MAPS).forEach((raw: unknown, n) => {
      if (typeof raw !== "object" || raw === null) return;
      const r = raw as Record<string, unknown>;
      const m = next.maps[n]!;
      if (typeof r.map === "string") m.map = r.map.trim().replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 64);
      if (typeof r.pick === "string" && PICKS.has(r.pick)) m.pick = r.pick as SeriesMap["pick"];
      if (typeof r.win === "string" && WINS.has(r.win)) m.win = r.win as SeriesMap["win"];
    });
  return next;
}

/** Aplica un cambio parcial que llega de /control. Ignora los campos inválidos. */
export function mergeControl(current: Control, input: unknown): Control {
  if (typeof input !== "object" || input === null) return current;
  const i = input as Record<string, unknown>;
  const next = { ...current, series: mergeSeries(current.series ?? emptySeries(), i.series) };
  for (const k of ["teamCT", "teamT"] as const) {
    const v = i[k];
    if (typeof v === "string") next[k] = v.trim().slice(0, 32);
  }
  if (i.focus === null || (typeof i.focus === "number" && Number.isInteger(i.focus))) next.focus = i.focus;
  if (i.server === null || (typeof i.server === "string" && /^[0-9a-f-]{36}$/i.test(i.server))) {
    // Otro servidor es otra partida: el jugador enfocado de antes no existe ahí.
    if (i.server !== next.server) next.focus = null;
    next.server = i.server;
  }
  for (const k of BOOLS) if (typeof i[k] === "boolean") next[k] = i[k];
  if (i.swap === true) {
    [next.teamCT, next.teamT] = [next.teamT, next.teamCT];
    next.series = { ...next.series, maps: next.series.maps.map((m) => ({ map: m.map, pick: flip(m.pick), win: flip(m.win) })) };
  }
  return next;
}

export function loadControl(path: string): Control {
  if (!existsSync(path)) return { ...DEFAULT_CONTROL };
  try {
    return mergeControl(DEFAULT_CONTROL, JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return { ...DEFAULT_CONTROL };
  }
}

export function saveControl(path: string, c: Control): void {
  try {
    writeFileSync(path, JSON.stringify(c, null, 2) + "\n");
  } catch {
    // Si no se puede escribir (carpeta de solo lectura), el relay sigue igual.
  }
}

/** Lo de /control de cada streamer (modo VPS), en un solo archivo: { user_id: Control }. */
export class ControlStore {
  private readonly path: string;
  private readonly controls = new Map<string, Control>();

  constructor(path: string) {
    this.path = path;
    try {
      const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (typeof raw === "object" && raw !== null)
        for (const [viewer, c] of Object.entries(raw)) this.controls.set(viewer, mergeControl(DEFAULT_CONTROL, c));
    } catch {
      // Sin archivo o roto: todos arrancan con los valores por defecto.
    }
  }

  get(viewer: string): Control {
    return this.controls.get(viewer) ?? { ...DEFAULT_CONTROL };
  }

  set(viewer: string, c: Control): void {
    this.controls.set(viewer, c);
    try {
      writeFileSync(this.path, JSON.stringify(Object.fromEntries(this.controls), null, 2) + "\n");
    } catch {
      // Si no se puede escribir, el relay sigue igual.
    }
  }
}

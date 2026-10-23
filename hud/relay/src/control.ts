// Lo que elige el streamer en /control. No viene del servidor, así que no pasa por el retraso.
// Se guarda en relay-control.json para que los nombres sobrevivan a un reinicio del relay.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface Control {
  teamCT: string;
  teamT: string;
  focus: number | null; // uid del jugador de la tarjeta grande
  showPlayers: boolean;
  showFocus: boolean;
  showKills: boolean;
  showScore: boolean;
}

export const DEFAULT_CONTROL: Control = {
  teamCT: "CT",
  teamT: "T",
  focus: null,
  showPlayers: true,
  showFocus: true,
  showKills: true,
  showScore: true,
};

const BOOLS = ["showPlayers", "showFocus", "showKills", "showScore"] as const;

/** Aplica un cambio parcial que llega de /control. Ignora los campos inválidos. */
export function mergeControl(current: Control, input: unknown): Control {
  if (typeof input !== "object" || input === null) return current;
  const i = input as Record<string, unknown>;
  const next = { ...current };
  for (const k of ["teamCT", "teamT"] as const) {
    const v = i[k];
    if (typeof v === "string") next[k] = v.trim().slice(0, 32);
  }
  if (i.focus === null || (typeof i.focus === "number" && Number.isInteger(i.focus))) next.focus = i.focus;
  for (const k of BOOLS) if (typeof i[k] === "boolean") next[k] = i[k];
  if (i.swap === true) [next.teamCT, next.teamT] = [next.teamT, next.teamCT];
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

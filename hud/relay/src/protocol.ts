// Paquetes que manda csstv_hud (server/addons/sourcemod/scripting/csstv_hud.sp). Texto: campos con |,
// jugadores con ; y los datos de cada jugador con ,.

export interface PlayerLine {
  uid: number;
  team: number; // 2 = T, 3 = CT
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
  damage: number; // daño hecho en la ronda
}

export interface NameLine {
  uid: number;
  steamid: string;
  name: string;
}

export type Phase = "freeze" | "live" | "planted" | "over";

export type Packet =
  | {
      type: "F";
      seq: number;
      tvDelay: number;
      map: string;
      round: number;
      scoreT: number;
      scoreCT: number;
      phase: Phase;
      seconds: number; // -1 = sin reloj
      players: PlayerLine[];
    }
  | { type: "N"; seq: number; names: NameLine[] }
  | { type: "D"; seq: number; players: PlayerLine[] }
  | { type: "E"; seq: number; event: GameEvent };

export type GameEvent =
  | ({ kind: "kill"; attacker: number; victim: number; weapon: string; headshot: boolean } & KillExtras)
  | { kind: "phase"; phase: Phase; seconds: number }
  | { kind: "bomb"; what: "plant" | "defuse" | "explode"; uid: number }
  | { kind: "end"; winner: number; reason: number };

/** Lo que agrega clientmod_deathnotice al player_death. Con el plugin 1.0.0 o sin ese plugin, todo en 0. */
export interface KillExtras {
  assister: number; // uid; 0 = sin asistencia
  flashAssist: boolean;
  penetrated: number; // paredes atravesadas
  blind: boolean; // el atacante estaba ciego
  smoke: boolean;
  noscope: boolean;
}

export type ParseResult = { ok: true; packet: Packet } | { ok: false; reason: "prefix" | "key" | "format" };

const PHASES = new Set<string>(["freeze", "live", "planted", "over"]);

function int(s: string | undefined): number {
  const n = Number.parseInt(s ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

function phase(s: string | undefined): Phase {
  return s !== undefined && PHASES.has(s) ? (s as Phase) : "live";
}

export function parsePlayer(line: string): PlayerLine | null {
  const f = line.split(",");
  if (f.length < 18) return null;
  return {
    uid: int(f[0]),
    team: int(f[1]),
    alive: f[2] === "1",
    hp: int(f[3]),
    armor: int(f[4]),
    helmet: f[5] === "1",
    defuser: f[6] === "1",
    money: int(f[7]),
    primary: f[8] ?? "",
    secondary: f[9] ?? "",
    active: f[10] ?? "",
    he: int(f[11]),
    flash: int(f[12]),
    smoke: int(f[13]),
    bomb: f[14] === "1",
    kills: int(f[15]),
    deaths: int(f[16]),
    damage: int(f[17]),
  };
}

function parsePlayers(s: string): PlayerLine[] {
  if (s === "") return [];
  return s
    .split(";")
    .map(parsePlayer)
    .filter((p): p is PlayerLine => p !== null);
}

function parseNames(s: string): NameLine[] {
  if (s === "") return [];
  const out: NameLine[] = [];
  for (const item of s.split(";")) {
    // El nombre va último y el plugin ya le sacó las comas.
    const [uid, steamid, ...rest] = item.split(",");
    if (uid === undefined || steamid === undefined) continue;
    out.push({ uid: int(uid), steamid, name: rest.join(",") });
  }
  return out;
}

function parseEvent(f: string[]): GameEvent | null {
  switch (f[0]) {
    case "kill":
      return {
        kind: "kill", attacker: int(f[1]), victim: int(f[2]), weapon: f[3] ?? "", headshot: f[4] === "1",
        assister: int(f[5]), flashAssist: f[6] === "1", penetrated: int(f[7]), blind: f[8] === "1", smoke: f[9] === "1", noscope: f[10] === "1",
      };
    case "phase":
      return { kind: "phase", phase: phase(f[1]), seconds: int(f[2]) };
    case "bomb":
      if (f[1] !== "plant" && f[1] !== "defuse" && f[1] !== "explode") return null;
      return { kind: "bomb", what: f[1], uid: int(f[2]) };
    case "end":
      return { kind: "end", winner: int(f[1]), reason: int(f[2]) };
    default:
      return null;
  }
}

export function parsePacket(text: string, key: string): ParseResult {
  const f = text.split("|");
  if (f[0] !== "CMH1") return { ok: false, reason: "prefix" };
  if (f[1] !== key) return { ok: false, reason: "key" };
  const seq = int(f[2]);
  const body = f.slice(4);

  switch (f[3]) {
    case "F": {
      if (body.length < 7) return { ok: false, reason: "format" };
      return {
        ok: true,
        packet: {
          type: "F",
          seq,
          tvDelay: int(body[0]),
          map: body[1] ?? "",
          round: int(body[2]),
          scoreT: int(body[3]),
          scoreCT: int(body[4]),
          phase: phase(body[5]),
          seconds: int(body[6]),
          players: parsePlayers(body[7] ?? ""),
        },
      };
    }
    case "N":
      return { ok: true, packet: { type: "N", seq, names: parseNames(body[0] ?? "") } };
    case "D":
      return { ok: true, packet: { type: "D", seq, players: parsePlayers(body[0] ?? "") } };
    case "E": {
      const event = parseEvent(body);
      return event ? { ok: true, packet: { type: "E", seq, event } } : { ok: false, reason: "format" };
    }
    default:
      return { ok: false, reason: "format" };
  }
}

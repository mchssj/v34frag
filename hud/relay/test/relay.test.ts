import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import { mergeControl, DEFAULT_CONTROL } from "../src/control.ts";
import { DelayQueue } from "../src/delay.ts";
import { findFont } from "../src/font.ts";
import { parsePacket, type Packet } from "../src/protocol.ts";
import { GameModel } from "../src/state.ts";

const KEY = "clave";
const P1 = "2,3,1,100,100,1,1,800,m4a1,usp,m4a1,1,2,0,0,3,1,57";
const P2 = "3,2,1,73,0,0,0,1200,ak47,glock,ak47,0,0,1,1,0,2,0";

function packet(text: string): Packet {
  const r = parsePacket(text, KEY);
  assert.ok(r.ok, `no se pudo leer: ${text}`);
  return r.packet;
}

describe("protocolo", () => {
  it("lee la foto completa", () => {
    const p = packet(`CMH1|${KEY}|7|F|30|de_dust2|4|1|2|live|83|${P1};${P2}`);
    assert.equal(p.type, "F");
    if (p.type !== "F") return;
    assert.equal(p.tvDelay, 30);
    assert.equal(p.map, "de_dust2");
    assert.equal(p.round, 4);
    assert.equal(p.scoreCT, 2);
    assert.equal(p.seconds, 83);
    assert.equal(p.players.length, 2);
    assert.deepEqual(p.players[0], {
      uid: 2, team: 3, alive: true, hp: 100, armor: 100, helmet: true, defuser: true, money: 800,
      primary: "m4a1", secondary: "usp", active: "m4a1", he: 1, flash: 2, smoke: 0, bomb: false, kills: 3, deaths: 1, damage: 57,
    });
  });

  it("lee una foto sin jugadores", () => {
    const p = packet(`CMH1|${KEY}|1|F|0|de_inferno|1|0|0|freeze|15|`);
    assert.equal(p.type === "F" && p.players.length, 0);
  });

  it("lee nombres con espacios y SteamID", () => {
    const p = packet(`CMH1|${KEY}|8|N|2,STEAM_0:1:123,El Juan;3,BOT,Bot Kalle`);
    assert.equal(p.type, "N");
    if (p.type !== "N") return;
    assert.deepEqual(p.names[0], { uid: 2, steamid: "STEAM_0:1:123", name: "El Juan" });
    assert.equal(p.names[1]?.steamid, "BOT");
  });

  it("lee los eventos", () => {
    const noExtras = { assister: 0, flashAssist: false, penetrated: 0, blind: false, smoke: false, noscope: false };
    // Plugin 1.0.0: sin los campos de clientmod_deathnotice.
    assert.deepEqual(packet(`CMH1|${KEY}|9|E|kill|2|3|ak47|1`), { type: "E", seq: 9, event: { kind: "kill", attacker: 2, victim: 3, weapon: "ak47", headshot: true, ...noExtras } });
    assert.deepEqual(packet(`CMH1|${KEY}|10|E|phase|planted|40`), { type: "E", seq: 10, event: { kind: "phase", phase: "planted", seconds: 40 } });
    assert.deepEqual(packet(`CMH1|${KEY}|11|E|bomb|defuse|2`), { type: "E", seq: 11, event: { kind: "bomb", what: "defuse", uid: 2 } });
    assert.deepEqual(packet(`CMH1|${KEY}|12|E|end|3|7`), { type: "E", seq: 12, event: { kind: "end", winner: 3, reason: 7 } });
  });

  it("lee los agregados de clientmod_deathnotice en la kill", () => {
    assert.deepEqual(packet(`CMH1|${KEY}|9|E|kill|2|3|awp|0|4|1|2|1|1|1`), {
      type: "E",
      seq: 9,
      event: { kind: "kill", attacker: 2, victim: 3, weapon: "awp", headshot: false, assister: 4, flashAssist: true, penetrated: 2, blind: true, smoke: true, noscope: true },
    });
  });

  it("rechaza la clave equivocada, otro prefijo y formatos rotos", () => {
    assert.deepEqual(parsePacket(`CMH1|otra|1|D|${P1}`, KEY), { ok: false, reason: "key" });
    assert.deepEqual(parsePacket("hola", KEY), { ok: false, reason: "prefix" });
    assert.deepEqual(parsePacket(`CMH1|${KEY}|1|X|algo`, KEY), { ok: false, reason: "format" });
    assert.deepEqual(parsePacket(`CMH1|${KEY}|1|E|bomb|robada|2`, KEY), { ok: false, reason: "format" });
  });

  it("descarta jugadores con campos de menos", () => {
    const p = packet(`CMH1|${KEY}|2|D|1,2,3;${P2}`);
    assert.equal(p.type === "D" && p.players.length, 1);
  });
});

describe("cola de retraso", () => {
  it("entrega cada paquete recién después del retraso, en orden", () => {
    const q = new DelayQueue();
    q.push(packet(`CMH1|${KEY}|1|D|${P1}`), 1000, 30);
    q.push(packet(`CMH1|${KEY}|2|D|${P2}`), 1500, 30);
    assert.equal(q.release(30999).length, 0);
    assert.equal(q.release(31000).length, 1);
    assert.equal(q.release(31499).length, 0);
    assert.equal(q.release(31500).length, 1);
    assert.equal(q.size, 0);
  });

  it("descarta los paquetes viejos que llegan desordenados", () => {
    const q = new DelayQueue();
    assert.equal(q.push(packet(`CMH1|${KEY}|5|D|${P1}`), 0, 0), true);
    assert.equal(q.push(packet(`CMH1|${KEY}|4|D|${P1}`), 0, 0), false);
  });

  it("acepta la foto completa aunque la secuencia vuelva a empezar (plugin recargado)", () => {
    const q = new DelayQueue();
    q.push(packet(`CMH1|${KEY}|500|D|${P1}`), 0, 0);
    assert.equal(q.push(packet(`CMH1|${KEY}|1|F|0|de_dust2|1|0|0|live|60|${P1}`), 0, 0), true);
    assert.equal(q.push(packet(`CMH1|${KEY}|2|D|${P1}`), 0, 0), true);
  });

  it("si baja el retraso, un paquete nuevo no sale antes que uno anterior", () => {
    const q = new DelayQueue();
    q.push(packet(`CMH1|${KEY}|1|D|${P1}`), 0, 30);
    q.push(packet(`CMH1|${KEY}|2|D|${P2}`), 1000, 5);
    assert.equal(q.release(6000).length, 0);
    assert.equal(q.release(30000).length, 2);
  });
});

describe("estado", () => {
  it("arma los jugadores con sus nombres y aplica los cambios", () => {
    const m = new GameModel();
    m.apply(packet(`CMH1|${KEY}|1|N|2,STEAM_0:1:1,Juan;3,BOT,Kalle`), 0);
    m.apply(packet(`CMH1|${KEY}|2|F|30|de_dust2|1|0|0|live|100|${P1};${P2}`), 1000);
    m.apply(packet(`CMH1|${KEY}|3|D|3,2,0,0,0,0,0,1200,,,,0,0,0,0,0,3,0`), 2000);
    const s = m.snapshot();
    assert.equal(s.players.length, 2);
    assert.equal(s.players.find((p) => p.uid === 3)?.alive, false);
    assert.equal(s.players.find((p) => p.uid === 2)?.name, "Juan");
    // Ordenados: T (2) primero, después CT (3).
    assert.deepEqual(s.players.map((p) => p.team), [2, 3]);
    assert.equal(s.phaseEndsAt, 1000 + 100 * 1000);
  });

  it("la foto completa saca a los que ya no están", () => {
    const m = new GameModel();
    m.apply(packet(`CMH1|${KEY}|1|F|0|de_dust2|1|0|0|live|60|${P1};${P2}`), 0);
    m.apply(packet(`CMH1|${KEY}|2|F|0|de_dust2|1|0|0|live|60|${P1}`), 0);
    assert.equal(m.snapshot().players.length, 1);
  });

  it("guarda las últimas kills, la bomba y el fin de ronda, y los limpia al empezar otra", () => {
    const m = new GameModel();
    for (let i = 0; i < 8; i++) m.apply(packet(`CMH1|${KEY}|${i + 1}|E|kill|2|3|ak47|0`), i);
    assert.equal(m.snapshot().kills.length, 6);
    m.apply(packet(`CMH1|${KEY}|20|E|bomb|plant|3`), 100);
    m.apply(packet(`CMH1|${KEY}|21|E|phase|planted|40`), 100);
    m.apply(packet(`CMH1|${KEY}|22|E|end|2|0`), 200);
    let s = m.snapshot();
    assert.equal(s.bomb?.what, "plant");
    assert.equal(s.lastEnd?.winner, 2);
    assert.equal(s.phase, "planted");
    m.apply(packet(`CMH1|${KEY}|23|E|phase|freeze|15`), 300);
    s = m.snapshot();
    assert.equal(s.bomb, null);
    assert.equal(s.lastEnd, null);
  });

  it("sin reloj (-1) no hay hora de fin", () => {
    const m = new GameModel();
    m.apply(packet(`CMH1|${KEY}|1|E|phase|over|-1`), 0);
    assert.equal(m.snapshot().phaseEndsAt, null);
  });
});

describe("control", () => {
  it("aplica cambios válidos e ignora los inválidos", () => {
    const c = mergeControl(DEFAULT_CONTROL, { teamCT: "  Equipo A  ", focus: 5, showKills: false, showScore: "no", extra: 1 });
    assert.equal(c.teamCT, "Equipo A");
    assert.equal(c.focus, 5);
    assert.equal(c.showKills, false);
    assert.equal(c.showScore, true);
    assert.equal(mergeControl(c, { focus: 1.5 }).focus, 5);
    assert.equal(mergeControl(c, { focus: null }).focus, null);
  });

  it("intercambia los nombres en el medio tiempo y corta los nombres largos", () => {
    const c = mergeControl({ ...DEFAULT_CONTROL, teamCT: "A", teamT: "B" }, { swap: true });
    assert.deepEqual([c.teamCT, c.teamT], ["B", "A"]);
    assert.equal(mergeControl(c, { teamT: "x".repeat(50) }).teamT.length, 32);
  });
});

describe("fuentes de los íconos", () => {
  const FONT = join("cstrike", "resource", "clientmodkillfeed.ttf");

  it("usa gameDir si está configurado", () => {
    const dir = join("X:", "Juegos", "ClientMod");
    assert.equal(findFont(dir, "killfeed", (p) => p === join(dir, FONT)), join(dir, FONT));
    assert.equal(findFont(dir, "killfeed", () => false), null);
  });

  it("sin gameDir las busca en la carpeta por defecto de cada disco", () => {
    const d = join("D:\\CSSv34_ClientMod", FONT);
    assert.equal(findFont(null, "killfeed", (p) => p === d), d);
    assert.equal(findFont(null, "killfeed", () => false), null);
    const cs = join("C:\\CSSv34_ClientMod", "cstrike", "resource", "cs.ttf");
    assert.equal(findFont(null, "cs", (p) => p === cs), cs);
  });
});

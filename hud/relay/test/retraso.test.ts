import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Channel, LANE_IDLE_MS } from "../src/channel.ts";
import { ControlStore, DEFAULT_CONTROL, delayModeOf, mergeControl } from "../src/control.ts";
import { Hub } from "../src/hub.ts";
import { type RemoteConfig, sha256 } from "../src/remote.ts";
import type { Client, HttpServer } from "../src/server.ts";
import type { GameState } from "../src/state.ts";

// Retraso por streamer y por servidor (docs/bitacora/2026-11-01-hud-retraso-por-servidor).
const K = "clave";
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const U1 = "11111111-0000-4000-8000-000000000001";
const U2 = "22222222-0000-4000-8000-000000000002";
const P = "2,3,1,100,100,1,1,800,m4a1,usp,m4a1,1,2,0,0,3,1,57";
const full = (seq: number, tvDelay = 30, map = "de_dust2", seconds = 100) => `CMH1|${K}|${seq}|F|${tvDelay}|${map}|1|0|0|live|${seconds}|${P}`;
const names = (seq: number) => `CMH1|${K}|${seq}|N|2,STEAM_0:1:1,Juan`;
const kill = (seq: number) => `CMH1|${K}|${seq}|E|kill|2|3|ak47|1`;
const tmp = mkdtempSync(join(tmpdir(), "hud-retraso-"));

describe("vías de retraso", () => {
  it("en vivo ve la kill al instante y SourceTV a los 30 s, con un solo paquete del servidor", () => {
    const c = new Channel(K, null);
    c.touch("live", 0);
    assert.ok(c.handle(full(1), 0));
    assert.ok(c.handle(kill(2), 1000));
    assert.deepEqual([...c.release(1000)], [0]);
    assert.equal(c.snapshot("live", 1000).kills.length, 1);
    assert.equal(c.snapshot("tv", 1000).map, "");
    assert.deepEqual([...c.release(31_000)], ["tv"]);
    assert.equal(c.snapshot("tv", 31_000).kills.length, 1);
    assert.equal(c.delaySeconds("tv"), 30);
    assert.equal(c.delaySeconds("live"), 0);
    assert.equal(c.received, 2);
  });

  it("una vía nueva a mitad de ronda se arma con la historia, sin quedar vacía", () => {
    const c = new Channel(K, null);
    c.handle(names(1), 0);
    c.handle(full(2), 0);
    c.handle(kill(3), 2000);
    const s = c.snapshot("live", 5000);
    assert.equal(s.map, "de_dust2");
    assert.equal(s.players[0]?.name, "Juan");
    assert.equal(s.kills.length, 1);
  });

  it("una vía de 10 s con 5 s de historia muestra lo que ya cumplió y completa el resto a tiempo", () => {
    const c = new Channel(K, null);
    c.handle(full(1), 0);
    c.handle(kill(2), 4000);
    let s = c.snapshot(10, 5000);
    assert.equal(s.map, "");
    assert.ok(c.release(10_000).has(10));
    s = c.snapshot(10, 10_000);
    assert.equal(s.map, "de_dust2");
    assert.equal(s.kills.length, 0);
    c.release(14_000);
    assert.equal(c.snapshot(10, 14_000).kills.length, 1);
  });

  it("el reloj de la ronda de una vía armada con la historia es el mismo que el de una que estuvo desde el principio", () => {
    const c = new Channel(K, null);
    c.touch(5, 0);
    c.handle(full(1, 30, "de_dust2", 100), 0);
    c.release(5000);
    const desde = c.snapshot(5, 5000) as GameState;
    const otra = new Channel(K, null);
    otra.handle(full(1, 30, "de_dust2", 100), 0);
    const armada = otra.snapshot(5, 5000);
    assert.equal(armada.phaseEndsAt, desde.phaseEndsAt);
    assert.equal(armada.phaseEndsAt, 5000 + 100_000);
  });

  it("con el retraso fijo de la configuración todos van por la misma vía", () => {
    const c = new Channel(K, 7);
    assert.ok(c.locked);
    assert.equal(c.laneKey("live"), "tv");
    assert.equal(c.laneKey(20), "tv");
    c.handle(full(1, 30), 0);
    assert.equal(c.delaySeconds("live"), 7);
    c.snapshot("live", 0);
    assert.equal(c.laneCount, 1);
  });

  it("una vía que nadie mira se borra; la de SourceTV no", () => {
    const c = new Channel(K, null);
    c.touch("live", 0);
    c.touch(20, 0);
    assert.equal(c.laneCount, 3);
    c.touch(20, LANE_IDLE_MS);
    c.prune(LANE_IDLE_MS + 1);
    assert.equal(c.laneCount, 2);
    c.prune(2 * LANE_IDLE_MS + 2);
    assert.equal(c.laneCount, 1);
    assert.equal(c.laneKey("tv"), "tv");
  });

  it("la historia no pasa de unos 315 s", () => {
    const c = new Channel(K, null);
    c.handle(full(1, 0, "de_viejo"), 0);
    c.handle(full(2, 0, "de_nuevo"), 400_000);
    // La vía de 300 s ya no puede ver de_viejo: se descartó de la historia.
    assert.equal(c.snapshot(300, 400_000).map, "");
  });
});

describe("control: retraso por servidor", () => {
  it("guarda el modo de cada servidor y SourceTV borra la entrada", () => {
    let c = mergeControl(DEFAULT_CONTROL, { delay: { server: A, mode: "live" } });
    assert.equal(delayModeOf(c, A), "live");
    c = mergeControl(c, { delay: { server: "local", mode: 45 } });
    assert.equal(delayModeOf(c, "local"), 45);
    c = mergeControl(c, { delay: { server: A, mode: "tv" } });
    assert.deepEqual(c.delays, { local: 45 });
    assert.deepEqual(DEFAULT_CONTROL.delays, {});
  });

  it("ignora modos inválidos, números fuera de rango y servidores que no son UUID", () => {
    const base = mergeControl(DEFAULT_CONTROL, { delay: { server: A, mode: 10 } });
    for (const bad of [
      { delay: { server: A, mode: 0 } },
      { delay: { server: A, mode: 301 } },
      { delay: { server: A, mode: 2.5 } },
      { delay: { server: A, mode: "rapido" } },
      { delay: { server: "../etc", mode: "live" } },
      { delay: "live" },
    ])
      assert.deepEqual(mergeControl(base, bad).delays, { [A]: 10 }, JSON.stringify(bad));
  });

  it("se carga desde el archivo guardado", () => {
    const path = join(tmp, "control.json");
    const s = new ControlStore(path);
    s.set(U1, mergeControl(DEFAULT_CONTROL, { delay: { server: A, mode: "live" } }));
    assert.equal(delayModeOf(new ControlStore(path).get(U1), A), "live");
  });
});

describe("hub: dos streamers en el mismo servidor", () => {
  const cfg: RemoteConfig = {
    servers: [{ id: A, name: "flow", port: 27501, key: K, tvAddress: "" }],
    streamers: [
      { userId: U1, alias: "uno", tokenHash: sha256("hud_uno") },
      { userId: U2, alias: "dos", tokenHash: sha256("hud_dos") },
    ],
  };

  function setup(delay: number | null) {
    let now = 1_000_000;
    let onUdp: (t: string) => void = () => {};
    const logs: string[] = [];
    const sent: { viewer: string; event: string; data: GameState }[] = [];
    const clients: Client[] = [
      { viewer: U1, page: "hud", res: {} as never },
      { viewer: U2, page: "hud", res: {} as never },
    ];
    const hub = new Hub({
      bind: async (_port, onMessage) => ((onUdp = onMessage), { close: () => {} }),
      fetchRemote: async () => cfg,
      controls: new ControlStore(join(tmp, `c-${Math.random()}.json`)),
      delay,
      log: (m) => logs.push(m),
      now: () => now,
    });
    hub.http = {
      connections: () => clients,
      broadcast: (event: string, data: GameState, to: (c: Client) => boolean = () => true) => {
        for (const c of clients) if (to(c)) sent.push({ viewer: c.viewer, event, data });
      },
      disconnect: () => {},
    } as unknown as HttpServer;
    return { hub, logs, sent, udp: (t: string) => onUdp(t), advance: (ms: number) => (now += ms) };
  }

  it("cada uno recibe su vía: el de en vivo ya ve la kill y el de SourceTV todavía no", async () => {
    const t = setup(null);
    await t.hub.refresh();
    t.hub.onControl(U2, { delay: { server: A, mode: "live" } });
    assert.ok(t.logs.some((l) => l === "dos: retraso de flow → en vivo."));
    t.udp(full(1, 30));
    t.udp(kill(2));
    t.sent.length = 0;
    t.advance(100);
    t.hub.tick();
    assert.deepEqual(t.sent.map((s) => s.viewer), [U2]);
    assert.equal(t.sent[0]!.data.kills.length, 1);
    assert.equal(t.hub.stateFor(U1).map, "");
    t.advance(30_000);
    t.hub.tick();
    assert.equal(t.hub.stateFor(U1).kills.length, 1);
    const st = t.hub.status(U2) as Record<string, unknown>;
    assert.equal(st.delayMode, "live");
    assert.equal(st.delaySeconds, 0);
    assert.equal(st.tvDelay, 30);
    assert.equal(st.delayLocked, false);
    assert.equal((t.hub.status(U1) as Record<string, unknown>).delaySeconds, 30);
  });

  it("al cambiar de modo le manda enseguida el estado de su vía nueva", async () => {
    const t = setup(null);
    await t.hub.refresh();
    t.udp(full(1, 30));
    t.sent.length = 0;
    t.hub.onControl(U1, { delay: { server: A, mode: "live" } });
    const state = t.sent.find((s) => s.viewer === U1 && s.event === "state");
    assert.equal(state?.data.map, "de_dust2");
  });

  it("con el retraso fijo de hud.json, el modo se guarda pero no cambia nada", async () => {
    const t = setup(0);
    await t.hub.refresh();
    t.hub.onControl(U1, { delay: { server: A, mode: 60 } });
    const st = t.hub.status(U1) as Record<string, unknown>;
    assert.equal(st.delayLocked, true);
    assert.equal(st.delaySeconds, 0);
  });
});

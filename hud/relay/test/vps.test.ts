import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Channel } from "../src/channel.ts";
import { configPath, loadConfig } from "../src/config.ts";
import { ControlStore, DEFAULT_CONTROL, mergeControl } from "../src/control.ts";
import { Hub, type Socket } from "../src/hub.ts";
import { fetchRemote, parseRemote, type RemoteConfig, sha256 } from "../src/remote.ts";
import { type Client, HttpServer } from "../src/server.ts";

// Modo VPS del relay (docs/bitacora/2026-10-29-hud-relay-vps).
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const U1 = "11111111-0000-4000-8000-000000000001";
const U2 = "22222222-0000-4000-8000-000000000002";
const P = "2,3,1,100,100,1,1,800,m4a1,usp,m4a1,1,2,0,0,3,1,57";
const full = (key: string, seq: number, map: string) => `CMH1|${key}|${seq}|F|0|${map}|1|0|0|live|60|${P}`;
const tmp = mkdtempSync(join(tmpdir(), "hud-relay-"));

const remote = (o: Partial<RemoteConfig> = {}): RemoteConfig => ({
  servers: [
    { id: A, name: "CMLeague #1", port: 27501, key: "claveA", tvAddress: "10.0.0.1:27020" },
    { id: B, name: "RBK", port: 27502, key: "claveB", tvAddress: "10.0.0.2:27020" },
  ],
  streamers: [
    { userId: U1, alias: "uno", tokenHash: sha256("hud_uno") },
    { userId: U2, alias: "dos", tokenHash: sha256("hud_dos") },
  ],
  ...o,
});

/** Un Hub con puertos y base falsos, y un HTTP falso que solo anota lo que se manda. */
function fakeHub(cfg: RemoteConfig = remote()) {
  const ports = new Map<number, (text: string) => void>();
  const closed: number[] = [];
  const sent: { viewer: string; event: string; data: unknown }[] = [];
  const disconnected: string[] = [];
  const reports: { sessions: unknown; seen: Record<string, string> }[] = [];
  let next = cfg;
  let now = 1_000_000;
  const clients: Client[] = [];
  const hub = new Hub({
    bind: async (port, onMessage) => {
      if (ports.has(port)) throw new Error("ocupado");
      ports.set(port, onMessage);
      return { close: () => (ports.delete(port), closed.push(port)) } satisfies Socket;
    },
    fetchRemote: async (sessions, seen) => {
      reports.push({ sessions, seen });
      return next;
    },
    controls: new ControlStore(join(tmp, `control-${Math.random()}.json`)),
    delay: 0,
    log: () => {},
    now: () => now,
  });
  hub.http = {
    connections: () => clients,
    broadcast: (event: string, data: unknown, to: (c: Client) => boolean = () => true) => {
      for (const c of clients) if (to(c)) sent.push({ viewer: c.viewer, event, data });
    },
    disconnect: (viewer: string) => disconnected.push(viewer),
  } as unknown as HttpServer;
  const open = (viewer: string, page: "hud" | "control" = "hud") => clients.push({ viewer, page, res: {} as never });
  return {
    hub, ports, closed, sent, disconnected, reports, open,
    setRemote: (c: RemoteConfig) => (next = c),
    advance: (ms: number) => (now += ms),
    udp: (port: number, text: string) => ports.get(port)!(text),
  };
}

describe("configuración remota", () => {
  it("descarta lo mal formado y los puertos repetidos", () => {
    const c = parseRemote({
      servers: [
        { id: A, name: "A", port: 27501, key: "k", tv_address: "h:1" },
        { id: B, name: "B", port: 27501, key: "k" },
        { id: "x", port: "27503", key: "k" },
        { id: "y", port: 27504 },
      ],
      streamers: [{ user_id: U1, alias: "uno", token_hash: "h" }, { user_id: U2 }],
    });
    assert.deepEqual(c.servers.map((s) => s.id), [A]);
    assert.equal(c.servers[0]!.tvAddress, "h:1");
    assert.deepEqual(c.streamers.map((s) => s.userId), [U1]);
    assert.deepEqual(parseRemote(null), { servers: [], streamers: [] });
  });

  it("pide hud_relay_config con la clave anon y el token, e informa sesiones y paquetes", async () => {
    let req: { url: string; init: RequestInit } | null = null;
    const cfg = await fetchRemote(
      { apiUrl: "https://db.test/", anonKey: "anon", relayToken: "hudr_x" },
      [{ userId: U1, serverId: A }],
      { [A]: "2026-10-29T12:00:00.000Z" },
      async (url, init) => ((req = { url, init }), Response.json({ servers: [], streamers: [] })),
    );
    assert.deepEqual(cfg, { servers: [], streamers: [] });
    assert.equal(req!.url, "https://db.test/rest/v1/rpc/hud_relay_config");
    assert.equal((req!.init.headers as Record<string, string>).apikey, "anon");
    assert.deepEqual(JSON.parse(req!.init.body as string), {
      p_token: "hudr_x", p_sessions: [{ user_id: U1, server_id: A }], p_seen: { [A]: "2026-10-29T12:00:00.000Z" },
    });
    await assert.rejects(
      fetchRemote({ apiUrl: "https://db.test", anonKey: "a", relayToken: "t" }, [], {}, async () =>
        Response.json({ code: "PT401", message: "Token del relay inválido o revocado" }, { status: 401 })),
      /Token del relay inválido/,
    );
  });
});

describe("relay.json", () => {
  it("modo VPS: pide apiUrl, anonKey y relayToken; no hace falta key", () => {
    const p = join(tmp, "vps.json");
    writeFileSync(p, JSON.stringify({ apiUrl: "https://db.test", anonKey: "a", relayToken: "t", httpPort: 8090 }));
    const r = loadConfig(p);
    assert.ok(r.ok && r.config.remote?.relayToken === "t");
    writeFileSync(p, JSON.stringify({ apiUrl: "https://db.test", anonKey: "a" }));
    const bad = loadConfig(p);
    assert.ok(!bad.ok && bad.message.includes("relayToken"));
  });

  it("modo local: sigue pidiendo la clave; HUD_RELAY_CONFIG cambia la ruta y no crea el archivo", () => {
    const p = join(tmp, "local.json");
    writeFileSync(p, JSON.stringify({ key: "k" }));
    const r = loadConfig(p);
    assert.ok(r.ok && r.config.remote === null && r.config.key === "k");
    assert.equal(configPath(false, { HUD_RELAY_CONFIG: "/etc/cmleague/hud.json" }), "/etc/cmleague/hud.json");
    const missing = loadConfig(join(tmp, "no-existe.json"), false);
    assert.ok(!missing.ok && missing.message.startsWith("No existe"));
  });
});

describe("control por streamer", () => {
  it("elegir otro servidor saca al jugador enfocado; un id inválido se ignora", () => {
    const c = mergeControl({ ...DEFAULT_CONTROL, focus: 3 }, { server: A });
    assert.equal(c.server, A);
    assert.equal(c.focus, null);
    assert.equal(mergeControl(c, { server: "no-es-un-id" }).server, A);
    assert.equal(mergeControl({ ...c, focus: 4 }, { server: A }).focus, 4);
  });

  it("se guarda por streamer y sobrevive a un reinicio", () => {
    const p = join(tmp, "store.json");
    const s = new ControlStore(p);
    s.set(U1, { ...DEFAULT_CONTROL, server: A, teamCT: "Alfa" });
    const again = new ControlStore(p);
    assert.equal(again.get(U1).teamCT, "Alfa");
    assert.equal(again.get(U2).teamCT, "CT");
  });
});

describe("canales", () => {
  it("cada servidor con su clave y su secuencia: uno no descarta los paquetes del otro", () => {
    const a = new Channel("claveA", 0);
    const b = new Channel("claveB", 0);
    assert.ok(a.handle(full("claveA", 50, "de_dust2"), 0));
    assert.ok(b.handle(`CMH1|claveB|3|D|${P}`, 0));
    assert.ok(!b.handle(full("claveA", 51, "de_x"), 0));
    assert.equal(b.badKey, 1);
    a.release(1);
    b.release(1);
    assert.equal(a.snapshot().map, "de_dust2");
    assert.equal(b.snapshot().map, "");
  });
});

describe("hub", () => {
  it("abre un puerto por servidor y reconoce los tokens", async () => {
    const t = fakeHub();
    await t.hub.refresh();
    assert.deepEqual([...t.ports.keys()].sort(), [27501, 27502]);
    assert.equal(t.hub.viewer("hud_uno"), U1);
    assert.equal(t.hub.viewer("hud_otro"), null);
    assert.equal(t.hub.viewer(null), null);
  });

  it("cada streamer ve el servidor que eligió; con uno solo activo, ese", async () => {
    const t = fakeHub();
    await t.hub.refresh();
    assert.equal(t.hub.selected(U1), null);
    t.open(U1);
    t.open(U2);
    t.hub.onControl(U1, { server: A });
    t.hub.onControl(U2, { server: B });
    t.udp(27501, full("claveA", 1, "de_dust2"));
    t.udp(27502, full("claveB", 1, "de_inferno"));
    t.hub.tick();
    const maps = (v: string) => t.sent.filter((s) => s.viewer === v && s.event === "state").map((s) => (s.data as { map: string }).map);
    assert.deepEqual(maps(U1).at(-1), "de_dust2");
    assert.deepEqual(maps(U2).at(-1), "de_inferno");
    assert.ok(!maps(U1).includes("de_inferno"));

    t.setRemote(remote({ servers: remote().servers.slice(0, 1) }));
    await t.hub.refresh();
    assert.equal(t.hub.selected(U2), A, "se apagó su servidor: queda el único activo");
    assert.deepEqual(t.closed, [27502]);
  });

  it("informa sesiones (solo /hud) y el último paquete de cada servidor", async () => {
    const t = fakeHub();
    await t.hub.refresh();
    t.open(U1, "hud");
    t.open(U2, "control");
    t.hub.onControl(U1, { server: A });
    t.hub.onControl(U2, { server: A });
    t.udp(27501, full("claveA", 1, "de_dust2"));
    await t.hub.refresh();
    const last = t.reports.at(-1)!;
    assert.deepEqual(last.sessions, [{ userId: U1, serverId: A }]);
    assert.deepEqual(Object.keys(last.seen), [A]);
    await t.hub.refresh();
    assert.deepEqual(t.reports.at(-1)!.seen, {}, "un paquete se informa una sola vez");
    const st = t.hub.status(U2) as { servers: { id: string; streaming: string[]; receiving: boolean }[] };
    assert.deepEqual(st.servers.find((s) => s.id === A)!.streaming, ["uno"]);
    assert.ok(st.servers.find((s) => s.id === A)!.receiving);
  });

  it("un streamer revocado pierde la conexión; una clave nueva se aplica sin cerrar el puerto", async () => {
    const t = fakeHub();
    await t.hub.refresh();
    t.open(U2);
    t.setRemote(remote({
      streamers: remote().streamers.slice(0, 1),
      servers: [{ ...remote().servers[0]!, key: "nueva" }, remote().servers[1]!],
    }));
    await t.hub.refresh();
    assert.deepEqual(t.disconnected, [U2]);
    assert.equal(t.hub.viewer("hud_dos"), null);
    assert.deepEqual(t.closed, []);
    t.hub.onControl(U1, { server: A });
    t.open(U1);
    t.udp(27501, full("nueva", 1, "de_nuke"));
    t.hub.tick();
    assert.equal((t.hub.stateFor(U1) as { map: string }).map, "de_nuke");
  });

  it("cambiar el puerto cierra el viejo y abre el nuevo; un puerto ocupado no frena a los demás", async () => {
    const t = fakeHub();
    await t.hub.refresh();
    t.setRemote(remote({ servers: [{ ...remote().servers[0]!, port: 27510 }, remote().servers[1]!] }));
    await t.hub.refresh();
    assert.deepEqual(t.closed, [27501]);
    assert.ok(t.ports.has(27510));

    // Otro programa ocupa el 27511: ese servidor queda sin abrir y el resto sigue.
    t.ports.set(27511, () => {});
    const C = "cccccccc-0000-4000-8000-000000000003";
    t.setRemote(remote({ servers: [...remote().servers, { id: C, name: "flow", port: 27511, key: "claveC", tvAddress: "" }] }));
    await t.hub.refresh();
    const ids = (t.hub.status(U1) as { servers: { id: string }[] }).servers.map((s) => s.id);
    assert.ok(!ids.includes(C) && ids.includes(A) && ids.includes(B));
  });
});

describe("HTTP con token", () => {
  it("rutas debajo de /s/<token>/, 404 sin token válido y redirección sin barra", async () => {
    const calls: { viewer: string; body: unknown }[] = [];
    const http = new HttpServer({
      viewer: (token) => (token === "hud_uno" ? U1 : null),
      initial: (viewer) => [{ event: "control", data: { viewer } }],
      onControl: (viewer, body) => calls.push({ viewer, body }),
      status: (viewer) => ({ viewer }),
      health: () => ({ status: "ok" }),
      font: () => null,
    });
    await http.listen(0);
    const base = `http://127.0.0.1:${http.address}`;
    try {
      const page = await fetch(`${base}/s/hud_uno/hud`);
      assert.equal(page.status, 200);
      assert.equal(page.headers.get("referrer-policy"), "no-referrer");
      assert.match(await page.text(), /src="hud\.js"/);
      assert.equal((await fetch(`${base}/s/hud_otro/hud`)).status, 404);
      assert.equal((await fetch(`${base}/hud`)).status, 404, "en el modo VPS no hay nada sin token");
      assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), { status: "ok" });
      const redirect = await fetch(`${base}/s/hud_uno`, { redirect: "manual" });
      assert.equal(redirect.status, 302);
      assert.equal(redirect.headers.get("location"), "/s/hud_uno/hud");
      assert.deepEqual(await (await fetch(`${base}/s/hud_uno/api/status`)).json(), { viewer: U1 });
      const post = await fetch(`${base}/s/hud_uno/api/control`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ focus: 2 }),
      });
      assert.equal(post.status, 200);
      assert.deepEqual(calls, [{ viewer: U1, body: { focus: 2 } }]);

      const ac = new AbortController();
      const ev = await fetch(`${base}/s/hud_uno/events?page=hud`, { signal: ac.signal });
      const reader = ev.body!.getReader();
      const first = new TextDecoder().decode((await reader.read()).value);
      assert.match(first, /event: control/);
      assert.deepEqual(http.connections().map((c) => [c.viewer, c.page]), [[U1, "hud"]]);
      ac.abort();
    } finally {
      http.close();
    }
  });
});

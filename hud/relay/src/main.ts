// Relay del HUD de observer (docs/bitacora/2026-10-22-hud-observer y 2026-10-29-hud-relay-vps): recibe los paquetes
// UDP de csstv_hud, los retrasa igual que la SourceTV y se los pasa al HUD de OBS.
// Dos modos (config.ts): local, en la PC del streamer con un túnel de playit.gg, y VPS, para todos los servidores.

import { createSocket } from "node:dgram";
import { readSync } from "node:fs";
import { dirname, join } from "node:path";
import { isSea } from "node:sea";
import { Channel } from "./channel.ts";
import { type Config, configPath, loadConfig } from "./config.ts";
import { ControlStore, loadControl, mergeControl, saveControl } from "./control.ts";
import { findFont, loadFont } from "./font.ts";
import { Hub, type Socket } from "./hub.ts";
import { fetchRemote } from "./remote.ts";
import { HttpServer } from "./server.ts";

const VERSION = "2.2.0";
// El commit del build del VPS (scripts/build-node.mjs); con Node desde src/, "dev".
const BUILD = process.env.BUILD_SHA || "dev";
const RELEASE_MS = 50;
const STATUS_MS = 10000;
const REMOTE_MS = 30000;
const SUMMARY_MS = 60000;

function log(msg: string): void {
  const t = new Date().toLocaleTimeString("es-AR", { hour12: false });
  console.log(`[${t}] ${msg}`);
}

function fail(msg: string): never {
  console.error(msg);
  if (isSea()) {
    // Con doble clic la ventana se cerraría antes de que se pueda leer el error.
    console.error("\nApretá Enter para cerrar.");
    try {
      readSync(0, Buffer.alloc(16));
    } catch {
      // Sin consola (stdin cerrado): se cierra igual.
    }
  }
  process.exit(1);
}

function loadFonts(config: Config) {
  const killfeedPath = findFont(config.gameDir, "killfeed");
  return { path: killfeedPath, fonts: { killfeed: loadFont(killfeedPath), cs: loadFont(findFont(config.gameDir, "cs")) } };
}

async function main(): Promise<void> {
  console.log(`CMLeague HUD relay ${VERSION}\n`);
  const cfgPath = configPath(isSea());
  const loaded = loadConfig(cfgPath, !process.env.HUD_RELAY_CONFIG);
  if (!loaded.ok) fail(loaded.message);
  const config = loaded.config;
  if (config.remote) await runVps(config, cfgPath);
  else await runLocal(config, cfgPath);
}

// ---------- VPS ----------

async function runVps(config: Config, cfgPath: string): Promise<void> {
  const remote = config.remote!;
  const stateDir = process.env.STATE_DIRECTORY || dirname(cfgPath);
  const { path: fontPath, fonts } = loadFonts(config);

  const hub = new Hub({
    bind: (port, onMessage) =>
      new Promise<Socket>((resolve, reject) => {
        const udp = createSocket("udp4");
        udp.once("error", reject);
        udp.on("message", (msg) => onMessage(msg.toString("utf8")));
        udp.bind(port, "0.0.0.0", () => {
          udp.off("error", reject);
          udp.on("error", (e) => log(`Error en el puerto UDP ${port}: ${e.message}`));
          resolve({ close: () => udp.close() });
        });
      }),
    fetchRemote: (sessions, seen) => fetchRemote(remote, sessions, seen),
    controls: new ControlStore(join(stateDir, "control.json")),
    delay: config.delay,
    log,
  });

  const http = new HttpServer({
    viewer: (token) => hub.viewer(token),
    initial: (viewer) => hub.initial(viewer),
    health: () => ({ status: "ok", version: VERSION, build: BUILD, loaded: hub.loaded }),
    onControl: (viewer, body) => hub.onControl(viewer, body),
    status: (viewer) => hub.status(viewer, { version: VERSION, killfeedIcons: fonts.killfeed !== null, kitIcon: fonts.cs !== null }),
    font: (name) => fonts[name],
  });
  hub.http = http;

  try {
    await http.listen(config.httpPort);
  } catch (e) {
    fail(`No se pudo abrir el puerto ${config.httpPort}: ${(e as Error).message}`);
  }
  log(`Modo VPS. HTTP en 127.0.0.1:${config.httpPort} (lo publica Caddy). Configuración desde ${remote.apiUrl}.`);
  log(fonts.killfeed ? `Íconos: ${fontPath}` : `Sin la fuente de ClientMod: el HUD muestra los nombres de las armas (revisá "gameDir").`);

  const refresh = async () => {
    try {
      await hub.refresh();
    } catch (e) {
      log(`No se pudo leer la configuración de la base (sigue con la anterior): ${(e as Error).message}`);
    }
  };
  await refresh();
  setInterval(() => void refresh(), REMOTE_MS);
  setInterval(() => hub.tick(), RELEASE_MS);
  setInterval(() => log(hub.summary(SUMMARY_MS / 1000)), SUMMARY_MS);

  // systemd manda SIGTERM al reiniciar: se cierran los puertos y las conexiones de los HUD.
  process.once("SIGTERM", () => {
    hub.close();
    http.close();
    process.exit(0);
  });
}

// ---------- Local (PC del streamer) ----------

async function runLocal(config: Config, cfgPath: string): Promise<void> {
  const controlPath = join(dirname(cfgPath), "relay-control.json");
  let control = loadControl(controlPath);
  const { path: fontPath, fonts } = loadFonts(config);
  const channel = new Channel(config.key, config.delay);

  const http: HttpServer = new HttpServer({
    viewer: (token) => (token === null ? "local" : null),
    health: () => ({ status: "ok", version: VERSION, build: BUILD }),
    initial: () => [
      { event: "state", data: channel.snapshot() },
      { event: "control", data: control },
    ],
    onControl: (_viewer, body) => {
      control = mergeControl(control, body);
      saveControl(controlPath, control);
      http.broadcast("control", control);
    },
    status: () => ({
      mode: "local",
      version: VERSION,
      received: channel.received,
      lastPacketMsAgo: channel.lastPacketAt ? Date.now() - channel.lastPacketAt : null,
      delaySeconds: channel.delaySeconds(),
      queued: channel.queued,
      hudOpen: http.connections().filter((c) => c.page === "hud").length,
      killfeedIcons: fonts.killfeed !== null,
      kitIcon: fonts.cs !== null,
    }),
    font: (name) => fonts[name],
  });

  const udp = createSocket("udp4");
  udp.on("message", (msg) => channel.handle(msg.toString("utf8"), Date.now()));
  udp.on("error", (e) => fail(`Error en el puerto UDP ${config.udpPort}: ${e.message}`));

  // Solo 127.0.0.1: los paquetes llegan por el agente de playit, que corre en esta misma PC.
  await new Promise<void>((resolve) => udp.bind(config.udpPort, "127.0.0.1", resolve));
  try {
    await http.listen(config.httpPort);
  } catch (e) {
    fail(`No se pudo abrir el puerto ${config.httpPort} (¿hay otro relay abierto?): ${(e as Error).message}`);
  }

  log(`Esperando paquetes del servidor en UDP 127.0.0.1:${config.udpPort} (túnel de playit.gg).`);
  log(`HUD para OBS:      http://localhost:${config.httpPort}/hud`);
  log(`Página de control: http://localhost:${config.httpPort}/control`);
  log(
    fonts.killfeed
      ? `Íconos: ${fontPath}`
      : `No se encontró la fuente de ClientMod (cstrike/resource/clientmodkillfeed.ttf): el HUD muestra los nombres de las armas. Poné la carpeta de ClientMod en "gameDir" de relay.json.`,
  );
  log(config.delay === null ? "Retraso: el tv_delay del servidor." : `Retraso fijo: ${config.delay} s (relay.json).`);

  setInterval(() => {
    if (channel.release(Date.now())) http.broadcast("state", channel.snapshot());
  }, RELEASE_MS);

  let lastLine = "";
  setInterval(() => {
    let line: string;
    const last = channel.lastPacketAt;
    if (last === 0) line = "Todavía no llegó ningún paquete. ¿Está abierto playit y cargado el host en el servidor?";
    else if (Date.now() - last > 15000) line = `Sin paquetes hace ${Math.round((Date.now() - last) / 1000)} s (sin jugadores en el servidor o se cortó el túnel).`;
    else {
      const huds = http.connections().filter((c) => c.page === "hud").length;
      line = `Recibiendo: ${(channel.receivedWindow / (STATUS_MS / 1000)).toFixed(1)} paquetes/s · retraso ${channel.delaySeconds()} s · ${channel.snapshot().players.length} jugadores · HUD abiertos: ${huds}`;
    }
    if (channel.badKey) line += ` · ${channel.badKey} con clave incorrecta (revisá "key" en relay.json)`;
    if (channel.badFormat) line += ` · ${channel.badFormat} con formato inválido`;
    channel.receivedWindow = 0;
    channel.badKey = 0;
    channel.badFormat = 0;
    if (line !== lastLine || line.startsWith("Recibiendo")) log(line);
    lastLine = line;
  }, STATUS_MS);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});

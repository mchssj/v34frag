// Relay del HUD de observer (docs/bitacora/2026-10-22-hud-observer): recibe los paquetes UDP de csstv_hud,
// los retrasa igual que la SourceTV y se los pasa al HUD de OBS.

import { createSocket } from "node:dgram";
import { readSync } from "node:fs";
import { dirname, join } from "node:path";
import { isSea } from "node:sea";
import { configPath, loadConfig } from "./config.ts";
import { loadControl, mergeControl, saveControl } from "./control.ts";
import { DelayQueue } from "./delay.ts";
import { findKillfeedFont, loadFont } from "./font.ts";
import { parsePacket } from "./protocol.ts";
import { HttpServer } from "./server.ts";
import { GameModel } from "./state.ts";

const VERSION = "1.1.0";
const RELEASE_MS = 50;
const STATUS_MS = 10000;

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

async function main(): Promise<void> {
  console.log(`CMLeague HUD relay ${VERSION}\n`);
  const cfgPath = configPath(isSea());
  const loaded = loadConfig(cfgPath);
  if (!loaded.ok) fail(loaded.message);
  const config = loaded.config;

  const controlPath = join(dirname(cfgPath), "relay-control.json");
  let control = loadControl(controlPath);

  const fontPath = findKillfeedFont(config.gameDir);
  const font = loadFont(fontPath);

  const queue = new DelayQueue();
  const model = new GameModel();
  let tvDelay = 0;
  let received = 0;
  let receivedWindow = 0;
  let badKey = 0;
  let badFormat = 0;
  let lastPacketAt = 0;

  const delaySeconds = (): number => config.delay ?? tvDelay;

  const http: HttpServer = new HttpServer({
    initial: () => [
      { event: "state", data: model.snapshot() },
      { event: "control", data: control },
    ],
    onControl: (body) => {
      control = mergeControl(control, body);
      saveControl(controlPath, control);
      http.broadcast("control", control);
    },
    status: () => ({
      version: VERSION,
      received,
      lastPacketMsAgo: lastPacketAt ? Date.now() - lastPacketAt : null,
      delaySeconds: delaySeconds(),
      queued: queue.size,
      clients: http.clientCount,
      killfeedIcons: font !== null,
    }),
    font: () => font,
  });

  const udp = createSocket("udp4");
  udp.on("message", (msg) => {
    const now = Date.now();
    const result = parsePacket(msg.toString("utf8"), config.key);
    if (!result.ok) {
      if (result.reason === "key") badKey++;
      else badFormat++;
      return;
    }
    const packet = result.packet;
    if (packet.type === "F") tvDelay = packet.tvDelay;
    if (queue.push(packet, now, delaySeconds())) {
      received++;
      receivedWindow++;
      lastPacketAt = now;
    }
  });
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
    font
      ? `Íconos del feed: ${fontPath}`
      : `No se encontró la fuente de ClientMod (cstrike/resource/clientmodkillfeed.ttf): el feed muestra los nombres de las armas. Poné la carpeta de ClientMod en "gameDir" de relay.json.`,
  );
  log(config.delay === null ? "Retraso: el tv_delay del servidor." : `Retraso fijo: ${config.delay} s (relay.json).`);

  setInterval(() => {
    const out = queue.release(Date.now());
    if (out.length === 0) return;
    const now = Date.now();
    for (const p of out) model.apply(p, now);
    http.broadcast("state", model.snapshot());
  }, RELEASE_MS);

  let lastLine = "";
  setInterval(() => {
    let line: string;
    if (lastPacketAt === 0) line = "Todavía no llegó ningún paquete. ¿Está abierto playit y cargado el host en el servidor?";
    else if (Date.now() - lastPacketAt > 15000) line = `Sin paquetes hace ${Math.round((Date.now() - lastPacketAt) / 1000)} s (sin jugadores en el servidor o se cortó el túnel).`;
    else
      line = `Recibiendo: ${(receivedWindow / (STATUS_MS / 1000)).toFixed(1)} paquetes/s · retraso ${delaySeconds()} s · ${model.snapshot().players.length} jugadores · HUD abiertos: ${http.clientCount}`;
    if (badKey) line += ` · ${badKey} con clave incorrecta (revisá "key" en relay.json)`;
    if (badFormat) line += ` · ${badFormat} con formato inválido`;
    receivedWindow = 0;
    badKey = 0;
    badFormat = 0;
    if (line !== lastLine || line.startsWith("Recibiendo")) log(line);
    lastLine = line;
  }, STATUS_MS);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});

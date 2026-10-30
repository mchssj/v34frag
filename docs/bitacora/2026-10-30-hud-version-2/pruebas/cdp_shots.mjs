// Abre el HUD en Edge sin ventana y saca capturas a los segundos indicados: node cdp_shots.mjs <url> <carpeta> <seg,seg,...>
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [url, out, times] = process.argv.slice(2);
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=9333", "--window-size=1920,1080",
   `--user-data-dir=${mkdtempSync(join(tmpdir(), "edgecdp-"))}`, "about:blank"], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let list;
for (let i = 0; i < 40; i++) { try { list = await (await fetch("http://127.0.0.1:9333/json/list")).json(); if (list.length) break; } catch {} await wait(250); }
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 107, g: 90, b: 68, a: 1 } });
await send("Page.navigate", { url });
const start = Date.now();
for (const t of times.split(",").map(Number)) {
  await wait(Math.max(0, t * 1000 - (Date.now() - start)));
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(out, `hud_${t}s.png`), Buffer.from(data, "base64"));
  console.log("captura", t);
}
ws.close(); edge.kill();
process.exit(0);

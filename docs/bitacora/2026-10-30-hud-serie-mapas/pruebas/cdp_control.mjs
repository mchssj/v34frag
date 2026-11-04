// Prueba los clics de /control (pick, ganador, mapa escrito y BO5) en Edge sin ventana: node cdp_control.mjs (relay en el 8099).
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", ["--headless=new", "--remote-debugging-port=9334", `--user-data-dir=${mkdtempSync(join(tmpdir(), "edgecdp-"))}`, "about:blank"], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let list; for (let i = 0; i < 40; i++) { try { list = await (await fetch("http://127.0.0.1:9334/json/list")).json(); if (list.length) break; } catch {} await wait(250); }
const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true })).result.value;
await send("Page.navigate", { url: "http://localhost:8099/control" }); await wait(2000);
await ev(`(()=>{const s=document.querySelectorAll('#maps tr')[2].querySelectorAll('select')[1]; s.value='ct'; s.dispatchEvent(new Event('change'));})()`); await wait(500);
await ev(`(()=>{const i=document.querySelectorAll('#maps input')[0]; i.focus(); i.value='de_nuke_old_blue_ep'; i.dispatchEvent(new Event('input')); })()`); await wait(600);
await ev(`document.activeElement.blur()`); await wait(300);
await ev(`[...document.querySelectorAll('#bo button')].find(b=>b.textContent==='BO5').click()`); await wait(500);
console.log(await ev(`JSON.stringify([...document.querySelectorAll('#maps tr')].map(tr=>[tr.querySelector('input').value,...[...tr.querySelectorAll('select')].map(s=>s.value)]))`));
console.log(await ev(`document.getElementById('series-score').textContent`));
ws.close(); edge.kill(); process.exit(0);

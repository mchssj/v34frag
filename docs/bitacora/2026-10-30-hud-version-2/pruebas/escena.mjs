// Manda al relay local una escena fija: bomba plantada y clutch 1 vs 2. Uso: node escena.mjs <puerto> <clave>
import { createSocket } from "node:dgram";
const [port, key] = process.argv.slice(2);
const s = createSocket("udp4");
let seq = 100000;
const send = (t, b) => new Promise((r) => s.send(`CMH1|${key}|${++seq}|${t}|${b}`, Number(port), "127.0.0.1", r));
const P = [
  // uid,team,alive,hp,armor,helmet,defuser,money,prim,sec,act,he,flash,smoke,bomb,kills,deaths,damage
  "2,3,0,0,0,0,0,2100,,,,0,0,0,0,1,6,42",
  "3,3,1,31,22,1,1,5900,m4a1,usp,hegrenade,1,0,0,0,9,4,246",
  "4,3,0,0,0,0,0,800,,,,0,0,0,0,3,7,27",
  "5,3,0,0,0,0,0,1400,,,,0,0,0,0,4,6,100",
  "6,3,0,0,0,0,0,300,,,,0,0,0,0,2,8,0",
  "7,2,1,100,100,1,0,1650,ak47,glock,ak47,1,2,1,0,8,3,100",
  "8,2,1,64,100,0,0,300,awp,glock,awp,0,1,0,0,5,4,100",
  "9,2,0,0,0,0,0,2400,,,,0,0,0,0,2,6,0",
  "10,2,0,0,0,0,0,3150,,,,0,0,0,0,1,7,12",
  "11,2,0,0,0,0,0,450,,,,0,0,0,0,0,8,0",
].join(";");
await send("N", "2,STEAM_0:1:1,lucas;3,STEAM_0:1:2,tomás;4,STEAM_0:1:3,nico;5,STEAM_0:1:4,juanchi;6,STEAM_0:1:5,maxi;7,STEAM_0:1:6,brunoo;8,STEAM_0:1:7,el_ruso;9,STEAM_0:1:8,fede;10,STEAM_0:1:9,santi;11,STEAM_0:1:10,mateo");
await send("F", `0|de_inferno|22|11|10|planted|31|${P}`);
await send("E", "bomb|plant|8");
s.close();

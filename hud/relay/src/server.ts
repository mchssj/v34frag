// HTTP solo en 127.0.0.1: /hud para OBS, /control para el streamer y /events (Server-Sent Events) para
// mandarles el estado retrasado. Nadie de la red del streamer puede entrar.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readAsset, ASSETS, type AssetName } from "./assets.ts";
import { FONTS, type FontName } from "./font.ts";

export interface HttpHandlers {
  initial(): { event: string; data: unknown }[];
  onControl(body: unknown): void;
  status(): unknown;
  /** Una fuente de los íconos, o null si no se encontró. */
  font(name: FontName): Buffer | null;
}

const PAGES: Record<string, AssetName> = { "/": "hud.html", "/hud": "hud.html", "/control": "control.html" };
const MAX_BODY = 4096;

export class HttpServer {
  private clients = new Set<ServerResponse>();
  private server: Server;
  private handlers: HttpHandlers;

  constructor(handlers: HttpHandlers) {
    this.handlers = handlers;
    this.server = createServer((req, res) => this.route(req, res));
    setInterval(() => {
      for (const c of this.clients) c.write(": ping\n\n");
    }, 15000).unref();
  }

  listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(port, "127.0.0.1", () => resolve());
    });
  }

  close(): void {
    for (const c of this.clients) c.end();
    this.server.close();
  }

  get clientCount(): number {
    return this.clients.size;
  }

  broadcast(event: string, data: unknown): void {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients) c.write(msg);
  }

  private route(req: IncomingMessage, res: ServerResponse): void {
    const path = (req.url ?? "/").split("?")[0] ?? "/";

    if (req.method === "GET" && path === "/events") return this.events(res);
    if (req.method === "GET" && path === "/api/status") return json(res, 200, this.handlers.status());
    if (req.method === "POST" && path === "/api/control") return this.control(req, res);
    const fontName = /^\/font\/(\w+)\.ttf$/.exec(path)?.[1];
    if (req.method === "GET" && fontName && Object.hasOwn(FONTS, fontName)) {
      const font = this.handlers.font(fontName as FontName);
      if (!font) return json(res, 404, { error: "no se encontró la fuente" });
      res.writeHead(200, { "content-type": "font/ttf", "cache-control": "no-store" });
      res.end(font);
      return;
    }

    const page = PAGES[path] ?? (ASSETS as readonly string[]).find((a) => path === `/${a}`);
    if (req.method === "GET" && page) {
      const { body, type } = readAsset(page as AssetName);
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(body);
      return;
    }
    json(res, 404, { error: "no existe" });
  }

  private events(res: ServerResponse): void {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    for (const { event, data } of this.handlers.initial()) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    this.clients.add(res);
    res.on("close", () => this.clients.delete(res));
  }

  private control(req: IncomingMessage, res: ServerResponse): void {
    // Exigir JSON obliga a un navegador a pedir permiso (CORS) antes de mandarlo desde otra página,
    // y el relay nunca lo da: solo /control, servida por el propio relay, puede cambiar el HUD.
    if (!(req.headers["content-type"] ?? "").startsWith("application/json")) return json(res, 415, { error: "se espera JSON" });
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BODY) req.destroy();
    });
    req.on("end", () => {
      try {
        this.handlers.onControl(JSON.parse(body));
        json(res, 200, { ok: true });
      } catch {
        json(res, 400, { error: "JSON inválido" });
      }
    });
  }
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}

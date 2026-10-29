// HTTP solo en 127.0.0.1: /hud para OBS, /control para el streamer y /events (Server-Sent Events) para mandarles el
// estado retrasado. En la PC del streamer nadie de su red puede entrar; en el VPS lo publica Caddy en
// hud.cmleague.lat y todo va debajo de /s/<token>/ (el link de cada streamer).
// Las páginas piden todo con rutas relativas, así sirven igual en / y en /s/<token>/.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readAsset, ASSETS, type AssetName } from "./assets.ts";
import { FONTS, type FontName } from "./font.ts";

export type Page = "hud" | "control";

export interface Client {
  viewer: string;
  page: Page;
  res: ServerResponse;
}

export interface HttpHandlers {
  /**
   * Quién pide: con token (rutas /s/<token>/…) o sin él. Devuelve el id del espectador, o null para responder 404
   * (un token desconocido no se distingue de una ruta que no existe).
   */
  viewer(token: string | null): string | null;
  initial(viewer: string): { event: string; data: unknown }[];
  /** /healthz, sin token: para el chequeo del despliegue. Nada que identifique a nadie. */
  health(): unknown;
  onControl(viewer: string, body: unknown): void;
  status(viewer: string): unknown;
  /** Una fuente de los íconos, o null si no se encontró. */
  font(name: FontName): Buffer | null;
}

const PAGES: Record<string, AssetName> = { "/": "hud.html", "/hud": "hud.html", "/control": "control.html" };
const MAX_BODY = 4096;

export class HttpServer {
  private readonly clients = new Set<Client>();
  private readonly server: Server;
  private readonly handlers: HttpHandlers;

  constructor(handlers: HttpHandlers) {
    this.handlers = handlers;
    this.server = createServer((req, res) => this.route(req, res));
    setInterval(() => {
      for (const c of this.clients) c.res.write(": ping\n\n");
    }, 15000).unref();
  }

  listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(port, "127.0.0.1", () => resolve());
    });
  }

  get address(): number {
    const a = this.server.address();
    return typeof a === "object" && a ? a.port : 0;
  }

  close(): void {
    for (const c of this.clients) c.res.end();
    this.server.close();
  }

  get clientCount(): number {
    return this.clients.size;
  }

  /** Las conexiones abiertas (para saber quién tiene el HUD abierto). */
  connections(): readonly Client[] {
    return [...this.clients];
  }

  /** Manda un evento a las conexiones que cumplan el filtro (todas si no hay filtro). */
  broadcast(event: string, data: unknown, to: (c: Client) => boolean = () => true): void {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients) if (to(c)) c.res.write(msg);
  }

  /** Corta las conexiones de un espectador (por ejemplo, un streamer al que le quitaron la marca). */
  disconnect(viewer: string): void {
    for (const c of this.clients) if (c.viewer === viewer) c.res.end();
  }

  private route(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? "/", "http://relay");
    if (req.method === "GET" && url.pathname === "/healthz") return json(res, 200, this.handlers.health());
    const m = /^\/s\/([^/]+)(\/.*)?$/.exec(url.pathname);
    // /s/<token> sin barra: las rutas relativas de la página saldrían de /s/. Se manda a /s/<token>/hud.
    if (m && m[2] === undefined) {
      res.writeHead(302, { location: `/s/${m[1]}/hud`, "cache-control": "no-store" });
      res.end();
      return;
    }
    const viewer = this.handlers.viewer(m ? decodeURIComponent(m[1]!) : null);
    if (viewer === null) return json(res, 404, { error: "no existe" });
    const path = m ? m[2]! : url.pathname;

    if (req.method === "GET" && path === "/events") return this.events(res, viewer, url.searchParams.get("page") === "control" ? "control" : "hud");
    if (req.method === "GET" && path === "/api/status") return json(res, 200, this.handlers.status(viewer));
    if (req.method === "POST" && path === "/api/control") return this.control(req, res, viewer);
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
      // El token va en la ruta: que no salga en el Referer de las fuentes de Google ni de nada externo.
      res.writeHead(200, { "content-type": type, "cache-control": "no-store", "referrer-policy": "no-referrer" });
      res.end(body);
      return;
    }
    json(res, 404, { error: "no existe" });
  }

  private events(res: ServerResponse, viewer: string, page: Page): void {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    for (const { event, data } of this.handlers.initial(viewer)) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const client: Client = { viewer, page, res };
    this.clients.add(client);
    res.on("close", () => this.clients.delete(client));
  }

  private control(req: IncomingMessage, res: ServerResponse, viewer: string): void {
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
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return json(res, 400, { error: "JSON inválido" });
      }
      this.handlers.onControl(viewer, parsed);
      json(res, 200, { ok: true });
    });
  }
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}

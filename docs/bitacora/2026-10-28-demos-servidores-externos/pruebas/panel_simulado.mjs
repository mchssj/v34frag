// Panel Pterodactyl simulado para probar el Worker de demos con `wrangler dev` (local), sin tocar ningún panel real.
// Uso: node panel_simulado.mjs [puerto]   (por defecto 8790)
//
// Servidores:
//   aaaa1111  key "key-nuestra" (la de nuestra cuenta): tiene ext-uid-0001.dem (1000 bytes)
//   cccc3333  key "key-rbk" (PTERO_KEY_cccc3333): cualquier key => 403, simula una key revocada
//   eeee5555  otra cuenta: con "key-nuestra" responde 404, como un servidor que nuestra key no ve
// Anota cada pedido en la consola (método, ruta y la key que llegó), para ver qué key se mandó a cada panel.
import http from 'node:http';

const port = Number(process.argv[2]) || 8790;
const files = { aaaa1111: { 'ext-uid-0001.dem': Buffer.alloc(1000, 7) } };
const keys = { aaaa1111: 'key-nuestra' };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const auth = (req.headers.authorization || '').replace(/^Bearer /, '');
  console.log(`${req.method} ${url.pathname}${url.search} key=${auth || '-'}`);
  const send = (code, body, type = 'application/json') => {
    res.writeHead(code, { 'Content-Type': type, ...(Buffer.isBuffer(body) ? { 'Content-Length': body.length } : {}) });
    res.end(Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };

  const dl = url.pathname.match(/^\/dl\/(\w+)\/(.+)$/);
  if (dl) return send(200, files[dl[1]][dl[2]], 'application/octet-stream');

  const m = url.pathname.match(/^\/api\/client\/servers\/(\w+)(\/.*)$/);
  if (!m) return send(404, { errors: [] });
  const [, server, path] = m;
  if (server === 'cccc3333') return send(403, { errors: [{ code: 'AccessDeniedHttpException' }] });
  if (keys[server] !== auth) return send(404, { errors: [{ code: 'NotFoundHttpException' }] });

  const own = files[server];
  if (path === '/files/list') {
    return send(200, { data: Object.entries(own).map(([name, b]) => ({ attributes: { name, size: b.length, is_file: true } })) });
  }
  if (path === '/files/download') {
    const name = url.searchParams.get('file').split('/').pop();
    return send(200, { attributes: { url: `http://127.0.0.1:${port}/dl/${server}/${name}` } });
  }
  if (path === '/files/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      for (const f of JSON.parse(body).files) delete own[f];
      send(204, '');
    });
    return;
  }
  send(404, { errors: [] });
}).listen(port, '127.0.0.1', () => console.log(`panel simulado en http://127.0.0.1:${port}`));

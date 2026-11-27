"""Base falsa para probar !banlist en el servidor local: responde las funciones del reporter en 127.0.0.1:54321.
Uso: base_falsa.py <archivo con el texto de csstv_ban_list>"""
import sys, json
from http.server import BaseHTTPRequestHandler, HTTPServer
LISTA = open(sys.argv[1], encoding='utf-8').read().strip()
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length', 0)))
        fn = self.path.rsplit('/', 1)[-1]
        body = {'csstv_ban_list': LISTA, 'csstv_bans_compact': '', 'csstv_ban_ips_compact': '',
                'csstv_ban_check_ip': {'ok': True, 'banned': False}}.get(fn, {'ok': True})
        b = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
HTTPServer(('127.0.0.1', 54321), H).serve_forever()

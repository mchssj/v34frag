"""Login inicial de Google Drive para la máquina de render (se corre una sola vez).

Uso:  python drive_login.py [ruta/al/.env]

Necesita en el .env GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (el cliente OAuth "de escritorio" del proyecto de
Google Cloud; los pasos están en la guía de implementación). Abre el navegador, se acepta el permiso drive.file con
la cuenta de Daniel y el token de renovación queda en el .env como GOOGLE_REFRESH_TOKEN, sin imprimirlo.

Para que el token no venza a los 7 días, la app tiene que estar "En producción" en la pantalla de consentimiento
(drive.file no es un permiso sensible: no hace falta la verificación de Google).
"""
import base64
import hashlib
import http.server
import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

DEFAULT_ENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
SCOPE = "https://www.googleapis.com/auth/drive.file"


def read_env(path):
    vals = {}
    for line in open(path, encoding="utf-8"):
        s = line.strip()
        if s and not s.startswith("#") and "=" in s:
            k, v = s.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


def write_env_var(path, key, value):
    """Agrega o reemplaza KEY=valor en el .env, sin tocar el resto."""
    lines = open(path, encoding="utf-8").read().splitlines()
    out, done = [], False
    for line in lines:
        if line.split("=", 1)[0].strip() == key:
            out.append(f"{key}={value}")
            done = True
        else:
            out.append(line)
    if not done:
        out.append(f"{key}={value}")
    open(path, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")


def main():
    env_path = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ENV)
    env = read_env(env_path)
    client_id, client_secret = env.get("GOOGLE_CLIENT_ID"), env.get("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise SystemExit(f"faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en {env_path}")

    # Flujo para apps de escritorio: redirección a 127.0.0.1 con PKCE.
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if q.get("state", [None])[0] == state:
                result.update({k: v[0] for k, v in q.items()})
            ok = "code" in result
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            msg = "Listo: ya puedes cerrar esta pestaña." if ok else f"No se pudo: {result.get('error', 'sin respuesta')}"
            self.wfile.write(f"<p style='font-family:sans-serif'>{msg}</p>".encode())

        def log_message(self, *a):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    redirect = f"http://127.0.0.1:{server.server_port}"
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": client_id, "redirect_uri": redirect, "response_type": "code", "scope": SCOPE,
        "access_type": "offline", "prompt": "consent", "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256"})
    print("Abriendo el navegador para aceptar el permiso de Drive (solo los archivos que crea esta app).")
    print("Si no se abre, copia esta dirección en el navegador:\n" + url)
    webbrowser.open(url)
    while "code" not in result and "error" not in result:
        server.handle_request()
    if "error" in result:
        raise SystemExit(f"Google respondió: {result['error']}")

    body = urllib.parse.urlencode({"client_id": client_id, "client_secret": client_secret, "code": result["code"],
                                   "code_verifier": verifier, "grant_type": "authorization_code",
                                   "redirect_uri": redirect}).encode()
    try:
        with urllib.request.urlopen("https://oauth2.googleapis.com/token", data=body, timeout=30) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"no se pudo cambiar el código por el token ({e.code}): {e.read()[:300]!r}") from None
    if "refresh_token" not in data:
        raise SystemExit("Google no devolvió un token de renovación: quita el acceso de la app en tu cuenta de Google "
                         "y vuelve a correr este script")
    write_env_var(env_path, "GOOGLE_REFRESH_TOKEN", data["refresh_token"])
    print(f"Listo: GOOGLE_REFRESH_TOKEN quedó en {env_path}. Prueba con: python drive.py prueba")


if __name__ == "__main__":
    main()

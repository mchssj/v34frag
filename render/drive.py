"""Cliente mínimo de Google Drive (API v3) para los videos de los clips. Solo biblioteca estándar.

Usa el permiso drive.file: solo ve y toca los archivos que creó esta app, no el resto del Drive. Los videos van a
"CMLeague clips/<AAAA-MM-DD>" y quedan con el permiso "cualquiera con el enlace puede ver", para el reproductor
embebido (https://drive.google.com/file/d/<id>/preview).

Credenciales: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN, de las variables de entorno o de un
.env (por defecto, el de la raíz del repo). El token de renovación lo deja drive_login.py. Nunca se imprimen.

Uso de prueba:  python drive.py prueba [ruta/al/.env]   sube un archivo chico, lo comparte, lo lee y lo borra
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

KEYS = ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN")
DEFAULT_ENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
ROOT_FOLDER = "CMLeague clips"
FOLDER_MIME = "application/vnd.google-apps.folder"
API = "https://www.googleapis.com/drive/v3"
UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"


def load_env(path=DEFAULT_ENV):
    vals = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip().strip('"').strip("'")
    out = {k: os.environ.get(k) or vals.get(k) for k in KEYS}
    missing = [k for k in KEYS if not out[k]]
    if missing:
        raise SystemExit(f"faltan en el .env: {', '.join(missing)} (correr drive_login.py)")
    return out


class DriveError(Exception):
    pass


class Drive:
    def __init__(self, env):
        self.client_id = env["GOOGLE_CLIENT_ID"]
        self.client_secret = env["GOOGLE_CLIENT_SECRET"]
        self.refresh_token = env["GOOGLE_REFRESH_TOKEN"]
        self._token, self._expires = None, 0
        self._folders = {}

    # ---- acceso ----

    def token(self):
        if self._token and time.time() < self._expires - 60:
            return self._token
        body = urllib.parse.urlencode({"client_id": self.client_id, "client_secret": self.client_secret,
                                       "refresh_token": self.refresh_token, "grant_type": "refresh_token"}).encode()
        try:
            with urllib.request.urlopen("https://oauth2.googleapis.com/token", data=body, timeout=30) as r:
                data = json.loads(r.read())
        except urllib.error.HTTPError as e:
            # invalid_grant: el token venció o se revocó (con la app en "Prueba", Google lo vence a los 7 días).
            raise DriveError(f"no se pudo renovar el acceso a Drive ({e.code}): {e.read()[:200]!r}") from None
        self._token, self._expires = data["access_token"], time.time() + int(data.get("expires_in", 3600))
        return self._token

    def _request(self, method, url, body=None, headers=None, ok=(200,)):
        h = {"Authorization": f"Bearer {self.token()}", **(headers or {})}
        req = urllib.request.Request(url, data=body, method=method, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.status, r.read(), r.headers
        except urllib.error.HTTPError as e:
            if e.code in ok:
                return e.code, e.read(), e.headers
            raise DriveError(f"{method} {url.split('?')[0]}: {e.code} {e.read()[:300]!r}") from None

    def _json(self, method, url, data=None, ok=(200,)):
        body = json.dumps(data).encode() if data is not None else None
        st, raw, _ = self._request(method, url, body, {"Content-Type": "application/json"} if body else None, ok)
        return st, (json.loads(raw) if raw else None)

    # ---- carpetas ----

    def folder(self, name, parent=None):
        """El id de la carpeta (la crea si no existe). Solo ve las que creó esta app."""
        key = (name, parent)
        if key in self._folders:
            return self._folders[key]
        q = f"name = '{name}' and mimeType = '{FOLDER_MIME}' and trashed = false"
        if parent:
            q += f" and '{parent}' in parents"
        _, res = self._json("GET", f"{API}/files?" + urllib.parse.urlencode({"q": q, "fields": "files(id)", "spaces": "drive"}))
        if res["files"]:
            fid = res["files"][0]["id"]
        else:
            meta = {"name": name, "mimeType": FOLDER_MIME, **({"parents": [parent]} if parent else {})}
            _, res = self._json("POST", f"{API}/files?fields=id", meta)
            fid = res["id"]
        self._folders[key] = fid
        return fid

    # ---- archivos ----

    def upload(self, path, name, subfolder):
        """Sube el archivo a "CMLeague clips/<subfolder>" (subida reanudable), lo comparte con "cualquiera con el
        enlace" y devuelve su id."""
        parent = self.folder(subfolder, self.folder(ROOT_FOLDER))
        size = os.path.getsize(path)
        meta = json.dumps({"name": name, "parents": [parent]}).encode()
        _, _, h = self._request("POST", f"{UPLOAD}?uploadType=resumable", meta, {
            "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/mp4",
            "X-Upload-Content-Length": str(size)})
        session = h["Location"]
        with open(path, "rb") as f:
            data = f.read()
        _, raw, _ = self._request("PUT", session, data, {"Content-Type": "video/mp4", "Content-Length": str(size)},
                                  ok=(200, 201))
        fid = json.loads(raw)["id"]
        self._json("POST", f"{API}/files/{fid}/permissions", {"role": "reader", "type": "anyone"})
        _, info = self._json("GET", f"{API}/files/{fid}?fields=size")
        if int(info.get("size", -1)) != size:
            self.delete(fid)
            raise DriveError(f"Drive guardó {info.get('size')} bytes de {size}")
        return fid

    def delete(self, file_id):
        """Borra el archivo (si ya no estaba, no es error)."""
        st, _, _ = self._request("DELETE", f"{API}/files/{file_id}", ok=(200, 204, 404))
        return st


def prueba(env_path):
    import tempfile
    d = Drive(load_env(env_path))
    with tempfile.NamedTemporaryFile("wb", suffix=".mp4", delete=False) as f:
        f.write(b"prueba de Drive " * 1000)
        path = f.name
    try:
        fid = d.upload(path, "prueba.mp4", "_prueba")
        print("subida y compartida:", fid)
        _, info = d._json("GET", f"{API}/files/{fid}?fields=name,size,parents,permissions(type,role)")
        print("metadatos:", info.get("name"), info.get("size"), "bytes, permisos:", info.get("permissions"))
        req = urllib.request.Request(f"https://drive.google.com/file/d/{fid}/preview", method="GET")
        with urllib.request.urlopen(req, timeout=30) as r:
            print("reproductor embebido:", r.status)
        print("borrado:", d.delete(fid), "| otra vez:", d.delete(fid), "(404 = ya no está)")
        d.delete(d.folder("_prueba", d.folder(ROOT_FOLDER)))
    finally:
        os.remove(path)


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "prueba":
        prueba(sys.argv[2] if len(sys.argv) > 2 else DEFAULT_ENV)
    else:
        print(__doc__)

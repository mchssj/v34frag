"""Cliente mínimo de R2 (API compatible con S3, firma v4) para el bucket de clips. Solo biblioteca estándar.

Credenciales: CF_ACCOUNT_ID_CLIPS, CF_R2_BUCKET_CLIPS, CF_R2_ACCESS_KEY_ID_CLIPS y CF_R2_SECRET_ACCESS_CLIPS, de las variables de
entorno o de un .env (por defecto, el de la raíz del repo). Nunca se imprimen.

Uso de prueba:  python r2.py prueba [ruta/al/.env]   sube, verifica con HEAD, lee y borra un objeto de prueba
"""
import datetime
import hashlib
import hmac
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

KEYS = ("CF_ACCOUNT_ID_CLIPS", "CF_R2_BUCKET_CLIPS", "CF_R2_ACCESS_KEY_ID_CLIPS", "CF_R2_SECRET_ACCESS_CLIPS")
DEFAULT_ENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")


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
        raise SystemExit(f"faltan en el .env: {', '.join(missing)}")
    return out


class R2:
    def __init__(self, env):
        self.host = f"{env['CF_ACCOUNT_ID_CLIPS']}.r2.cloudflarestorage.com"
        self.bucket = env["CF_R2_BUCKET_CLIPS"]
        self.key_id = env["CF_R2_ACCESS_KEY_ID_CLIPS"]
        self.secret = env["CF_R2_SECRET_ACCESS_CLIPS"]

    def _request(self, method, key, body=b"", content_type=None):
        now = datetime.datetime.now(datetime.timezone.utc)
        amz_date, day = now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d")
        path = "/" + urllib.parse.quote(f"{self.bucket}/{key}", safe="/-_.~")
        payload_hash = hashlib.sha256(body).hexdigest()
        headers = {"host": self.host, "x-amz-content-sha256": payload_hash, "x-amz-date": amz_date}
        if content_type:
            headers["content-type"] = content_type
        signed = ";".join(sorted(headers))
        canonical = "\n".join([method, path, "", "".join(f"{k}:{headers[k]}\n" for k in sorted(headers)), signed,
                               payload_hash])
        scope = f"{day}/auto/s3/aws4_request"
        to_sign = "\n".join(["AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical.encode()).hexdigest()])
        k = ("AWS4" + self.secret).encode()
        for part in (day, "auto", "s3", "aws4_request"):
            k = hmac.new(k, part.encode(), hashlib.sha256).digest()
        sig = hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()
        headers["authorization"] = (f"AWS4-HMAC-SHA256 Credential={self.key_id}/{scope}, "
                                    f"SignedHeaders={signed}, Signature={sig}")
        req = urllib.request.Request(f"https://{self.host}{path}", data=body if method == "PUT" else None,
                                     method=method, headers={k: v for k, v in headers.items() if k != "host"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.status, r.read(), r.headers
        except urllib.error.HTTPError as e:
            return e.code, e.read(), e.headers

    def put(self, key, data, content_type="application/octet-stream"):
        return self._request("PUT", key, data, content_type)[:2]

    def get(self, key):
        return self._request("GET", key)[:2]

    def head(self, key):
        """(estado, tamaño en bytes o None)."""
        st, _, h = self._request("HEAD", key)
        size = h.get("Content-Length") if st == 200 else None
        return st, int(size) if size is not None else None

    def delete(self, key):
        return self._request("DELETE", key)[:2]


def prueba(env_path):
    r2 = R2(load_env(env_path))
    key = "_prueba/conexion.txt"
    data = f"prueba de conexión {datetime.datetime.now().isoformat()}".encode()
    st, body = r2.put(key, data, "text/plain; charset=utf-8")
    print("subida:", st, "" if st == 200 else body[:300].decode("utf-8", "replace"))
    if st != 200:
        sys.exit(1)
    print("HEAD:", *r2.head(key), "(tamaño esperado:", len(data), ")")
    st, body = r2.get(key)
    print("lectura:", st, "contenido igual:", body == data)
    st, _ = r2.delete(key)
    print("borrado:", st)
    st, _ = r2.get(key)
    print("después de borrar:", st, "(404 = ya no está)")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "prueba":
        prueba(sys.argv[2] if len(sys.argv) > 2 else DEFAULT_ENV)
    else:
        print(__doc__)

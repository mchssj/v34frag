# Sube el reporter 2.10.1 (cuchillo por vida y nombre de la web, armado sobre la 2.10.0 de main) a #1, #2 y #3 por la
# API del panel de MVZG. Por cada uno: baja el que hay y comprueba que es la 2.10.0, lo deja como
# disabled/csstv_reporter_2.10.0.smx, sube el nuevo y lo vuelve a bajar para compararlo byte a byte. No recarga nada:
# entra en el próximo cambio de mapa. Uso: python subir_2_10_1.py [--hacer]
import hashlib, json, os, struct, sys, urllib.parse, urllib.request, uuid, zlib

R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')).replace(os.sep, '/') + '/'
LOCAL = os.path.join(os.path.dirname(__file__), '..', 'build_2.10.1', 'csstv_reporter.smx')
env = {}
for line in open(R + '.env', encoding='utf-8'):
    if '=' in line and not line.lstrip().startswith('#'):
        k, v = line.rstrip('\r\n').split('=', 1)
        env[k.strip()] = v.strip().strip('"')

P = '/cstrike/addons/sourcemod/plugins/'
K = env['SFTP_CSS_API_KEY']
SERVERS = [
    # nombre, panel, id, key, dónde está el reporter, archivo local
    ('#1', 'https://panel-mvzg.com', '157703b5', K, P + 'csstv_reporter.smx', LOCAL),
    ('#2', 'https://panel-mvzg.com', 'cd1be322', K, P + 'csstv_reporter.smx', LOCAL),
    ('#3', 'https://panel-mvzg.com', '16c850ff', K, P + 'csstv_reporter.smx', LOCAL),
]
HACER = '--hacer' in sys.argv


def api(s, method, path, body=None, raw=False):
    _, panel, sid, key, _, _ = s
    req = urllib.request.Request(f'{panel}/api/client/servers/{sid}/{path}', method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={'Authorization': 'Bearer ' + key, 'Accept': 'application/json',
                                          'Content-Type': 'application/json', 'User-Agent': 'cmleague-deploy'})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = r.read()
        return d if raw else (json.loads(d) if d else None)


def bajar(s, f):
    url = api(s, 'GET', 'files/download?file=' + urllib.parse.quote(f))['attributes']['url']
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'cmleague-deploy'}), timeout=120) as r:
        return r.read()


def version(b):
    off = struct.unpack('<IHBIIBII', b[:24])[7]
    d = b[:off] + zlib.decompress(b[off:])
    for v in (b'2.10.1', b'2.10.0', b'2.9.3'):
        if v in d:
            return v.decode()
    return '?'


def existe(s, f):
    d, n = f.rsplit('/', 1)
    names = [x['attributes']['name'] for x in api(s, 'GET', 'files/list?directory=' + urllib.parse.quote(d))['data']]
    return n in names


def subir(s, f, data):
    d, n = f.rsplit('/', 1)
    url = api(s, 'GET', 'files/upload')['attributes']['url'] + '&directory=' + urllib.parse.quote(d)
    b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="files"; filename="{n}"\r\n'
            'Content-Type: application/octet-stream\r\n\r\n').encode() + data + f'\r\n--{b}--\r\n'.encode()
    req = urllib.request.Request(url, data=body, method='POST',
                                 headers={'Content-Type': 'multipart/form-data; boundary=' + b, 'User-Agent': 'cmleague-deploy'})
    urllib.request.urlopen(req, timeout=120).read()


for s in SERVERS:
    name, _, _, _, f, local = s
    nuevo = open(local, 'rb').read()
    actual = bajar(s, f)
    d = f.rsplit('/', 1)[0]
    resp = P + 'disabled/csstv_reporter_2.10.0.smx'
    print(f'{name}: hay {version(actual)} ({len(actual)} bytes) en {f}; nuevo {version(nuevo)} ({len(nuevo)} bytes)')
    if version(actual) != '2.10.0':
        print('  no es la 2.10.0: no se toca')
        continue
    if not HACER:
        continue
    if existe(s, resp):
        print('  ya hay un respaldo 2.10.0: no se pisa')
    else:
        # Copia del que hay como respaldo (subida del mismo contenido, así el original queda intacto hasta el reemplazo).
        subir(s, resp, actual)
        assert bajar(s, resp) == actual, 'el respaldo no coincide'
        print('  respaldo:', resp)
    subir(s, f, nuevo)
    vuelta = bajar(s, f)
    ok = hashlib.sha256(vuelta).hexdigest() == hashlib.sha256(nuevo).hexdigest()
    print(f'  subido {f}: {"igual byte a byte" if ok else "NO COINCIDE"} ({version(vuelta)})')

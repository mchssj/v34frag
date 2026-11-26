"""Sube el reporter 2.10.3 y csstv_qol 1.6.0 (y las dos líneas de cfg) a #1, #2 y #3 por la API del panel. No recarga nada.
Uso: desplegar.py <.env> <carpeta para respaldos> [--hacer]      (sin --hacer solo revisa)"""
import sys, re, json, time, hashlib, os, urllib.request, urllib.parse, urllib.error
ENV, BK = sys.argv[1:3]; HACER = '--hacer' in sys.argv
K = next(l.split('=', 1)[1].strip().strip('"\'') for l in open(ENV, encoding='utf-8', errors='replace') if l.startswith('SFTP_CSS_API_KEY='))
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(AQUI + '/../../../..')
H = {'Authorization': 'Bearer ' + K, 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'}
md = lambda b: hashlib.md5(b).hexdigest()
def abrir(r):
    for i in range(6):
        try: return urllib.request.urlopen(r, timeout=60)
        except urllib.error.HTTPError: raise
        except OSError:
            if i == 5: raise
            time.sleep(8)
def api(p): return abrir(urllib.request.Request('https://panel-mvzg.com/api/client/servers/' + p, headers=H)).read()
def baja(s, f):
    u = json.loads(api(f'{s}/files/download?file=' + urllib.parse.quote(f)))['attributes']['url']
    return abrir(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})).read()
def sube(s, f, b):
    abrir(urllib.request.Request(f'https://panel-mvzg.com/api/client/servers/{s}/files/write?file=' + urllib.parse.quote(f), data=b, method='POST', headers={**H, 'Content-Type': 'text/plain'}))
    assert baja(s, f) == b, (s, f, 'no quedó igual')
P = '/cstrike/addons/sourcemod/plugins/'; C = '/cstrike/cfg/sourcemod/'
PLUG = [('csstv_reporter.smx', 'c3862c08307a4e775a3e73a0f1022a7f', 'csstv_reporter_2.10.2.smx'), ('csstv_qol.smx', 'a2a8f43eae6b4f53e00ea103c299bb37', 'csstv_qol_1.5.0.smx')]
def cfg_qol(b):
    n, c = re.subn(rb'// Durante la partida no se puede cambiar el nombre\.\r?\ncsstv_qol_lock_names "1"\r?\n\r?\n', b'', b); assert c == 1, 'csstv_qol.cfg'; return n
def cfg_rep(b):
    assert b'csstv_lock_names' not in b and b'csstv_web_names' not in b
    nl = b'\r\n' if b'\r\n' in b else b'\n'
    L = 'csstv_web_names "1"           // a quien tiene ficha se le pone el nombre de la web; un VIP usa el que quiera\ncsstv_lock_names "1"          // con la partida empezada, quien no tiene ficha no se cambia el nombre (antes csstv_qol_lock_names)\n'.encode().replace(b'\n', nl)
    n, c = re.subn(rb'(?m)^(csstv_claim "1"[^\n]*\n)', lambda m: m[1] + L, b); assert c == 1, 'csstv_reporter.cfg'; return n
SRV = [('#1', '157703b5'), ('#2', 'cd1be322'), ('#3', '16c850ff')]
for n, s in SRV:          # primero se revisan los tres: o van todos, o ninguno
    for f, m, _ in PLUG: assert md(baja(s, P + f)) == m, (n, f, 'no es la versión esperada')
    cfg_qol(baja(s, C + 'csstv_qol.cfg')); cfg_rep(baja(s, C + 'csstv_reporter.cfg'))
    print(n, 'listo para subir', json.loads(api(s + '/resources'))['attributes']['current_state'])
if HACER:
    os.makedirs(BK, exist_ok=True)
    for n, s in SRV:
        for f, m, r in PLUG: sube(s, P + 'disabled/' + r, baja(s, P + f))
        for f in ('csstv_qol.cfg', 'csstv_reporter.cfg'): open(f'{BK}/{s}_{f}', 'wb').write(baja(s, C + f))
        for f, _, _ in PLUG: sube(s, P + f, open(f'{RAIZ}/server/addons/sourcemod/plugins/{f}', 'rb').read())
        sube(s, C + 'csstv_qol.cfg', cfg_qol(baja(s, C + 'csstv_qol.cfg'))); sube(s, C + 'csstv_reporter.cfg', cfg_rep(baja(s, C + 'csstv_reporter.cfg')))
        print(n, 'subido y comparado')
    for n, s in SRV: print(n, *[md(baja(s, P + f)) for f, _, _ in PLUG], *[md(baja(s, P + 'disabled/' + r)) for _, _, r in PLUG], json.loads(api(s + '/resources'))['attributes']['current_state'])

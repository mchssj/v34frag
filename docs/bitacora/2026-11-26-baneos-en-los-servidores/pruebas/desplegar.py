"""Sube el reporter 2.12.0 (baneos) a #1, #2 y #3 por la API del panel, con la 2.10.3 en plugins/disabled/. No recarga
nada: entra en el próximo cambio de mapa. Uso: desplegar.py <.env> [--hacer]      (sin --hacer solo revisa)"""
import sys, json, time, hashlib, os, urllib.request, urllib.parse, urllib.error
ENV = sys.argv[1]; HACER = '--hacer' in sys.argv
K = next(l.split('=', 1)[1].strip().strip('"\'') for l in open(ENV, encoding='utf-8', errors='replace') if l.startswith('SFTP_CSS_API_KEY='))
RAIZ = os.path.abspath(os.path.dirname(os.path.abspath(__file__)) + '/../../../..')
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
P = '/cstrike/addons/sourcemod/plugins/'
VIEJO = 'd7c3a9297e9d14559bedea9f8d09ebd4'   # 2.10.3
NUEVO = open(f'{RAIZ}/server/addons/sourcemod/plugins/csstv_reporter.smx', 'rb').read()
SRV = [('#1', '157703b5'), ('#2', 'cd1be322'), ('#3', '16c850ff')]
for n, s in SRV:          # primero se revisan los tres: o van todos, o ninguno
    assert md(baja(s, P + 'csstv_reporter.smx')) == VIEJO, (n, 'no es la 2.10.3')
    print(n, 'listo para subir')
if HACER:
    for n, s in SRV:
        sube(s, P + 'disabled/csstv_reporter_2.10.3.smx', baja(s, P + 'csstv_reporter.smx'))
        sube(s, P + 'csstv_reporter.smx', NUEVO)
        print(n, 'subido y comparado')
    for n, s in SRV: print(n, md(baja(s, P + 'csstv_reporter.smx')), md(baja(s, P + 'disabled/csstv_reporter_2.10.3.smx')), json.loads(api(s + '/resources'))['attributes']['current_state'])

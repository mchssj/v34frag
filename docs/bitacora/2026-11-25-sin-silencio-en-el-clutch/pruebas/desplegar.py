import re,json,urllib.request,urllib.parse,hashlib,sys
env={}
for l in open('E:/Css V34 Web/v34frag/.env',encoding='utf-8',errors='replace'):
    m=re.match(r'\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$',l)
    if m: env[m[1]]=m[2].strip('"\'')
K=env['SFTP_CSS_API_KEY']
def req(p):
    r=urllib.request.Request('https://panel-mvzg.com/api/client/servers/'+p,headers={'Authorization':'Bearer '+K,'Accept':'application/json','User-Agent':'Mozilla/5.0'})
    return urllib.request.urlopen(r,timeout=40).read()
def ls(s,d): return [x['attributes'] for x in json.loads(req(f'{s}/files/list?directory='+urllib.parse.quote(d)))['data']]
def get(s,f): return req(f'{s}/files/contents?file='+urllib.parse.quote(f))
def dl(s,f):
    u=json.loads(req(f'{s}/files/download?file='+urllib.parse.quote(f)))['attributes']['url']
    return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=60).read()
import os,time
_u=urllib.request.urlopen
def _r(*a,**k):
    for i in range(6):
        try: return _u(*a,**k)
        except urllib.error.HTTPError: raise
        except OSError:
            if i==5: raise
            time.sleep(8)
urllib.request.urlopen=_r
H=os.path.dirname(os.path.abspath(__file__))
new=open(H+'/csstv_qol.smx','rb').read()
md=lambda b: hashlib.md5(b).hexdigest()
assert md(new)=='a2a8f43eae6b4f53e00ea103c299bb37'
def put(s,f,b):
    r=urllib.request.Request(f'https://panel-mvzg.com/api/client/servers/{s}/files/write?file='+urllib.parse.quote(f),data=b,method='POST',
      headers={'Authorization':'Bearer '+K,'Accept':'application/json','Content-Type':'text/plain','User-Agent':'Mozilla/5.0'})
    return urllib.request.urlopen(r,timeout=60).status
P='/cstrike/addons/sourcemod/plugins/'; C='/cstrike/cfg/sourcemod/csstv_qol.cfg'
for s in ['cd1be322','16c850ff']:
    old=dl(s,P+'csstv_qol.smx'); assert md(old)=='fe36dbcd308a112addfa7cca03dd49e4',s
    put(s,P+'disabled/csstv_qol_1.4.0.smx',old); assert dl(s,P+'disabled/csstv_qol_1.4.0.smx')==old
    cfg=dl(s,C); open(f'{H}/{s}_csstv_qol.cfg.bak','wb').write(cfg)
    n,c=re.subn(rb'(// Desde la 1\.2\.0 [^\n]*\n)// Quien queda [^\n]*\nclutch_mute|(// Desde la 1\.2\.0 [^\n]*\n)// Quien queda [^\n]*\ncsstv_qol_clutch_mute "1"\r?\n\r?\n',rb'\2',cfg); assert c==1 and b'clutch_mute' not in n and len(cfg)-len(n)<200,(c,len(cfg)-len(n))
    put(s,P+'csstv_qol.smx',new); assert md(dl(s,P+'csstv_qol.smx'))==md(new)
    put(s,C,n); assert dl(s,C)==n
    print(s,'ok',len(cfg),len(n),md(n))

print('--- control')
for s in ['157703b5','cd1be322','16c850ff']:
    a=json.loads(req(s+'/resources'))['attributes']['current_state']
    print(s,md(dl(s,P+'csstv_qol.smx')),md(dl(s,P+'disabled/csstv_qol_1.4.0.smx')),md(dl(s,C)),b'clutch_mute' in dl(s,C),a)

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
import time
_u=urllib.request.urlopen
def _r(*a,**k):
    for i in range(6):
        try: return _u(*a,**k)
        except urllib.error.HTTPError: raise
        except OSError:
            if i==5: raise
            time.sleep(8)
urllib.request.urlopen=_r
B='/cstrike/addons/sourcemod/plugins'; N='Anti_Wallhack_Lite.smx'; M='373446f5a53ec1572a18df9d9f8a1097'
def names(s,d): return [x['name'] for x in ls(s,d)]
for s in ['157703b5','cd1be322','16c850ff']:
    if N in names(s,B):
        assert hashlib.md5(dl(s,f'{B}/{N}')).hexdigest()==M
        assert N not in names(s,B+'/disabled'),'ya hay uno en disabled '+s
        d=json.dumps({'root':B,'files':[{'from':N,'to':'disabled/'+N}]}).encode()
        urllib.request.urlopen(urllib.request.Request(f'https://panel-mvzg.com/api/client/servers/{s}/files/rename',data=d,method='PUT',headers={'Authorization':'Bearer '+K,'Accept':'application/json','Content-Type':'application/json','User-Agent':'Mozilla/5.0'}),timeout=60)
print('--- control')
for s in ['157703b5','cd1be322','16c850ff']:
    print(s,'en plugins:',N in names(s,B),'| en disabled:',hashlib.md5(dl(s,f'{B}/disabled/{N}')).hexdigest()==M,
      '|',json.loads(req(s+'/resources'))['attributes']['current_state'], '| qol', hashlib.md5(dl(s,B+'/csstv_qol.smx')).hexdigest()[:8])

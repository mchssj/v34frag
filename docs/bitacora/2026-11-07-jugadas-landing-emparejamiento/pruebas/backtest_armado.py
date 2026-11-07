# Compara qué tan bien predice al ganador cada forma de medir la fuerza de un equipo (solo ELO, armado 200/100/5,
# armado 400/200/3 y otros, μ de TrueSkill reconstruida), sobre todos los mixes. Lee <carpeta>/all.json con tres listas
# bajadas por la REST de la base (solo lectura): ms = matches?kind=eq.mix&status=eq.finished (id, played_at, starts_at,
# score1, score2, winner_side), st = match_player_stats (todas las columnas de estadísticas, win_prob y elo_before) y
# pl = players (id, steam_id). Ese archivo tiene SteamID: queda fuera del repo. Uso: python -I backtest_armado.py <carpeta>
import json,sys,math,re
D=sys.argv[1]; A=json.load(open(D+'/all.json'))
key={p['id']:p['steam_id'] for p in A['pl']}
MU0,S0,BETA,TAU=25,25/3,25/6,25/300
ncdf=lambda x:0.5*(1+math.erf(x/math.sqrt(2))); npdf=lambda x:math.exp(-x*x/2)/math.sqrt(2*math.pi)
def wgt(r,t):
  if not r or r<=0 or t<=0: return 0
  if r*100<35*t: return 0
  if r*100>=90*t: return 1
  return r/t
def rating(k,d,r,a,b,c,e,f): return (k/r/0.679+0.7*(r-d)/r/0.317+(a+4*b+9*c+16*e+25*f)/r/1.277)/2.7
by={}
for s in A['st']: by.setdefault(s['match_id'],[]).append(s)
ms=sorted(A['ms'],key=lambda m:(m['played_at'] or m['starts_at'],m['id']))
STEAM=re.compile(r'^(7656119[0-9]{10}|765612[0-9]{11})$')
R={}; H={}  # H: key -> list of stat rows (5v5) previas
CFG={'elo':None,'r200':(200,100,5),'r400':(400,200,3),'r600':(600,300,3),'r400c300':(400,300,3)}
hits={k:0 for k in list(CFG)+['mu']}; ll={k:0.0 for k in hits}; n=0
for m in ms:
  ss=[s for s in by.get(m['id'],[]) if s['team'] in (1,2)]
  if not ss: continue
  tot=max((m['score1'] or 0)+(m['score2'] or 0), max(s['rounds'] or 0 for s in ss))
  sd={}
  for s in ss: sd.setdefault(s['team'],set()).add(s['player_id'] or s['steam_id'])
  five=len(sd)==2 and min(map(len,sd.values()))>=5
  xs=[]
  for s in ss:
    w=wgt(s['rounds'],tot)
    k=(key.get(s['player_id']) if s['player_id'] else None) or s['steam_id']
    mu,sg=R.get(k,[MU0,S0]); xs.append((s,w,k,mu,sg,bool(STEAM.match(s['steam_id'] or ''))))
  ws=m['winner_side']
  if ws in (1,2) and five and all(x[0]['elo_before'] is not None for x in xs if x[1]>0):
    act=[x for x in xs if x[1]>0]; n+=1
    def adj(x,c):
      if c is None: return 0
      W,C,P=c; rows=H.get(x[2],[])
      if not rows: return 0
      t=[sum(r[f] for r in rows) for f in ('kills','deaths','rounds','k1','k2','k3','k4','k5')]
      if not t[2]: return 0
      r=rating(*t); nn=len(rows); return max(-C,min(C,W*((nn*r+P)/(nn+P)-1)))
    for name,c in CFG.items():
      a=sum(x[0]['elo_before']+adj(x,c) for x in act if x[0]['team']==1)/max(1,sum(1 for x in act if x[0]['team']==1))
      b=sum(x[0]['elo_before']+adj(x,c) for x in act if x[0]['team']==2)/max(1,sum(1 for x in act if x[0]['team']==2))
      p1=1/(1+10**((b-a)/400)); hits[name]+=(p1>0.5)==(ws==1); ll[name]+=-math.log(p1 if ws==1 else 1-p1)
    a=[x for x in act if x[0]['team']==1]; b=[x for x in act if x[0]['team']==2]
    c_=math.sqrt(sum(x[1]**2*(x[4]**2+TAU**2+BETA**2) for x in act)); p1=ncdf((sum(x[1]*x[3] for x in a)-sum(x[1]*x[3] for x in b))/c_)
    hits['mu']+=(p1>0.5)==(ws==1); ll['mu']+=-math.log(p1 if ws==1 else 1-p1)
  # actualizar mu
  xs2=[x for x in xs if x[1]>0]; n1=[x for x in xs2 if x[0]['team']==1]; n2=[x for x in xs2 if x[0]['team']==2]
  if n1 and n2:
    mu1=sum(x[1]*x[3] for x in n1); mu2=sum(x[1]*x[3] for x in n2); c=math.sqrt(sum(x[1]**2*(x[4]**2+TAU**2+BETA**2) for x in xs2))
    res1=0.5 if ws not in (1,2) else (1 if ws==1 else 0)
    if res1!=0.5:
      t=((mu1-mu2) if res1==1 else (mu2-mu1))/c; v=(-t-1/t) if t<-4 else npdf(t)/ncdf(t); w_=v*(v+t)
    for s,w,k,mu,sg,has in xs2:
      if not has: continue
      res=res1 if s['team']==1 else 1-res1; s2=sg*sg+TAU*TAU; nm=mu
      if res==1: nm=mu+w*s2/c*v
      elif res==0: nm=mu-w*s2/c*v
      if res!=0.5: s2=s2*max(1-w*w*s2/(c*c)*w_,0.0001)
      R[k]=[nm,math.sqrt(s2)]
  if five:
    for s in ss:
      if s['rounds']: H.setdefault((key.get(s['player_id']) if s['player_id'] else None) or s['steam_id'],[]).append(s)
print('mixes evaluados',n)
for k in hits: print(f"{k:9} aciertos {hits[k]:3}/{n} ({100*hits[k]/n:.0f}%)  logloss {ll[k]/n:.3f}")

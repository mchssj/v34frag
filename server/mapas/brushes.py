import struct,sys,collections
def load(fn):
    b=open(fn,'rb').read(); L=[struct.unpack('<iiii',b[8+16*i:24+16*i]) for i in range(64)]
    g=lambda i:b[L[i][0]:L[i][0]+L[i][1]]
    sd,st=g(43),g(44); tbl=struct.unpack('<%di'%(len(st)//4),st)
    names=[sd[o:sd.index(b'\0',o)].decode('latin1').lower() for o in tbl]
    td=g(2); tdname=[names[struct.unpack('<i',td[32*i+12:32*i+16])[0]] for i in range(len(td)//32)]
    ti=g(6); tinfo=[struct.unpack('<ii',ti[72*i+64:72*i+72]) for i in range(len(ti)//72)]
    pl=g(1); planes=[struct.unpack('<4fi',pl[20*i:20*i+20]) for i in range(len(pl)//20)]
    bs=g(19); sides=[struct.unpack('<Hhhh',bs[8*i:8*i+8]) for i in range(len(bs)//8)]
    br=g(18); brushes=[struct.unpack('<iii',br[12*i:12*i+12]) for i in range(len(br)//12)]
    mo=g(14); m0=struct.unpack('<9f',mo[:36])
    return dict(b=b,L=L,names=names,tdname=tdname,tinfo=tinfo,planes=planes,sides=sides,brushes=brushes,m0=m0)
def bounds(d,br):
    fs,ns,c=br; mn=[None]*3; mx=[None]*3
    for s in d['sides'][fs:fs+ns]:
        n0,n1,n2,dist,t=d['planes'][s[0]]
        for ax,n in enumerate((n0,n1,n2)):
            if n==1.0: mx[ax]=dist
            if n==-1.0: mn[ax]=-dist
    return mn,mx
def sidetex(d,s):
    t=s[1]
    if t<0: return '(none)',0
    fl,tdi=d['tinfo'][t]; return d['tdname'][tdi],fl
def summary(fn):
    d=load(fn); print('==',fn,'world bounds',[round(x) for x in d['m0'][:6]], 'brushes',len(d['brushes']))
    c=collections.Counter()
    for br in d['brushes']:
        texs=frozenset(sidetex(d,s)[0] for s in d['sides'][br[0]:br[0]+br[1]])
        key=('+'.join(sorted(t for t in texs if t.startswith('tools')))) or 'normal'
        c[(key[:70],hex(br[2]))]+=1
    for k,v in c.most_common(25): print('  ',v,k)
    return d
if __name__=='__main__':
    for f in sys.argv[1:]: summary(f)

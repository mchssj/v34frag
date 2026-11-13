# Convierte el lump de props estáticos (sprp) de un BSP de v10 a v5, dejando los primeros 60 bytes de cada prop.
import struct,sys
src,dst=sys.argv[1],sys.argv[2]
b=bytearray(open(src,'rb').read())
L=[list(struct.unpack('<iiii',b[8+16*i:24+16*i])) for i in range(64)]
go,gl=L[35][0],L[35][1]
n=struct.unpack('<i',b[go:go+4])[0]
hdr=[list(struct.unpack('<4sHHii',b[go+4+16*k:go+20+16*k])) for k in range(n)]
datas=[]
for h in hdr:
    gid,fl,ver,fo,fl2=h; d=bytes(b[fo:fo+fl2])
    if gid[::-1]==b'sprp':
        assert ver==10, ver
        p=0; dn=struct.unpack('<i',d[:4])[0]; p=4+128*dn
        ln=struct.unpack('<i',d[p:p+4])[0]; p+=4+2*ln
        pn=struct.unpack('<i',d[p:p+4])[0]; p+=4
        rs=(len(d)-p)//pn; assert rs==72 and p+72*pn==len(d)
        d=d[:p]+b''.join(d[p+72*i:p+72*i+60] for i in range(pn))
        h[2]=5; print('sprp: %d props, %d -> 60 bytes'%(pn,rs))
    datas.append(d)
# Reescribe el game lump en su mismo lugar (queda más chico), con offsets absolutos recalculados.
pos=go+4+16*n; out=bytearray(struct.pack('<i',n))
for h,d in zip(hdr,datas): h[3]=pos; h[4]=len(d); pos+=len(d)
for h in hdr: out+=struct.pack('<4sHHii',*h)
for d in datas: out+=d
assert len(out)<=gl
b[go:go+gl]=out+bytes(gl-len(out)); L[35][1]=len(out)
b[8+16*35:24+16*35]=struct.pack('<iiii',*L[35])
open(dst,'wb').write(b); print('ok',dst,len(b))

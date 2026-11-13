# Descomprime un BSP comprimido con LZMA (lumps, game lumps y pakfile) y pasa sprp v10 a v5.
import struct,sys,lzma,io,zipfile
src,dst=sys.argv[1],sys.argv[2]
b=open(src,'rb').read()
def unl(d):
    assert d[:4]==b'LZMA',d[:4]
    real,csz=struct.unpack('<II',d[4:12]); p=d[12:17]
    lc,lp,pb=p[0]%9,(p[0]//9)%5,p[0]//45; ds=struct.unpack('<I',p[1:5])[0]
    o=lzma.LZMADecompressor(lzma.FORMAT_RAW,filters=[{'id':lzma.FILTER_LZMA1,'lc':lc,'lp':lp,'pb':pb,'dict_size':ds}]).decompress(d[17:17+csz],real)
    assert len(o)==real,(len(o),real); return o
L=[struct.unpack('<iiii',b[8+16*i:24+16*i]) for i in range(64)]
lumps=[]
for i,(o,l,v,fc) in enumerate(L):
    d=b[o:o+l]
    if fc and l: d=unl(d); assert len(d)==fc
    lumps.append([d,v])
# game lump (offsets absolutos al original)
g=lumps[35][0]; n=struct.unpack('<i',g[:4])[0]
H=[list(struct.unpack('<4sHHii',g[4+16*k:20+16*k])) for k in range(n)]
GD=[]
for k,h in enumerate(H):
    gid,fl,ver,fo,fl2=h
    if gid==b'\0\0\0\0': continue
    if fl&1:
        end=H[k+1][3] if k+1<n and H[k+1][3] else L[35][0]+L[35][1]; d=unl(b[fo:end])
    else: d=b[fo:fo+fl2]
    if gid[::-1]==b'sprp' and ver==10:
        dn=struct.unpack('<i',d[:4])[0]; p=4+128*dn; ln=struct.unpack('<i',d[p:p+4])[0]; p+=4+2*ln
        pn=struct.unpack('<i',d[p:p+4])[0]; p+=4; assert p+72*pn==len(d),(len(d)-p)/pn
        d=d[:p]+b''.join(d[p+72*i:p+72*i+60] for i in range(pn)); ver=5; print('sprp',pn,'props -> v5')
    GD.append([gid,0,ver,d])
# pakfile: entradas LZMA (método 14) -> stored
z=zipfile.ZipFile(io.BytesIO(lumps[40][0])); raw=lumps[40][0]; out=io.BytesIO(); nz=zipfile.ZipFile(out,'w',zipfile.ZIP_STORED)
for zi in z.infolist():
    hdr=raw[zi.header_offset:zi.header_offset+30]; fnl,exl=struct.unpack('<HH',hdr[26:30]); st=zi.header_offset+30+fnl+exl
    cd=raw[st:st+zi.compress_size]
    if zi.compress_type==14:
        ps=struct.unpack('<H',cd[2:4])[0]; p=cd[4:4+ps]; lc,lp,pb=p[0]%9,(p[0]//9)%5,p[0]//45; ds=struct.unpack('<I',p[1:5])[0]
        data=lzma.LZMADecompressor(lzma.FORMAT_RAW,filters=[{'id':lzma.FILTER_LZMA1,'lc':lc,'lp':lp,'pb':pb,'dict_size':ds}]).decompress(cd[4+ps:],zi.file_size)
    else: data=cd
    assert len(data)==zi.file_size; ni=zipfile.ZipInfo(zi.filename,zi.date_time); nz.writestr(ni,data)
nz.close(); lumps[40][0]=out.getvalue(); print('pak',len(z.infolist()),'archivos')
# arma el BSP nuevo
o=bytearray(b[:1036]); hdr=[]
for i,(d,v) in enumerate(lumps):
    while len(o)%4: o+=b'\0'
    if i==35:
        base=len(o); pos=base+4+16*len(GD); gl=bytearray(struct.pack('<i',len(GD))); body=b''
        for gid,fl,ver,d2 in GD: gl+=struct.pack('<4sHHii',gid,0,ver,pos,len(d2)); pos+=len(d2); body+=d2
        d=bytes(gl)+body
    hdr.append((len(o) if d else 0,len(d),v,0)); o+=d
for i,h in enumerate(hdr): o[8+16*i:24+16*i]=struct.pack('<iiii',*h)
open(dst,'wb').write(o); print('ok',dst,len(o))

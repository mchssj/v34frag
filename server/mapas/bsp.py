import struct,sys,io,zipfile,re,collections
NAMES={0:'ENTITIES',1:'PLANES',2:'TEXDATA',3:'VERTEXES',5:'NODES',6:'TEXINFO',7:'FACES',10:'LEAFS',12:'EDGES',13:'SURFEDGES',14:'MODELS',17:'LEAFBRUSHES',18:'BRUSHES',19:'BRUSHSIDES',26:'DISPINFO',27:'ORIGINALFACES',33:'DISP_VERTS',35:'GAME_LUMP',40:'PAKFILE',43:'TEXDATA_STRING_DATA',44:'TEXDATA_STRING_TABLE',53:'LIGHTING_HDR',58:'FACES_HDR',8:'LIGHTING'}
for fn in sys.argv[1:]:
    b=open(fn,'rb').read()
    print('=====',fn)
    L=[struct.unpack('<iiii',b[8+16*i:24+16*i]) for i in range(64)]
    for i,(o,l,v,fc) in enumerate(L):
        if l and i in NAMES: print(f'  {i:2} {NAMES[i]:22} len {l:>10} ver {v} fourcc {fc}')
    # counts
    def cnt(i,sz): return L[i][1]//sz
    print('  faces',cnt(7,56),'brushes',cnt(18,12),'brushsides',cnt(19,8),'planes',cnt(1,20),'texinfo',cnt(6,72),'texdata',cnt(2,32),'models',cnt(14,48),'vertexes',cnt(3,12),'dispinfo',cnt(26,176),'leafs',L[10][1]//32,'nodes',cnt(5,32),'edges',cnt(12,4),'surfedges',cnt(13,4))
    ents=b[L[0][0]:L[0][0]+L[0][1]].decode('latin1')
    cls=collections.Counter(re.findall(r'"classname"\s+"([^"]+)"',ents))
    print('  entities',sum(cls.values()),'; clases:',dict(cls.most_common(60)))
    # game lump
    o,l=L[35][0],L[35][1]; n=struct.unpack('<i',b[o:o+4])[0]
    for k in range(n):
        gid,fl,ver,fo,fl2=struct.unpack('<4sHHii',b[o+4+16*k:o+20+16*k])
        print('  gamelump',gid[::-1],'flags',fl,'ver',ver,'len',fl2)
        if gid[::-1]==b'sprp':
            p=fo; dn=struct.unpack('<i',b[p:p+4])[0]; p+=4
            names=[b[p+128*j:p+128*(j+1)].split(b'\0')[0].decode() for j in range(dn)]; p+=128*dn
            ln=struct.unpack('<i',b[p:p+4])[0]; p+=4+2*ln
            pn=struct.unpack('<i',b[p:p+4])[0]; p+=4
            print('   static props: modelos',dn,'leafs',ln,'props',pn,'bytes/prop',(fo+fl2-p)/pn if pn else 0)
            globals()['spnames_'+fn.split('/')[-1][:3]]=names
    # pak
    o,l=L[40][0],L[40][1]
    z=zipfile.ZipFile(io.BytesIO(b[o:o+l]))
    meth=collections.Counter(i.compress_type for i in z.infolist())
    ext=collections.Counter(i.filename.rsplit('.',1)[-1].lower() for i in z.infolist())
    print('  pakfile',len(z.infolist()),'files; compress methods',dict(meth),'; exts',dict(ext))
    globals()['pak_'+fn.split('/')[-1][:3]]=z
    # texdata string
    o,l=L[43][0],L[43][1]
    tex=[t.decode('latin1') for t in b[o:o+l].split(b'\0') if t]
    print('  materials',len(tex))
    globals()['tex_'+fn.split('/')[-1][:3]]=tex

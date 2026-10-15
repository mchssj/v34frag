import os, re, struct, sys, zlib

pat = re.compile(sys.argv[1])
for p in sys.argv[2:]:
    b = open(p, 'rb').read()
    magic, ver, comp, disk, img, nsec, stroff, dataoff = struct.unpack('<IHBIIBII', b[:24])
    data = b[:dataoff] + (zlib.decompress(b[dataoff:]) if comp == 1 else b[dataoff:])
    strs = sorted(set(m.decode('latin1') for m in re.findall(rb'[\x20-\x7e]{5,}', data)))
    print('=====', os.path.basename(p), len(data))
    for s in strs:
        if pat.search(s):
            print('   ', s[:160])

"""El sonido del juego del v34 contra el de ClientMod: al video del v34 le resta las voces que se le mezclaron.
Uso: python -I restar.py <clip de ClientMod> <clip del v34> <voces.wav del mismo clip, con la ganancia aplicada>"""
import json, math, struct, subprocess, sys, wave
FF = json.load(open(r"E:\Css V34 Web\v34frag\render\config.json"))["ffmpeg"]
def pcm(p):
    r = subprocess.run([FF, "-v", "error", "-i", p, "-vn", "-ac", "1", "-ar", "48000", "-f", "s16le", "-"], capture_output=True).stdout
    return struct.unpack(f"<{len(r)//2}h", r)
cm, fin, vo = pcm(sys.argv[1]), pcm(sys.argv[2]), pcm(sys.argv[3])
n = min(len(fin), len(vo)); game = [fin[i] - vo[i] for i in range(n)]  # las voces entran con ganancia 1 en amix (ya traen la 0,4)
def env(x): return [math.sqrt(sum(v*v for v in x[i:i+480]) / 480) for i in range(0, len(x) - 480, 480)]
a, b = env(cm), env(game); m = min(len(a), len(b))
def corr(lag):
    xs = [(a[i], b[i - lag]) for i in range(m) if 0 <= i - lag < m]
    ma = sum(x for x, _ in xs) / len(xs); mb = sum(y for _, y in xs) / len(xs)
    num = sum((x - ma) * (y - mb) for x, y in xs); den = math.sqrt(sum((x - ma) ** 2 for x, _ in xs) * sum((y - mb) ** 2 for _, y in xs))
    return num / den if den else 0
res = sorted(((corr(l), l) for l in range(-50, 51)), reverse=True)
print("sonido del juego v34 contra ClientMod: en 0 ms", round(corr(0), 3), "| mejor", round(res[0][0], 3), "a", res[0][1] * 10, "ms |", [(l * 10, round(c, 3)) for c, l in res[1:4]])
# Por tramo (cada uno aparte: 0-5 s, 5-18 s, 18-23 s)
for lo, hi in ((0, 500), (500, 1797), (1797, 2297)):
    def c2(lag):
        xs = [(a[i], b[i - lag]) for i in range(lo, min(hi, m)) if 0 <= i - lag < m]
        ma = sum(x for x, _ in xs) / len(xs); mb = sum(y for _, y in xs) / len(xs)
        num = sum((x - ma) * (y - mb) for x, y in xs); den = math.sqrt(sum((x - ma) ** 2 for x, _ in xs) * sum((y - mb) ** 2 for _, y in xs))
        return num / den if den else 0
    best = max((c2(l), l) for l in range(-50, 51)); print(f"  tramo {lo/100:.1f}-{hi/100:.1f}s: mejor {best[0]:.3f} a {best[1]*10} ms (en 0: {c2(0):.3f})")

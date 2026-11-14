"""Compara el audio de dos videos (o un video y un .wav) cada 10 ms y busca el corrimiento en que más se parecen.
Uso: python -I comparar.py <referencia, ej. el clip de ClientMod> <otro>"""
import json, math, struct, subprocess, sys
FF = json.load(open(r"E:\Css V34 Web\v34frag\render\config.json"))["ffmpeg"]
def pcm(p):
    r = subprocess.run([FF, "-v", "error", "-i", p, "-vn", "-ac", "1", "-ar", "48000", "-f", "s16le", "-"], capture_output=True).stdout
    return struct.unpack(f"<{len(r)//2}h", r)
def env(x): return [math.sqrt(sum(v*v for v in x[i:i+480]) / 480) for i in range(0, len(x) - 480, 480)]
a, b = env(pcm(sys.argv[1])), env(pcm(sys.argv[2])); n = min(len(a), len(b))
def corr(lag):
    xs = [(a[i], b[i - lag]) for i in range(n) if 0 <= i - lag < n]
    ma = sum(x for x, _ in xs) / len(xs); mb = sum(y for _, y in xs) / len(xs)
    num = sum((x - ma) * (y - mb) for x, y in xs); den = math.sqrt(sum((x - ma) ** 2 for x, _ in xs) * sum((y - mb) ** 2 for _, y in xs))
    return num / den if den else 0
best = max((corr(l), l) for l in range(-50, 51))
rms = lambda e: math.sqrt(sum(v * v for v in e) / len(e))
print(f"correlación en 0 ms: {corr(0):.3f}; la mejor: {best[0]:.3f} a {best[1]*10} ms; volumen (RMS) ClientMod {rms(a):.0f} / v34 {rms(b):.0f}")

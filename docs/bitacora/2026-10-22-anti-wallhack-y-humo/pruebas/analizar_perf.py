import re, sys, glob, statistics as st, collections
srv = re.compile(r"L (\S+) - (\S+): servidor · ticks (\d+)/(\d+) · tarde >\d+ms (\d+) · >\d+ms (\d+) · >\d+ms (\d+) · peor ([\d.]+) ms · jugadores (\d+)")
ply = re.compile(r"L (\S+) - (\S+):   (.*) \[(STEAM[^\]]*)\] ping (\d+) ms · pérdida ([\d.]+)%/([\d.]+)% · choke ([\d.]+)%/([\d.]+)% · rate (\S+) · upd (\d+) · cmd (\d+)")
for f in sorted(glob.glob(sys.argv[1] + "/csstv_perf_*.log")):
    W = []; P = collections.defaultdict(list)
    for l in open(f, encoding="utf-8", errors="replace"):
        m = srv.match(l)
        if m and int(m[9]) >= 8: W.append(m)
        m2 = ply.match(l)
        if m2 and W and W[-1][2] == m2[2]: P[m2[3]].append(m2)
    if not W: continue
    tk = sum(int(w[3]) for w in W); te = sum(int(w[4]) for w in W)
    t2 = sum(int(w[6]) for w in W); t5 = sum(int(w[7]) for w in W)
    print(f"\n### {f[-12:-4]}  ventanas(>=8 jug) {len(W)} {W[0][2]}–{W[-1][2]} | ticks {tk}/{te} ({100*tk/te:.2f}%) | >2int {100*t2/tk:.2f}% | >5int {t5} | peor med {st.median(float(w[8]) for w in W)} max {max(float(w[8]) for w in W)}")
    for n, L in sorted(P.items(), key=lambda kv: -len(kv[1])):
        if len(L) < 10: continue
        ping = [int(x[5]) for x in L]; lo = [float(x[6]) for x in L]; li = [float(x[7]) for x in L]
        co = [float(x[8]) for x in L]; ci = [float(x[9]) for x in L]
        hi_ci = sum(c > 20 for c in ci)
        print(f"  {n[:22]:22} n{len(L):3} ping {min(ping)}-{st.median(ping):.0f}-{max(ping)} · loss out {st.mean(lo):.1f}% in {st.mean(li):.1f}% (max {max(li)}) · choke out {st.mean(co):.1f}% (max {max(co)}) in med {st.median(ci):.1f}% (>20% en {hi_ci}/{len(L)}) · rate {L[-1][10]} upd {L[-1][11]} cmd {L[-1][12]}")

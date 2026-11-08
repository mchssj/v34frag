import sys, json, urllib.request
sys.path.insert(0, r"E:\Css V34 Web\v34frag\render")
import leer_demo, procesar, render_clip
env = procesar.load_env(procesar.DEFAULT_ENV)
def get(q):
    req = urllib.request.Request(env["RENDER_SUPABASE_URL"].rstrip("/") + "/rest/v1/" + q, headers={
        "User-Agent": procesar.USER_AGENT, "apikey": env["RENDER_SUPABASE_KEY"], "Authorization": "Bearer " + env["RENDER_SUPABASE_KEY"]})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())
cfg = json.load(open(r"E:\Css V34 Web\v34frag\render\config.json"))
for mid, demo in zip(sys.argv[1::2], sys.argv[2::2]):
    clips = get(f"match_clip_list?select=*&match_id=eq.{mid}")
    conf = get("clip_config?select=pre_seconds,post_seconds,split_gap_seconds&id=eq.1")[0]
    d = leer_demo.Demo(demo).parse(); rounds = leer_demo.rounds(d)
    off = procesar.tick_offset(d, rounds, clips)
    lead = round(cfg.get("lead_seconds", 0.5) / d.tick_interval)
    print(mid[:8])
    for c in sorted(clips, key=lambda c: c["round"]):
        job = procesar.build_job(d, rounds, c, off, conf)
        try:
            render_clip.check_targets(d, job, lead); r = "ok " + str([render_clip.spec_target(d, job["steamid"], max(s[0]-lead,0)) for s in job["segs"]][-1])
        except RuntimeError as e:
            r = "FALLA SOLO ESTE: " + str(e)
        print(" ", c["id"][:8], c["round"], c["type"], ascii(job["player"]), r)

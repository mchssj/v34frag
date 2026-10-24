"""Graba una jugada de una demo de CS:S v34 con el cliente ClientMod y la pasa a .mp4 con FFmpeg.

Uso (prueba de una jugada; la grabación automática es procesar.py, que usa las mismas funciones):
  python render_clip.py <demo.dem> --player "<nombre>" --round <n>        las kills de ese jugador en esa ronda
  python render_clip.py <demo.dem> --player "<nombre>" --ticks 100,200     ticks de la demo a mano
  Opciones: --config <config.json> (por defecto, el de esta carpeta), --height 1080, --name <nombre del mp4>

record_session() graba varias jugadas de una demo en una sola sesión del juego (abrir y cargar la demo se lleva la
mitad del tiempo). Los tramos van en orden de tick y solo se salta hacia adelante: si dos jugadas se pisan, la segunda
va en otra pasada, con el juego recién abierto (un salto hacia atrás reinicia la demo y deja la consola sin efecto).

La ronda es la que numera leer_demo.py (cuenta las que reinicia el plugin al empezar). Las rutas y la calidad
salen de config.json (copia de config.example.json). Solo usa la biblioteca estándar y FFmpeg.

Corre como administrador (se eleva solo, con un aviso de UAC): el launcher de ClientMod lo es, y Windows no deja
que un programa sin esos permisos le mande clics ni teclas. Así el script hace clic en PLAY y maneja el juego.

Cómo controla el juego: escribe en su consola. Abre la consola con la tecla de consola, escribe el paso (los
comandos y una marca "echo CML_PASO_n") con mensajes de teclado a la ventana, aprieta Enter y espera la marca en el
log de la consola. No sirve un cfg por paso (durante la demo el juego no ejecuta cfg sueltos, por el sv_pure grabado
en la demo), ni un bucle con wait (traba la carga de la demo, que usa la misma cola de comandos), ni un atajo de
teclado (la barra del espectador se queda con el teclado; la consola se abre igual).

La resolución y el modo de ventana quedan en el registro (registry_key), compartido con la instalación normal:
se respaldan antes y se restauran al final.
"""
import argparse
import ctypes
import ctypes.wintypes as wt
import glob
import json
import os
import shutil
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import leer_demo  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
LOG_OUT = None  # archivo donde se copia la salida (la ventana elevada se cierra al terminar)


def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    if LOG_OUT:
        with open(LOG_OUT, "a", encoding="utf-8") as f:
            f.write(line + "\n")


def load_config(path):
    cfg = json.load(open(path, encoding="utf-8"))
    for k in ("client_dir", "work_dir", "out_dir"):
        cfg[k] = os.path.abspath(cfg[k])
    return cfg


def segments(ticks, tick_interval, cfg):
    """Tramos [inicio, fin] en ticks de la demo: pre antes de la primera kill, post después de la última,
    y un corte cuando entre dos kills pasan más de split_gap_seconds."""
    per_sec = 1 / tick_interval
    pre, post, gap = (round(cfg[k] * per_sec) for k in ("pre_seconds", "post_seconds", "split_gap_seconds"))
    groups = [[ticks[0]]]
    for t in ticks[1:]:
        if t - groups[-1][-1] > gap:
            groups.append([t])
        else:
            groups[-1].append(t)
    return [(max(g[0] - pre, 0), g[-1] + post) for g in groups]


# ---- Windows: elevación, ventanas, mouse y teclado ----

user32 = ctypes.windll.user32
shell32 = ctypes.windll.shell32
kernel32 = ctypes.windll.kernel32
user32.SetProcessDPIAware()


def is_admin():
    return bool(shell32.IsUserAnAdmin())


class _SEI(ctypes.Structure):
    _fields_ = [("cbSize", wt.DWORD), ("fMask", ctypes.c_ulong), ("hwnd", wt.HWND), ("lpVerb", wt.LPCWSTR),
                ("lpFile", wt.LPCWSTR), ("lpParameters", wt.LPCWSTR), ("lpDirectory", wt.LPCWSTR),
                ("nShow", ctypes.c_int), ("hInstApp", wt.HINSTANCE), ("lpIDList", ctypes.c_void_p),
                ("lpClass", wt.LPCWSTR), ("hkeyClass", wt.HKEY), ("dwHotKey", wt.DWORD),
                ("hIcon", wt.HANDLE), ("hProcess", wt.HANDLE)]


def relaunch_as_admin(out_file, script=None):
    """Vuelve a abrir el script como administrador, espera a que termine y va mostrando su salida."""
    if os.path.exists(out_file):
        os.remove(out_file)
    args = subprocess.list2cmdline([os.path.abspath(script or __file__)] + sys.argv[1:] + ["--out-log", out_file])
    sei = _SEI(cbSize=ctypes.sizeof(_SEI), fMask=0x40, lpVerb="runas", lpFile=sys.executable,
               lpParameters=f"-I {args}", lpDirectory=AQUI, nShow=7)
    if not shell32.ShellExecuteExW(ctypes.byref(sei)):
        raise SystemExit("no se pudo abrir como administrador (¿se rechazó el aviso de UAC?)")
    pos = 0
    while kernel32.WaitForSingleObject(sei.hProcess, 500) != 0:
        pos = _tail(out_file, pos)
    _tail(out_file, pos)
    code = wt.DWORD()
    kernel32.GetExitCodeProcess(sei.hProcess, ctypes.byref(code))
    sys.exit(code.value)


def _tail(path, pos):
    if not os.path.exists(path):
        return pos
    with open(path, "rb") as f:
        f.seek(pos)
        data = f.read()
    sys.stdout.write(data.decode("utf-8", "replace"))
    sys.stdout.flush()
    return pos + len(data)


def find_window(title):
    h = user32.FindWindowW(None, title)
    if not h:
        return None
    r = wt.RECT()
    user32.GetWindowRect(h, ctypes.byref(r))
    return h, r


def click(x, y):
    user32.SetCursorPos(x, y)
    time.sleep(0.4)
    user32.mouse_event(2, 0, 0, 0, 0)
    time.sleep(0.15)
    user32.mouse_event(4, 0, 0, 0, 0)


WM_KEYDOWN, WM_KEYUP, WM_CHAR = 0x100, 0x101, 0x102
SCAN_CONSOLE = 0x29  # la tecla a la izquierda del 1 (º en el teclado español, ` en el inglés)


def post_key(hwnd, scan, vk=None):
    vk = vk or user32.MapVirtualKeyW(scan, 1)
    user32.PostMessageW(hwnd, WM_KEYDOWN, vk, 1 | (scan << 16))
    time.sleep(0.05)
    user32.PostMessageW(hwnd, WM_KEYUP, vk, 1 | (scan << 16) | (0xC0 << 24))
    time.sleep(0.05)


def console_command(hwnd, text):
    """Abre la consola, escribe el texto y aprieta Enter. El texto tiene que cerrar la consola (hideconsole)."""
    post_key(hwnd, SCAN_CONSOLE)
    time.sleep(0.3)
    for ch in text:
        user32.PostMessageW(hwnd, WM_CHAR, ord(ch), 1)
        time.sleep(0.005)
    post_key(hwnd, 0x1C, 0x0D)  # Enter


class Game:
    """El cliente ClientMod de la copia de render, manejado desde su consola."""

    LAUNCHER = "ClientMod Launcher"
    GAME = "CS:S v34 ClientMod"

    def __init__(self, cfg):
        self.cfg = cfg
        self.cstrike = os.path.join(cfg["client_dir"], "cstrike")
        self.steps = os.path.join(self.cstrike, "cfg", "cmleague")
        self.logfile = os.path.join(self.cstrike, "cmleague", "render.log")
        self.ini = os.path.join(cfg["client_dir"], "clientmod.ini")
        self.reg_backup = os.path.join(cfg["work_dir"], "registro.reg")
        self.n = 0
        self.log_pos = 0
        self.hwnd = None
        self.step_pos = 0

    # ---- preparación y limpieza ----

    def prepare(self, demo_rel):
        shutil.rmtree(self.steps, ignore_errors=True)
        if os.path.exists(self.logfile):
            os.remove(self.logfile)
        c = self.cfg
        open(os.path.join(self.cstrike, "cfg", "cmleague_render.cfg"), "w", encoding="utf-8").write("\n".join([
            # La consola es la única forma de manejar el juego: en una instalación limpia puede venir apagada.
            "con_enable 1",
            'bind "`" "toggleconsole"',
            "con_logfile cmleague/render.log",
            f"host_framerate {c['fps']}",
            "fps_max 0",
            "volume 0.4",
            "net_graph 0",
            "cl_showfps 0",
            f"playdemo {demo_rel}",
            "",
        ]))
        # Parámetros del launcher: se guarda el ini original y se restaura al final.
        shutil.copyfile(self.ini, self.ini + ".render_orig")
        lines = open(self.ini, encoding="utf-8").read().splitlines()
        params = f"Params=-novid -windowed -noborder -w {c['width']} -h {c['height']} +exec cmleague_render"
        lines = [params if l.startswith("Params=") else l for l in lines]
        open(self.ini, "w", encoding="utf-8").write("\n".join(lines) + "\n")
        subprocess.run(["reg", "export", c["registry_key"], self.reg_backup, "/y"], check=True, capture_output=True)

    def restore(self):
        if os.path.exists(self.ini + ".render_orig"):
            shutil.move(self.ini + ".render_orig", self.ini)
        if os.path.exists(self.reg_backup):
            subprocess.run(["reg", "import", self.reg_backup], check=True, capture_output=True)

    # ---- juego ----

    def running(self):
        out = subprocess.run(["tasklist", "/fi", "imagename eq CMLauncher.exe", "/fo", "csv", "/nh"],
                             capture_output=True, text=True).stdout
        return "CMLauncher.exe" in out

    def launch(self):
        subprocess.Popen([os.path.join(self.cfg["client_dir"], "CMLauncher.exe")], cwd=self.cfg["client_dir"])
        t0 = time.time()
        while not find_window(self.LAUNCHER):
            if time.time() - t0 > 60:
                raise TimeoutError("no apareció la ventana del launcher")
            time.sleep(0.5)
        time.sleep(2)  # que termine de dibujar el botón
        # PLAY está abajo a la derecha: en la ventana de 890x500, en (785, 450).
        for _ in range(3):
            w = find_window(self.LAUNCHER)
            if not w or find_window(self.GAME):
                break
            h, r = w
            user32.SetForegroundWindow(h)
            click(r.left + round((r.right - r.left) * 785 / 890), r.top + round((r.bottom - r.top) * 450 / 500))
            log("Clic en PLAY.")
            time.sleep(6)
        while not (w := find_window(self.GAME)):
            if time.time() - t0 > 120:
                raise TimeoutError("no apareció la ventana del juego")
            time.sleep(0.5)
        self.hwnd = w[0]

    def quit(self):
        """Cierra el juego con el mismo mecanismo de los pasos (no se lo puede matar: es un proceso protegido)."""
        if not self.running():
            return
        if self.hwnd:
            log("Cerrando el juego.")
            t0 = time.time()
            while self.running() and time.time() - t0 < 60:
                console_command(self.hwnd, "quit")
                time.sleep(4)
        if self.running():
            log("El juego no se cerró: ciérralo a mano.")

    def read_log(self):
        if not os.path.exists(self.logfile):
            return ""
        with open(self.logfile, "rb") as f:
            f.seek(self.log_pos)
            data = f.read()
        self.log_pos += len(data)
        return data.decode("utf-8", "replace")

    def wait_seek(self, line, since, timeout=180, quiet=1.5):
        """Espera a que termine un demo_gototick: que aparezca la línea (si hay) y que el log deje de crecer.
        La línea se busca desde "since": puede haberse escrito antes del salto (la demo sigue un poco después de
        cada tramo). Si no aparece, alcanza con que el log se quede quieto."""
        if line:
            t0 = time.time()
            while line not in open(self.logfile, "rb").read()[since:].decode("utf-8", "replace"):
                if time.time() - t0 > timeout:
                    log(f"Aviso: el salto no mostró '{line}' en {timeout} s; sigo cuando el log se quede quieto.")
                    break
                time.sleep(0.2)
        size, t_quiet = -1, time.time()
        while time.time() - t_quiet < quiet:
            new = os.path.getsize(self.logfile)
            if new != size:
                size, t_quiet = new, time.time()
            time.sleep(0.1)
        self.log_pos = os.path.getsize(self.logfile)

    def wait_log(self, text, timeout, retry=None):
        t0, buf, last = time.time(), "", time.time()
        while time.time() - t0 < timeout:
            buf += self.read_log()
            if text in buf:
                return buf
            if retry and time.time() - last > 5:
                retry()
                last = time.time()
            time.sleep(0.2)
        raise TimeoutError(f"no apareció '{text}' en el log en {timeout} s")

    def step(self, commands, timeout=60):
        """Escribe el paso en la consola y espera su marca en el log. Si no llegó en 5 s, lo vuelve a escribir
        (pasa si la consola no llegó a abrirse)."""
        self.n += 1
        self.step_pos = os.path.getsize(self.logfile)
        marker = f"CML_PASO_{self.n}"
        text = "; ".join(commands + [f"echo {marker}"])
        send = lambda: console_command(self.hwnd, text)  # noqa: E731
        send()
        self.wait_log(marker, timeout, retry=send)

    def log_text(self, since):
        return open(self.logfile, "rb").read()[since:].decode("utf-8", "replace")

    def wait_text(self, text, since, timeout):
        """Espera a que el texto aparezca en el log desde la posición since (sin depender de lo ya leído)."""
        t0 = time.time()
        while text not in self.log_text(since):
            if time.time() - t0 > timeout:
                raise TimeoutError(f"no apareció '{text}' en el log en {timeout} s")
            time.sleep(0.2)

    def restarted(self, wait=1.5):
        """Si el último paso reinició la demo (un demo_gototick hacia atrás la vuelve a abrir)."""
        time.sleep(wait)
        return "Playing demo from" in self.log_text(self.step_pos)

    def stop_movie(self, prefix, tries=3):
        """endmovie y comprobar que los cuadros dejaron de aparecer. En la prueba del 2026-10-23 un endmovie no hizo
        efecto y se grabaron 13 000 cuadros: ahora se reintenta y, si no corta, se falla enseguida."""
        for _ in range(tries):
            self.step(["demo_pause", "endmovie", "hideconsole", "gameui_hide"])
            time.sleep(1.0)
            before = count_frames(prefix)
            time.sleep(1.5)
            if count_frames(prefix) == before:
                return
            log(f"Aviso: endmovie no cortó la grabación de {os.path.basename(prefix)}; reintento.")
        raise RuntimeError(f"endmovie no cortó la grabación de {os.path.basename(prefix)}")


def count_frames(prefix):
    return len(glob.glob(prefix + "*.tga"))


def ffmpeg_segment(cfg, prefix, frames, out, skip=0):
    """Un tramo: los TGA y el WAV de startmovie a H.264 y AAC. skip: cuadros del principio que se descartan (los
    primeros cuadros después de un salto salen sin el arma: la cámara todavía no está en primera persona)."""
    tgas = sorted(glob.glob(prefix + "*.tga"))
    first = tgas[0][len(prefix):-4]
    pattern = f"{prefix}%0{len(first)}d.tga"
    cmd = [cfg["ffmpeg"], "-y", "-loglevel", "error", "-framerate", str(cfg["fps"]),
           "-start_number", str(int(first) + skip), "-i", pattern]
    wav = prefix + ".wav"
    has_audio = os.path.exists(wav) and os.path.getsize(wav) > 1000
    if has_audio:
        cmd += ["-ss", f"{skip / cfg['fps']:.3f}", "-i", wav]
    cmd += ["-frames:v", str(frames), "-vf", f"scale={cfg['width']}:{cfg['height']}", "-c:v", "libx264",
            "-crf", str(cfg["crf"]), "-preset", cfg["preset"], "-pix_fmt", "yuv420p"]
    cmd += ["-c:a", "aac", "-b:a", "128k", "-shortest"] if has_audio else ["-an"]
    subprocess.run(cmd + [out], check=True)


def lead_frames(cfg):
    return round(cfg.get("lead_seconds", 0.5) * cfg["fps"])


def segment_frames(seg, tick_interval, cfg):
    t0, t1 = seg
    return round((t1 - t0) * tick_interval * cfg["fps"])


def plan_passes(jobs, lead_ticks, gap_ticks):
    """Reparte los tramos de todas las jugadas en pasadas donde todos los saltos son hacia adelante.

    Un salto hacia atrás reinicia la demo, y después de eso el juego deja de obedecer la consola (prueba del
    2026-10-23: se pasó de largo y no cortó la grabación). Dos jugadas que se pisan (un 4k y un 3k de la misma ronda)
    van en pasadas distintas, cada una con el juego recién abierto. gap_ticks: separación mínima con el tramo
    anterior de la misma pasada (la demo sigue unos segundos después de cada tramo)."""
    plan = sorted(((max(seg[0] - lead_ticks, 0), seg, job, i) for job in jobs for i, seg in enumerate(job["segs"])),
                  key=lambda x: x[0])
    passes = []  # [[último fin, [(j0, seg, job, i), ...]], ...]
    for item in plan:
        dest = next((p for p in passes if p[0] + gap_ticks < item[0]), None)
        if dest is None:
            dest = [-1, []]
            passes.append(dest)
        dest[0] = item[1][1]
        dest[1].append(item)
    return [p[1] for p in passes]


def record_session(cfg, demo_path, d, jobs, frames_dir):
    """Graba varias jugadas de una demo, con una sesión del juego por pasada (plan_passes; casi siempre una o dos).

    jobs: [{"key": nombre corto y único, "player": nombre en la demo, "segs": [(t0, t1), ...]}].
    frames_dir tiene que estar dentro de cstrike/ del cliente (startmovie escribe ahí).
    Devuelve {key: [prefijo de los cuadros de cada tramo]}. Si falla lanza una excepción, con el juego cerrado y el
    cliente restaurado."""
    game = Game(cfg)
    demos = os.path.join(game.cstrike, "cmleague", "demos")
    os.makedirs(demos, exist_ok=True)
    os.makedirs(cfg["work_dir"], exist_ok=True)  # respaldo del registro
    shutil.rmtree(frames_dir, ignore_errors=True)
    os.makedirs(frames_dir)
    rel_frames = os.path.relpath(frames_dir, game.cstrike).replace("\\", "/")
    demo_name = os.path.splitext(os.path.basename(demo_path))[0]
    dst = os.path.join(demos, demo_name + ".dem")
    if not os.path.exists(dst) or os.path.getsize(dst) != os.path.getsize(demo_path):
        shutil.copyfile(demo_path, dst)
    if game.running():
        w = find_window(Game.GAME)
        game.hwnd = w[0] if w else None
        game.quit()
        if game.running():
            raise RuntimeError("ClientMod ya está abierto y no se pudo cerrar: ciérralo antes de grabar")

    lead = lead_frames(cfg)
    lead_ticks = round(cfg.get("lead_seconds", 0.5) / d.tick_interval)
    # Después de cada tramo la demo sigue corriendo hasta que llega el demo_pause (en la prueba del 2026-10-23,
    # entre 5 y 10 s de demo): un tramo que empieza antes de eso es, para el juego, un salto hacia atrás.
    passes = plan_passes(jobs, lead_ticks, round(cfg.get("gap_seconds", 15) / d.tick_interval))
    out = {job["key"]: [None] * len(job["segs"]) for job in jobs}
    all_kills = [k for r in leer_demo.rounds(d) for k in r["kills"] if not k["suicide"]]
    kill_line = lambda k: f"{k['attacker']} killed {k['victim']} with {k['weapon']}."  # noqa: E731
    if len(passes) > 1:
        log(f"Hay tramos muy cerca unos de otros: {len(passes)} pasadas.")

    for n_pass, plan in enumerate(passes, 1):
        game = Game(cfg)
        game.prepare(f"cmleague/demos/{demo_name}")
        try:
            game.launch()
            game.wait_log("Redownloading all lightmaps", 600)
            log(f"Demo cargada (pasada {n_pass} de {len(passes)}).")
            prev_end, since = -1, None
            for j0, (t0, t1), job, i in plan:
                # En este motor spec_mode 3 es la primera persona (4 es la cámara de persecución). La barra del
                # espectador se oculta: tapa la imagen y se queda con el teclado. Sin chat ni mapa:
                # hud_saytext_time 0 y overview_mode 0 (el mapa de arriba a la izquierda es el overview del
                # espectador, no el radar).
                spec = [f'spec_player "{job["player"]}"', "spec_mode 3", "hidepanel specmenu", "hidepanel specgui",
                        "hidepanel overview", "overview_mode 0", "hud_saytext_time 0"]
                frames = segment_frames((t0, t1), d.tick_interval, cfg)
                name = f"{job['key']}_{i}_"
                prefix = os.path.join(frames_dir, name)
                # Se salta un poco antes (j0) y esos cuadros se descartan en FFmpeg.
                goto = ["demo_pause", f"demo_gototick {j0}"] + spec + ["hideconsole", "gameui_hide"]
                game.step(goto)
                # El salto avanza la demo a toda velocidad y tarda: mientras tanto, la consola escribe cada kill
                # que pasa. Llegó cuando apareció la última kill anterior al tramo y el log se quedó quieto. La
                # línea se busca desde el tramo anterior (la demo sigue un poco después de cada tramo).
                since = game.step_pos if since is None else since
                before = [k for k in all_kills if prev_end < k["tick"] < j0]
                if game.restarted():
                    # Para el juego el salto fue hacia atrás (la demo había seguido más de lo previsto después del
                    # tramo anterior) y la reinició. Después del reinicio la demo no queda en pausa: se espera la
                    # carga y se pausa y se salta otra vez, como al abrir el juego. Las kills se vuelven a escribir
                    # desde el principio.
                    log(f"Aviso: el salto a {j0} reinició la demo; vuelvo a saltar desde el principio.")
                    game.wait_text("Redownloading all lightmaps", game.step_pos, 600)
                    game.step(goto)
                    if game.restarted():
                        raise RuntimeError(f"{job['key']} tramo {i}: la demo se reinició dos veces")
                    since, before = game.step_pos, [k for k in all_kills if k["tick"] < j0]
                last = kill_line(before[-1]) if before else None
                game.wait_seek(last, since)
                # Si ya pasó la primera kill del tramo, la demo se pasó de largo: mejor fallar que grabar otra cosa.
                after = next((k for k in all_kills if k["tick"] >= j0), None)
                text = game.log_text(since)
                if after and kill_line(after) in text[text.rfind(last) + len(last) if last and last in text else 0:]:
                    raise RuntimeError(f"{job['key']} tramo {i}: la demo pasó de largo el tick {j0}")
                prev_end = t1
                game.step(spec + ["hideconsole", "gameui_hide", f"startmovie {rel_frames}/{name}", "demo_resume"])
                since = game.step_pos
                t0w = time.time()
                while count_frames(prefix) < lead + frames + 2:
                    if time.time() - t0w > 300:
                        raise TimeoutError(f"{job['key']} tramo {i}: {count_frames(prefix)} de {lead + frames} cuadros en 300 s")
                    time.sleep(0.2)
                game.stop_movie(prefix)
                out[job["key"]][i] = prefix
                log(f"{job['key']} tramo {i}: {frames} cuadros en {time.time() - t0w:.1f} s")
        finally:
            game.quit()
            game.restore()
    return out


def frames_mb(prefixes):
    return sum(os.path.getsize(f) for p in prefixes for f in glob.glob(p + "*")) / 1e6


def encode(cfg, prefixes, segs, tick_interval, out):
    """Los tramos de una jugada a un .mp4 (uno por tramo, unidos con concat sin recodificar). Borra los cuadros."""
    parts = []
    base = os.path.splitext(out)[0]
    try:
        for i, (prefix, seg) in enumerate(zip(prefixes, segs)):
            part = f"{base}.tramo{i}.mp4"
            ffmpeg_segment(cfg, prefix, segment_frames(seg, tick_interval, cfg), part, skip=lead_frames(cfg))
            parts.append(part)
        if len(parts) == 1:
            subprocess.run([cfg["ffmpeg"], "-y", "-loglevel", "error", "-i", parts[0], "-c", "copy",
                            "-movflags", "+faststart", out], check=True)
        else:
            lst = base + ".tramos.txt"
            open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
            subprocess.run([cfg["ffmpeg"], "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                            "-c", "copy", "-movflags", "+faststart", out], check=True)
            os.remove(lst)
    finally:
        for p in parts:
            if os.path.exists(p):
                os.remove(p)
        for prefix in prefixes:
            for f in glob.glob(prefix + "*"):
                os.remove(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("demo")
    ap.add_argument("--player", required=True)
    ap.add_argument("--round", type=int)
    ap.add_argument("--ticks")
    ap.add_argument("--config", default=os.path.join(AQUI, "config.json"))
    ap.add_argument("--height", type=int)
    ap.add_argument("--name")
    ap.add_argument("--out-log", help=argparse.SUPPRESS)
    a = ap.parse_args()
    global LOG_OUT
    if not is_admin():
        relaunch_as_admin(os.path.join(AQUI, "ultimo_render.log"))
    LOG_OUT = a.out_log
    cfg = load_config(a.config)
    if a.height:
        cfg["height"], cfg["width"] = a.height, round(a.height * 16 / 9)
    t_start = time.time()

    # 1. La jugada.
    d = leer_demo.Demo(a.demo).parse()
    if a.ticks:
        ticks = sorted(int(x) for x in a.ticks.split(","))
    else:
        rs = {r["n"]: r for r in leer_demo.rounds(d)}
        ticks = [k["tick"] for k in rs[a.round]["kills"] if k["attacker"] == a.player and not k["suicide"]]
        if not ticks:
            raise SystemExit(f"{a.player} no tiene kills en la ronda {a.round}")
    segs = segments(ticks, d.tick_interval, cfg)
    log(f"{d.header['map']}, {a.player}: kills en {ticks}, tramos {segs} (tick {d.tick_interval:.5f} s)")

    # 2. Grabar.
    os.makedirs(cfg["out_dir"], exist_ok=True)
    frames_dir = os.path.join(cfg["client_dir"], "cstrike", "cmleague", "cuadros")
    t_game = time.time()
    prefixes = record_session(cfg, a.demo, d, [{"key": "clip", "player": a.player, "segs": segs}], frames_dir)["clip"]
    times = {"juego_s": round(time.time() - t_game, 1)}

    # 3. FFmpeg.
    t_ff = time.time()
    demo_name = os.path.splitext(os.path.basename(a.demo))[0]
    name = a.name or f"{demo_name}_{a.player.split()[0]}_{ticks[0]}_{cfg['height']}p"
    mb = frames_mb(prefixes)
    out = os.path.join(cfg["out_dir"], name + ".mp4")
    encode(cfg, prefixes, segs, d.tick_interval, out)
    times["ffmpeg_s"] = round(time.time() - t_ff, 1)

    info = {
        "demo": os.path.basename(a.demo), "map": d.header["map"], "player": a.player, "kill_ticks": ticks,
        "tramos": segs, "tick_interval": d.tick_interval, "resolucion": f"{cfg['width']}x{cfg['height']}",
        "fps": cfg["fps"], "segundos_video": round(sum((t1 - t0) * d.tick_interval for t0, t1 in segs), 2),
        "mb_mp4": round(os.path.getsize(out) / 1e6, 2), "mb_cuadros": round(mb, 1),
        "tiempos": {**times, "total_s": round(time.time() - t_start, 1)},
    }
    json.dump(info, open(out[:-4] + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log(f"Listo: {out}")
    print(json.dumps(info, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        log("ERROR\n" + traceback.format_exc())
        sys.exit(1)

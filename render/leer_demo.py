"""Lee una demo de CS:S v34 (demo protocolo 3, red protocolo 7) y saca las kills y las rondas con su tick.

Uso:
  python leer_demo.py <demo.dem>                 kills por ronda
  python leer_demo.py <demo.dem> --clips         registros que serían clip (3+ kills en la ronda)
  python leer_demo.py <demo.dem> --json          todo en JSON (para render_clip.py)

Solo usa la biblioteca estándar. Decodifica la lista de eventos, los eventos y la tabla userinfo;
el resto de los mensajes de red se salta por su largo. Formato tomado del SDK episode1 de AlliedModders
(demoformat.h) y de UntitledParser (HL2 old engine, el mismo protocolo de red 7).

Hay dos ticks por cosa:
  - "tick": el del .dem, contado desde que empezó la grabación (el que usa demo_gototick).
  - "server_tick": el del servidor (net_Tick), para comparar con lo que manda el plugin.
"""
import json
import struct
import sys

# Mensajes de red del motor viejo (OeMessageList).
NET_NOP, NET_DISCONNECT, NET_FILE, NET_TICK, NET_STRINGCMD, NET_SETCONVAR, NET_SIGNONSTATE = range(7)
(SVC_PRINT, SVC_SERVERINFO, SVC_SENDTABLE, SVC_CLASSINFO, SVC_SETPAUSE, SVC_CREATESTRINGTABLE,
 SVC_UPDATESTRINGTABLE, SVC_VOICEINIT, SVC_VOICEDATA, SVC_HLTV, SVC_SOUNDS, SVC_SETVIEW, SVC_FIXANGLE,
 SVC_CROSSHAIRANGLE, SVC_BSPDECAL, SVC_TERRAINMOD, SVC_USERMESSAGE, SVC_ENTITYMESSAGE, SVC_GAMEEVENT,
 SVC_PACKETENTITIES, SVC_TEMPENTITIES, SVC_PREFETCH, SVC_MENU, SVC_GAMEEVENTLIST, SVC_GETCVARVALUE) = range(7, 32)

# Comandos del .dem.
DEM_SIGNON, DEM_PACKET, DEM_SYNCTICK, DEM_CONSOLECMD, DEM_USERCMD, DEM_DATATABLES, DEM_STOP = range(1, 8)
CMDINFO_BYTES = 76  # flags + 6 vectores de 3 floats


class Bits:
    """Lector de bits LSB primero, como el bf_read del motor."""

    def __init__(self, data, start=0, end=None):
        self.data, self.pos = data, start
        self.end = len(data) * 8 if end is None else end

    def left(self):
        return self.end - self.pos

    def read(self, n):
        if n == 0:
            return 0
        if self.pos + n > self.end:
            raise EOFError(f"se pidieron {n} bits y quedan {self.left()}")
        b = self.pos >> 3
        chunk = int.from_bytes(self.data[b:b + ((self.pos & 7) + n + 7) // 8], "little")
        self.pos += n
        return (chunk >> ((self.pos - n) & 7)) & ((1 << n) - 1)

    def skip(self, n):
        if self.pos + n > self.end:
            raise EOFError(f"se pidieron saltar {n} bits y quedan {self.left()}")
        self.pos += n

    def bit(self):
        return self.read(1) == 1

    def sint(self, n):
        v = self.read(n)
        return v - (1 << n) if v & (1 << (n - 1)) else v

    def float(self):
        return struct.unpack("<f", self.read(32).to_bytes(4, "little"))[0]

    def string(self, limit=4096):
        out = bytearray()
        while len(out) < limit:
            c = self.read(8)
            if c == 0:
                break
            out.append(c)
        return out.decode("utf-8", "replace")

    def coord(self):
        # bitcoord: entero de 14 bits y fracción de 5, con signo.
        has_int, has_frac = self.bit(), self.bit()
        if has_int or has_frac:
            self.read(1)
            if has_int:
                self.read(14)
            if has_frac:
                self.read(5)

    def vector_coord(self):
        flags = [self.bit(), self.bit(), self.bit()]
        for f in flags:
            if f:
                self.coord()


def highest_bit(v):
    return max(v.bit_length() - 1, 0)


class Demo:
    def __init__(self, path):
        self.raw = open(path, "rb").read()
        h = struct.unpack_from("<8sii260s260s260s260sfiii", self.raw, 0)
        if h[0].rstrip(b"\0") != b"HL2DEMO":
            raise SystemExit("no es una demo de Source")
        self.header = {
            "demo_protocol": h[1], "net_protocol": h[2],
            "server": h[3].split(b"\0")[0].decode("utf-8", "replace"),
            "client": h[4].split(b"\0")[0].decode("utf-8", "replace"),
            "map": h[5].split(b"\0")[0].decode("utf-8", "replace"),
            "playback_time": round(h[7], 2), "playback_ticks": h[8], "playback_frames": h[9],
        }
        if h[1] != 3 or h[2] != 7:
            print(f"aviso: protocolo {h[1]}/{h[2]}, este lector es para 3/7", file=sys.stderr)
        self.tick_interval = None
        self.event_desc = {}  # id -> (nombre, [(clave, tipo)])
        self.tables = []  # [{"name", "max", "fixed", "bits", "entries": [[nombre, datos]]}]
        self.players = {}  # userid -> {"name", "steamid", "bot"}
        self.names = {}  # steamid -> [(tick, nombre)], para saber cómo se llamaba en cada momento
        self.events = []
        self.server_tick = 0
        self.errors = []

    # ---- tablas de strings (solo importa userinfo) ----

    def table_update(self, t, br, count, tick=0):
        history, idx = [], -1
        for _ in range(count):
            idx += 1
            if not br.bit():
                idx = br.read(highest_bit(t["max"]))
            name = ""
            if br.bit():
                if br.bit():
                    h, n = br.read(5), br.read(5)
                    name = history[h][:n] + br.string()
                else:
                    name = br.string()
            data = None
            if br.bit():
                nbits = t["bits"] if t["fixed"] else br.read(12) * 8  # MAX_USERDATA_BITS es 12 en este motor
                start = br.pos
                br.skip(nbits)
                data = (start, nbits)
            if idx < len(t["entries"]):
                if name:
                    t["entries"][idx][0] = name
                if data:
                    t["entries"][idx][1] = data
            else:
                t["entries"].append([name, data])
            if t["name"] == "userinfo" and data:
                self.userinfo(br.data, data, tick)
            if len(history) == 32:
                history.pop(0)
            history.append(name)

    def safe_update(self, t, br, count, tick):
        # Una tabla que no se entiende (instancebaseline, por ejemplo) no corta el resto del paquete.
        try:
            self.table_update(t, br, count, tick)
        except (EOFError, IndexError) as e:
            self.errors.append(f"tick {tick}: tabla {t['name']}: {e}")

    def userinfo(self, buf, data, tick=0):
        start, nbits = data
        if nbits < 8 * 132:  # player_info_t
            return
        b = Bits(buf, start, start + nbits)
        raw = bytes(b.read(8) for _ in range(nbits // 8))
        name = raw[0:32].split(b"\0")[0].decode("utf-8", "replace")
        userid = struct.unpack_from("<i", raw, 32)[0]
        guid = raw[36:69].split(b"\0")[0].decode("ascii", "replace")
        fake, hltv = raw[108] != 0, raw[109] != 0
        if hltv:
            return
        sid = guid if not fake else f"BOT:{name}"
        self.players[userid] = {"name": name, "steamid": sid, "bot": fake}
        hist = self.names.setdefault(sid, [])
        if not hist or hist[-1][1] != name:
            hist.append((tick, name))

    def name_at(self, steamid, tick):
        """Cómo se llamaba el jugador con ese SteamID (STEAM_X:Y:Z o BOT:nombre) en ese tick de la demo."""
        hist = self.names.get(steamid)
        if not hist:
            return None
        name = hist[0][1]
        for t, n in hist:
            if t > tick:
                break
            name = n
        return name

    # ---- mensajes de red ----

    def messages(self, buf, tick):
        br = Bits(buf)
        while br.left() >= 5:
            t = br.read(5)
            if t == NET_NOP:
                continue
            elif t == NET_DISCONNECT or t == NET_STRINGCMD or t == SVC_PRINT:
                br.string(1 << 16)
            elif t == NET_FILE:
                br.read(32); br.string(); br.read(1)
            elif t == NET_TICK:
                self.server_tick = br.read(32)
            elif t == NET_SETCONVAR:
                for _ in range(br.read(8)):
                    br.string(); br.string()
            elif t == NET_SIGNONSTATE:
                br.read(8); br.read(32)
            elif t == SVC_SERVERINFO:
                br.read(16); br.read(32); br.read(1); br.read(1); br.read(32); br.read(16); br.read(32)
                br.read(8); br.read(8)
                self.tick_interval = br.float()
                br.read(8)
                for _ in range(4):
                    br.string()
            elif t == SVC_SENDTABLE:
                br.read(1)
                br.skip(br.read(16))
            elif t == SVC_CLASSINFO:
                n = br.read(16)
                if not br.bit():
                    for _ in range(n):
                        br.read(highest_bit(n) + 1); br.string(); br.string()
            elif t == SVC_SETPAUSE:
                br.read(1)
            elif t == SVC_CREATESTRINGTABLE:
                name = br.string()
                mx = br.read(16)
                count = br.read(highest_bit(mx) + 1)
                length = br.read(20)
                fixed = br.bit()
                size, bits = (br.read(12), br.read(4)) if fixed else (0, 0)
                tb = {"name": name, "max": mx, "fixed": fixed, "bits": bits, "entries": []}
                self.tables.append(tb)
                end = br.pos + length
                self.safe_update(tb, Bits(br.data, br.pos, end), count, tick)
                br.pos = end
            elif t == SVC_UPDATESTRINGTABLE:
                tb = self.tables[br.read(5)]
                count = br.read(16) if br.bit() else 1
                length = br.read(20)
                end = br.pos + length
                self.safe_update(tb, Bits(br.data, br.pos, end), count, tick)
                br.pos = end
            elif t == SVC_VOICEINIT:
                br.string(); br.read(8)
            elif t == SVC_VOICEDATA:
                br.read(8)  # en este motor no hay byte de proximidad
                br.skip(br.read(16))
            elif t == SVC_SOUNDS:
                reliable = br.bit()
                if not reliable:
                    br.read(8)
                br.skip(br.read(8 if reliable else 16))
            elif t == SVC_SETVIEW:
                br.read(11)
            elif t == SVC_FIXANGLE:
                br.read(1); br.read(48)
            elif t == SVC_CROSSHAIRANGLE:
                br.read(48)
            elif t == SVC_BSPDECAL:
                br.vector_coord()
                br.read(9)
                if br.bit():
                    br.read(11); br.read(11)
                br.read(1)
            elif t == SVC_USERMESSAGE:
                br.read(8)
                br.skip(br.read(11))
            elif t == SVC_ENTITYMESSAGE:
                br.read(11); br.read(9)
                br.skip(br.read(11))
            elif t == SVC_GAMEEVENT:
                length = br.read(11)
                end = br.pos + length
                self.game_event(Bits(br.data, br.pos, end), tick)
                br.pos = end
            elif t == SVC_PACKETENTITIES:
                br.read(11)
                if br.bit():
                    br.read(32)
                br.read(1); br.read(11)
                length = br.read(20)
                br.read(1)
                br.skip(length)
            elif t == SVC_TEMPENTITIES:
                br.read(8)
                br.skip(br.read(17))
            elif t == SVC_PREFETCH:
                br.read(13)
            elif t == SVC_MENU:
                br.read(16)
                br.skip(br.read(16))
            elif t == SVC_GAMEEVENTLIST:
                n = br.read(9)
                length = br.read(20)
                end = br.pos + length
                for _ in range(n):
                    eid, name, keys = br.read(9), br.string(), []
                    while (kt := br.read(3)) != 0:
                        keys.append((br.string(), kt))
                    self.event_desc[eid] = (name, keys)
                br.pos = end
            else:
                raise ValueError(f"mensaje {t} sin soporte en el tick {tick}")

    def game_event(self, br, tick):
        eid = br.read(9)
        if eid not in self.event_desc:
            return
        name, keys = self.event_desc[eid]
        if name not in ("player_death", "round_start", "round_end", "round_freeze_end", "player_team"):
            return
        ev = {"event": name, "tick": tick, "server_tick": self.server_tick, "players": None}
        for key, kt in keys:
            if kt == 1:
                ev[key] = br.string()
            elif kt == 2:
                ev[key] = round(br.float(), 3)
            elif kt == 3:
                ev[key] = br.sint(32)
            elif kt == 4:
                ev[key] = br.sint(16)
            elif kt == 5:
                ev[key] = br.read(8)
            elif kt == 6:
                ev[key] = br.bit()
            elif kt == 7:
                ev[key] = br.read(64)
        if name == "player_death":
            # Los nombres y SteamID de ese momento (un jugador puede cambiarse el nombre durante la partida).
            ev["players"] = {u: dict(player(self, u)) for u in (ev.get("attacker", 0), ev.get("userid", 0))}
        self.events.append(ev)

    # ---- archivo ----

    def parse(self):
        off, raw = 1072, self.raw
        while off < len(raw):
            cmd = raw[off]
            tick = struct.unpack_from("<i", raw, off + 1)[0]
            off += 5
            if cmd in (DEM_SIGNON, DEM_PACKET):
                off += CMDINFO_BYTES + 8
                n = struct.unpack_from("<i", raw, off)[0]
                off += 4
                try:
                    self.messages(raw[off:off + n], tick)
                except (EOFError, ValueError, IndexError) as e:
                    self.errors.append(f"tick {tick}: {e}")
                off += n
            elif cmd == DEM_SYNCTICK:
                pass
            elif cmd in (DEM_CONSOLECMD, DEM_DATATABLES):
                off += 4 + struct.unpack_from("<i", raw, off)[0]
            elif cmd == DEM_USERCMD:
                off += 8 + struct.unpack_from("<i", raw, off + 4)[0]
            elif cmd == DEM_STOP:
                break
            else:
                self.errors.append(f"comando {cmd} desconocido en el byte {off - 5}; se corta la lectura")
                break
        return self


def player(d, userid):
    p = d.players.get(userid)
    return p or {"name": f"userid {userid}", "steamid": None, "bot": False}


def rounds(d):
    """Agrupa las kills por ronda: una ronda empieza en round_start y se cuenta solo si terminó (round_end).
    La demo arranca con la primera ronda en curso (sin su round_start): esa ronda va desde el tick 0.
    Las kills entre un round_end y el round_start siguiente no cuentan, como en las stats del plugin.
    Los números de ronda incluyen las que reinicia el plugin al empezar: no son los de match_clips."""
    out, cur = [], {"start_tick": 0, "freeze_end_tick": None, "kills": [], "end": None}
    for ev in d.events:
        if ev["event"] == "round_start":
            cur = {"start_tick": ev["tick"], "freeze_end_tick": None, "kills": [], "end": None}
        elif cur is None:
            continue
        elif ev["event"] == "round_freeze_end":
            cur["freeze_end_tick"] = ev["tick"]
        elif ev["event"] == "player_death":
            snap = ev.get("players") or {}
            a = snap.get(ev.get("attacker", 0)) or player(d, ev.get("attacker", 0))
            v = snap.get(ev["userid"]) or player(d, ev["userid"])
            cur["kills"].append({
                "tick": ev["tick"], "server_tick": ev["server_tick"], "attacker": a["name"], "attacker_steamid": a["steamid"],
                "victim": v["name"], "victim_steamid": v["steamid"], "weapon": ev.get("weapon"), "headshot": ev.get("headshot"),
                "suicide": ev.get("attacker", 0) in (0, ev["userid"]),
            })
        elif ev["event"] == "round_end":
            cur["end"] = {"tick": ev["tick"], "winner": ev.get("winner"), "reason": ev.get("reason"), "message": ev.get("message")}
            out.append(cur)
            cur = None
    for i, r in enumerate(out, 1):
        r["n"] = i
    return out


def clips(rs):
    """Registros con 3+ kills de un jugador en la ronda, en el formato del plugin (sin clutch: el lector no sigue los vivos)."""
    out = []
    for r in rs:
        by = {}
        for k in r["kills"]:
            if not k["suicide"]:
                by.setdefault((k["attacker_steamid"], k["attacker"]), []).append(k)
        for (sid, name), ks in by.items():
            if len(ks) >= 3:
                out.append({"round": r["n"], "steamid": sid, "name": name, "kills": len(ks),
                            "kill_ticks": [k["tick"] for k in ks[:5]], "kill_server_ticks": [k["server_tick"] for k in ks[:5]],
                            "weapons": [k["weapon"] for k in ks]})
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    d = Demo(sys.argv[1]).parse()
    rs = rounds(d)
    tickrate = round(1 / d.tick_interval) if d.tick_interval else None
    if "--json" in sys.argv:
        json.dump({"header": d.header, "tickrate": tickrate, "players": d.players, "names": d.names, "rounds": rs,
                   "clips": clips(rs), "errors": d.errors}, sys.stdout, ensure_ascii=False, indent=1)
        return
    h = d.header
    print(f"{h['map']} | {h['server']} | {h['playback_time']} s, {h['playback_ticks']} ticks | tickrate {tickrate}")
    print(f"jugadores: {len(d.players)} | rondas terminadas: {len(rs)} | kills: {sum(len(r['kills']) for r in rs)}")
    if "--clips" in sys.argv:
        for c in clips(rs):
            print(f"  ronda {c['round']:>2}  {c['kills']}k  {c['name']:<24} ticks {c['kill_ticks']}  {', '.join(c['weapons'])}")
    else:
        for r in rs:
            e = r["end"]
            print(f"ronda {r['n']} (ticks {r['start_tick']}-{e['tick']}, gana {e['winner']}, {e['message']})")
            for k in r["kills"]:
                hs = " HS" if k["headshot"] else ""
                print(f"   {k['tick']:>7} (srv {k['server_tick']})  {k['attacker']} -> {k['victim']}  {k['weapon']}{hs}")
    for e in d.errors[:10]:
        print("error:", e, file=sys.stderr)
    if len(d.errors) > 10:
        print(f"... y {len(d.errors) - 10} errores más", file=sys.stderr)


if __name__ == "__main__":
    main()

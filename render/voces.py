"""Las voces de los jugadores para los clips grabados con el CS:S v34 normal ("client": "v34").

ClientMod manda la voz comprimida con Opus dentro de paquetes que dicen ser Speex (svc_VoiceInit declara
vaudio_speex), y la demo la guarda así: cada paquete trae uno o más cuadros de 28 bytes, cada uno un cuadro Opus de
10 ms, mono. ClientMod la reproduce bien; el v34 la decodifica como Speex y sale ruido. Por eso con el v34 la voz del
juego se apaga (voice_enable 0) y acá se decodifica de la demo con FFmpeg y se arma un .wav por tramo, en el tiempo
del video, que render_clip.ffmpeg_segment mezcla con el sonido del juego.

Bitácora: docs/bitacora/2026-11-14-render-voces-opus.
"""
import os
import struct
import subprocess
import tempfile
import wave

FRAME_BYTES = 28  # un cuadro Opus de ClientMod
SR = 48000  # Opus se decodifica a 48 kHz
FRAME_SAMPLES = 480  # 10 ms
DELAY = 0.28  # el juego reproduce la voz ~280 ms después del tick del paquete (la prueba con siege, 2026-11-14)
SPURT_GAP = 0.2  # un silencio más largo que esto empieza otra frase, ubicada otra vez por su tick
LEAD = 2.0  # segundos antes del tramo en que se toman paquetes (una frase que empezó antes)
GAIN = 0.4  # como el "volume 0.4" de cmleague_render.cfg, que en ClientMod también baja la voz


def frames_of(data):
    return [data[i:i + FRAME_BYTES] for i in range(0, len(data), FRAME_BYTES)]


def is_opus(voice):
    """Si los paquetes de voz de la demo son los cuadros Opus de ClientMod: largos múltiplos de 28 y cada cuadro con
    una cabecera Opus de un solo cuadro mono (los 3 bits bajos en 0: 0x60, 0xd0). Con Speex de verdad no pasa."""
    if not voice:
        return False
    sample = voice[:2000]
    if sum(len(data) % FRAME_BYTES == 0 for _, _, data in sample) < 0.95 * len(sample):
        return False
    heads = [f[0] for _, _, data in sample for f in frames_of(data) if f]
    return bool(heads) and sum((h & 0x07) == 0 for h in heads) >= 0.95 * len(heads)


# ---- Ogg Opus mínimo, para que FFmpeg decodifique los cuadros tal cual ----

def _crc_table():
    table = []
    for i in range(256):
        r = i << 24
        for _ in range(8):
            r = ((r << 1) ^ 0x04C11DB7) if r & 0x80000000 else (r << 1)
        table.append(r & 0xFFFFFFFF)
    return table


_CRC = _crc_table()


def _crc(data):
    r = 0
    for x in data:
        r = ((r << 8) & 0xFFFFFFFF) ^ _CRC[((r >> 24) ^ x) & 0xFF]
    return r


def _page(packets, granule, seq, flags):
    lacing = bytearray()
    for p in packets:
        lacing += bytes([255] * (len(p) // 255) + [len(p) % 255])
    head = b"OggS" + bytes([0, flags]) + struct.pack("<qIII", granule, 1, seq, 0) + bytes([len(lacing)]) + lacing
    page = head + b"".join(packets)
    return page[:22] + struct.pack("<I", _crc(page)) + page[26:]


def ogg_opus(frames):
    out = _page([b"OpusHead" + struct.pack("<BBHIhB", 1, 1, 0, SR, 0, 0)], 0, 0, 2)
    out += _page([b"OpusTags" + struct.pack("<I", 8) + b"CMLeague" + struct.pack("<I", 0)], 0, 1, 0)
    seq, granule = 2, 0
    for i in range(0, len(frames), 50):
        chunk = frames[i:i + 50]
        granule += len(chunk) * FRAME_SAMPLES
        out += _page(chunk, granule, seq, 4 if i + 50 >= len(frames) else 0)
        seq += 1
    return out


def decode(ffmpeg, frames):
    """Los cuadros Opus de un jugador a muestras de 16 bits a 48 kHz (480 por cuadro)."""
    fd, path = tempfile.mkstemp(suffix=".opus")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(ogg_opus(frames))
        r = subprocess.run([ffmpeg, "-v", "error", "-c:a", "libopus", "-i", path, "-ar", str(SR), "-ac", "1",
                            "-f", "s16le", "-"], capture_output=True)
    finally:
        os.remove(path)
    if r.returncode != 0 or len(r.stdout) < 2:
        raise RuntimeError(f"FFmpeg no decodificó la voz: {r.stderr.decode(errors='replace')[:200]}")
    pcm = struct.unpack(f"<{len(r.stdout) // 2}h", r.stdout)
    if len(pcm) != len(frames) * FRAME_SAMPLES:
        raise RuntimeError(f"FFmpeg dio {len(pcm)} muestras para {len(frames)} cuadros")
    return pcm


def track(ffmpeg, voice, tick_interval, t0, seconds, out_wav, delay=DELAY, gain=GAIN):
    """Las voces de un tramo que empieza en el tick t0 y dura `seconds` en el video, en out_wav (48 kHz, mono).

    Los cuadros de cada jugador van uno detrás de otro, cada 10 ms, como los reproduce el juego, y solo se vuelven a
    ubicar por el tick después de un silencio de más de SPURT_GAP: ubicar cada paquete en su tick hacía chasquidos
    (llegan irregulares, de 1 a 3 cuadros). Devuelve cuántos jugadores hablan (0: no escribe nada)."""
    by_client = {}
    for tick, client, data in voice:
        t = (tick - t0) * tick_interval + delay  # en el tiempo del tramo, cuando suena el último cuadro
        if -LEAD <= t <= seconds:
            by_client.setdefault(client, []).append((t, frames_of(data)))
    if not by_client:
        return 0
    n = int(round(seconds * SR))
    mix = [0.0] * n
    for packets in by_client.values():
        pcm = decode(ffmpeg, [f for _, fs in packets for f in fs])
        j, cursor, last_t = 0, None, None
        for t, fs in packets:
            first = int(t * SR) - (len(fs) - 1) * FRAME_SAMPLES
            if cursor is None or t - last_t > SPURT_GAP:
                cursor = first
            last_t = t
            for _ in fs:
                lo = max(0, -cursor)
                hi = min(FRAME_SAMPLES, n - cursor)
                for q in range(lo, hi):
                    mix[cursor + q] += pcm[j * FRAME_SAMPLES + q]
                cursor += FRAME_SAMPLES
                j += 1
    with wave.open(out_wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(struct.pack(f"<{n}h", *(max(-32768, min(32767, int(v * gain))) for v in mix)))
    return len(by_client)

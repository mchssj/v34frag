import { describe, expect, it } from "vitest"

import { checkConfig, stripSecrets, type ConfigFile } from "./check"
import { readZip, writeZip } from "./zip"

const f = (path: string, text = "", size = text.length || 10): ConfigFile => ({
  path,
  size,
  text,
})

describe("revisión de configs", () => {
  it("acepta los tipos de la carpeta cfg", () => {
    const r = checkConfig(
      [
        f("cfg/config.cfg", "bind w +forward"),
        f("cfg/buypresets_ct.vdf"),
        f("cfg/user.scr"),
        f("cfg/valve.rc"),
        f("cfg/server_blacklist.txt"),
      ],
      true
    )
    expect(r.ok).toBe(true)
    expect(r.accepted).toHaveLength(5)
  })

  it("un archivo comprimido con un .exe adentro se rechaza entero", () => {
    const r = checkConfig([f("cfg/config.cfg"), f("cfg/loader.exe")], true)
    expect(r.ok).toBe(false)
    expect(r.rejected[0]!.path).toBe("cfg/loader.exe")
  })

  it("sueltos, los prohibidos se saltean y el resto se publica", () => {
    const r = checkConfig([f("config.cfg"), f("hack.dll")], false)
    expect(r.ok).toBe(true)
    expect(r.accepted.map((x) => x.path)).toEqual(["config.cfg"])
  })

  it("encuentra contraseñas con valor y las saca", () => {
    const text =
      'name "pepon"\nrcon_password "secreta123"\npassword ""\nsv_password abc\nbind w +forward'
    const r = checkConfig([f("cfg/config.cfg", text)], true)
    expect(r.secrets.map((s) => [s.key, s.line])).toEqual([
      ["rcon_password", 2],
      ["sv_password", 4],
    ])
    expect(stripSecrets(text)).not.toMatch(/secreta123|sv_password/)
    expect(stripSecrets(text)).toMatch(/bind w \+forward/)
  })

  it("marca los scripts para moderación", () => {
    const r = checkConfig(
      [
        f("cfg/norecoil.cfg", "x"),
        f("cfg/weapon1.cfg", 'alias spam "+attack; wait; -attack; wait; spam"'),
        f("cfg/fps.cfg", "fps_max 300"),
      ],
      true
    )
    expect(r.ok).toBe(true)
    expect(r.scripts.map((s) => s.path)).toEqual([
      "cfg/norecoil.cfg",
      "cfg/weapon1.cfg",
    ])
  })

  it("no deja pasar más de 2 MB", () => {
    const r = checkConfig([f("cfg/aim.cfg", "", 3 * 1024 * 1024)], true)
    expect(r.ok).toBe(false)
  })

  it("arma y lee un .zip", async () => {
    const enc = new TextEncoder()
    const zip = writeZip([
      { path: "cfg/config.cfg", data: enc.encode("bind w +forward") },
      { path: "cfg/autoexec.cfg", data: enc.encode("rate 25000") },
    ])
    const files = await readZip(new Uint8Array(await zip.arrayBuffer()))
    expect(files.map((x) => x.path)).toEqual([
      "cfg/config.cfg",
      "cfg/autoexec.cfg",
    ])
    expect(new TextDecoder().decode(files[1]!.data)).toBe("rate 25000")
  })
})

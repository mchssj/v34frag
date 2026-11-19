import { checkConfig, type ConfigFile } from "./check"

// Configs de ejemplo para /demo/configs (docs/bitacora/2026-10-29-configs-jugadores en kyan/pruebas).

export interface PublishedConfig {
  nick: string
  uploaded_at: string
  files: ConfigFile[]
  /** Marcada para que la revise un admin (parece tener scripts). */
  flagged: string[]
}

const file = (path: string, text: string): ConfigFile => ({
  path,
  text,
  size: new TextEncoder().encode(text).length,
})

const CONFIG = `// Config de ejemplo
unbindall
bind "w" "+forward"
bind "s" "+back"
bind "a" "+moveleft"
bind "d" "+moveright"
bind "SPACE" "+jump"
bind "CTRL" "+duck"
bind "SHIFT" "+speed"
bind "MOUSE1" "+attack"
bind "MOUSE2" "+attack2"
bind "q" "lastinv"
bind "e" "+use"
bind "r" "+reload"
bind "g" "drop"
bind "b" "buymenu"
sensitivity "1.8"
m_rawinput "1"
zoom_sensitivity_ratio "1.0"
cl_crosshaircolor "5"
cl_dynamiccrosshair "0"
cl_crosshairscale "1200"
`

const AUTOEXEC = `// Rates y gráficos
rate "25000"
cl_updaterate "101"
cl_cmdrate "101"
cl_interp "0.01"
fps_max "300"
mat_queue_mode "2"
volume "0.4"
voice_scale "0.6"
echo "autoexec cargado"
`

const BUY_CT = `"BuyPresets"
{
  "Preset1" { "Primary" "m4a1" "Secondary" "deagle" "Armor" "2" }
}
`

export const DEMO_CONFIGS: PublishedConfig[] = [
  {
    nick: "kako1",
    uploaded_at: "2026-10-27",
    files: [
      file("cfg/config.cfg", CONFIG),
      file("cfg/autoexec.cfg", AUTOEXEC),
      file("cfg/buypresets_ct.vdf", BUY_CT),
      file("cfg/fps.cfg", 'fps_max "500"\nmat_picmip "2"\nr_shadows "0"\n'),
      file("cfg/user.scr", '"user.scr"\n{\n}\n'),
    ],
    flagged: [],
  },
  {
    nick: "gunk",
    uploaded_at: "2026-10-25",
    files: [
      file("cfg/config.cfg", CONFIG.replace("1.8", "2.4")),
      file("cfg/autoexec.cfg", AUTOEXEC),
      file(
        "cfg/norecoil.cfg",
        'alias +nr "+attack; cl_pitchdown 89; wait; m_pitch 0.02"\nalias -nr "-attack"\nbind MOUSE1 +nr\n'
      ),
      file(
        "cfg/weapon1.cfg",
        'alias spam "+attack; wait; -attack; wait; spam"\n'
      ),
    ],
    flagged: [],
  },
  {
    nick: "miez1",
    uploaded_at: "2026-10-29",
    files: [
      file("cfg/config.cfg", CONFIG.replace("1.8", "1.2")),
      file("cfg/valve.rc", "exec autoexec.cfg\n"),
    ],
    flagged: [],
  },
]
// Las marcas salen de la misma revisión que se hace al subir.
for (const c of DEMO_CONFIGS)
  c.flagged = checkConfig(c.files, true).scripts.map((s) => s.path)

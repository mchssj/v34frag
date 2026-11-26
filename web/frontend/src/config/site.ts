// Valores fijos: la API todavía no los expone (ver "Pedidos al backend" en la bitácora
// 2026-10-16-frontend-diseno-landing-auth). Reemplazar por datos reales cuando existan.

/** Links de la comunidad (Daniel, 2026-11-05): la tarjeta "Comunidad" de "Para ti" y la landing. */
export const COMMUNITY = {
  discordUrl: "https://discord.gg/bn5Yxsh9tc",
  steamGroupUrl: "https://steamcommunity.com/groups/clientmodleague",
}

/**
 * ClientMod, el cliente de CS:S v34 con el que se juega (guía de la primera vez, docs/bitacora/2026-11-14-guia-primera-vez).
 * Link de descarga oficial confirmado por Kyan (2026-11-14).
 */
export const CLIENTMOD = {
  downloadUrl: "https://clientmod.ru/",
}

/**
 * Launcher de escritorio (docs/bitacora/2026-11-24-launcher-escritorio). Las versiones se publican en el R2 de Daniel,
 * en descargas.cmleague.lat/launcher/: `latest.json` dice cuál es la última y dónde está su instalador (lo arma y lo sube
 * GitHub Actions). El bucket tiene que permitir el GET desde https://cmleague.lat (CORS).
 */
export const LAUNCHER = {
  /**
   * Si ya se puede bajar. Mientras sea `false`, la web no lo promociona (el link de Jugar y el "Ver el launcher" del aviso
   * de Conectar); `/launcher` igual se puede abrir y dice que todavía no está publicado.
   */
  published: false,
  latestUrl: "https://descargas.cmleague.lat/launcher/latest.json",
  /** Abre el launcher instalado (protocolo que registra el instalador). */
  openUrl: "cmleague://play",
}

/** La tarjeta del Discord en el inicio. Los números (en línea y miembros) los da la API: GET /api/v1/community/discord. */
export const DISCORD = {
  inviteUrl: COMMUNITY.discordUrl,
  channels: ["buscar-equipo", "pcw", "torneos", "soporte"],
}

/** Vigencia del link de confirmación (otp_expiry de Supabase Auth: 3600 s en la configuración local). */
export const CONFIRMATION_LINK_EXPIRY = "1 hora"

/**
 * Samples de los efectos de tema. Los de Counter-Strike: Source (Valve) están solo en local
 * (ignorados por git); hay que reemplazarlos por audio CC0 antes de producción. Si un archivo
 * no está, el efecto usa el sonido sintetizado.
 */
export const THEME_FX_SOUNDS = {
  bounce: "/sounds/grenade_hit1.wav",
  explode: "/sounds/sg_explode.wav",
}

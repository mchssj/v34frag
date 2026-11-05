// Valores fijos: la API todavía no los expone (ver "Pedidos al backend" en la bitácora
// 2026-10-16-frontend-diseno-landing-auth). Reemplazar por datos reales cuando existan.

/** Links de la comunidad (Daniel, 2026-11-05): la tarjeta "Comunidad" de "Para ti" y la landing. */
export const COMMUNITY = {
  discordUrl: "https://discord.gg/bn5Yxsh9tc",
  steamGroupUrl: "https://steamcommunity.com/groups/clientmodleague",
}

export const DISCORD = {
  inviteUrl: COMMUNITY.discordUrl,
  online: 214,
  members: 1386,
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

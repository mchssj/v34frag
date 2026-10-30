// Planes, beneficios y reglas de vencimiento del VIP (docs/bitacora/2026-10-29-hacete-vip en kyan/pruebas).
// Todo es de ejemplo y se cambia acá: los precios los decide Kyan y el medio de pago está por definir.

export interface Plan {
  id: string
  months: number
  /** Precio total en pesos argentinos. */
  price: number
  /** Porcentaje de descuento contra pagar mes a mes. */
  discount: number
  highlight?: boolean
}

/** Precio de un mes suelto. Los demás planes salen de este con su descuento. */
export const MONTH_PRICE = 3000

const plan = (
  id: string,
  months: number,
  discount: number,
  highlight = false
): Plan => ({
  id,
  months,
  discount,
  price: Math.round((MONTH_PRICE * months * (1 - discount / 100)) / 100) * 100,
  highlight,
})

export const PLANS: Plan[] = [
  plan("mensual", 1, 0),
  plan("trimestral", 3, 10, true),
  plan("semestral", 6, 15),
]

/** Días que siguen andando los beneficios después de que se vence, para que no se corte de golpe. Propuesto. */
export const GRACE_DAYS = 3

export const ars = (n: number) =>
  n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  })

export type Group = "web" | "juego" | "comunidad"
export const GROUP_LABEL: Record<Group, string> = {
  web: "En la web",
  juego: "Juego, misiones y tienda",
  comunidad: "Comunidad",
}

export interface Benefit {
  group: Group
  name: string
  /** Lo que tenés sin VIP; `false` si no lo tenés. */
  free: string | false
  vip: string
  /** Ruta del demo, para probarlo. */
  demo?: string
  /** Todavía no hay prototipo. */
  soon?: boolean
}

// Solo lo que existe o está prototipado; lo demás va como "Próximamente". No prometer lo que no hay.
export const BENEFITS: Benefit[] = [
  {
    group: "web",
    name: "Comparador de jugadores",
    free: "Hasta 2",
    vip: "Hasta 5",
    demo: "/demo/comparador",
  },
  {
    group: "web",
    name: "Buscador",
    free: "Texto y orden",
    vip: "Filtros avanzados y búsquedas guardadas",
    demo: "/demo/buscador",
  },
  {
    group: "web",
    name: "Exportá tus stats en imagen o PDF",
    free: "Vista previa",
    vip: "Descarga sin marca y estilo dorado",
    demo: "/demo/exportar",
  },
  {
    group: "web",
    name: "Widget para la bio de Twitch y Twitter",
    free: "Vista previa",
    vip: "Panel, firma y tarjeta del link",
    demo: "/demo/bio",
  },
  {
    group: "web",
    name: "Desglose de tu fórmula de ELO",
    free: "El cambio de cada mix",
    vip: "Paso por paso y simulador",
    demo: "/demo/elo",
  },
  {
    group: "web",
    name: "Vista previa del cierre de temporada",
    free: "Tu puesto y tu medalla",
    vip: "Objetivos y proyección",
    demo: "/demo/recalculo",
  },
  {
    group: "web",
    name: "Partidas favoritas",
    free: false,
    vip: "Sin límite",
    demo: "/demo/favoritas",
  },
  {
    group: "web",
    name: "Configs de los jugadores",
    free: "Subir la tuya y ver la lista",
    vip: "Ver el contenido y descargar",
    demo: "/demo/configs",
  },
  {
    group: "juego",
    name: "Misiones semanales",
    free: "6 por semana",
    vip: "3 más, que pagan monedas VIP",
    demo: "/demo/misiones",
  },
  {
    group: "juego",
    name: "Monedas VIP",
    free: false,
    vip: "En cada mix, para los cosméticos VIP",
    demo: "/demo/tienda",
  },
  {
    group: "juego",
    name: "Marco Oro VIP y medalla VIP",
    free: false,
    vip: "Incluidos",
    demo: "/demo/tienda",
  },
  {
    group: "comunidad",
    name: "Stats avanzadas post-torneo",
    free: "24 h después",
    vip: "Apenas termina la final",
    demo: "/demo/torneo-stats",
  },
  {
    group: "comunidad",
    name: "Tu nombre en los créditos",
    free: false,
    vip: "Si querés",
    demo: "/demo/creditos",
  },
  {
    group: "web",
    name: "Historial de partidas sin límite",
    free: false,
    vip: "Próximamente",
    soon: true,
  },
  {
    group: "web",
    name: "Cambio de nombre cada 12 h",
    free: "Cada 3 semanas",
    vip: "Próximamente",
    soon: true,
  },
  {
    group: "web",
    name: "URL personalizada (cmleague.lat/tuTag)",
    free: false,
    vip: "Próximamente",
    soon: true,
  },
  {
    group: "juego",
    name: "Comandos de chat exclusivos en el juego",
    free: false,
    vip: "Próximamente",
    soon: true,
  },
]

export type ExpiryStatus = "decidido" | "propuesto"

/** Qué pasa con cada beneficio cuando se vence el VIP (después de los días de gracia). */
export const ON_EXPIRY: { name: string; what: string; status: ExpiryStatus }[] =
  [
    {
      name: "Monedas VIP y cosméticos VIP",
      what: "Quedan congelados: no se pierden, vuelven si renovás",
      status: "decidido",
    },
    {
      name: "Marco Oro VIP y medalla VIP",
      what: "Dejan de mostrarse hasta que renueves",
      status: "propuesto",
    },
    {
      name: "Partidas favoritas",
      what: "Se siguen viendo, pero no se pueden marcar nuevas",
      status: "propuesto",
    },
    {
      name: "Búsquedas guardadas",
      what: "Se guardan, pero sin los filtros avanzados",
      status: "propuesto",
    },
    {
      name: "Widget de la bio",
      what: "La imagen sigue andando, con marca de agua",
      status: "propuesto",
    },
    {
      name: "Misiones VIP",
      what: "Dejan de salir. Lo completo y sin reclamar se puede reclamar hasta el lunes",
      status: "propuesto",
    },
    { name: "Comparador", what: "Vuelve a 2 jugadores", status: "propuesto" },
    {
      name: "Configs",
      what: "Tu config sigue publicada; dejás de descargar las de los demás",
      status: "propuesto",
    },
    { name: "Créditos", what: "Salís de la lista", status: "propuesto" },
  ]

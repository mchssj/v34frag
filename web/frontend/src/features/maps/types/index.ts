import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// Catálogo de mapas (contrato partidas.md y admin.md, replanteo 30). Trae también los retirados:
// una sala vieja necesita la foto de un mapa que ya no se elige. Cada mapa tiene sus versiones de
// servidor (Inferno: de_inferno y de_inferno_classic) y una sola foto para todas.

export type MapEntry = Schemas["MapItem"]

import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// Administración › Clips: reglas de las jugadas destacadas y los videos reprocesados que esperan
// el "Bien" (contrato admin.md, "Clips (admin)").

export type ClipConfig = Schemas["ClipConfigValues"]

export type ClipConfigPatch = Schemas["ClipConfigPatch"]

export type ClipReview = Schemas["ClipReview"]

export type ClipType = Schemas["Clip"]["type"]

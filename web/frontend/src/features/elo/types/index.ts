import type { Schemas } from "@/api/client"

export type EloBreakdown = Schemas["EloBreakdown"]
export type EloMix = EloBreakdown["items"][number]
export type EloSteps = NonNullable<EloMix["steps"]>
export type EloConfig = NonNullable<EloBreakdown["config"]>
export type Outcome = EloMix["result"]

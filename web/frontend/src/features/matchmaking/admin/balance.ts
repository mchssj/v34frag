/**
 * El ajuste del ELO de armado: la misma cuenta que `mm_balance_elos` (replanteo 73). El rating se corrige hacia 1,00
 * con `prior` mapas promedio y el ajuste queda entre −cap y +cap.
 */
export function balanceAdjust(
  rating: number,
  maps: number,
  cfg: { weight: number; cap: number; prior: number }
) {
  if (maps + cfg.prior === 0) return 0
  const corrected = (maps * rating + cfg.prior) / (maps + cfg.prior)
  return Math.max(
    -cfg.cap,
    Math.min(cfg.cap, Math.round(cfg.weight * (corrected - 1)))
  )
}

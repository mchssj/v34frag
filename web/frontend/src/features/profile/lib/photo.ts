/**
 * La foto que se ve de una cuenta, la misma que usa el resto de la web (`coalesce(players.photo_url,
 * avatar_url)` en la base): la de la ficha si un admin le puso una y, si no, la que subió el
 * jugador. Al subir la suya, la base borra la de la ficha (replanteo 71: gana la última).
 */
export function myPhotoUrl(
  profile:
    | {
        player?: { photo_url?: string | null } | null
        details?: { avatar_url?: string | null } | null
      }
    | null
    | undefined
): string | null {
  return profile?.player?.photo_url ?? profile?.details?.avatar_url ?? null
}

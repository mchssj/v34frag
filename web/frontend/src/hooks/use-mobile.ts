import { useMediaQuery } from "@/lib/useMediaQuery"

const MOBILE_BREAKPOINT = 768

// Reescrito sobre useMediaQuery (useSyncExternalStore): el de shadcn hacía setState en un efecto.
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
}

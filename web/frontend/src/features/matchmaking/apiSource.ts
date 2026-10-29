import { mmSocket } from "./socket"
import { createApiSource } from "./source"

/** Fuente real: la API con el socket. Una sola instancia para toda la app. */
export const apiMmSource = createApiSource(mmSocket)

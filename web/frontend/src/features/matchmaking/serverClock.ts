// Reloj del servidor para las cuentas regresivas (aceptar, veto, espera). Los plazos los fija la base, y el reloj de
// cada PC puede ir corrido: con 8 s de adelanto, un turno de veto de 15 s se veía como de 7. La API manda `server_now`
// con el estado del matchmaking y con la reserva de una partida, y acá se guarda la diferencia.

let offset = 0

/** Guarda la diferencia con el reloj del servidor. Se descuenta la mitad de lo que tardó el pedido. */
export function syncServerClock(serverNow: unknown, requestMs = 0) {
  if (typeof serverNow !== "string") return
  const t = Date.parse(serverNow)
  if (!Number.isFinite(t)) return
  offset = t + requestMs / 2 - Date.now()
}

/** La hora del servidor, en milisegundos. */
export const serverNow = () => Date.now() + offset

/** Solo para las pruebas. */
export const resetServerClock = () => {
  offset = 0
}

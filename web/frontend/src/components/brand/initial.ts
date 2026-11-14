/** Inicial de un alias o nombre, en mayúscula; "?" si está vacío. */
export const initialOf = (name: string) =>
  name.trim().charAt(0).toUpperCase() || "?"

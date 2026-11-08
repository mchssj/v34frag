/** Contraseña aleatoria para que un admin se la pase a un jugador: sin caracteres que se confunden (0/O, 1/l/I). */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomPassword(length = 16): string {
  // Se descartan los bytes que no entran justo en el alfabeto: así cada carácter es igual de probable.
  const limit = 256 - (256 % ALPHABET.length);
  let out = '';
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < limit && out.length < length) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function cifrarClave(clave) {
  const sal = randomBytes(16);
  const hash = scryptSync(clave, sal, 64);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export function verificarClave(clave, guardada) {
  const [tipo, sal, hash] = String(guardada).split('$');

  if (tipo !== 'scrypt' || !sal || !hash) return false;

  const esperado = Buffer.from(hash, 'hex');
  const calculado = scryptSync(clave, Buffer.from(sal, 'hex'), esperado.length);

  return timingSafeEqual(calculado, esperado);
}

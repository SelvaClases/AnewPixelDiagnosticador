export class ErrorApi extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

export function texto(valor, campo, { max = 255, obligatorio = true } = {}) {
  const limpio = typeof valor === 'string' ? valor.trim() : '';

  if (obligatorio && !limpio) {
    throw new ErrorApi(`Falta completar ${campo}`);
  }

  if (limpio.length > max) {
    throw new ErrorApi(`Revisa ${campo}: máximo ${max} caracteres`);
  }

  return limpio;
}

export function entero(valor, campo) {
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;

  if (!Number.isSafeInteger(numero)) {
    throw new ErrorApi(`Revisa ${campo}: debe ser un número entero`);
  }

  return numero;
}

export function identificadores(valor, campo) {
  if (!Array.isArray(valor) || !valor.length) {
    throw new ErrorApi(`Falta ${campo}`);
  }

  const ids = valor.map((item) => entero(item, campo));

  if (new Set(ids).size !== ids.length) {
    throw new ErrorApi(`Revisa ${campo}: hay elementos repetidos`);
  }

  return ids;
}

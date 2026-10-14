import { ErrorApi } from '../validaciones.js';

// Validación de estilos personalizables: listas cerradas para que a la página pública
// solo lleguen valores seguros. La lista de fuentes debe coincidir con proyecto-web/js/fuentes.js.
export const FUENTES = [
  'Poppins', 'Mulish', 'Montserrat', 'Inter', 'Lato', 'Open Sans', 'Roboto', 'Nunito',
  'Raleway', 'Playfair Display', 'Merriweather', 'Lora', 'Oswald', 'Bebas Neue', 'Pacifico', 'Dancing Script'
];

const COLOR = /^#[0-9a-f]{6}$/i;
const ALINEACIONES = ['izquierda', 'centro', 'derecha'];

export function color(valor, campo) {
  if (!COLOR.test(valor)) throw new ErrorApi(`Revisa ${campo}: el color no es válido`);
  return valor.toLowerCase();
}

export function opcion(valor, permitidas, campo) {
  if (!permitidas.includes(valor)) throw new ErrorApi(`Revisa ${campo}: la opción no es válida`);
  return valor;
}

export function enteroEntre(valor, minimo, maximo, campo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw new ErrorApi(`Revisa ${campo}: debe estar entre ${minimo} y ${maximo}`);
  }
  return numero;
}

// Fuente, tamaño, color, negrita y cursiva de un texto. Solo se guarda lo que viene definido.
export function estiloTexto(entrada, campo, { tamanoMinimo = 10, tamanoMaximo = 96 } = {}) {
  const estilo = {};

  if (!entrada || typeof entrada !== 'object') return estilo;

  if (entrada.fuente !== undefined) {
    if (!FUENTES.includes(entrada.fuente)) throw new ErrorApi(`Revisa ${campo}: la fuente no es válida`);
    estilo.fuente = entrada.fuente;
  }
  if (entrada.tamano !== undefined) estilo.tamano = enteroEntre(entrada.tamano, tamanoMinimo, tamanoMaximo, `el tamaño de ${campo}`);
  if (entrada.color !== undefined) estilo.color = color(entrada.color, campo);
  if (entrada.negrita !== undefined) estilo.negrita = Boolean(entrada.negrita);
  if (entrada.cursiva !== undefined) estilo.cursiva = Boolean(entrada.cursiva);
  if (entrada.alineacion !== undefined) {
    if (!ALINEACIONES.includes(entrada.alineacion)) throw new ErrorApi(`Revisa ${campo}: la alineación no es válida`);
    estilo.alineacion = entrada.alineacion;
  }

  return estilo;
}

// Fuentes de Google disponibles para personalizar textos. Debe coincidir con la lista del servidor
// (base-de-datos/consultas/pantallaFinal.js). `variantes` es lo que existe de cada una en Google Fonts:
// pedir un peso que no existe hace fallar la carga, por eso no es igual para todas.
const CURSIVA_Y_NEGRITA = 'ital,wght@0,400;0,700;1,400;1,700';
const SOLO_PESOS = 'wght@400;700';

export const FUENTES = [
  { nombre: 'Poppins', tipo: 'sans-serif', variantes: CURSIVA_Y_NEGRITA },
  { nombre: 'Mulish', tipo: 'sans-serif', variantes: CURSIVA_Y_NEGRITA },
  { nombre: 'Montserrat', tipo: 'sans-serif', variantes: CURSIVA_Y_NEGRITA },
  { nombre: 'Inter', tipo: 'sans-serif', variantes: SOLO_PESOS },
  { nombre: 'Lato', tipo: 'sans-serif', variantes: CURSIVA_Y_NEGRITA },
  { nombre: 'Open Sans', tipo: 'sans-serif', variantes: CURSIVA_Y_NEGRITA },
  { nombre: 'Roboto', tipo: 'sans-serif', variantes: CURSIVA_Y_NEGRITA },
  { nombre: 'Nunito', tipo: 'sans-serif', variantes: CURSIVA_Y_NEGRITA },
  { nombre: 'Raleway', tipo: 'sans-serif', variantes: CURSIVA_Y_NEGRITA },
  { nombre: 'Playfair Display', tipo: 'serif', variantes: CURSIVA_Y_NEGRITA },
  { nombre: 'Merriweather', tipo: 'serif', variantes: CURSIVA_Y_NEGRITA },
  { nombre: 'Lora', tipo: 'serif', variantes: CURSIVA_Y_NEGRITA },
  { nombre: 'Oswald', tipo: 'sans-serif', variantes: SOLO_PESOS },
  { nombre: 'Bebas Neue', tipo: 'sans-serif', variantes: '' },
  { nombre: 'Pacifico', tipo: 'cursive', variantes: '' },
  { nombre: 'Dancing Script', tipo: 'cursive', variantes: SOLO_PESOS }
];

const porNombre = new Map(FUENTES.map((fuente) => [fuente.nombre, fuente]));

export function familiaCss(nombre) {
  const fuente = porNombre.get(nombre);
  return fuente ? `'${fuente.nombre}', ${fuente.tipo}` : '';
}

// Agrega un <link> por fuente (una sola vez): si una falla, las demás siguen cargando.
export function cargarFuentes(nombres, documento = document) {
  nombres.forEach((nombre) => {
    const fuente = porNombre.get(nombre);
    const id = `fuente-${nombre.replace(/\s+/g, '-').toLowerCase()}`;

    if (!fuente || documento.getElementById(id)) return;

    const familia = nombre.replace(/\s+/g, '+') + (fuente.variantes ? `:${fuente.variantes}` : '');
    const enlace = documento.createElement('link');
    enlace.id = id;
    enlace.rel = 'stylesheet';
    enlace.href = `https://fonts.googleapis.com/css2?family=${familia}&display=swap`;
    documento.head.append(enlace);
  });
}

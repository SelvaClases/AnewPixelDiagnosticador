import { crear } from '../utilidades.js';
import { FUENTES } from '../fuentes.js';
import { entrada, boton } from './interfaz.js';

// Controles de diseño compartidos (Agradecimientos, Redes sociales…).
// Todos guardan solo lo que se cambió: lo que no se toca vuelve al diseño original de la página.

export function segmentado(opciones, valorInicial, alCambiar) {
  const contenedor = crear('div', 'segmentado');
  let valor = valorInicial;

  const botones = opciones.map((opcion) => {
    const elemento = crear('button', '', opcion.texto, { type: 'button', title: opcion.titulo || opcion.texto });
    elemento.addEventListener('click', () => marcar(opcion.valor, true));
    contenedor.append(elemento);
    return { elemento, valor: opcion.valor };
  });

  function marcar(nuevo, avisar = false) {
    valor = nuevo;
    botones.forEach((item) => item.elemento.classList.toggle('activa', item.valor === valor));
    if (avisar && alCambiar) alCambiar(valor);
  }

  marcar(valorInicial);
  return { elemento: contenedor, leer: () => valor, marcar };
}

// Selector de color con estado "original": mientras no se toca, no guarda nada.
export function controlColor(titulo, valorInicial, original) {
  const envoltura = crear('label', 'control-color', undefined, { title: titulo });
  const selector = crear('input', '', undefined, { type: 'color', 'aria-label': titulo });
  let valor = valorInicial;

  function pintar() {
    selector.value = valor || original;
    envoltura.classList.toggle('sin-definir', !valor);
  }

  selector.addEventListener('input', () => {
    valor = selector.value;
    envoltura.classList.remove('sin-definir');
  });

  envoltura.append(selector, crear('span', 'control-color-texto', titulo));
  pintar();

  return {
    elemento: envoltura,
    leer: () => valor,
    restablecer() {
      valor = undefined;
      pintar();
    }
  };
}

// Número con − / +. Vacío = valor original (se muestra como sugerencia; − / + parten de `porDefecto`).
export function controlNumero({ valor, porDefecto, sugerencia, minimo, maximo, paso = 2, unidad = 'px', titulo }) {
  const contenedor = crear('div', 'control-tamano', undefined, { title: titulo });
  const numero = entrada('number', valor ?? '', {
    min: minimo,
    max: maximo,
    placeholder: String(sugerencia ?? porDefecto),
    'aria-label': titulo
  });
  let actual = valor;

  const cambiar = (delta) => {
    const base = Number(numero.value) || porDefecto;
    actual = Math.min(maximo, Math.max(minimo, base + delta));
    numero.value = actual;
  };
  const menos = boton('−', 'boton-secundario boton-mini', () => cambiar(-paso));
  const mas = boton('+', 'boton-secundario boton-mini', () => cambiar(paso));
  menos.setAttribute('aria-label', `${titulo}: menos`);
  mas.setAttribute('aria-label', `${titulo}: más`);

  numero.addEventListener('input', () => {
    const leido = Number(numero.value);
    actual = numero.value && Number.isInteger(leido) && leido >= minimo && leido <= maximo ? leido : undefined;
  });

  contenedor.append(menos, numero, crear('span', 'secundario', unidad), mas);

  return {
    elemento: contenedor,
    leer: () => actual,
    restablecer() {
      actual = undefined;
      numero.value = '';
    }
  };
}

/**
 * Barra de formato tipo editor: fuente, tamaño, color, negrita, cursiva (+ fondo y forma si `conBoton`).
 * `original` describe cómo se ve sin personalizar: { tamano, color, negrita, cursiva, fondo?, forma? }.
 */
export function barraEstilo(
  original,
  inicial = {},
  { conBoton = false, conAlineacion = false, tamanoMinimo = 10, tamanoMaximo = 96 } = {}
) {
  const estilo = { ...inicial };
  const barra = crear('div', 'barra-estilo');

  delete estilo.color;
  delete estilo.fondo;
  delete estilo.tamano;

  const fuente = crear('select', 'entrada entrada-chica', undefined, { 'aria-label': 'Fuente', title: 'Fuente' });
  fuente.append(new Option('Fuente original', ''));
  FUENTES.forEach(({ nombre }) => fuente.append(new Option(nombre, nombre)));
  fuente.value = estilo.fuente || '';
  fuente.addEventListener('change', () => {
    if (fuente.value) estilo.fuente = fuente.value;
    else delete estilo.fuente;
  });

  const tamano = controlNumero({
    valor: inicial.tamano,
    porDefecto: original.tamano,
    minimo: tamanoMinimo,
    maximo: tamanoMaximo,
    titulo: 'Tamaño del texto (en escritorio)'
  });
  const color = controlColor('Color del texto', inicial.color, original.color);

  function alternador(texto, clase, propiedad, titulo) {
    const elemento = boton(texto, `boton-secundario boton-mini ${clase}`, () => {
      const activo = estilo[propiedad] ?? original[propiedad];
      estilo[propiedad] = !activo;
      pintarAlternador();
    });
    const pintarAlternador = () =>
      elemento.setAttribute('aria-pressed', String(Boolean(estilo[propiedad] ?? original[propiedad])));
    elemento.title = titulo;
    pintarAlternador();
    return { elemento, pintar: pintarAlternador };
  }

  const negrita = alternador('B', 'alternador-negrita', 'negrita', 'Negrita');
  const cursiva = alternador('I', 'alternador-cursiva', 'cursiva', 'Cursiva');

  barra.append(fuente, tamano.elemento, color.elemento, negrita.elemento, cursiva.elemento);

  // Sin elegir ninguna, el texto queda alineado como en el diseño original.
  let alineacion = null;

  if (conAlineacion) {
    alineacion = segmentado(
      [
        { valor: 'izquierda', texto: 'Izquierda', titulo: 'Alinear a la izquierda' },
        { valor: 'centro', texto: 'Centro', titulo: 'Centrar' },
        { valor: 'derecha', texto: 'Derecha', titulo: 'Alinear a la derecha' }
      ],
      estilo.alineacion,
      (valor) => {
        estilo.alineacion = valor;
      }
    );
    barra.append(alineacion.elemento);
  }

  let fondo = null;
  let forma = null;

  if (conBoton) {
    fondo = controlColor('Color de fondo', inicial.fondo, original.fondo);
    forma = segmentado(
      [
        { valor: 'pildora', texto: 'Píldora', titulo: 'Bordes totalmente redondos' },
        { valor: 'redondeado', texto: 'Redondeado', titulo: 'Esquinas redondeadas' },
        { valor: 'recto', texto: 'Recto', titulo: 'Esquinas rectas' }
      ],
      estilo.forma || original.forma,
      (valor) => {
        estilo.forma = valor;
      }
    );
    barra.append(fondo.elemento, forma.elemento);
  }

  const restablecer = () => {
    Object.keys(estilo).forEach((clave) => delete estilo[clave]);
    fuente.value = '';
    tamano.restablecer();
    color.restablecer();
    negrita.pintar();
    cursiva.pintar();
    if (fondo) fondo.restablecer();
    if (forma) forma.marcar(original.forma);
    if (alineacion) alineacion.marcar(undefined);
  };

  const botonRestablecer = boton('↺', 'boton-secundario boton-mini', restablecer);
  botonRestablecer.title = 'Volver al estilo original';
  botonRestablecer.setAttribute('aria-label', 'Volver al estilo original');
  barra.append(botonRestablecer);

  return {
    elemento: barra,
    restablecer,
    leer() {
      const resultado = { ...estilo };
      if (tamano.leer()) resultado.tamano = tamano.leer();
      if (color.leer()) resultado.color = color.leer();
      if (fondo && fondo.leer()) resultado.fondo = fondo.leer();
      return resultado;
    }
  };
}

import { crear } from '../utilidades.js';

// Gráficas de barras en SVG, sin librerías. Marcas finas con esquina redondeada apoyada en la base,
// 2px de separación entre segmentos apilados, cuadrícula discreta y tooltip al pasar el mouse.

const SVG = 'http://www.w3.org/2000/svg';
const MARGEN = { arriba: 12, derecha: 8, abajo: 26, izquierda: 34 };
const RADIO = 4;
const SEPARACION = 2;

function nodo(etiqueta, atributos = {}) {
  const elemento = document.createElementNS(SVG, etiqueta);
  Object.entries(atributos).forEach(([nombre, valor]) => elemento.setAttribute(nombre, valor));
  return elemento;
}

// Paso "redondo" (1, 2, 5, 10…) para que el eje tenga 3–5 marcas.
function escalaEje(maximo) {
  if (maximo <= 0) return { tope: 1, paso: 1 };
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 5, 10].map((m) => m * potencia).find((m) => m >= bruto);
  const pasoEntero = Math.max(1, paso);
  return { tope: Math.ceil(maximo / pasoEntero) * pasoEntero, paso: pasoEntero };
}

// Rectángulo con las dos esquinas del extremo de datos redondeadas (arriba en verticales, derecha en horizontales).
function barraRedondeada(x, y, ancho, alto, extremo = 'arriba') {
  const r = Math.min(RADIO, ancho / 2, alto);
  if (alto <= 0 || ancho <= 0) return '';
  if (extremo === 'derecha') {
    return `M${x},${y} h${ancho - r} a${r},${r} 0 0 1 ${r},${r} v${alto - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${ancho - r} z`;
  }
  return `M${x},${y + alto} v-${alto - r} a${r},${r} 0 0 1 ${r},-${r} h${ancho - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${alto - r} z`;
}

function crearTooltip(contenedor) {
  const tooltip = crear('div', 'grafica-tooltip', undefined, { role: 'status' });
  tooltip.hidden = true;
  contenedor.append(tooltip);

  return {
    mostrar(titulo, filas, x, y) {
      tooltip.replaceChildren(crear('strong', '', titulo));
      filas.forEach(({ nombre, valor, color }) => {
        const fila = crear('div', 'grafica-tooltip-fila');
        const muestra = crear('span', 'grafica-muestra');
        muestra.style.background = color;
        fila.append(muestra, crear('span', '', nombre), crear('b', '', String(valor)));
        tooltip.append(fila);
      });
      tooltip.hidden = false;
      const ancho = contenedor.clientWidth;
      const izquierda = Math.min(Math.max(8, x - tooltip.offsetWidth / 2), ancho - tooltip.offsetWidth - 8);
      tooltip.style.left = `${izquierda}px`;
      tooltip.style.top = `${Math.max(0, y - tooltip.offsetHeight - 10)}px`;
    },
    ocultar() {
      tooltip.hidden = true;
    }
  };
}

function leyenda(series) {
  const contenedor = crear('div', 'grafica-leyenda');
  series.forEach(({ nombre, color }) => {
    const item = crear('span', 'grafica-leyenda-item');
    const muestra = crear('span', 'grafica-muestra');
    muestra.style.background = color;
    item.append(muestra, nombre);
    contenedor.append(item);
  });
  return contenedor;
}

// Se redibuja al cambiar el ancho del contenedor.
function alRedimensionar(lienzo, dibujar) {
  let anchoPrevio = 0;
  const observador = new ResizeObserver(() => {
    const ancho = Math.round(lienzo.clientWidth);
    if (ancho && ancho !== anchoPrevio) {
      anchoPrevio = ancho;
      dibujar(ancho);
    }
  });
  observador.observe(lienzo);
}

/**
 * Barras verticales (apiladas si hay más de una serie).
 * categorias: [{ etiqueta, titulo }]; series: [{ nombre, color, valores: [] }]
 * mostrarEtiqueta(indice, total): si se escribe la etiqueta bajo esa barra.
 */
export function graficaBarras({ categorias, series, alto = 220, mostrarEtiqueta = () => true, descripcion = '' }) {
  const tarjeta = crear('div', 'grafica');
  const lienzo = crear('div', 'grafica-lienzo');
  const tooltip = crearTooltip(lienzo);

  if (series.length > 1) tarjeta.append(leyenda(series));
  tarjeta.append(lienzo);

  const totales = categorias.map((_, i) => series.reduce((suma, serie) => suma + serie.valores[i], 0));
  const { tope, paso } = escalaEje(Math.max(...totales, 0));

  function dibujar(ancho) {
    const svg = nodo('svg', { width: ancho, height: alto, role: 'img', 'aria-label': descripcion });
    const areaAncho = ancho - MARGEN.izquierda - MARGEN.derecha;
    const areaAlto = alto - MARGEN.arriba - MARGEN.abajo;
    const banda = areaAncho / categorias.length;
    const anchoBarra = Math.max(2, Math.min(28, banda * 0.62));
    const escalaY = (valor) => (valor / tope) * areaAlto;
    const base = MARGEN.arriba + areaAlto;

    for (let marca = 0; marca <= tope; marca += paso) {
      const y = base - escalaY(marca);
      svg.append(
        nodo('line', { x1: MARGEN.izquierda, x2: ancho - MARGEN.derecha, y1: y, y2: y, class: marca === 0 ? 'grafica-base' : 'grafica-cuadricula' })
      );
      const texto = nodo('text', { x: MARGEN.izquierda - 8, y: y + 4, class: 'grafica-eje', 'text-anchor': 'end' });
      texto.textContent = marca;
      svg.append(texto);
    }

    categorias.forEach((categoria, i) => {
      const centro = MARGEN.izquierda + banda * i + banda / 2;
      const x = centro - anchoBarra / 2;
      const grupo = nodo('g', { class: 'grafica-columna' });
      let acumulado = 0;
      const visibles = series.filter((serie) => serie.valores[i] > 0);

      visibles.forEach((serie, posicion) => {
        const valor = serie.valores[i];
        const esUltimo = posicion === visibles.length - 1;
        const yInferior = base - escalaY(acumulado);
        const altoSegmento = escalaY(valor) - (posicion > 0 ? SEPARACION : 0);
        const yArriba = yInferior - escalaY(valor);
        acumulado += valor;

        const d = esUltimo
          ? barraRedondeada(x, yArriba, anchoBarra, altoSegmento)
          : `M${x},${yArriba} h${anchoBarra} v${altoSegmento} h-${anchoBarra} z`;
        if (d) grupo.append(nodo('path', { d, fill: serie.color }));
      });

      if (mostrarEtiqueta(i, categorias.length)) {
        const etiqueta = nodo('text', { x: centro, y: alto - 8, class: 'grafica-eje', 'text-anchor': 'middle' });
        etiqueta.textContent = categoria.etiqueta;
        svg.append(etiqueta);
      }

      // Zona sensible: toda la columna, más grande que la barra.
      const zona = nodo('rect', { x: MARGEN.izquierda + banda * i, y: MARGEN.arriba, width: banda, height: areaAlto, class: 'grafica-zona' });
      zona.addEventListener('pointerenter', () => {
        svg.classList.add('con-foco');
        grupo.classList.add('activa');
        tooltip.mostrar(
          categoria.titulo || categoria.etiqueta,
          series.map((serie) => ({ nombre: serie.nombre, valor: serie.valores[i], color: serie.color })),
          centro,
          base - escalaY(totales[i])
        );
      });
      zona.addEventListener('pointerleave', () => {
        svg.classList.remove('con-foco');
        grupo.classList.remove('activa');
        tooltip.ocultar();
      });

      svg.append(grupo, zona);
    });

    lienzo.querySelector('svg')?.remove();
    lienzo.prepend(svg);
  }

  alRedimensionar(lienzo, dibujar);
  return tarjeta;
}

/**
 * Barras horizontales de una serie, con el valor escrito al final de cada barra.
 * filas: [{ etiqueta, valor }]
 */
export function graficaHorizontal({ filas, color, nombre, descripcion = '' }) {
  const tarjeta = crear('div', 'grafica');
  const lienzo = crear('div', 'grafica-lienzo');
  const tooltip = crearTooltip(lienzo);
  const altoFila = 34;
  const anchoEtiquetas = 118;
  const total = filas.reduce((suma, fila) => suma + fila.valor, 0);
  const maximo = Math.max(...filas.map((fila) => fila.valor), 1);

  tarjeta.append(lienzo);

  function dibujar(ancho) {
    const alto = filas.length * altoFila + 8;
    const svg = nodo('svg', { width: ancho, height: alto, role: 'img', 'aria-label': descripcion });
    const areaAncho = ancho - anchoEtiquetas - 48;

    filas.forEach((fila, i) => {
      const y = 4 + i * altoFila;
      const largo = (fila.valor / maximo) * areaAncho;
      const grupo = nodo('g', { class: 'grafica-columna' });
      const etiqueta = nodo('text', { x: anchoEtiquetas - 10, y: y + altoFila / 2 + 4, class: 'grafica-eje grafica-eje-fuerte', 'text-anchor': 'end' });
      const valor = nodo('text', { x: anchoEtiquetas + largo + 8, y: y + altoFila / 2 + 4, class: 'grafica-valor' });

      etiqueta.textContent = fila.etiqueta;
      valor.textContent = fila.valor;
      grupo.append(nodo('path', { d: barraRedondeada(anchoEtiquetas, y + 8, largo, altoFila - 16, 'derecha'), fill: color }));

      const zona = nodo('rect', { x: 0, y, width: ancho, height: altoFila, class: 'grafica-zona' });
      zona.addEventListener('pointerenter', () => {
        svg.classList.add('con-foco');
        grupo.classList.add('activa');
        const porcentaje = total ? Math.round((fila.valor / total) * 100) : 0;
        tooltip.mostrar(fila.etiqueta, [{ nombre: `${nombre} (${porcentaje}%)`, valor: fila.valor, color }], anchoEtiquetas + largo / 2, y + 6);
      });
      zona.addEventListener('pointerleave', () => {
        svg.classList.remove('con-foco');
        grupo.classList.remove('activa');
        tooltip.ocultar();
      });

      svg.append(nodo('line', { x1: anchoEtiquetas, x2: anchoEtiquetas, y1: y + 4, y2: y + altoFila - 4, class: 'grafica-base' }), grupo, etiqueta, valor, zona);
    });

    lienzo.querySelector('svg')?.remove();
    lienzo.prepend(svg);
  }

  alRedimensionar(lienzo, dibujar);
  return tarjeta;
}

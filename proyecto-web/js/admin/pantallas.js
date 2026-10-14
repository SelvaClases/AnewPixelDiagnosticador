import { crear } from '../utilidades.js';
import * as orden from './orden.js';
import * as niveles from './niveles.js';
import * as agradecimientos from './pantallaFinal.js';
import * as redes from './redes.js';
import { crearVistaPrevia } from './vistaPrevia.js';

// Todo lo que arma las pantallas del cliente, en el orden en que las recorre.
const PAGINAS = [
  { clave: 'orden', nombre: 'Orden del formulario', vista: orden },
  { clave: 'niveles', nombre: 'Niveles del resultado', vista: niveles, vistaPrevia: true },
  { clave: 'agradecimientos', nombre: 'Agradecimientos', vista: agradecimientos, vistaPrevia: true },
  { clave: 'redes', nombre: 'Redes sociales', vista: redes, vistaPrevia: true }
];

let vistaPreviaActual = null;

export async function montar(contenedor) {
  const navegacion = crear('nav', 'subpestanas', undefined, { 'aria-label': 'Pantallas' });
  const cuerpo = crear('div', 'pantallas-cuerpo');
  const botones = new Map();

  async function abrir(clave) {
    const pagina = PAGINAS.find((item) => item.clave === clave);

    botones.forEach((boton, claveBoton) => {
      const activo = claveBoton === clave;
      boton.classList.toggle('activa', activo);
      boton.setAttribute('aria-current', activo ? 'page' : 'false');
    });

    if (vistaPreviaActual) vistaPreviaActual.destruir();
    vistaPreviaActual = null;

    const panel = crear('div', 'pantallas-formulario');
    cuerpo.className = 'pantallas-cuerpo';
    cuerpo.replaceChildren(panel);

    if (pagina.vistaPrevia) {
      vistaPreviaActual = crearVistaPrevia(cuerpo);
      cuerpo.classList.add('con-vista-previa');
      cuerpo.append(vistaPreviaActual.elemento);
    }

    contenedor.parentElement.scrollTop = 0;

    try {
      await pagina.vista.montar(panel, { vistaPrevia: vistaPreviaActual });
    } catch (error) {
      panel.replaceChildren(crear('p', 'error-panel', error.message));
    }
  }

  PAGINAS.forEach((pagina, indice) => {
    const boton = crear('button', '', undefined, { type: 'button' });
    boton.append(crear('span', 'subpestana-numero', String(indice + 1)), pagina.nombre);
    boton.addEventListener('click', () => abrir(pagina.clave));
    botones.set(pagina.clave, boton);
    navegacion.append(boton);
  });

  contenedor.replaceChildren(navegacion, cuerpo);
  await abrir(PAGINAS[0].clave);
}

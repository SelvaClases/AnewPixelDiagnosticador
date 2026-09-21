import { obtenerEstructura, ordenarAreas, ordenarPreguntas } from '../consultas.js';
import { TIPOS_PREGUNTA } from '../diagnostico.js';
import { crear, plural } from '../utilidades.js';
import { boton, ejecutar } from './interfaz.js';

let raiz;

export async function montar(contenedor) {
  raiz = contenedor;
  await pintar();
}

async function pintar() {
  const estructura = await obtenerEstructura();
  const numeros = new Map();
  let contador = 0;

  estructura.forEach((area) => {
    area.preguntas.forEach((pregunta) => {
      if (pregunta.activa) numeros.set(pregunta.id, ++contador);
    });
  });

  const barra = crear('div', 'barra');
  const titulos = crear('div');
  const lista = crear('div', 'lista-orden');

  titulos.append(
    crear('h2', '', 'Orden del formulario'),
    crear(
      'p',
      'ayuda',
      'Arrastra las áreas y las preguntas, o usa las flechas. El cliente las verá en este orden y los cambios se guardan al instante.'
    )
  );
  barra.append(
    titulos,
    crear(
      'span',
      'chip',
      `${plural(contador, 'pregunta visible', 'preguntas visibles')} en ${plural(estructura.length, 'área', 'áreas')}`
    )
  );

  estructura.forEach((area, indice) => lista.append(itemArea(area, indice, estructura, numeros)));
  hacerOrdenable(lista, '.orden-area', (ids) => guardar(() => ordenarAreas(ids)));

  raiz.replaceChildren(barra, estructura.length ? lista : crear('p', 'vacio', 'Aún no hay áreas.'));
}

async function guardar(operacion) {
  await ejecutar(operacion, 'Orden guardado');
  await pintar();
}

function flechas(ids, indice, guardarOrden) {
  const contenedor = crear('div', 'acciones');
  const subir = boton('↑', 'boton-secundario boton-cuadrado', () => mover(ids, indice, -1, guardarOrden));
  const bajar = boton('↓', 'boton-secundario boton-cuadrado', () => mover(ids, indice, 1, guardarOrden));

  subir.disabled = indice === 0;
  bajar.disabled = indice === ids.length - 1;
  subir.setAttribute('aria-label', 'Subir');
  bajar.setAttribute('aria-label', 'Bajar');
  contenedor.append(subir, bajar);
  return contenedor;
}

function mover(ids, indice, delta, guardarOrden) {
  const nuevo = [...ids];
  [nuevo[indice], nuevo[indice + delta]] = [nuevo[indice + delta], nuevo[indice]];
  return guardar(() => guardarOrden(nuevo));
}

function itemArea(area, indice, estructura, numeros) {
  const item = crear('section', 'orden-area', undefined, { draggable: 'true', 'data-id': area.id });
  const cabecera = crear('div', 'orden-cabecera');
  const lista = crear('div', 'lista-orden lista-preguntas');
  const visibles = area.preguntas.filter((pregunta) => pregunta.activa).length;
  const idsPreguntas = area.preguntas.map((pregunta) => pregunta.id);

  cabecera.append(
    crear('span', 'asa', '⠿', { 'aria-hidden': 'true' }),
    crear('h3', 'orden-titulo', area.nombre),
    crear('span', 'chip', plural(visibles, 'visible', 'visibles')),
    flechas(
      estructura.map((otra) => otra.id),
      indice,
      ordenarAreas
    )
  );

  area.preguntas.forEach((pregunta, posicion) => {
    lista.append(itemPregunta(pregunta, posicion, idsPreguntas, area.id, numeros));
  });

  if (!area.preguntas.length) {
    lista.append(crear('p', 'vacio', 'Esta área no tiene preguntas.'));
  }

  hacerOrdenable(lista, '.orden-pregunta', (ids) => guardar(() => ordenarPreguntas(area.id, ids)));
  item.append(cabecera, lista);
  return item;
}

function itemPregunta(pregunta, posicion, ids, areaId, numeros) {
  const item = crear('div', pregunta.activa ? 'orden-pregunta' : 'orden-pregunta inactiva', undefined, {
    draggable: 'true',
    'data-id': pregunta.id
  });

  item.append(
    crear('span', 'asa', '⠿', { 'aria-hidden': 'true' }),
    crear('span', 'numero', pregunta.activa ? String(numeros.get(pregunta.id)) : '–'),
    crear('p', 'pregunta-texto', pregunta.pregunta),
    crear('span', `chip tipo-${pregunta.tipo}`, TIPOS_PREGUNTA[pregunta.tipo].nombre),
    flechas(ids, posicion, (nuevo) => ordenarPreguntas(areaId, nuevo))
  );

  if (!pregunta.activa) item.append(crear('span', 'chip chip-alerta', 'Oculta'));
  return item;
}

function hacerOrdenable(lista, selector, alTerminar) {
  const hijos = () => [...lista.children].filter((hijo) => hijo.matches(selector));
  let arrastrado = null;
  let inicial = '';

  lista.addEventListener('dragstart', (evento) => {
    const item = evento.target;

    if (!(item instanceof Element) || !item.matches(selector) || item.parentElement !== lista) return;

    arrastrado = item;
    inicial = hijos()
      .map((hijo) => hijo.dataset.id)
      .join();
    item.classList.add('arrastrando');
    evento.dataTransfer.effectAllowed = 'move';
    evento.dataTransfer.setData('text/plain', item.dataset.id);
  });

  lista.addEventListener('dragover', (evento) => {
    if (!arrastrado) return;

    evento.preventDefault();
    const objetivo = evento.target instanceof Element ? evento.target.closest(selector) : null;

    if (!objetivo || objetivo === arrastrado || objetivo.parentElement !== lista) return;

    const caja = objetivo.getBoundingClientRect();
    const despues = evento.clientY > caja.top + caja.height / 2;
    lista.insertBefore(arrastrado, despues ? objetivo.nextSibling : objetivo);
  });

  lista.addEventListener('dragend', () => {
    if (!arrastrado) return;

    const ids = hijos().map((hijo) => Number(hijo.dataset.id));
    arrastrado.classList.remove('arrastrando');
    arrastrado = null;

    if (ids.join() !== inicial) alTerminar(ids);
  });
}

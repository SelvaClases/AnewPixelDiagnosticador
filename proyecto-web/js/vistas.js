import { crear } from './utilidades.js';

const pantallas = ['inicio', 'cuestionario', 'contacto', 'resultado'];

const $ = (id) => document.getElementById(id);

const tieneRespuesta = (respuesta) =>
  respuesta.alternativas.length > 0 || respuesta.texto.trim() !== '';

function pintarTitulo(elemento, texto) {
  const corte = texto.indexOf('¿');

  if (corte > 0) {
    elemento.replaceChildren(
      crear('span', 'ligero', texto.slice(0, corte).trim()),
      ' ',
      crear('strong', '', texto.slice(corte))
    );
    return;
  }

  elemento.replaceChildren(crear('strong', '', texto));
}

let cacheProgreso = null;

function activarPropulsion(cohete) {
  cohete.addEventListener('transitionrun', (evento) => {
    if (evento.propertyName === 'left') cohete.classList.add('impulsando');
  });

  cohete.addEventListener('transitionend', (evento) => {
    if (evento.propertyName === 'left') cohete.classList.remove('impulsando');
  });

  cohete.addEventListener('transitioncancel', (evento) => {
    if (evento.propertyName === 'left') cohete.classList.remove('impulsando');
  });
}

function pintarProgreso(areas, indice) {
  const contenedor = $('progreso');
  const plantilla = $('plantilla-cohete');

  if (!cacheProgreso || cacheProgreso.areas !== areas) {
    const segmentos = areas.map(() => {
      const segmento = crear('div', 'segmento');
      const relleno = crear('div', 'relleno');
      segmento.append(relleno);
      return { segmento, relleno };
    });

    const cohete = crear('span', 'cohete');
    cohete.append(plantilla.content.cloneNode(true));
    activarPropulsion(cohete);

    cacheProgreso = { areas, segmentos, cohete };
    contenedor.replaceChildren(...segmentos.map(({ segmento }) => segmento), cohete);
  }

  let acumuladas = 0;
  let segmentoActivo = null;
  let fraccionActiva = 1;

  cacheProgreso.segmentos.forEach((estado, indiceArea) => {
    const total = areas[indiceArea].preguntas.length;
    const hechas = Math.min(Math.max(indice - acumuladas, 0), total);
    const fraccion = hechas / total;

    estado.relleno.style.width = `${fraccion * 100}%`;

    if (indice >= acumuladas && indice < acumuladas + total) {
      segmentoActivo = estado.segmento;
      fraccionActiva = fraccion;
    }

    acumuladas += total;
  });

  if (!segmentoActivo) {
    segmentoActivo = cacheProgreso.segmentos[cacheProgreso.segmentos.length - 1].segmento;
  }

  const posicion = segmentoActivo.offsetLeft + segmentoActivo.offsetWidth * fraccionActiva;
  cacheProgreso.cohete.style.left = `${posicion}px`;
}

export function completarProgreso(areas, total, alTerminar) {
  pintarProgreso(areas, total);

  const cohete = cacheProgreso && cacheProgreso.cohete;

  if (!cohete) {
    alTerminar();
    return;
  }

  let terminado = false;

  const finalizar = () => {
    if (terminado) return;
    terminado = true;
    cohete.removeEventListener('transitionend', alFinDeTransicion);
    alTerminar();
  };

  const alFinDeTransicion = (evento) => {
    if (evento.propertyName === 'left') finalizar();
  };

  cohete.addEventListener('transitionend', alFinDeTransicion);
  setTimeout(finalizar, 600);
}

function pintarUnica(pregunta, previa, alSeleccionar) {
  const seleccionada = previa.alternativas[0];

  const botones = pregunta.alternativas.map((alternativa) => {
    const boton = crear('button', 'alternativa', alternativa.alternativa, { type: 'button' });
    boton.classList.toggle('activa', alternativa.id === seleccionada);

    boton.addEventListener('click', () => {
      botones.forEach((item) => {
        item.disabled = true;
        item.classList.toggle('activa', item === boton);
      });
      alSeleccionar({ alternativas: [alternativa.id], texto: '' });
    });

    return boton;
  });

  $('alternativas').replaceChildren(...botones);
}

function pintarMultiple(pregunta, previa, alCambiar) {
  const marcadas = new Set(previa.alternativas);

  const filas = pregunta.alternativas.map((alternativa) => {
    const fila = crear('label', 'alternativa alternativa-casilla');
    const casilla = crear('input', '', undefined, { type: 'checkbox' });

    casilla.checked = marcadas.has(alternativa.id);
    fila.classList.toggle('activa', casilla.checked);

    casilla.addEventListener('change', () => {
      if (casilla.checked) marcadas.add(alternativa.id);
      else marcadas.delete(alternativa.id);

      fila.classList.toggle('activa', casilla.checked);
      alCambiar({ alternativas: [...marcadas], texto: '' });
    });

    fila.append(casilla, crear('span', 'marca'), crear('span', '', alternativa.alternativa));
    return fila;
  });

  $('alternativas').replaceChildren(...filas);
}

function pintarAbierta(previa, alCambiar) {
  const campo = crear('textarea', 'respuesta-abierta', undefined, {
    rows: 6,
    maxlength: 1000,
    placeholder: 'Escribe tu respuesta aquí',
    'aria-label': 'Tu respuesta'
  });

  campo.value = previa.texto;
  campo.addEventListener('input', () => alCambiar({ alternativas: [], texto: campo.value }));
  $('alternativas').replaceChildren(campo);
}

export function mostrarPantalla(nombre) {
  pantallas.forEach((id) => {
    $(id).hidden = id !== nombre;
  });
  window.scrollTo(0, 0);
}

export function mostrarError(id, mensaje) {
  const error = $(id);
  error.textContent = mensaje;
  error.hidden = !mensaje;
}

export function pintarPregunta({ pregunta, indice, total, areas, previa }, { alSeleccionar, alContinuar }) {
  const continuar = $('continuar');
  let actual = previa;

  const cambiar = (respuesta) => {
    actual = respuesta;
    continuar.disabled = pregunta.obligatoria && !tieneRespuesta(respuesta);
  };

  $('actual').textContent = indice + 1;
  $('total').textContent = total;
  pintarProgreso(areas, indice);
  pintarTitulo($('pregunta'), pregunta.pregunta);

  continuar.parentElement.hidden = pregunta.tipo === 'unica';
  continuar.classList.toggle('continuar-multiple', pregunta.tipo === 'multiple');
  continuar.onclick = () => alContinuar(actual);

  if (pregunta.tipo === 'unica') pintarUnica(pregunta, previa, alSeleccionar);
  else if (pregunta.tipo === 'multiple') pintarMultiple(pregunta, previa, cambiar);
  else pintarAbierta(previa, cambiar);

  cambiar(previa);
}

export function pintarResultado(resultados) {
  const proporcion = (resultado) => (resultado.maximo ? resultado.input / resultado.maximo : 0);
  const mayor = Math.max(...resultados.map(proporcion));
  const aprovechado = resultados.every((resultado) => resultado.input <= 1);
  const prioritarias = resultados.filter((resultado) => proporcion(resultado) === mayor);
  const empate = prioritarias.length === resultados.length;
  const titulo = $('titulo-resultado');

  if (aprovechado) {
    titulo.replaceChildren(crear('strong', '', 'Tu negocio está aprovechando todo su potencial'));
  } else if (empate) {
    titulo.replaceChildren(
      crear('span', 'ligero', 'Tienes oportunidades de crecimiento en'),
      ' ',
      crear('strong', '', 'todas tus áreas')
    );
  } else {
    const nombres = new Intl.ListFormat('es', { type: 'conjunction' }).format(
      prioritarias.map((resultado) => resultado.area)
    );
    titulo.replaceChildren(
      crear('span', 'ligero', 'Tu próxima oportunidad de crecimiento está en'),
      ' ',
      crear('strong', '', nombres)
    );
  }

  $('areas').replaceChildren(
    ...resultados.map((resultado) => {
      const tarjeta = crear('article', 'area');
      const cabecera = crear('div', 'area-cabecera');
      const niveles = crear('div', 'niveles');
      const nivel = resultado.maximo
        ? `Oportunidad nivel ${resultado.input} de ${resultado.maximo}`
        : 'Sin niveles configurados';

      cabecera.append(crear('h3', 'area-nombre', resultado.area), crear('span', 'area-nivel', nivel));

      for (let paso = 1; paso <= resultado.maximo; paso++) {
        niveles.append(crear('span', paso <= resultado.input ? 'nivel lleno' : 'nivel'));
      }

      tarjeta.append(cabecera, niveles);

      if (!aprovechado && !empate && prioritarias.includes(resultado)) {
        tarjeta.classList.add('prioridad');
        tarjeta.append(crear('span', 'area-etiqueta', 'Mayor oportunidad'));
      }

      return tarjeta;
    })
  );
}

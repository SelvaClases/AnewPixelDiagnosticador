import {
  obtenerEstructura,
  crearArea,
  actualizarArea,
  eliminarArea,
  crearPregunta,
  actualizarPregunta,
  eliminarPregunta,
  crearInput,
  actualizarInput,
  eliminarInput
} from '../consultas.js';
import { TIPOS_PREGUNTA, rangoPosible, rangoPosibleDeArea, huecosDeCobertura } from '../diagnostico.js';
import { crear, plural } from '../utilidades.js';
import { abrirModal, avisar, boton, campo, confirmar, ejecutar, entrada, formularioModal } from './interfaz.js';

const SCORES_INICIALES = [40, 30, 20, 10];
const abiertas = new Set();
const inputsAbiertos = new Set();
let raiz;

export async function montar(contenedor) {
  raiz = contenedor;
  await pintar();
}

async function pintar() {
  const estructura = await obtenerEstructura();
  const barra = crear('div', 'barra');
  const titulos = crear('div');

  titulos.append(
    crear('h2', '', 'Áreas y preguntas'),
    crear('p', 'ayuda', 'Abre un área para ver sus preguntas, alternativas, scores e inputs.')
  );
  barra.append(titulos, boton('+ Nueva área', 'boton-primario', () => formularioArea()));

  raiz.replaceChildren(
    barra,
    ...(estructura.length
      ? estructura.map((area) => tarjetaArea(area, estructura))
      : [crear('p', 'vacio', 'Aún no hay áreas. Crea la primera para empezar.')])
  );
}

function tarjetaArea(area, estructura) {
  const abierta = abiertas.has(area.id);
  const tarjeta = crear('article', abierta ? 'area-admin abierta' : 'area-admin');
  const cabecera = crear('div', 'area-cabecera');
  const alternar = crear('button', 'area-alternar', undefined, {
    type: 'button',
    'aria-expanded': String(abierta)
  });
  const acciones = crear('div', 'acciones');
  const rango = rangoPosibleDeArea(area.preguntas);
  const cuerpo = crear('div', 'area-cuerpo');

  alternar.append(
    crear('span', 'chevron', '▸'),
    crear('span', 'area-titulo', area.nombre),
    crear('span', 'chip', plural(area.preguntas.length, 'pregunta', 'preguntas')),
    crear('span', 'chip', `Puntaje posible ${rango.minimo} – ${rango.maximo}`)
  );

  alternar.addEventListener('click', () => {
    const ahoraAbierta = tarjeta.classList.toggle('abierta');
    alternar.setAttribute('aria-expanded', String(ahoraAbierta));
    if (ahoraAbierta) abiertas.add(area.id);
    else abiertas.delete(area.id);
  });

  acciones.append(
    boton('Renombrar', 'boton-secundario boton-chico', () => formularioArea(area)),
    boton('Eliminar', 'boton-peligro boton-chico', () => borrarArea(area))
  );

  cuerpo.append(seccionInputs(area, rango), seccionPreguntas(area, estructura));
  cabecera.append(alternar, acciones);
  tarjeta.append(cabecera, cuerpo);
  return tarjeta;
}

function seccionPreguntas(area, estructura) {
  const seccion = crear('section', 'seccion');
  const cabecera = crear('div', 'seccion-cabecera');

  cabecera.append(
    crear('h4', '', 'Preguntas'),
    boton('+ Nueva pregunta', 'boton-primario boton-chico', () =>
      formularioPregunta(estructura, { areaId: area.id })
    )
  );
  seccion.append(cabecera);

  if (!area.preguntas.length) {
    seccion.append(crear('p', 'vacio', 'Esta área todavía no tiene preguntas.'));
  }

  area.preguntas.forEach((pregunta, indice) => {
    seccion.append(tarjetaPregunta(pregunta, indice + 1, estructura));
  });

  return seccion;
}

function tarjetaPregunta(pregunta, numero, estructura) {
  const tarjeta = crear('div', pregunta.activa ? 'pregunta-admin' : 'pregunta-admin inactiva');
  const encabezado = crear('div', 'pregunta-encabezado');
  const acciones = crear('div', 'acciones');
  const etiquetas = crear('div', 'etiquetas');

  acciones.append(
    boton('Editar', 'boton-secundario boton-chico', () => formularioPregunta(estructura, { pregunta })),
    boton(pregunta.activa ? 'Ocultar' : 'Mostrar', 'boton-secundario boton-chico', () =>
      alternarVisibilidad(pregunta)
    ),
    boton('Eliminar', 'boton-peligro boton-chico', () => borrarPregunta(pregunta))
  );

  encabezado.append(
    crear('span', 'numero', String(numero)),
    crear('p', 'pregunta-texto', pregunta.pregunta),
    acciones
  );

  etiquetas.append(crear('span', `chip tipo-${pregunta.tipo}`, TIPOS_PREGUNTA[pregunta.tipo].nombre));
  if (pregunta.tipo !== 'unica' && pregunta.obligatoria) etiquetas.append(crear('span', 'chip', 'Obligatoria'));
  if (!pregunta.activa) etiquetas.append(crear('span', 'chip chip-alerta', 'Oculta en el formulario'));

  tarjeta.append(encabezado, etiquetas);

  if (pregunta.tipo === 'abierta') {
    tarjeta.append(
      crear('p', 'nota', 'El cliente escribe su respuesta. No suma puntaje y queda guardada en el historial.')
    );
    return tarjeta;
  }

  const lista = crear('ul', 'alternativas-admin');
  pregunta.alternativas.forEach((alternativa) => {
    const fila = crear('li');
    fila.append(
      crear('span', pregunta.tipo === 'multiple' ? 'casilla-vista' : 'punto-vista'),
      crear('span', 'alternativa-texto', alternativa.alternativa),
      crear('span', 'score', `${alternativa.score} pts`)
    );
    lista.append(fila);
  });
  tarjeta.append(lista);

  if (pregunta.tipo === 'multiple') {
    const ponderacion = crear('div', 'nota');
    const resumen = [...pregunta.ponderaciones]
      .sort((a, b) => a.minimo - b.minimo)
      .map((rango) => `${rango.minimo}–${rango.maximo} → ${rango.valor} pts`)
      .join(' · ');

    ponderacion.append(
      crear('strong', '', 'Ponderación: '),
      document.createTextNode(resumen || 'sin rangos definidos')
    );
    tarjeta.append(ponderacion);
  }

  return tarjeta;
}

function sumaMaximaCasillas(alternativas) {
  return alternativas.reduce((total, item) => {
    const valor = Number(item.score);
    return valor > 0 ? total + valor : total;
  }, 0);
}

function seccionInputs(area, rango) {
  const abierto = inputsAbiertos.has(area.id);
  const seccion = crear('section', abierto ? 'panel-inputs abierto' : 'panel-inputs');
  const cabecera = crear('div', 'inputs-cabecera');
  const alternar = crear('button', 'inputs-alternar', undefined, {
    type: 'button',
    'aria-expanded': String(abierto)
  });
  const accion = boton(abierto ? 'Ocultar' : 'Ver inputs', 'boton-secundario boton-chico');
  const cuerpo = crear('div', 'inputs-cuerpo');
  const huecos = rango.maximo > 0 ? huecosDeCobertura(area.inputs, rango.minimo, rango.maximo) : [];

  alternar.append(
    crear('span', 'chevron', '▸'),
    crear('span', 'inputs-titulo', 'Inputs (rangos de puntaje)'),
    crear('span', 'chip', plural(area.inputs.length, 'rango', 'rangos'))
  );
  if (huecos.length) alternar.append(crear('span', 'chip chip-alerta', 'Con huecos'));

  const cambiar = (valor) => {
    seccion.classList.toggle('abierto', valor);
    alternar.setAttribute('aria-expanded', String(valor));
    accion.textContent = valor ? 'Ocultar' : 'Ver inputs';
    if (valor) inputsAbiertos.add(area.id);
    else inputsAbiertos.delete(area.id);
  };

  alternar.addEventListener('click', () => cambiar(!seccion.classList.contains('abierto')));
  accion.addEventListener('click', () => cambiar(!seccion.classList.contains('abierto')));

  const barra = crear('div', 'inputs-barra');
  barra.append(
    crear(
      'p',
      'ayuda',
      `Con las preguntas visibles, el puntaje de esta área puede ir de ${rango.minimo} a ${rango.maximo}. El input es el nivel que se asigna según el puntaje obtenido.`
    ),
    boton('+ Nuevo rango', 'boton-primario boton-chico', () => formularioInput(area, rango))
  );
  cuerpo.append(barra);

  if (area.inputs.length) {
    const tabla = crear('table', 'tabla');
    const encabezado = crear('thead');
    const filas = crear('tbody');

    encabezado.append(filaEncabezado(['Desde', 'Hasta', 'Input', '']));
    tabla.append(encabezado, filas);

    [...area.inputs]
      .sort((a, b) => a.minimo - b.minimo)
      .forEach((input) => {
        const fila = crear('tr');
        const acciones = crear('td', 'acciones-tabla');

        acciones.append(
          boton('Editar', 'boton-secundario boton-chico', () => formularioInput(area, rango, input)),
          boton('Eliminar', 'boton-peligro boton-chico', () => borrarInput(input))
        );
        fila.append(
          crear('td', '', String(input.minimo)),
          crear('td', '', String(input.maximo)),
          celdaInput(input.input),
          acciones
        );
        filas.append(fila);
      });

    const envoltura = crear('div', 'tabla-envoltura');
    envoltura.append(tabla);
    cuerpo.append(envoltura);
  } else {
    cuerpo.append(crear('p', 'vacio', 'Sin rangos. Agrega los inputs de esta área.'));
  }

  if (rango.maximo > 0) {
    const cobertura = huecos.length
      ? `Sin input para: ${huecos.map(([a, b]) => (a === b ? a : `${a} – ${b}`)).join(', ')}`
      : 'Los rangos cubren todo el puntaje posible';

    cuerpo.append(crear('p', huecos.length ? 'cobertura alerta' : 'cobertura', cobertura));
  }

  const pie = crear('div', 'inputs-pie');
  pie.append(
    boton('¿Cómo se calcula?', 'boton-secundario boton-chico', () => explicarCalculo(area, rango)),
    boton('Cerrar', 'boton-secundario boton-chico', () => cambiar(false))
  );
  cuerpo.append(pie);

  cabecera.append(alternar, accion);
  seccion.append(cabecera, cuerpo);
  return seccion;
}

function filaExplicacion(etiqueta, pts) {
  const fila = crear('li', 'explicacion-fila');
  fila.append(crear('span', '', etiqueta), crear('span', 'explicacion-pts', pts));
  return fila;
}

function listaAlternativas(alternativas) {
  const lista = crear('ul', 'explicacion-lista');
  alternativas.forEach((alternativa) => {
    lista.append(filaExplicacion(alternativa.alternativa || '(sin texto)', `${alternativa.score} pts`));
  });
  return lista;
}

function listaPonderaciones(ponderaciones) {
  const lista = crear('ul', 'explicacion-lista explicacion-lista-ponderacion');
  [...ponderaciones]
    .sort((a, b) => a.minimo - b.minimo)
    .forEach((rango) => {
      lista.append(filaExplicacion(`${rango.minimo}–${rango.maximo}`, `${rango.valor} pts`));
    });
  return lista;
}

function filaRango(rangoPregunta) {
  const fila = crear('div', 'explicacion-rango');
  fila.append(
    crear('span', 'explicacion-minimo', `Mínimo posible: ${rangoPregunta.minimo}`),
    crear('span', 'explicacion-maximo', `Máximo posible: ${rangoPregunta.maximo}`)
  );
  return fila;
}

function explicarCalculo(area, rango) {
  const cuerpo = crear('div', 'explicacion-calculo');

  cuerpo.append(
    crear('p', 'ayuda', `Así se calcula el puntaje del área "${area.nombre}", paso a paso.`)
  );

  const pasoUno = crear('div', 'explicacion-paso');
  pasoUno.append(crear('h4', '', 'Paso 1 · Lo que aporta cada pregunta'));

  if (!area.preguntas.length) {
    pasoUno.append(crear('p', 'vacio', 'Esta área todavía no tiene preguntas.'));
  }

  area.preguntas.forEach((pregunta, indice) => {
    const bloque = crear('div', 'explicacion-pregunta');
    const encabezado = crear('div', 'explicacion-encabezado');

    encabezado.append(
      crear('span', 'numero', String(indice + 1)),
      crear('p', 'explicacion-titulo', pregunta.pregunta),
      crear('span', `chip tipo-${pregunta.tipo}`, TIPOS_PREGUNTA[pregunta.tipo].nombre)
    );
    bloque.append(encabezado);

    if (pregunta.tipo === 'unica') {
      bloque.append(
        crear('p', 'explicacion-descripcion', 'Se suma el score de la alternativa que el cliente elige.'),
        listaAlternativas(pregunta.alternativas),
        filaRango(rangoPosible(pregunta))
      );
    } else if (pregunta.tipo === 'multiple') {
      bloque.append(
        crear(
          'p',
          'explicacion-descripcion',
          'Se suman los scores de todas las casillas que el cliente marca.'
        ),
        listaAlternativas(pregunta.alternativas)
      );

      if (pregunta.ponderaciones.length) {
        bloque.append(
          crear('p', 'explicacion-descripcion', 'Esa suma se traduce con esta ponderación antes de sumarse al área:'),
          listaPonderaciones(pregunta.ponderaciones)
        );
      } else {
        bloque.append(crear('p', 'nota-explicacion', 'Sin ponderación definida: la suma se usa tal cual.'));
      }

      bloque.append(filaRango(rangoPosible(pregunta)));
    } else {
      bloque.append(
        crear('p', 'explicacion-descripcion', 'No suma puntaje: solo queda guardada en el historial.')
      );
    }

    pasoUno.append(bloque);
  });

  const pasoDos = crear('div', 'explicacion-paso');
  pasoDos.append(
    crear('h4', '', 'Paso 2 · El nivel final'),
    crear(
      'p',
      'explicacion-descripcion',
      `Se suma lo que aportó cada pregunta de arriba (el total del área puede ir de ${rango.minimo} a ${rango.maximo}). Ese total se busca en la tabla de Inputs para asignar el nivel que ve el cliente en su diagnóstico.`
    )
  );

  cuerpo.append(pasoUno, pasoDos);
  abrirModal({ titulo: `Cómo se calcula: ${area.nombre}`, cuerpo, ancho: 660 });
}

function filaEncabezado(titulos) {
  const fila = crear('tr');
  titulos.forEach((titulo) => fila.append(crear('th', '', titulo)));
  return fila;
}

function celdaInput(valor) {
  const celda = crear('td');
  celda.append(crear('span', 'pastilla', String(valor)));
  return celda;
}

function formularioArea(area) {
  const nombre = entrada('text', area ? area.nombre : '', { maxlength: 80, required: '' });

  formularioModal({
    titulo: area ? 'Renombrar área' : 'Nueva área',
    ancho: 480,
    cuerpo: campo('Nombre del área', nombre),
    alGuardar: async () => {
      const guardada = area ? await actualizarArea(area.id, nombre.value) : await crearArea(nombre.value);
      abiertas.add(guardada.id);
      await pintar();
      avisar(area ? 'Área actualizada' : 'Área creada');
    }
  });
  nombre.focus();
}

async function borrarArea(area) {
  const detalle = plural(area.preguntas.length, 'pregunta', 'preguntas');
  const mensaje = `¿Eliminar el área "${area.nombre}"? También se borrarán sus ${detalle} y sus inputs. El historial ya guardado no cambia.`;

  if (!(await confirmar(mensaje))) return;

  await ejecutar(() => eliminarArea(area.id), 'Área eliminada');
  abiertas.delete(area.id);
  await pintar();
}

async function alternarVisibilidad(pregunta) {
  await ejecutar(
    () => actualizarPregunta(pregunta.id, { ...pregunta, activa: !pregunta.activa }),
    pregunta.activa ? 'Pregunta oculta del formulario' : 'Pregunta visible en el formulario'
  );
  await pintar();
}

async function borrarPregunta(pregunta) {
  const mensaje = `¿Eliminar la pregunta "${pregunta.pregunta}" con todas sus alternativas? El historial ya guardado no cambia.`;

  if (!(await confirmar(mensaje))) return;

  await ejecutar(() => eliminarPregunta(pregunta.id), 'Pregunta eliminada');
  await pintar();
}

async function borrarInput(input) {
  if (!(await confirmar(`¿Eliminar el rango ${input.minimo} – ${input.maximo}?`))) return;

  await ejecutar(() => eliminarInput(input.id), 'Rango eliminado');
  await pintar();
}

function formularioInput(area, rango, input) {
  const sugerido = area.inputs.length ? Math.max(...area.inputs.map((item) => item.maximo)) + 1 : rango.minimo;
  const minimo = entrada('number', input ? input.minimo : sugerido, { step: 1, required: '' });
  const maximo = entrada('number', input ? input.maximo : '', { step: 1, required: '' });
  const valor = entrada('number', input ? input.input : area.inputs.length + 1, { step: 1, required: '' });
  const rejilla = crear('div', 'rejilla');
  const cuerpo = crear('div', 'campos');

  rejilla.append(campo('Desde (puntaje)', minimo), campo('Hasta (puntaje)', maximo));
  cuerpo.append(
    crear('p', 'ayuda', `Área: ${area.nombre}. Puntaje posible: ${rango.minimo} – ${rango.maximo}.`),
    rejilla,
    campo('Input asignado', valor, 'Es el nivel que obtiene el cliente cuando su puntaje cae en este rango.')
  );

  formularioModal({
    titulo: input ? 'Editar rango' : 'Nuevo rango',
    ancho: 520,
    cuerpo,
    alGuardar: async () => {
      const datos = { area_id: area.id, minimo: minimo.value, maximo: maximo.value, input: valor.value };

      if (input) await actualizarInput(input.id, datos);
      else await crearInput(datos);

      await pintar();
      avisar(input ? 'Rango actualizado' : 'Rango agregado');
    }
  });
}

function formularioPregunta(estructura, { pregunta, areaId }) {
  const editando = Boolean(pregunta);
  const estado = {
    tipo: editando ? pregunta.tipo : 'unica',
    alternativas: editando
      ? pregunta.alternativas.map(({ alternativa, score }) => ({ alternativa, score }))
      : SCORES_INICIALES.map((score) => ({ alternativa: '', score })),
    ponderaciones:
      editando && pregunta.tipo === 'multiple'
        ? pregunta.ponderaciones.map(({ minimo, maximo, valor }) => ({ minimo, maximo, valor }))
        : []
  };

  const selectorArea = crear('select', 'entrada');
  estructura.forEach((area) => {
    const opcion = crear('option', '', area.nombre);
    opcion.value = area.id;
    selectorArea.append(opcion);
  });
  selectorArea.value = editando ? pregunta.area_id : areaId;

  const texto = crear('textarea', 'entrada', undefined, { rows: 3, maxlength: 500, required: '' });
  texto.value = editando ? pregunta.pregunta : '';

  const opcionesTipo = crear('div', 'tipos');
  Object.entries(TIPOS_PREGUNTA).forEach(([clave, info]) => {
    const etiqueta = crear('label', 'tipo-opcion');
    const radio = crear('input', '', undefined, { type: 'radio', name: 'tipo', value: clave });

    radio.checked = estado.tipo === clave;
    radio.addEventListener('change', () => {
      estado.tipo = clave;
      actualizarTipo();
    });
    etiqueta.append(radio, crear('strong', '', info.nombre), crear('small', '', info.detalle));
    opcionesTipo.append(etiqueta);
  });

  const obligatoria = crear('input', '', undefined, { type: 'checkbox' });
  obligatoria.checked = editando ? pregunta.obligatoria : true;
  const activa = crear('input', '', undefined, { type: 'checkbox' });
  activa.checked = editando ? pregunta.activa : true;

  const filaObligatoria = casilla('Respuesta obligatoria', obligatoria);
  const filaActiva = casilla('Visible en el formulario', activa);
  const opciones = crear('div', 'casillas');
  opciones.append(filaObligatoria, filaActiva);

  const bloque = crear('div', 'campo');
  const tituloBloque = crear('span', 'campo-etiqueta');
  const ayudaBloque = crear('small', 'campo-ayuda');
  const filas = crear('div', 'filas-alternativas');
  const encabezados = crear('div', 'fila-alternativa fila-encabezado');
  const agregar = boton('+ Añadir alternativa', 'boton-secundario boton-chico', () => {
    estado.alternativas.push({ alternativa: '', score: 0 });
    pintarFilas();
    filas.querySelector('.fila-alternativa:last-child input').focus();
  });

  encabezados.append(crear('span', '', 'Texto'), crear('span', '', 'Score'));
  bloque.append(tituloBloque, ayudaBloque, encabezados, filas, agregar);

  const bloquePonderacion = crear('div', 'campo');
  const ayudaPonderacion = crear('small', 'campo-ayuda');
  const filasPonderacion = crear('div', 'filas-alternativas');
  const encabezadosPonderacion = crear('div', 'fila-ponderacion fila-encabezado');
  const agregarPonderacion = boton('+ Añadir rango', 'boton-secundario boton-chico', () => {
    agregarRangoPonderacion();
    filasPonderacion.querySelector('.fila-ponderacion:last-child input').focus();
  });

  encabezadosPonderacion.append(
    crear('span', '', 'Desde (suma)'),
    crear('span', '', 'Hasta (suma)'),
    crear('span', '', 'Valor')
  );
  bloquePonderacion.append(
    crear('span', 'campo-etiqueta', 'Ponderación de la suma (obligatoria)'),
    ayudaPonderacion,
    encabezadosPonderacion,
    filasPonderacion,
    agregarPonderacion
  );

  function agregarRangoPonderacion() {
    const tope = sumaMaximaCasillas(estado.alternativas);
    const sugerido = estado.ponderaciones.length
      ? Math.min(Math.max(...estado.ponderaciones.map((item) => item.maximo)) + 1, tope)
      : 0;

    estado.ponderaciones.push({ minimo: sugerido, maximo: tope, valor: tope });
    pintarFilasPonderacion();
  }

  function pintarFilasPonderacion() {
    filasPonderacion.replaceChildren(
      ...estado.ponderaciones.map((item, indice) => {
        const fila = crear('div', 'fila-ponderacion');
        const minimo = entrada('number', item.minimo, {
          step: 1,
          'aria-label': `Inicio del rango ${indice + 1} de ponderación`
        });
        const maximo = entrada('number', item.maximo, {
          step: 1,
          'aria-label': `Fin del rango ${indice + 1} de ponderación`
        });
        const valor = entrada('number', item.valor, {
          step: 1,
          'aria-label': `Valor del rango ${indice + 1} de ponderación`
        });
        const quitar = boton('×', 'boton-peligro boton-cuadrado', () => {
          estado.ponderaciones.splice(indice, 1);
          pintarFilasPonderacion();
        });

        minimo.addEventListener('input', () => {
          item.minimo = minimo.value;
        });
        maximo.addEventListener('input', () => {
          const tope = sumaMaximaCasillas(estado.alternativas);
          if (Number(maximo.value) > tope) maximo.value = tope;
          item.maximo = maximo.value;
        });
        valor.addEventListener('input', () => {
          item.valor = valor.value;
        });
        [minimo, maximo, valor].forEach((control) => {
          control.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter') evento.preventDefault();
          });
        });

        quitar.setAttribute('aria-label', 'Quitar rango');
        fila.append(minimo, maximo, valor, quitar);
        return fila;
      })
    );
  }

  function pintarFilas() {
    const ultima = estado.alternativas.length - 1;

    filas.replaceChildren(
      ...estado.alternativas.map((item, indice) => {
        const fila = crear('div', 'fila-alternativa');
        const textoAlternativa = entrada('text', item.alternativa, {
          maxlength: 200,
          placeholder: `Alternativa ${indice + 1}`,
          'aria-label': `Texto de la alternativa ${indice + 1}`
        });
        const score = entrada('number', item.score, {
          step: 1,
          'aria-label': `Score de la alternativa ${indice + 1}`
        });
        const subir = boton('↑', 'boton-secundario boton-cuadrado', () => mover(indice, -1));
        const bajar = boton('↓', 'boton-secundario boton-cuadrado', () => mover(indice, 1));
        const quitar = boton('×', 'boton-peligro boton-cuadrado', () => {
          estado.alternativas.splice(indice, 1);
          pintarFilas();
        });

        textoAlternativa.addEventListener('input', () => {
          item.alternativa = textoAlternativa.value;
        });
        score.addEventListener('input', () => {
          item.score = score.value;
          if (estado.tipo === 'multiple') actualizarAyudaPonderacion();
        });
        [textoAlternativa, score].forEach((control) => {
          control.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter') evento.preventDefault();
          });
        });

        subir.disabled = indice === 0;
        bajar.disabled = indice === ultima;
        subir.setAttribute('aria-label', 'Subir alternativa');
        bajar.setAttribute('aria-label', 'Bajar alternativa');
        quitar.setAttribute('aria-label', 'Quitar alternativa');

        fila.append(textoAlternativa, score, subir, bajar, quitar);
        return fila;
      })
    );
  }

  function mover(indice, delta) {
    const destino = indice + delta;
    [estado.alternativas[indice], estado.alternativas[destino]] = [
      estado.alternativas[destino],
      estado.alternativas[indice]
    ];
    pintarFilas();
  }

  function actualizarAyudaPonderacion() {
    const tope = sumaMaximaCasillas(estado.alternativas);
    ayudaPonderacion.textContent = `La suma de las casillas marcadas va de 0 a ${tope}. Define a qué valor se traduce cada tramo de esa suma antes de sumarse al área. Es obligatorio definir al menos un rango.`;
  }

  function actualizarTipo() {
    const abierta = estado.tipo === 'abierta';
    const multiple = estado.tipo === 'multiple';

    bloque.hidden = abierta;
    bloquePonderacion.hidden = !multiple;
    filaObligatoria.hidden = estado.tipo === 'unica';
    tituloBloque.textContent = multiple ? 'Opciones (casillas) y su score' : 'Alternativas y su score';
    ayudaBloque.textContent = multiple
      ? 'El cliente puede marcar varias. El score de cada casilla marcada se suma, y esa suma se traduce según la ponderación de abajo.'
      : 'El cliente elige una. El score de la elegida se suma al puntaje del área.';

    if (!abierta && !estado.alternativas.length) {
      estado.alternativas = SCORES_INICIALES.map((score) => ({ alternativa: '', score }));
    }

    if (multiple) {
      actualizarAyudaPonderacion();
      if (!estado.ponderaciones.length) {
        const tope = sumaMaximaCasillas(estado.alternativas);
        estado.ponderaciones = [{ minimo: 0, maximo: tope, valor: tope }];
      }
      pintarFilasPonderacion();
    }

    pintarFilas();
    opcionesTipo.querySelectorAll('.tipo-opcion').forEach((opcion) => {
      opcion.classList.toggle('activa', opcion.querySelector('input').checked);
    });
  }

  const cuerpo = crear('div', 'campos');
  const grupoTipo = crear('div', 'campo');
  grupoTipo.append(crear('span', 'campo-etiqueta', 'Tipo de pregunta'), opcionesTipo);
  cuerpo.append(
    campo('Área', selectorArea),
    grupoTipo,
    campo('Pregunta', texto, 'Tip: el texto antes del signo ¿ se muestra en letra ligera y el resto en negrita.'),
    opciones,
    bloque,
    bloquePonderacion
  );

  actualizarTipo();

  formularioModal({
    titulo: editando ? 'Editar pregunta' : 'Nueva pregunta',
    ancho: 760,
    cuerpo,
    alGuardar: async () => {
      const datos = {
        area_id: Number(selectorArea.value),
        pregunta: texto.value,
        tipo: estado.tipo,
        obligatoria: obligatoria.checked,
        activa: activa.checked,
        alternativas: estado.tipo === 'abierta' ? [] : estado.alternativas,
        ponderaciones: estado.tipo === 'multiple' ? estado.ponderaciones : []
      };
      const guardada = editando ? await actualizarPregunta(pregunta.id, datos) : await crearPregunta(datos);

      abiertas.add(guardada.area_id);
      await pintar();
      avisar(editando ? 'Pregunta actualizada' : 'Pregunta creada');
    }
  });
}

function casilla(etiqueta, control) {
  const contenedor = crear('label', 'casilla');
  contenedor.append(control, crear('span', '', etiqueta));
  return contenedor;
}

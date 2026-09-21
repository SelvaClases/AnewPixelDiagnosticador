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
import { TIPOS_PREGUNTA, rangoPosibleDeArea, huecosDeCobertura } from '../diagnostico.js';
import { crear, plural } from '../utilidades.js';
import { avisar, boton, campo, confirmar, ejecutar, entrada, formularioModal } from './interfaz.js';

const SCORES_INICIALES = [50, 35, 20, 5];
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

  return tarjeta;
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
  pie.append(boton('Cerrar', 'boton-secundario boton-chico', () => cambiar(false)));
  cuerpo.append(pie);

  cabecera.append(alternar, accion);
  seccion.append(cabecera, cuerpo);
  return seccion;
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
      : SCORES_INICIALES.map((score) => ({ alternativa: '', score }))
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

  function actualizarTipo() {
    const abierta = estado.tipo === 'abierta';

    bloque.hidden = abierta;
    filaObligatoria.hidden = estado.tipo === 'unica';
    tituloBloque.textContent =
      estado.tipo === 'multiple' ? 'Opciones (casillas) y su ponderación' : 'Alternativas y su score';
    ayudaBloque.textContent =
      estado.tipo === 'multiple'
        ? 'El cliente puede marcar varias. El score de cada casilla marcada se suma al puntaje del área.'
        : 'El cliente elige una. El score de la elegida se suma al puntaje del área.';

    if (!abierta && !estado.alternativas.length) {
      estado.alternativas = SCORES_INICIALES.map((score) => ({ alternativa: '', score }));
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
    bloque
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
        alternativas: estado.tipo === 'abierta' ? [] : estado.alternativas
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

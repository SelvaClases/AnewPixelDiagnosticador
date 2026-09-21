import {
  listarDiagnosticos,
  obtenerDiagnostico,
  crearDiagnostico,
  actualizarDiagnostico,
  eliminarDiagnostico,
  obtenerEstructura
} from '../consultas.js';
import { TIPOS_PREGUNTA } from '../diagnostico.js';
import { crear, formatearFecha, plural } from '../utilidades.js';
import { avisar, boton, campo, confirmar, ejecutar, entrada, formularioModal } from './interfaz.js';

let contenedorTabla;
let busqueda = '';
let temporizador;

export async function montar(contenedor) {
  const barra = crear('div', 'barra');
  const titulos = crear('div');
  const herramientas = crear('div', 'herramientas');
  const buscador = crear('input', 'entrada buscador', undefined, {
    type: 'search',
    placeholder: 'Buscar nombre, empresa o correo',
    'aria-label': 'Buscar en el historial'
  });

  buscador.value = busqueda;
  buscador.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      busqueda = buscador.value.trim();
      pintarTabla();
    }, 250);
  });

  titulos.append(
    crear('h2', '', 'Historial de diagnósticos'),
    crear('p', 'ayuda', 'Personas atendidas, con sus respuestas y resultados tal como se guardaron.')
  );
  herramientas.append(buscador, boton('+ Nuevo registro', 'boton-primario', nuevoRegistro));
  barra.append(titulos, herramientas);

  contenedorTabla = crear('div');
  contenedor.replaceChildren(barra, contenedorTabla);
  await pintarTabla();
}

async function pintarTabla() {
  const registros = await listarDiagnosticos(busqueda);

  if (!registros.length) {
    contenedorTabla.replaceChildren(
      crear('p', 'vacio', busqueda ? 'No hay registros para esa búsqueda.' : 'Todavía no hay diagnósticos registrados.')
    );
    return;
  }

  const tabla = crear('table', 'tabla tabla-historial');
  const encabezado = crear('thead');
  const cuerpo = crear('tbody');
  const titulos = crear('tr');
  const envoltura = crear('div', 'tabla-envoltura');

  ['Fecha', 'Persona', 'Contacto', 'Niveles', 'Origen', ''].forEach((titulo) => {
    titulos.append(crear('th', '', titulo));
  });
  encabezado.append(titulos);

  registros.forEach((registro) => cuerpo.append(filaRegistro(registro)));

  tabla.append(encabezado, cuerpo);
  envoltura.append(tabla);
  contenedorTabla.replaceChildren(crear('p', 'ayuda', plural(registros.length, 'registro', 'registros')), envoltura);
}

function filaRegistro(registro) {
  const fila = crear('tr');
  const persona = crear('td');
  const contacto = crear('td', 'celda-contacto');
  const niveles = crear('td', 'niveles-lista');
  const origen = crear('td');
  const acciones = crear('td', 'acciones-tabla');

  persona.append(crear('strong', '', registro.nombre));
  if (registro.empresa) persona.append(crear('small', 'secundario', registro.empresa));

  contacto.append(crear('span', '', registro.correo || '—'));
  if (registro.telefono) contacto.append(crear('small', 'secundario', registro.telefono));

  registro.areas.forEach((area) => {
    niveles.append(crear('span', 'pastilla', `${area.input}/${area.maximo}`, { title: area.area }));
  });

  origen.append(
    crear(
      'span',
      registro.origen === 'manual' ? 'chip chip-alerta' : 'chip',
      registro.origen === 'manual' ? 'Manual' : 'Formulario'
    )
  );

  acciones.append(
    boton('Ver', 'boton-secundario boton-chico', () => verDetalle(registro.id)),
    boton('Eliminar', 'boton-peligro boton-chico', () => borrarRegistro(registro))
  );

  fila.append(
    crear('td', 'nowrap', formatearFecha(registro.creado_en)),
    persona,
    contacto,
    niveles,
    origen,
    acciones
  );

  return fila;
}

async function borrarRegistro(registro) {
  if (!(await confirmar(`¿Eliminar el registro de ${registro.nombre} y todas sus respuestas? Esta acción no se puede deshacer.`))) {
    return false;
  }

  await ejecutar(() => eliminarDiagnostico(registro.id), 'Registro eliminado');
  await pintarTabla();
  return true;
}

function camposPersona(datos = {}) {
  const nombre = entrada('text', datos.nombre || '', { maxlength: 120, required: '' });
  const empresa = entrada('text', datos.empresa || '', { maxlength: 120 });
  const correo = entrada('email', datos.correo || '', { maxlength: 160 });
  const telefono = entrada('tel', datos.telefono || '', { maxlength: 40 });
  const notas = crear('textarea', 'entrada', undefined, { rows: 3, maxlength: 2000 });
  const rejilla = crear('div', 'rejilla');

  notas.value = datos.notas || '';
  rejilla.append(
    campo('Nombre *', nombre),
    campo('Empresa', empresa),
    campo('Correo', correo),
    campo('Teléfono', telefono)
  );

  return {
    elementos: [rejilla, campo('Notas del seguimiento', notas)],
    leer: () => ({
      nombre: nombre.value,
      empresa: empresa.value,
      correo: correo.value,
      telefono: telefono.value,
      notas: notas.value
    })
  };
}

async function verDetalle(id) {
  const registro = await ejecutar(() => obtenerDiagnostico(id));

  if (!registro) return;

  const persona = camposPersona(registro);
  const cuerpo = crear('div', 'campos');
  const origen = registro.origen === 'manual' ? 'Registro manual' : 'Formulario web';

  cuerpo.append(
    crear('p', 'ayuda', `Registrado el ${formatearFecha(registro.creado_en)} · ${origen}`),
    ...persona.elementos,
    seccionResultados(registro.areas),
    seccionRespuestas(registro)
  );

  const eliminar = boton('Eliminar registro', 'boton-peligro', async () => {
    if (await borrarRegistro(registro)) modal.cerrar();
  });

  const modal = formularioModal({
    titulo: registro.nombre,
    ancho: 820,
    cuerpo,
    textoGuardar: 'Guardar cambios',
    extras: [eliminar],
    alGuardar: async () => {
      await actualizarDiagnostico(registro.id, persona.leer());
      await pintarTabla();
      avisar('Registro actualizado');
    }
  });
}

function seccionResultados(areas) {
  const seccion = crear('section', 'seccion-detalle');
  const rejilla = crear('div', 'resultados');

  seccion.append(crear('h4', '', 'Resultado por área'));

  areas.forEach((area) => {
    const tarjeta = crear('div', 'resultado-area');
    const niveles = crear('div', 'niveles');

    for (let paso = 1; paso <= area.maximo; paso++) {
      niveles.append(crear('span', paso <= area.input ? 'nivel lleno' : 'nivel'));
    }

    tarjeta.append(
      crear('strong', '', area.area),
      crear('small', 'secundario', `Nivel ${area.input} de ${area.maximo} · ${area.puntaje} pts`),
      niveles
    );
    rejilla.append(tarjeta);
  });

  seccion.append(rejilla);
  return seccion;
}

function agruparRespuestas(respuestas) {
  const preguntas = new Map();

  respuestas.forEach((fila) => {
    const clave = `${fila.pregunta_id}|${fila.pregunta}`;

    if (!preguntas.has(clave)) {
      preguntas.set(clave, { area: fila.area, pregunta: fila.pregunta, tipo: fila.tipo, items: [] });
    }
    preguntas.get(clave).items.push(fila);
  });

  const areas = new Map();

  preguntas.forEach((pregunta) => {
    if (!areas.has(pregunta.area)) areas.set(pregunta.area, []);
    areas.get(pregunta.area).push(pregunta);
  });

  return areas;
}

function seccionRespuestas(registro) {
  const seccion = crear('section', 'seccion-detalle');

  seccion.append(crear('h4', '', 'Respuestas'));

  if (!registro.respuestas.length) {
    seccion.append(crear('p', 'vacio', 'Este registro no tiene respuestas.'));
    return seccion;
  }

  agruparRespuestas(registro.respuestas).forEach((preguntas, area) => {
    const bloque = crear('div', 'bloque-respuestas');

    bloque.append(crear('h5', '', area));

    preguntas.forEach((pregunta) => {
      const lista = crear('ul', 'respuestas-lista');

      pregunta.items.forEach((fila) => {
        const elemento = crear('li');
        elemento.append(crear('span', '', fila.respuesta));
        if (fila.tipo !== 'abierta') elemento.append(crear('span', 'score', `${fila.score} pts`));
        lista.append(elemento);
      });

      bloque.append(
        crear('p', 'pregunta-texto', pregunta.pregunta),
        crear('span', `chip tipo-${pregunta.tipo}`, TIPOS_PREGUNTA[pregunta.tipo]?.nombre || pregunta.tipo),
        lista
      );
    });

    seccion.append(bloque);
  });

  return seccion;
}

async function nuevoRegistro() {
  const estructura = await ejecutar(() => obtenerEstructura());

  if (!estructura) return;

  const areas = estructura
    .map((area) => ({ ...area, preguntas: area.preguntas.filter((pregunta) => pregunta.activa) }))
    .filter((area) => area.preguntas.length);
  const persona = camposPersona();
  const lectores = new Map();
  const cuerpo = crear('div', 'campos');

  cuerpo.append(crear('h4', '', 'Datos de la persona'), ...persona.elementos);
  cuerpo.append(
    crear('h4', '', 'Respuestas'),
    crear('p', 'ayuda', 'Marca lo que respondió la persona. Las preguntas sin respuesta se guardan vacías.')
  );

  areas.forEach((area) => {
    const bloque = crear('div', 'bloque-respuestas');
    bloque.append(crear('h5', '', area.nombre));

    area.preguntas.forEach((pregunta) => {
      bloque.append(crear('p', 'pregunta-texto', pregunta.pregunta), controlRespuesta(pregunta, lectores));
    });

    cuerpo.append(bloque);
  });

  formularioModal({
    titulo: 'Nuevo registro manual',
    ancho: 820,
    cuerpo,
    textoGuardar: 'Guardar registro',
    alGuardar: async () => {
      const respuestas = [...lectores].map(([id, leer]) => ({ pregunta_id: id, ...leer() }));

      await crearDiagnostico(persona.leer(), respuestas);
      await pintarTabla();
      avisar('Registro creado');
    }
  });
}

function controlRespuesta(pregunta, lectores) {
  const contenedor = crear('div', 'opciones-registro');

  if (pregunta.tipo === 'abierta') {
    const texto = crear('textarea', 'entrada', undefined, { rows: 2, maxlength: 1000 });
    contenedor.append(texto);
    lectores.set(pregunta.id, () => ({ alternativas: [], texto: texto.value }));
    return contenedor;
  }

  const unica = pregunta.tipo === 'unica';
  const controles = [];

  if (unica) {
    const ninguna = crear('input', '', undefined, { type: 'radio', name: `p${pregunta.id}`, value: '' });
    ninguna.checked = true;
    contenedor.append(opcion(ninguna, 'Sin respuesta'));
  }

  pregunta.alternativas.forEach((alternativa) => {
    const control = crear('input', '', undefined, {
      type: unica ? 'radio' : 'checkbox',
      name: `p${pregunta.id}`,
      value: alternativa.id
    });

    controles.push(control);
    contenedor.append(opcion(control, alternativa.alternativa, `${alternativa.score} pts`));
  });

  lectores.set(pregunta.id, () => ({
    alternativas: controles.filter((control) => control.checked).map((control) => Number(control.value)),
    texto: ''
  }));

  return contenedor;
}

function opcion(control, texto, score) {
  const etiqueta = crear('label', 'casilla');

  etiqueta.append(control, crear('span', '', texto));
  if (score) etiqueta.append(crear('small', 'secundario', score));
  return etiqueta;
}

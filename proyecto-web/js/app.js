import { obtenerPreguntas, guardarDiagnostico } from './consultas.js';
import { agruparPorArea } from './diagnostico.js';
import { mostrarPantalla, mostrarError, pintarPregunta, pintarResultado, completarProgreso } from './vistas.js';

const PAUSA_AL_RESPONDER = 350;
const SIN_RESPUESTA = { alternativas: [], texto: '' };

const estado = {
  preguntas: [],
  areas: [],
  respuestas: {},
  indice: 0
};

let temporizador;

async function cargarPreguntas() {
  const preguntas = await obtenerPreguntas();

  estado.areas = agruparPorArea(preguntas);
  estado.preguntas = estado.areas.flatMap((area) => area.preguntas);
}

function mostrarPregunta() {
  const pregunta = estado.preguntas[estado.indice];

  mostrarPantalla('cuestionario');
  pintarPregunta(
    {
      pregunta,
      indice: estado.indice,
      total: estado.preguntas.length,
      areas: estado.areas,
      previa: estado.respuestas[pregunta.id] || SIN_RESPUESTA
    },
    { alSeleccionar: seleccionar, alContinuar: continuar }
  );
}

function guardarRespuesta(respuesta) {
  estado.respuestas[estado.preguntas[estado.indice].id] = respuesta;
}

function seleccionar(respuesta) {
  guardarRespuesta(respuesta);
  temporizador = setTimeout(avanzar, PAUSA_AL_RESPONDER);
}

function continuar(respuesta) {
  guardarRespuesta(respuesta);
  avanzar();
}

function avanzar() {
  if (estado.indice < estado.preguntas.length - 1) {
    estado.indice++;
    mostrarPregunta();
    return;
  }

  completarProgreso(estado.areas, estado.preguntas.length, () => {
    mostrarPantalla('contacto');
  });
}

function retroceder() {
  clearTimeout(temporizador);

  if (estado.indice === 0) {
    mostrarPantalla('inicio');
    return;
  }

  estado.indice--;
  mostrarPregunta();
}

function volverALasPreguntas() {
  estado.indice = estado.preguntas.length - 1;
  mostrarPregunta();
}

async function comenzar() {
  const boton = document.getElementById('comenzar');
  boton.disabled = true;
  mostrarError('error', '');

  try {
    await cargarPreguntas();

    if (!estado.preguntas.length) {
      mostrarError('error', 'Todavía no hay preguntas disponibles. Vuelve a intentarlo más tarde.');
      return;
    }

    estado.respuestas = {};
    estado.indice = 0;
    mostrarPregunta();
  } catch {
    mostrarError('error', 'No pudimos cargar el diagnóstico. Intenta de nuevo en unos momentos.');
  } finally {
    boton.disabled = false;
  }
}

async function terminar(evento) {
  evento.preventDefault();

  const boton = document.getElementById('enviar');
  const persona = Object.fromEntries(new FormData(evento.currentTarget));
  const respuestas = estado.preguntas.map((pregunta) => ({
    pregunta_id: pregunta.id,
    ...(estado.respuestas[pregunta.id] || SIN_RESPUESTA)
  }));

  boton.disabled = true;
  mostrarError('error-contacto', '');

  try {
    const { areas } = await guardarDiagnostico(persona, respuestas);
    pintarResultado(areas);
    mostrarPantalla('resultado');
  } catch (error) {
    mostrarError('error-contacto', error.message);
  } finally {
    boton.disabled = false;
  }
}

function reiniciar() {
  document.getElementById('formulario-contacto').reset();
  mostrarPantalla('inicio');
}

document.getElementById('comenzar').addEventListener('click', comenzar);
document.getElementById('atras').addEventListener('click', retroceder);
document.getElementById('atras-contacto').addEventListener('click', volverALasPreguntas);
document.getElementById('formulario-contacto').addEventListener('submit', terminar);
document.getElementById('reiniciar').addEventListener('click', reiniciar);

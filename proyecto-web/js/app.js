import {
  obtenerPreguntas,
  guardarDiagnostico,
  obtenerVistaPrevia,
  enviarProgresoCuestionario,
  obtenerPantallaFinalPublica
} from './consultas.js';
import { agruparPorArea } from './diagnostico.js';
import {
  mostrarPantalla,
  mostrarError,
  pintarPregunta,
  pintarAgradecimiento,
  pintarResumen,
  pintarRedesResumen,
  completarProgreso,
  activarLucesAmbiente,
  activarEstrellasAnimadas
} from './vistas.js';
import { PAISES_TELEFONO, banderaDe } from './datos/paises-telefono.js';
import { registrarEvento, registrarEventoPersonalizado } from './pixel.js';

const PAUSA_AL_RESPONDER = 350;
const SIN_RESPUESTA = { alternativas: [], texto: '' };

const estado = {
  preguntas: [],
  areas: [],
  respuestas: {},
  indice: 0
};

let temporizador;
let sesionId = '';
let pantallaFinal = null;
let nivelCalculado = null;
let fraccionCalculada = 1;

function registrarProgreso(preguntaActual) {
  if (!sesionId) return;

  enviarProgresoCuestionario({
    sesion_id: sesionId,
    pregunta_actual: preguntaActual,
    total_preguntas: estado.preguntas.length,
    respuestas: respuestasActuales()
  }).catch(() => {
    // el seguimiento es informativo, no debe interrumpir el cuestionario
  });
}

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
  registrarProgreso(estado.indice + 1);
}

function guardarRespuesta(respuesta) {
  estado.respuestas[estado.preguntas[estado.indice].id] = respuesta;
}

function respuestasActuales() {
  return estado.preguntas.map((pregunta) => ({
    pregunta_id: pregunta.id,
    ...(estado.respuestas[pregunta.id] || SIN_RESPUESTA)
  }));
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

  completarProgreso(estado.areas, estado.preguntas.length, async () => {
    try {
      const { nivel, fraccion } = await obtenerVistaPrevia(respuestasActuales());
      nivelCalculado = nivel || null;
      fraccionCalculada = fraccion ?? 1;
    } catch {
      // si la vista previa falla, igual se pasa al formulario; el diagnóstico solo se
      // muestra después si logramos calcular el nivel (si no, se va directo al agradecimiento)
      nivelCalculado = null;
    }

    // Terminó el cuestionario: antes esto pasaba al hacer clic en "Agenda una sesión
    // exploratoria"; ahora el formulario aparece solo, así que el evento se dispara aquí.
    registrarEvento('InitiateCheckout');
    registrarEventoPersonalizado('BotonFinal');
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

// "Atrás" en el formulario de contacto: ya no hay una pantalla de diagnóstico antes
// (esa ahora va después), así que regresa a la última pregunta del cuestionario.
function volverUltimaPregunta() {
  estado.indice = Math.max(0, estado.preguntas.length - 1);
  mostrarPregunta();
}

// Botón de cada nivel ("Agenda una sesión exploratoria"…) en la pantalla de diagnóstico:
// ya dejó sus datos antes, así que ahora pasa a la pantalla de agradecimiento.
function verAgradecimiento() {
  pintarAgradecimiento(pantallaFinal);
  mostrarPantalla('resultado');
}

// "Volver a hacer el test" en la pantalla de diagnóstico: empieza todo de nuevo.
function repetirTest() {
  reiniciar();
  comenzar();
}

async function comenzar() {
  // Se dispara con el clic en sí, no solo cuando el cuestionario logra cargar.
  registrarEventoPersonalizado('BotonInicial');

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
    nivelCalculado = null;
    fraccionCalculada = 1;
    sesionId = crypto.randomUUID();
    // El cuestionario arrancó de verdad (ya cargaron las preguntas), no solo se hizo clic.
    registrarEvento('ViewContent', { content_name: 'Diagnosticador' });
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
  const codigoTelefono = persona.codigo_telefono || '';
  delete persona.codigo_telefono;

  if (persona.rubro === 'Otro') {
    persona.rubro = (persona.rubro_otro || '').trim();
  }
  delete persona.rubro_otro;

  const telefono = (persona.telefono || '').replace(/[^\d\s]/g, '').trim();
  persona.telefono = telefono ? `${codigoTelefono} ${telefono}`.trim() : '';
  persona.sesion_id = sesionId;
  const respuestas = respuestasActuales();

  boton.disabled = true;
  mostrarError('error-contacto', '');

  try {
    await guardarDiagnostico(persona, respuestas);
    // Envío exitoso del formulario de contacto: ahora sí es un lead real.
    registrarEvento('Lead');
    pantallaFinal = await obtenerPantallaFinalPublica().catch(() => null);

    if (nivelCalculado) {
      // Ya dejó sus datos: ahora sí se le muestra su diagnóstico.
      pintarResumen(nivelCalculado, fraccionCalculada);
      pintarRedesResumen(pantallaFinal);
      mostrarPantalla('resumen');
    } else {
      // No se pudo calcular un nivel (p. ej. la vista previa falló). La pantalla de
      // agradecimiento está desactivada por ahora, así que no hay nada que mostrar:
      // se reinicia en vez de dejar a la persona en una pantalla vacía.
      reiniciar();
    }
  } catch (error) {
    mostrarError('error-contacto', error.message);
  } finally {
    boton.disabled = false;
  }
}

function reiniciar() {
  document.getElementById('formulario-contacto').reset();
  document.getElementById('campo-rubro-otro').hidden = true;
  document.getElementById('rubro-otro').required = false;
  mostrarPantalla('inicio');
}

// El botón de la pantalla final va a donde se configuró en el admin (por defecto, al inicio).
function botonFinal() {
  const destino = pantallaFinal ? pantallaFinal.boton_destino : 'inicio';

  if (destino === 'url') {
    if (pantallaFinal.boton_nueva_pestana) window.open(pantallaFinal.boton_url, '_blank', 'noopener');
    else location.href = pantallaFinal.boton_url;
    return;
  }

  reiniciar();
  if (destino === 'cuestionario') comenzar();
}

function poblarCodigosTelefono() {
  const select = document.getElementById('codigo-telefono');
  const porDefecto = location.hostname.includes('-mx') ? 'MX' : 'PE';

  select.replaceChildren(
    ...PAISES_TELEFONO.map((pais) => {
      const opcion = document.createElement('option');
      opcion.value = pais.dial;
      opcion.textContent = `${pais.nombre} ${banderaDe(pais.iso)} +${pais.dial}`;
      if (pais.iso === porDefecto) opcion.selected = true;
      return opcion;
    })
  );
}

function configurarRubroOtro() {
  const rubro = document.getElementById('rubro');
  const campoOtro = document.getElementById('campo-rubro-otro');
  const otro = document.getElementById('rubro-otro');

  rubro.addEventListener('change', () => {
    const esOtro = rubro.value === 'Otro';
    campoOtro.hidden = !esOtro;
    otro.required = esOtro;
    if (!esOtro) otro.value = '';
  });
}

function configurarTelefono() {
  const telefono = document.getElementById('telefono');

  telefono.addEventListener('input', () => {
    const limpio = telefono.value.replace(/[^\d\s]/g, '');
    if (limpio !== telefono.value) telefono.value = limpio;
  });
}

document.getElementById('comenzar').addEventListener('click', comenzar);
document.getElementById('atras').addEventListener('click', retroceder);
document.getElementById('ver-agradecimiento').addEventListener('click', verAgradecimiento);
document.getElementById('repetir-test').addEventListener('click', repetirTest);
document.getElementById('atras-contacto').addEventListener('click', volverUltimaPregunta);
document.getElementById('formulario-contacto').addEventListener('submit', terminar);
document.getElementById('reiniciar').addEventListener('click', botonFinal);

// Modo vista previa: el admin carga esta página en un iframe (?vista-previa) y le envía
// por postMessage lo que debe pintar. No guarda nada ni registra métricas.
function activarVistaPrevia() {
  let pantallaActual = '';

  const mostrarSiCambia = (nombre) => {
    if (nombre === pantallaActual) return;
    pantallaActual = nombre;
    mostrarPantalla(nombre);
  };

  document.body.classList.add('modo-vista-previa');

  window.addEventListener('message', (evento) => {
    if (evento.origin !== location.origin || evento.source !== window.parent || !evento.data) return;

    const { tipo } = evento.data;

    if (tipo === 'resumen') {
      pintarResumen(evento.data.nivel, evento.data.fraccion);
      mostrarSiCambia('resumen');
    } else if (tipo === 'agradecimiento') {
      pintarAgradecimiento(evento.data.pantalla);
      mostrarSiCambia('resultado');
    }
  });

  window.parent.postMessage({ tipo: 'vista-previa-lista' }, location.origin);
}

poblarCodigosTelefono();
configurarRubroOtro();
configurarTelefono();
activarLucesAmbiente();
activarEstrellasAnimadas();

if (window.parent !== window && new URLSearchParams(location.search).has('vista-previa')) {
  activarVistaPrevia();
}

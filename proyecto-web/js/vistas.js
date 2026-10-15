import { crear } from './utilidades.js';
import { NOMBRES_RED, iconoRed } from './iconosRedes.js';
import { cargarFuentes, familiaCss } from './fuentes.js';

const pantallas = ['inicio', 'cuestionario', 'resumen', 'contacto', 'resultado'];

const $ = (id) => document.getElementById(id);

const tieneRespuesta = (respuesta) =>
  respuesta.alternativas.length > 0 || respuesta.texto.trim() !== '';

function respuestaCompleta(pregunta, respuesta) {
  if (!tieneRespuesta(respuesta)) return false;

  const alternativaOtro = (pregunta.alternativas || []).find((alternativa) => alternativa.es_otro);

  if (alternativaOtro && respuesta.alternativas.includes(alternativaOtro.id) && !respuesta.texto.trim()) {
    return false;
  }

  return true;
}

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

const parrafos = (texto) =>
  texto
    .split(/\n{2,}/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean);

function conNegritas(elemento, texto) {
  const partes = texto.split(/\*\*(.+?)\*\*/g);
  elemento.replaceChildren(
    ...partes.map((parte, indice) => (indice % 2 === 1 ? crear('strong', '', parte) : parte))
  );
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

function campoOtroAlternativa(valorInicial, alEscribir) {
  const campo = crear('input', 'respuesta-otro', undefined, {
    type: 'text',
    maxlength: 200,
    placeholder: 'Escribe tu respuesta',
    'aria-label': 'Tu respuesta para "Otro"'
  });

  campo.value = valorInicial || '';
  campo.addEventListener('click', (evento) => evento.stopPropagation());
  campo.addEventListener('input', () => alEscribir(campo.value));

  return campo;
}

function pintarUnica(pregunta, previa, { alSeleccionar, alCambiar }) {
  const alternativaOtro = pregunta.alternativas.find((alternativa) => alternativa.es_otro);
  const seleccionada = previa.alternativas[0];
  let campoOtro = null;

  const botones = pregunta.alternativas.map((alternativa) => {
    const boton = crear('button', 'alternativa', alternativa.alternativa, { type: 'button' });
    boton.classList.toggle('activa', alternativa.id === seleccionada);

    boton.addEventListener('click', () => {
      if (alternativaOtro) {
        botones.forEach((item) => item.classList.toggle('activa', item === boton));

        if (alternativa.es_otro) {
          campoOtro.hidden = false;
          campoOtro.focus();
          alCambiar({ alternativas: [alternativa.id], texto: campoOtro.value });
        } else {
          campoOtro.hidden = true;
          alCambiar({ alternativas: [alternativa.id], texto: '' });
        }
        return;
      }

      botones.forEach((item) => {
        item.disabled = true;
        item.classList.toggle('activa', item === boton);
      });
      alSeleccionar({ alternativas: [alternativa.id], texto: '' });
    });

    return boton;
  });

  const hijos = [...botones];

  if (alternativaOtro) {
    campoOtro = campoOtroAlternativa(seleccionada === alternativaOtro.id ? previa.texto : '', (valor) => {
      alCambiar({ alternativas: [alternativaOtro.id], texto: valor });
    });
    campoOtro.hidden = seleccionada !== alternativaOtro.id;
    hijos.push(campoOtro);
  }

  $('alternativas').replaceChildren(...hijos);
}

function pintarMultiple(pregunta, previa, alCambiar) {
  const marcadas = new Set(previa.alternativas);
  const alternativaOtro = pregunta.alternativas.find((alternativa) => alternativa.es_otro);
  let textoOtro = previa.texto || '';
  let campoOtro = null;

  const emitir = () => alCambiar({ alternativas: [...marcadas], texto: textoOtro });

  const filas = pregunta.alternativas.map((alternativa) => {
    const fila = crear('label', 'alternativa alternativa-casilla');
    const casilla = crear('input', '', undefined, { type: 'checkbox' });

    casilla.checked = marcadas.has(alternativa.id);
    fila.classList.toggle('activa', casilla.checked);

    casilla.addEventListener('change', () => {
      if (casilla.checked) marcadas.add(alternativa.id);
      else marcadas.delete(alternativa.id);

      fila.classList.toggle('activa', casilla.checked);

      if (alternativa.es_otro && campoOtro) {
        campoOtro.hidden = !casilla.checked;
        if (casilla.checked) campoOtro.focus();
        else textoOtro = '';
      }

      emitir();
    });

    fila.append(casilla, crear('span', 'marca'), crear('span', '', alternativa.alternativa));
    return fila;
  });

  const hijos = [...filas];

  if (alternativaOtro) {
    campoOtro = campoOtroAlternativa(textoOtro, (valor) => {
      textoOtro = valor;
      emitir();
    });
    campoOtro.hidden = !marcadas.has(alternativaOtro.id);
    hijos.push(campoOtro);
  }

  $('alternativas').replaceChildren(...hijos);
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

  if (nombre === 'resumen' || nombre === 'contacto') {
    activarParallaxResumen();
    // El humo se quitó de todas las pantallas (antes vivía aquí, en "contacto").
  }

  window.scrollTo(0, 0);
}

export function mostrarError(id, mensaje) {
  const error = $(id);
  error.textContent = mensaje;
  error.hidden = !mensaje;
}

let parallaxActivo = false;

function activarParallaxResumen() {
  if (parallaxActivo) return;
  parallaxActivo = true;

  const pantallasParallax = [$('resumen'), $('contacto')];
  const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (movimientoReducido) return;

  const actualizarPosicion = (fondo, x, y) => {
    const limitar = (valor) => Math.max(-0.5, Math.min(0.5, valor));
    const posicionX = limitar(x);
    const posicionY = limitar(y);
    const desplazamientoX = (posicionX * -540).toFixed(1);
    const desplazamientoY = (posicionY * -540).toFixed(1);

    fondo.style.transform = `translate3d(${desplazamientoX}px, ${desplazamientoY}px, 0) scale(1.16)`;
  };

  pantallasParallax.forEach((pantalla) => {
    const fondo = pantalla.querySelector('.fondo-parallax');
    if (!fondo) return;

    pantalla.addEventListener('pointermove', (evento) => {
      const rect = pantalla.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const x = (evento.clientX - rect.left) / rect.width - 0.5;
      const y = (evento.clientY - rect.top) / rect.height - 0.5;
      actualizarPosicion(fondo, x, y);
    });

    pantalla.addEventListener('pointerleave', () => {
      actualizarPosicion(fondo, 0, 0);
    });
  });

  window.addEventListener('scroll', () => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    const pantalla = pantallasParallax.find((item) => !item.hidden);
    if (!pantalla) return;

    const fondo = pantalla.querySelector('.fondo-parallax');
    const recorrido = Math.max(1, pantalla.scrollHeight - window.innerHeight);
    actualizarPosicion(fondo, 0, (window.scrollY / recorrido) * 0.5);
  }, { passive: true });

  window.addEventListener('resize', () => {
    pantallasParallax.forEach((pantalla) => {
      const fondo = pantalla.querySelector('.fondo-parallax');
      if (pantalla.hidden || !fondo) actualizarPosicion(fondo, 0, 0);
    });
  });
}

let lucesActivas = false;

export function activarLucesAmbiente() {
  if (lucesActivas) return;
  lucesActivas = true;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const raiz = document.documentElement;
  let cuadroPendiente = null;

  window.addEventListener(
    'pointermove',
    (evento) => {
      const x = evento.clientX / window.innerWidth - 0.5;
      const y = evento.clientY / window.innerHeight - 0.5;

      if (cuadroPendiente) return;

      cuadroPendiente = requestAnimationFrame(() => {
        raiz.style.setProperty('--luz-x', x.toFixed(3));
        raiz.style.setProperty('--luz-y', y.toFixed(3));
        cuadroPendiente = null;
      });
    },
    { passive: true }
  );
}

const ALEATORIO_ENTRE = (min, max) => Math.random() * (max - min) + min;

function crearEstrella(topMaximo = 100) {
  const estrella = crear('span', 'estrella-animada');
  const profundidad = ALEATORIO_ENTRE(0, 1);
  const tamano = (2 + profundidad * 3.2).toFixed(2);
  const movimiento = (12 + profundidad * 56).toFixed(1);
  const fija = Math.random() < 0.35;

  estrella.style.left = `${ALEATORIO_ENTRE(0, 100).toFixed(2)}%`;
  estrella.style.top = `${ALEATORIO_ENTRE(0, topMaximo).toFixed(2)}%`;
  estrella.style.width = `${tamano}px`;
  estrella.style.height = `${tamano}px`;
  estrella.style.setProperty('--movimiento', `${movimiento}px`);

  if (fija) {
    estrella.style.setProperty('--brillo-max', ALEATORIO_ENTRE(0.35, 0.9).toFixed(2));
    return estrella;
  }

  const intensidad = ALEATORIO_ENTRE(0, 1);
  const brilloMax = ALEATORIO_ENTRE(0.6, 1);
  const brilloMin = Math.max(0.05, brilloMax - ALEATORIO_ENTRE(0.15, 0.85) * intensidad - 0.1);

  estrella.classList.add('parpadea');
  estrella.style.setProperty('--brillo-max', brilloMax.toFixed(2));
  estrella.style.setProperty('--brillo-min', brilloMin.toFixed(2));
  estrella.style.setProperty('--duracion', `${ALEATORIO_ENTRE(1.6, 9).toFixed(2)}s`);
  estrella.style.setProperty('--retraso', `${ALEATORIO_ENTRE(0, 6).toFixed(2)}s`);

  return estrella;
}

// En la pantalla de inicio hay un planeta ilustrado en la franja inferior: ahí no se generan estrellas.
const TOPE_SUPERIOR_POR_PANTALLA = { inicio: 73 };

// Las pantallas sin planeta aprovechan todo el alto, así que llevan más estrellas para sentirse igual de vivas.
// El cuestionario no lleva estrellas propias: ahí el parallax vive en la llama del cohete.
const CANTIDAD_POR_PANTALLA = { inicio: 16, resumen: 28, contacto: 28, resultado: 28 };
const PANTALLAS_SIN_ESTRELLAS = new Set(['cuestionario']);

let estrellasListas = false;

export function activarEstrellasAnimadas() {
  if (estrellasListas) return;
  estrellasListas = true;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  pantallas.forEach((id) => {
    if (PANTALLAS_SIN_ESTRELLAS.has(id)) return;

    const pantalla = $(id);
    if (!pantalla) return;

    const topMaximo = TOPE_SUPERIOR_POR_PANTALLA[id] ?? 100;
    const cantidad = CANTIDAD_POR_PANTALLA[id] ?? 20;
    const capa = crear('div', 'capa-estrellas');
    for (let i = 0; i < cantidad; i++) {
      capa.append(crearEstrella(topMaximo));
    }
    pantalla.prepend(capa);
  });
}

let humoIniciado = false;
let humoCanvas = null;
let humoCtx = null;
let humoParticulas = [];
const humoMouse = {
  x: null,
  y: null,
  objetivoX: null,
  objetivoY: null,
  influencia: 0,
  objetivoInfluencia: 0
};

const HUMO_COLORES = [
  [131, 112, 192],
  [104, 115, 190],
  [143, 111, 183],
  [91, 123, 191],
  [159, 133, 196]
];

function colorHumo() {
  const base = HUMO_COLORES[Math.floor(Math.random() * HUMO_COLORES.length)];
  return base.map((canal) => Math.max(0, Math.min(255, canal + (Math.random() - 0.5) * 16)));
}

function crearParticulaHumo(w, h, aparecer = false) {
  const duracion = 7000 + Math.random() * 5000;
  const altura = h * (0.9 + Math.random() * 0.6);
  const segmentos = 54;

  return {
    xBase: Math.random() * w,
    altura: aparecer ? Math.random() * altura : 0,
    alturaMaxima: altura,
    velocidad: 0.45 + Math.random() * 0.6,
    longitudTrail: 170 + Math.random() * 200,
    segmentos,
    turbulencias: Array.from({ length: 12 }, () => (Math.random() - 0.5) * 8),
    objetivosTurbulencia: Array.from({ length: 12 }, () => (Math.random() - 0.5) * 18),
    framesHastaTurbulencia: 30 + Math.random() * 70,
    jitters: Array.from({ length: segmentos }, () => Math.random() * Math.PI * 2),
    anchos: Array.from({ length: segmentos }, () => 0.4 + Math.random() * 1.3),
    grosor: 8 + Math.random() * 7,
    viento: (Math.random() - 0.5) * 0.8,
    vientoObjetivo: (Math.random() - 0.5) * 1.4,
    framesHastaRafaga: 35 + Math.random() * 100,
    ondaA: { amp: 14 + Math.random() * 22, frec: 0.009 + Math.random() * 0.01, fase: Math.random() * Math.PI * 2 },
    ondaB: { amp: 8 + Math.random() * 16, frec: 0.021 + Math.random() * 0.017, fase: Math.random() * Math.PI * 2 },
    ondaC: { amp: 4 + Math.random() * 10, frec: 0.045 + Math.random() * 0.03, fase: Math.random() * Math.PI * 2 },
    fase: Math.random() * Math.PI * 2,
    velocidadFase: 0.012 + Math.random() * 0.014,
    vida: aparecer ? Math.random() * duracion : 0,
    duracion,
    opacidadBase: 0.2 + Math.random() * 0.16,
    disolucion: 0,
    objetivoDisolucion: 0,
    color: colorHumo()
  };
}

function ajustarTamanoHumo() {
  if (!humoCanvas) return;
  const rect = humoCanvas.getBoundingClientRect();
  humoCanvas.width = Math.max(1, Math.round(rect.width));
  humoCanvas.height = Math.max(1, Math.round(rect.height));
}

function animarHumo() {
  requestAnimationFrame(animarHumo);

  const pantallaActiva = $('contacto').hidden ? null : $('contacto');
  if (!humoCtx || !pantallaActiva || humoCanvas.parentElement !== pantallaActiva) return;

  if (humoCanvas.width !== humoCanvas.clientWidth || humoCanvas.height !== humoCanvas.clientHeight) {
    ajustarTamanoHumo();
    if (!humoCanvas.width || !humoCanvas.height) return;
  }

  humoMouse.influencia += (humoMouse.objetivoInfluencia - humoMouse.influencia) * 0.12;

  if (humoMouse.objetivoX !== null && humoMouse.objetivoY !== null) {
    if (humoMouse.x === null || humoMouse.y === null) {
      humoMouse.x = humoMouse.objetivoX;
      humoMouse.y = humoMouse.objetivoY;
    } else {
      humoMouse.x += (humoMouse.objetivoX - humoMouse.x) * 0.14;
      humoMouse.y += (humoMouse.objetivoY - humoMouse.y) * 0.14;
    }
  } else if (humoMouse.influencia < 0.01) {
    humoMouse.x = null;
    humoMouse.y = null;
  }

  const w = humoCanvas.width;
  const h = humoCanvas.height;

  humoCtx.clearRect(0, 0, w, h);
  humoCtx.globalCompositeOperation = 'source-over';

  humoParticulas.forEach((p) => {
    p.vida++;
    p.fase += p.velocidadFase;
    p.altura += p.velocidad;
    p.framesHastaRafaga--;
    p.framesHastaTurbulencia--;

    if (p.framesHastaRafaga <= 0) {
      p.vientoObjetivo = (Math.random() - 0.5) * 1.8;
      p.framesHastaRafaga = 45 + Math.random() * 130;
    }

    if (p.framesHastaTurbulencia <= 0) {
      p.objetivosTurbulencia = p.objetivosTurbulencia.map(() => (Math.random() - 0.5) * 22);
      p.framesHastaTurbulencia = 45 + Math.random() * 85;
    }

    p.viento += (p.vientoObjetivo - p.viento) * 0.012;
    p.turbulencias = p.turbulencias.map((valor, indice) =>
      valor + (p.objetivosTurbulencia[indice] - valor) * 0.035
    );

    const progreso = p.vida / p.duracion;
    const avance = p.altura / p.alturaMaxima;

    if (progreso >= 1 || avance >= 1) {
      Object.assign(p, crearParticulaHumo(w, h));
      return;
    }

    let opacidad = p.opacidadBase;
    if (progreso < 0.08) opacidad *= progreso / 0.08;
    else if (progreso > 0.75) opacidad *= Math.max(0, 1 - (progreso - 0.75) / 0.25);
    if (opacidad <= 0.004) return;

    const [r, g, b] = p.color;
    const pasos = p.segmentos;

    const posiciones = new Array(pasos);
    let distanciaMinima = Infinity;

    for (let i = 0; i < pasos; i++) {
      const t = i / (pasos - 1);
      const d = p.altura - p.longitudTrail * (1 - t);
      if (d <= 0) {
        posiciones[i] = null;
        continue;
      }

      const y = h - d;
      const crecimiento = d / p.alturaMaxima + 0.2;
      const seed = p.jitters[i];
      const curva =
        Math.sin(d * p.ondaA.frec + p.ondaA.fase + seed * 0.6) * p.ondaA.amp * crecimiento +
        Math.sin(d * p.ondaB.frec + p.ondaB.fase + seed * 1.3 + p.fase) * p.ondaB.amp * crecimiento +
        Math.sin(d * p.ondaC.frec + p.ondaC.fase + seed * 2.1) * p.ondaC.amp;
      const indiceRuido = t * (p.turbulencias.length - 1);
      const nodoRuido = Math.floor(indiceRuido);
      const fraccionRuido = indiceRuido - nodoRuido;
      const ruido = p.turbulencias[nodoRuido] * (1 - fraccionRuido) +
        p.turbulencias[Math.min(nodoRuido + 1, p.turbulencias.length - 1)] * fraccionRuido;
      const derivaViento = p.viento * 48 * Math.pow(Math.min(1, d / p.alturaMaxima), 1.35);
      const x = p.xBase + curva + ruido * (0.8 + t * 1.8) + derivaViento;
      posiciones[i] = { x, y, t };

      if (humoMouse.influencia > 0.01 && humoMouse.x !== null && i % 2 === 0) {
        distanciaMinima = Math.min(distanciaMinima, Math.hypot(x - humoMouse.x, y - humoMouse.y));
      }
    }

    const radioInfluencia = 260;
    p.objetivoDisolucion = humoMouse.influencia > 0.01 && distanciaMinima < radioInfluencia
      ? (1 - distanciaMinima / radioInfluencia) ** 2 * humoMouse.influencia
      : 0;
    p.disolucion += (p.objetivoDisolucion - p.disolucion) * 0.045;
    p.disolucion = Math.max(0, Math.min(1, p.disolucion));

    if (p.disolucion >= 0.98) {
      Object.assign(p, crearParticulaHumo(w, h));
      return;
    }

    for (let i = 0; i < pasos; i++) {
      const pos = posiciones[i];
      if (!pos) continue;
      let { x, y, t } = pos;
      if (y < -60) continue;

      const dispersion = p.disolucion;
      x += (x - p.xBase) * dispersion * 0.45 + Math.sin(p.jitters[i] + p.fase) * dispersion * (18 + t * 38);
      y -= dispersion * (8 + t * 34);

      let fuerzaPuntero = 0;
      if (humoMouse.influencia > 0.01 && humoMouse.x !== null) {
        const dx = x - humoMouse.x;
        const dy = y - humoMouse.y;
        const distancia = Math.hypot(dx, dy) || 0.01;

        if (distancia < radioInfluencia) {
          fuerzaPuntero = (1 - distancia / radioInfluencia) ** 2 * humoMouse.influencia;
          x += (dx / distancia) * fuerzaPuntero * (42 + dispersion * 58);
          y += (dy / distancia) * fuerzaPuntero * (24 + dispersion * 34);
        }
      }

      const envolvente = Math.sin(Math.max(0.001, Math.min(1, t)) * Math.PI);
      const opacidadSegmento = opacidad * envolvente * (1 - dispersion * 0.82) * (1 - fuerzaPuntero * 0.4);

      if (opacidadSegmento <= 0.003) continue;

      const expansion = (0.7 + t * 0.65 + avance * 0.75) * (1 + dispersion * 1.25 + fuerzaPuntero * 0.6);
      const radio = p.grosor * (0.6 + t * 0.9) * p.anchos[i] * expansion;

      const gradiente = humoCtx.createRadialGradient(x, y, 0, x, y, radio);
      gradiente.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacidadSegmento})`);
      gradiente.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${opacidadSegmento * 0.4})`);
      gradiente.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      humoCtx.fillStyle = gradiente;
      humoCtx.beginPath();
      humoCtx.ellipse(x, y, radio * 0.82, radio * 1.18, 0, 0, Math.PI * 2);
      humoCtx.fill();
    }
  });
}

function activarHumoResumen() {
  if (humoIniciado) return;
  humoIniciado = true;

  humoCanvas = document.querySelector('.resumen-vapor');
  if (!humoCanvas) return;

  humoCtx = humoCanvas.getContext('2d');
  ajustarTamanoHumo();
  window.addEventListener('resize', ajustarTamanoHumo);

  [$('resumen'), $('contacto')].forEach((pantalla) => {
    pantalla.addEventListener('pointermove', (evento) => {
      const rect = humoCanvas.getBoundingClientRect();
      humoMouse.objetivoX = evento.clientX - rect.left;
      humoMouse.objetivoY = evento.clientY - rect.top;
      humoMouse.objetivoInfluencia = 1;
    });

    pantalla.addEventListener('pointerleave', () => {
      humoMouse.objetivoInfluencia = 0;
      humoMouse.objetivoX = null;
      humoMouse.objetivoY = null;
    });
  });

  humoParticulas = Array.from({ length: 18 }, () => crearParticulaHumo(humoCanvas.width, humoCanvas.height, true));

  requestAnimationFrame(animarHumo);
}

export function pintarResumen(nivel, fraccion = 1) {
  const plantillaIcono = $('plantilla-oportunidad');

  activarParallaxResumen();

  $('resumen-vehiculo').src = 'assets/astronauta.png';
  $('resumen-vehiculo').style.left = `${Math.min(1, Math.max(0, fraccion)) * 100}%`;
  $('resumen-titulo').textContent = nivel.titulo;

  $('resumen-introduccion').replaceChildren(
    ...parrafos(nivel.introduccion).map((parrafo) => {
      const p = crear('p', 'resumen-texto');
      conNegritas(p, parrafo);
      return p;
    })
  );

  $('resumen-lista').replaceChildren(
    ...nivel.oportunidades.map((oportunidad) => {
      const li = crear('li');
      li.append(plantillaIcono.content.cloneNode(true), oportunidad.texto);
      return li;
    })
  );

  $('resumen-texto-intermedio').replaceChildren(
    ...parrafos(nivel.texto_intermedio).map((parrafo) => {
      const p = crear('p', 'resumen-texto');
      conNegritas(p, parrafo);
      return p;
    })
  );

  $('resumen-cierre-titulo').textContent = nivel.cierre_titulo;
  conNegritas($('resumen-cierre-texto'), nivel.cierre_texto);
  $('resumen-boton-texto').textContent = nivel.boton_texto;
  $('resumen-boton-nota').textContent = nivel.boton_nota;
}

export function pintarPregunta({ pregunta, indice, total, areas, previa }, { alSeleccionar, alContinuar }) {
  const continuar = $('continuar');
  const tieneOtro = (pregunta.alternativas || []).some((alternativa) => alternativa.es_otro);
  let actual = previa;

  const cambiar = (respuesta) => {
    actual = respuesta;
    continuar.disabled = pregunta.obligatoria && !respuestaCompleta(pregunta, respuesta);
  };

  $('actual').textContent = indice + 1;
  $('total').textContent = total;
  pintarProgreso(areas, indice);
  pintarTitulo($('pregunta'), pregunta.pregunta);

  continuar.parentElement.hidden = pregunta.tipo === 'unica' && !tieneOtro;
  continuar.classList.toggle('continuar-multiple', pregunta.tipo === 'multiple');
  continuar.onclick = () => alContinuar(actual);

  if (pregunta.tipo === 'unica') pintarUnica(pregunta, previa, { alSeleccionar, alCambiar: cambiar });
  else if (pregunta.tipo === 'multiple') pintarMultiple(pregunta, previa, cambiar);
  else pintarAbierta(previa, cambiar);

  cambiar(previa);
}

// Los mensajes guardados antes eran texto simple; ahora son { texto, estilo }.
const comoMensaje = (mensaje) => (typeof mensaje === 'string' ? { texto: mensaje, estilo: {} } : { estilo: {}, ...mensaje });

const ALINEACION_TEXTO = { izquierda: 'left', centro: 'center', derecha: 'right' };

const RADIO_BOTON = { pildora: '999px', redondeado: '10px', recto: '0' };

// El tamaño elegido es el de escritorio; en pantallas chicas baja hasta el 60% para no desbordar.
const tamanoAdaptable = (px) => `clamp(${Math.round(px * 0.6)}px, ${(px / 14.4).toFixed(2)}vw, ${px}px)`;

// Aplica (o quita) el estilo personalizado de un elemento: lo que no se definió vuelve al CSS original.
function aplicarEstilo(elemento, estilo = {}) {
  elemento.style.fontFamily = estilo.fuente ? familiaCss(estilo.fuente) : '';
  elemento.style.fontSize = estilo.tamano ? tamanoAdaptable(estilo.tamano) : '';
  elemento.style.color = estilo.color || '';
  elemento.style.fontWeight = estilo.negrita === undefined ? '' : estilo.negrita ? '700' : '400';
  elemento.style.fontStyle = estilo.cursiva === undefined ? '' : estilo.cursiva ? 'italic' : 'normal';
  elemento.style.textAlign = ALINEACION_TEXTO[estilo.alineacion] || '';
}

function aplicarEstilos(pantalla) {
  const estilos = pantalla.estilos || {};
  const elementos = estilos.elementos || {};
  const boton = $('reiniciar');
  const estiloBoton = elementos.boton || {};

  const mensajes = pantalla.mensajes.map(comoMensaje);

  cargarFuentes(
    [...Object.values(elementos), ...mensajes.map((mensaje) => mensaje.estilo)].map((estilo) => estilo.fuente).filter(Boolean)
  );

  $('resultado').dataset.alineacion = estilos.alineacion || 'centro';
  aplicarEstilo($('final-etiqueta'), elementos.etiqueta);
  aplicarEstilo($('final-titulo'), elementos.titulo);
  // Cada mensaje tiene su propio diseño (un estilo general antiguo, si existe, queda como base).
  $('final-mensajes').querySelectorAll('.agradecimiento-texto').forEach((p) => {
    aplicarEstilo(p, { ...elementos.mensajes, ...mensajes[Number(p.dataset.mensaje)].estilo });
  });
  aplicarEstilo($('final-redes-titulo'), elementos.redes_titulo);
  aplicarEstilo(boton, estiloBoton);
  boton.style.background = estiloBoton.fondo || '';
  boton.style.borderRadius = RADIO_BOTON[estiloBoton.forma] || '';
}

// Pinta la pantalla de agradecimiento con lo configurado en el admin.
// Sin configuración (si falla la carga) se quedan los textos por defecto del HTML.
export function pintarAgradecimiento(pantalla) {
  if (!pantalla) return;

  const redes = pantalla.redes || [];
  const contenedor = $('redes-agradecimiento');
  const lista = $('redes-lista');
  const boton = $('reiniciar');

  $('final-etiqueta').textContent = pantalla.etiqueta;
  $('final-etiqueta').hidden = !pantalla.etiqueta;
  $('final-titulo').textContent = pantalla.titulo;

  $('final-mensajes').replaceChildren(
    ...pantalla.mensajes.map(comoMensaje).flatMap((mensaje, indice) =>
      parrafos(mensaje.texto).map((parrafo) => {
        const p = crear('p', 'agradecimiento-texto', undefined, { 'data-mensaje': indice });
        conNegritas(p, parrafo);
        return p;
      })
    )
  );

  $('final-redes-titulo').textContent = pantalla.redes_titulo;
  $('final-redes-titulo').hidden = !pantalla.redes_titulo;

  boton.hidden = pantalla.boton_destino === 'ninguno';
  $('final-boton-texto').textContent = pantalla.boton_texto;
  aplicarEstilos(pantalla);

  if (!redes.length) {
    contenedor.hidden = true;
    lista.replaceChildren();
    return;
  }

  contenedor.hidden = false;
  pintarRedes(lista, redes, pantalla.redes_estilo || {});
}

// Mismas redes sociales (y mismo diseño) que la pantalla de agradecimiento, pero debajo
// del botón "Volver a hacer el test" en la pantalla de diagnóstico.
export function pintarRedesResumen(pantalla) {
  const redes = (pantalla && pantalla.redes) || [];
  const contenedor = $('redes-resumen');
  const lista = $('redes-resumen-lista');
  const titulo = $('redes-resumen-titulo');

  if (!pantalla || !redes.length) {
    contenedor.hidden = true;
    lista.replaceChildren();
    return;
  }

  titulo.textContent = pantalla.redes_titulo;
  titulo.hidden = !pantalla.redes_titulo;
  contenedor.hidden = false;
  pintarRedes(lista, redes, pantalla.redes_estilo || {});
}

// Botones de redes con el diseño elegido en el admin (contenido, icono, fondo, forma, tamaño…).
// El diseño general va en atributos y variables CSS de la lista; lo propio de cada red, en su botón.
function pintarRedes(lista, redes, estilo) {
  const variables = {
    '--red-tamano': estilo.tamano ? `${estilo.tamano}px` : '',
    '--red-separacion': estilo.separacion !== undefined ? `${estilo.separacion}px` : '',
    '--red-fondo': estilo.fondo === 'personalizado' && estilo.colorFondo ? estilo.colorFondo : '',
    '--red-borde': estilo.fondo === 'personalizado' && estilo.colorBorde ? estilo.colorBorde : ''
  };

  Object.assign(lista.dataset, {
    contenido: estilo.contenido || 'icono_texto',
    icono: estilo.icono || 'circulo',
    fondo: estilo.fondo || 'oscuro',
    forma: estilo.forma || 'pildora',
    disposicion: estilo.disposicion || 'fila'
  });
  Object.entries(variables).forEach(([nombre, valor]) => lista.style.setProperty(nombre, valor));
  if (estilo.texto && estilo.texto.fuente) cargarFuentes([estilo.texto.fuente]);

  lista.replaceChildren(
    ...redes.map((red) => {
      const propio = red.estilo || {};
      const nombre = red.usuario || NOMBRES_RED[red.plataforma] || red.plataforma;
      const enlace = crear('a', `red-boton red-${red.plataforma}`, undefined, {
        href: red.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': nombre,
        title: nombre
      });
      const icono = crear('span', 'red-icono');
      const texto = crear('span', 'red-nombre', nombre);

      if (propio.tamano) enlace.style.setProperty('--red-tamano', `${propio.tamano}px`);
      if (propio.colorFondo) enlace.style.setProperty('--red-fondo-propio', propio.colorFondo);

      icono.append(iconoRed(red.plataforma));
      aplicarEstilo(texto, estilo.texto);
      enlace.append(icono, texto);
      return enlace;
    })
  );
}

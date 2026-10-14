import { obtenerMetricasCuestionario, obtenerRespuestasCuestionario } from '../consultas.js';
import { TIPOS_PREGUNTA } from '../diagnostico.js';
import { crear, formatearFecha } from '../utilidades.js';
import { abrirModal, boton, ejecutar } from './interfaz.js';
import { verDetalle } from './historial.js';
import { graficaBarras, graficaHorizontal } from './graficas.js';

const PAISES = {
  MX: '🇲🇽 México',
  PE: '🇵🇪 Perú'
};

const etiquetaPais = (pais) => PAISES[pais] || (pais ? pais : '—');

function etiquetaPlataforma(ua) {
  const texto = ua || '';

  if (!texto) return '—';

  let dispositivo = 'Computadora';
  if (/iPhone/i.test(texto)) dispositivo = 'iPhone';
  else if (/iPad/i.test(texto)) dispositivo = 'iPad';
  else if (/Android/i.test(texto)) dispositivo = /Mobile/i.test(texto) ? 'Android (celular)' : 'Android (tablet)';
  else if (/Macintosh/i.test(texto)) dispositivo = 'Mac';
  else if (/Windows/i.test(texto)) dispositivo = 'Windows';
  else if (/Linux/i.test(texto)) dispositivo = 'Linux';

  let navegador = '';
  if (/Edg\//i.test(texto)) navegador = 'Edge';
  else if (/Chrome\//i.test(texto) && !/Chromium/i.test(texto)) navegador = 'Chrome';
  else if (/CriOS/i.test(texto)) navegador = 'Chrome';
  else if (/Firefox\//i.test(texto)) navegador = 'Firefox';
  else if (/Safari\//i.test(texto)) navegador = 'Safari';

  return navegador ? `${dispositivo} · ${navegador}` : dispositivo;
}

// Colores validados contra el fondo del admin (paleta oscura de referencia, slots 1 y 2).
const COLOR_COMPLETADOS = '#3987e5';
const COLOR_ABANDONADOS = '#d95926';

const PERIODOS = [
  { valor: '7', texto: '7 días' },
  { valor: '30', texto: '30 días' },
  { valor: '90', texto: '90 días' },
  { valor: 'todo', texto: 'Todo' }
];
const TAMANOS_PAGINA = [10, 25, 50];
const CLAVE_PREFERENCIAS = 'admin-metricas';

const fechaCorta = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const fechaLarga = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function leerPreferencias() {
  try {
    return { periodo: '30', porPagina: 10, ...JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS) || '{}') };
  } catch {
    return { periodo: '30', porPagina: 10 };
  }
}

function guardarPreferencias(preferencias) {
  try {
    localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(preferencias));
  } catch {
    // sin almacenamiento: se usan los valores por defecto la próxima vez
  }
}

// Día local (no UTC), para que "hoy" sea el día de quien mira.
const claveDia = (fecha) => fecha.toLocaleDateString('en-CA');

function tipoDispositivo(ua) {
  const texto = ua || '';
  if (!texto) return 'Desconocido';
  if (/iPad|Tablet/i.test(texto) || (/Android/i.test(texto) && !/Mobile/i.test(texto))) return 'Tablet';
  if (/iPhone|Android|Mobile/i.test(texto)) return 'Celular';
  return 'Computadora';
}

let estado;

export async function montar(contenedor) {
  const sesiones = await obtenerMetricasCuestionario();
  const preferencias = leerPreferencias();
  const barra = crear('div', 'barra');
  const titulos = crear('div');
  const filtros = crear('div', 'segmentado segmentado-grande', undefined, { role: 'group', 'aria-label': 'Periodo' });
  const cuerpo = crear('div', 'metricas-cuerpo');

  estado = { sesiones, preferencias, pagina: 1, cuerpo };

  titulos.append(
    crear('h2', '', 'Métricas del cuestionario'),
    crear(
      'p',
      'ayuda',
      'Cada vez que alguien entra al cuestionario se registra hasta qué pregunta llegó, aunque no termine ni deje sus datos.'
    )
  );

  PERIODOS.forEach(({ valor, texto }) => {
    const opcion = crear('button', '', texto, { type: 'button' });
    opcion.classList.toggle('activa', valor === preferencias.periodo);
    opcion.addEventListener('click', () => {
      preferencias.periodo = valor;
      guardarPreferencias(preferencias);
      filtros.querySelectorAll('button').forEach((item) => item.classList.toggle('activa', item === opcion));
      estado.pagina = 1;
      pintar();
    });
    filtros.append(opcion);
  });

  barra.append(titulos, filtros);
  contenedor.replaceChildren(barra, cuerpo);
  pintar();
}

function sesionesDelPeriodo() {
  const { sesiones, preferencias } = estado;
  if (preferencias.periodo === 'todo') return sesiones;

  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  desde.setDate(desde.getDate() - (Number(preferencias.periodo) - 1));
  return sesiones.filter((sesion) => new Date(sesion.creado_en) >= desde);
}

function pintar() {
  const { cuerpo } = estado;

  if (!estado.sesiones.length) {
    cuerpo.replaceChildren(crear('p', 'vacio', 'Todavía no hay intentos de cuestionario registrados.'));
    return;
  }

  const sesiones = sesionesDelPeriodo();

  if (!sesiones.length) {
    cuerpo.replaceChildren(crear('p', 'vacio', 'No hay intentos en este periodo. Prueba con un periodo más largo.'));
    return;
  }

  cuerpo.replaceChildren(resumen(sesiones), seccionGraficas(sesiones), seccionTabla(sesiones));
}

function resumen(sesiones) {
  const total = sesiones.length;
  const completados = sesiones.filter((sesion) => sesion.completado).length;
  const conversion = total ? Math.round((completados / total) * 100) : 0;
  const contenedor = crear('div', 'metricas-resumen');

  contenedor.append(
    tarjetaResumen(total, total === 1 ? 'intento' : 'intentos'),
    tarjetaResumen(completados, 'completados', COLOR_COMPLETADOS),
    tarjetaResumen(total - completados, 'abandonados', COLOR_ABANDONADOS),
    tarjetaResumen(`${conversion}%`, 'conversión (completan el formulario)')
  );
  return contenedor;
}

function tarjetaResumen(numero, etiqueta, color) {
  const tarjeta = crear('div', 'metrica-tarjeta');
  const texto = crear('span', '', etiqueta);

  if (color) {
    const muestra = crear('span', 'grafica-muestra');
    muestra.style.background = color;
    texto.prepend(muestra);
  }

  tarjeta.append(crear('strong', '', String(numero)), texto);
  return tarjeta;
}

function tarjetaGrafica(titulo, ayuda, grafica, clase = '') {
  const tarjeta = crear('section', `grafica-tarjeta ${clase}`);
  tarjeta.append(crear('h3', '', titulo), crear('p', 'ayuda', ayuda), grafica);
  return tarjeta;
}

function seccionGraficas(sesiones) {
  const contenedor = crear('div', 'metricas-graficas');
  contenedor.append(
    tarjetaGrafica('Intentos por día', 'Cuántas personas empezaron el cuestionario cada día y cuántas lo completaron.', graficaPorDia(sesiones), 'grafica-ancha'),
    tarjetaGrafica('Actividad por hora', 'A qué hora del día empiezan el cuestionario (hora local).', graficaPorHora(sesiones)),
    tarjetaGrafica('¿Dónde abandonan?', 'Última pregunta a la que llegaron quienes no completaron el formulario.', graficaAbandono(sesiones)),
    tarjetaGrafica('Dispositivos', 'Desde dónde responden el cuestionario.', graficaDispositivos(sesiones))
  );
  return contenedor;
}

function graficaPorDia(sesiones) {
  const fechas = sesiones.map((sesion) => new Date(sesion.creado_en));
  const hasta = new Date();
  const desde = new Date(hasta);

  if (estado.preferencias.periodo === 'todo') desde.setTime(Math.min(...fechas.map((fecha) => fecha.getTime())));
  else desde.setDate(desde.getDate() - (Number(estado.preferencias.periodo) - 1));
  desde.setHours(0, 0, 0, 0);

  // Todos los días del periodo, incluso los que no tuvieron intentos.
  const dias = [];
  for (const dia = new Date(desde); dia <= hasta; dia.setDate(dia.getDate() + 1)) dias.push(new Date(dia));

  const indice = new Map(dias.map((dia, i) => [claveDia(dia), i]));
  const completados = dias.map(() => 0);
  const abandonados = dias.map(() => 0);

  sesiones.forEach((sesion) => {
    const i = indice.get(claveDia(new Date(sesion.creado_en)));
    if (i === undefined) return;
    if (sesion.completado) completados[i]++;
    else abandonados[i]++;
  });

  const cadaCuanto = Math.ceil(dias.length / 8);

  return graficaBarras({
    categorias: dias.map((dia) => ({ etiqueta: fechaCorta.format(dia), titulo: fechaLarga.format(dia) })),
    series: [
      { nombre: 'Completados', color: COLOR_COMPLETADOS, valores: completados },
      { nombre: 'Abandonados', color: COLOR_ABANDONADOS, valores: abandonados }
    ],
    mostrarEtiqueta: (i, total) => (total - 1 - i) % cadaCuanto === 0,
    descripcion: 'Intentos por día, completados y abandonados'
  });
}

function graficaPorHora(sesiones) {
  const porHora = Array.from({ length: 24 }, () => 0);
  sesiones.forEach((sesion) => porHora[new Date(sesion.creado_en).getHours()]++);

  return graficaBarras({
    categorias: porHora.map((_, hora) => ({ etiqueta: `${hora}h`, titulo: `De ${hora}:00 a ${hora}:59` })),
    series: [{ nombre: 'Intentos', color: COLOR_COMPLETADOS, valores: porHora }],
    mostrarEtiqueta: (hora) => hora % 3 === 0,
    descripcion: 'Intentos por hora del día'
  });
}

function graficaAbandono(sesiones) {
  const abandonos = sesiones.filter((sesion) => !sesion.completado);

  if (!abandonos.length) return crear('p', 'vacio', 'Nadie abandonó en este periodo.');

  const ultima = Math.max(...abandonos.map((sesion) => Math.max(sesion.pregunta_actual, sesion.total_preguntas || 0)), 1);
  const porPregunta = Array.from({ length: ultima }, () => 0);
  abandonos.forEach((sesion) => {
    porPregunta[Math.min(Math.max(sesion.pregunta_actual, 1), ultima) - 1]++;
  });

  return graficaBarras({
    categorias: porPregunta.map((_, i) => ({ etiqueta: String(i + 1), titulo: `Pregunta ${i + 1}` })),
    series: [{ nombre: 'Abandonaron aquí', color: COLOR_ABANDONADOS, valores: porPregunta }],
    mostrarEtiqueta: (i, total) => total <= 16 || i % Math.ceil(total / 12) === 0,
    descripcion: 'Abandonos por pregunta'
  });
}

function graficaDispositivos(sesiones) {
  const conteo = new Map();
  sesiones.forEach((sesion) => {
    const tipo = tipoDispositivo(sesion.plataforma);
    conteo.set(tipo, (conteo.get(tipo) || 0) + 1);
  });

  return graficaHorizontal({
    filas: [...conteo].map(([etiqueta, valor]) => ({ etiqueta, valor })).sort((a, b) => b.valor - a.valor),
    color: COLOR_COMPLETADOS,
    nombre: 'Intentos',
    descripcion: 'Intentos por tipo de dispositivo'
  });
}

function seccionTabla(sesiones) {
  const { preferencias } = estado;
  const seccion = crear('section', 'metricas-tabla');
  const paginas = Math.max(1, Math.ceil(sesiones.length / preferencias.porPagina));
  const pagina = Math.min(estado.pagina, paginas);
  const inicio = (pagina - 1) * preferencias.porPagina;
  const visibles = sesiones.slice(inicio, inicio + preferencias.porPagina);

  const tabla = crear('table', 'tabla tabla-historial');
  const encabezado = crear('thead');
  const cuerpoTabla = crear('tbody');
  const titulos = crear('tr');
  const envoltura = crear('div', 'tabla-envoltura tabla-fija');

  ['Última actividad', 'Llegó hasta', 'Estado', 'Correo', 'Teléfono', 'País', 'Plataforma', ''].forEach((titulo) => {
    titulos.append(crear('th', '', titulo));
  });
  encabezado.append(titulos);
  visibles.forEach((sesion) => cuerpoTabla.append(filaSesion(sesion)));
  tabla.append(encabezado, cuerpoTabla);
  envoltura.append(tabla);

  const irA = (nueva) => {
    estado.pagina = nueva;
    seccion.replaceWith(seccionTabla(sesiones));
  };

  const paginacion = crear('div', 'paginacion');
  const porPagina = crear('select', 'entrada entrada-chica', undefined, { 'aria-label': 'Filas por página' });
  TAMANOS_PAGINA.forEach((tamano) => porPagina.append(new Option(`${tamano} por página`, tamano)));
  porPagina.value = preferencias.porPagina;
  porPagina.addEventListener('change', () => {
    preferencias.porPagina = Number(porPagina.value);
    guardarPreferencias(preferencias);
    irA(1);
  });

  const navegacion = crear('div', 'paginacion-botones');
  const anterior = boton('‹ Anterior', 'boton-secundario boton-chico', () => irA(pagina - 1));
  const siguiente = boton('Siguiente ›', 'boton-secundario boton-chico', () => irA(pagina + 1));
  anterior.disabled = pagina === 1;
  siguiente.disabled = pagina === paginas;
  navegacion.append(anterior, crear('span', 'paginacion-pagina', `Página ${pagina} de ${paginas}`), siguiente);

  paginacion.append(
    crear('span', 'secundario', `Mostrando ${inicio + 1}–${inicio + visibles.length} de ${sesiones.length}`),
    porPagina,
    navegacion
  );

  seccion.append(crear('h3', '', 'Intentos'), envoltura, paginacion);
  return seccion;
}

function filaSesion(sesion) {
  const fila = crear('tr');
  const progreso = sesion.completado
    ? 'Completo'
    : sesion.total_preguntas
      ? `${sesion.pregunta_actual} / ${sesion.total_preguntas}`
      : `Pregunta ${sesion.pregunta_actual}`;

  const celdaProgreso = crear('td');
  celdaProgreso.append(crear('span', `pastilla${sesion.completado ? ' pastilla-completa' : ''}`, progreso));

  const celdaEstado = crear('td');
  celdaEstado.append(
    crear('span', sesion.completado ? 'chip' : 'chip chip-alerta', sesion.completado ? 'Completado' : 'Abandonado')
  );

  const celdaAcciones = crear('td', 'acciones-tabla');
  celdaAcciones.append(boton('Ver respuestas', 'boton-secundario boton-chico', () => verRespuestas(sesion)));
  if (sesion.diagnostico_id) {
    celdaAcciones.append(boton('Ver registro', 'boton-secundario boton-chico', () => verDetalle(sesion.diagnostico_id)));
  }

  fila.append(
    crear('td', 'nowrap', formatearFecha(sesion.actualizado_en)),
    celdaProgreso,
    celdaEstado,
    crear('td', 'nowrap', sesion.registro_correo || '—'),
    crear('td', 'nowrap', sesion.registro_telefono || '—'),
    crear('td', 'nowrap', etiquetaPais(sesion.pais)),
    crear('td', '', etiquetaPlataforma(sesion.plataforma)),
    celdaAcciones
  );

  return fila;
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

async function verRespuestas(sesion) {
  const respuestas = await ejecutar(() => obtenerRespuestasCuestionario(sesion.sesion_id));

  if (!respuestas) return;

  const cuerpo = crear('div', 'campos');
  const progreso = sesion.total_preguntas ? `${sesion.pregunta_actual} / ${sesion.total_preguntas}` : `Pregunta ${sesion.pregunta_actual}`;

  cuerpo.append(
    crear(
      'p',
      'ayuda',
      `Llegó hasta la pregunta ${progreso} · ${sesion.completado ? 'Completó el formulario' : 'No completó el formulario'}`
    )
  );

  if (!respuestas.length) {
    cuerpo.append(crear('p', 'vacio', 'Todavía no respondió ninguna pregunta.'));
  } else {
    agruparRespuestas(respuestas).forEach((preguntas, area) => {
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

      cuerpo.append(bloque);
    });
  }

  abrirModal({ titulo: 'Respuestas de este intento', cuerpo, ancho: 720 });
}

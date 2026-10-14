import { db, transaccion } from '../conexion.js';
import { ErrorApi, texto } from '../validaciones.js';
import { obtenerPreguntasConScore } from './preguntas.js';
import { listarInputs } from './inputs.js';
import { nivelParaPuntaje, rangoGlobal, listarNiveles } from './niveles.js';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAXIMO_TEXTO_ABIERTO = 2000;

// Un perfil por nivel general, en el mismo orden (de menor a mayor puntaje).
const PERFILES = [
  'Empresa consolidada',
  'Oportunidades por potenciar',
  'Potencial de crecimiento',
  'Alto potencial por aprovechar'
];

const insertarDiagnostico = db.prepare(
  'INSERT INTO diagnosticos (nombre, empresa, rubro, correo, telefono, notas, origen, pais, perfil) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
const insertarRespuesta = db.prepare(
  'INSERT INTO diagnostico_respuestas (diagnostico_id, pregunta_id, area, pregunta, tipo, respuesta, score) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const insertarArea = db.prepare(
  'INSERT INTO diagnostico_areas (diagnostico_id, area, puntaje, input, maximo) VALUES (?, ?, ?, ?, ?)'
);
const buscar = db.prepare(
  'SELECT id, nombre, empresa, rubro, correo, telefono, notas, origen, pais, perfil, creado_en FROM diagnosticos WHERE id = ?'
);
const respuestasDe = db.prepare(
  'SELECT pregunta_id, area, pregunta, tipo, respuesta, score FROM diagnostico_respuestas WHERE diagnostico_id = ? ORDER BY id'
);
const areasDe = db.prepare(
  'SELECT area, puntaje, input, maximo FROM diagnostico_areas WHERE diagnostico_id = ? ORDER BY id'
);
const listar = db.prepare(`
  SELECT id, nombre, empresa, rubro, correo, telefono, origen, pais, perfil, creado_en
  FROM diagnosticos
  WHERE nombre LIKE ? OR empresa LIKE ? OR correo LIKE ? OR telefono LIKE ?
  ORDER BY creado_en DESC, id DESC
`);
const listarResumenes = db.prepare(
  'SELECT diagnostico_id, area, input, maximo FROM diagnostico_areas ORDER BY id'
);
const actualizarPersona = db.prepare(
  'UPDATE diagnosticos SET nombre = ?, empresa = ?, rubro = ?, correo = ?, telefono = ?, notas = ? WHERE id = ?'
);
const borrar = db.prepare('DELETE FROM diagnosticos WHERE id = ?');
const sinPerfil = db.prepare('SELECT id FROM diagnosticos WHERE perfil IS NULL');
const guardarPerfil = db.prepare('UPDATE diagnosticos SET perfil = ? WHERE id = ?');

function validarPersona(persona, estricto) {
  const entrada = persona || {};
  const correo = texto(entrada.correo, 'el correo', { max: 160, obligatorio: estricto });

  if (correo && !CORREO.test(correo)) {
    throw new ErrorApi('Revisa el correo: no parece válido');
  }

  return {
    nombre: texto(entrada.nombre, 'el nombre', { max: 120 }),
    empresa: texto(entrada.empresa, 'la empresa', { max: 120, obligatorio: estricto }),
    rubro: texto(entrada.rubro, 'el rubro', { max: 120, obligatorio: estricto }),
    correo,
    telefono: texto(entrada.telefono, 'el teléfono', { max: 40, obligatorio: false }),
    notas: texto(entrada.notas, 'las notas', { max: 2000, obligatorio: false })
  };
}

function respuestaAbierta(pregunta, entrante, estricto) {
  const contenido = typeof entrante.texto === 'string' ? entrante.texto.trim() : '';

  if (!contenido) {
    if (estricto && pregunta.obligatoria) {
      throw new ErrorApi(`Falta responder: ${pregunta.pregunta}`);
    }
    return [];
  }

  if (contenido.length > MAXIMO_TEXTO_ABIERTO) {
    throw new ErrorApi(`La respuesta a "${pregunta.pregunta}" es demasiado larga`);
  }

  return [{ respuesta: contenido, score: 0 }];
}

function respuestaConAlternativas(pregunta, entrante, estricto) {
  const enviadas = Array.isArray(entrante.alternativas) ? entrante.alternativas.map(Number) : [];
  const ids = [...new Set(enviadas)];

  if (pregunta.tipo === 'unica' && ids.length > 1) {
    throw new ErrorApi(`Solo puedes elegir una opción en: ${pregunta.pregunta}`);
  }

  const elegidas = ids.map((id) => pregunta.alternativas.find((alternativa) => alternativa.id === id));

  if (elegidas.includes(undefined)) {
    throw new ErrorApi(`Hay una alternativa que no existe en: ${pregunta.pregunta}`);
  }

  if (!elegidas.length && estricto && pregunta.obligatoria) {
    throw new ErrorApi(`Falta responder: ${pregunta.pregunta}`);
  }

  return elegidas.map((alternativa) => {
    if (alternativa.es_otro) {
      const contenido = typeof entrante.texto === 'string' ? entrante.texto.trim() : '';

      if (!contenido) {
        if (estricto) {
          throw new ErrorApi(`Escribe tu respuesta en "Otro" para: ${pregunta.pregunta}`);
        }
        return { respuesta: alternativa.alternativa, score: alternativa.score };
      }

      return { respuesta: contenido, score: alternativa.score };
    }

    return { respuesta: alternativa.alternativa, score: alternativa.score };
  });
}

function evaluar(respuestas, estricto) {
  const entrantes = new Map(
    (Array.isArray(respuestas) ? respuestas : []).map((item) => [Number(item && item.pregunta_id), item])
  );
  const totales = new Map();
  const filas = [];

  obtenerPreguntasConScore({ soloActivas: true }).forEach((pregunta) => {
    if (!totales.has(pregunta.area_id)) {
      totales.set(pregunta.area_id, { areaId: pregunta.area_id, area: pregunta.area, puntaje: 0 });
    }

    const entrante = entrantes.get(pregunta.id) || {};
    const dadas =
      pregunta.tipo === 'abierta'
        ? respuestaAbierta(pregunta, entrante, estricto)
        : respuestaConAlternativas(pregunta, entrante, estricto);

    dadas.forEach(({ respuesta, score }) => {
      filas.push({
        pregunta_id: pregunta.id,
        area: pregunta.area,
        pregunta: pregunta.pregunta,
        tipo: pregunta.tipo,
        respuesta,
        score
      });
    });

    const sumaPregunta = dadas.reduce((total, { score }) => total + score, 0);
    const ponderacion =
      pregunta.tipo === 'multiple'
        ? pregunta.ponderaciones.find((rango) => sumaPregunta >= rango.minimo && sumaPregunta <= rango.maximo)
        : null;

    totales.get(pregunta.area_id).puntaje += ponderacion ? ponderacion.valor : sumaPregunta;
  });

  const inputs = listarInputs();

  const areas = [...totales.values()].map(({ areaId, area, puntaje }) => {
    const rangos = inputs.filter((rango) => rango.area_id === areaId);
    const rango = rangos.find((item) => puntaje >= item.minimo && puntaje <= item.maximo);

    return {
      area,
      puntaje,
      input: rango ? rango.input : 0,
      maximo: rangos.length ? Math.max(...rangos.map((item) => item.input)) : 0
    };
  });

  return { filas, areas };
}

export function respuestasLegibles(respuestas) {
  return evaluar(respuestas, false).filas;
}

export function vistaPreviaDiagnostico(respuestas) {
  const { areas } = evaluar(respuestas, false);
  const puntajeTotal = areas.reduce((total, area) => total + area.input, 0);
  const nivel = nivelParaPuntaje(puntajeTotal);
  const niveles = listarNiveles();
  const indice = nivel ? niveles.findIndex((item) => item.id === nivel.id) : -1;
  const fraccion = indice >= 0 ? 1 - (indice + 0.5) / niveles.length : 1;

  return {
    areas,
    puntajeTotal,
    nivel,
    rango: rangoGlobal(),
    fraccion
  };
}

// Perfil del historial: el nivel general en el que cae el total de inputs y un score 0–100
// repartido en tramos iguales por nivel, para que el número siempre coincida con la etiqueta.
// Se calcula una sola vez al guardar el registro y queda congelado.
function perfilDe(areas, niveles) {
  if (!areas.length) {
    return null;
  }

  const total = areas.reduce((suma, area) => suma + area.input, 0);
  const indice = niveles.findIndex((nivel) => total >= nivel.minimo && total <= nivel.maximo);

  if (indice < 0) {
    return { total, indice: -1, score: null, nombre: '', titulo: '', color: '' };
  }

  const nivel = niveles[indice];
  const tramo = 100 / niveles.length;
  const avance = nivel.maximo > nivel.minimo ? (total - nivel.minimo) / (nivel.maximo - nivel.minimo) : 1;
  const inicio = indice === 0 ? 0 : Math.round(tramo * indice) + 1;
  const fin = Math.round(tramo * (indice + 1));

  return {
    total,
    indice,
    niveles: niveles.length,
    score: Math.round(inicio + (fin - inicio) * avance),
    nombre: niveles.length === PERFILES.length ? PERFILES[indice] : nivel.titulo,
    titulo: nivel.titulo,
    color: nivel.color,
    minimo: nivel.minimo,
    maximo: nivel.maximo
  };
}

function leerPerfil(fila) {
  return { ...fila, perfil: fila.perfil ? JSON.parse(fila.perfil) : null };
}

// Registros guardados antes de congelar el perfil: se les fija el que corresponde hoy, una sola vez.
function completarPerfilesFaltantes() {
  const pendientes = sinPerfil.all();

  if (!pendientes.length) return;

  const niveles = listarNiveles();

  transaccion(() => {
    pendientes.forEach(({ id }) => {
      const perfil = perfilDe(areasDe.all(id), niveles);
      if (perfil) guardarPerfil.run(JSON.stringify(perfil), id);
    });
  });
}

completarPerfilesFaltantes();

export function obtenerDiagnostico(id) {
  const diagnostico = buscar.get(id);

  if (!diagnostico) {
    throw new ErrorApi('El registro no existe', 404);
  }

  return {
    ...leerPerfil(diagnostico),
    respuestas: respuestasDe.all(id).map((fila) => ({ ...fila })),
    areas: areasDe.all(id).map((fila) => ({ ...fila }))
  };
}

export function listarDiagnosticos(busqueda) {
  const termino = texto(busqueda, 'la búsqueda', { max: 100, obligatorio: false });
  const patron = `%${termino}%`;
  const resumenes = new Map();

  listarResumenes.all().forEach(({ diagnostico_id, area, input, maximo }) => {
    if (!resumenes.has(diagnostico_id)) {
      resumenes.set(diagnostico_id, []);
    }
    resumenes.get(diagnostico_id).push({ area, input, maximo });
  });

  return listar.all(patron, patron, patron, patron).map((fila) => ({
    ...leerPerfil(fila),
    areas: resumenes.get(fila.id) || []
  }));
}

export function guardarDiagnostico(persona, respuestas, { origen, estricto, pais = '' }) {
  const datos = validarPersona(persona, estricto);
  const { filas, areas } = evaluar(respuestas, estricto);
  const perfil = perfilDe(areas, listarNiveles());

  const id = transaccion(() => {
    const { lastInsertRowid } = insertarDiagnostico.run(
      datos.nombre,
      datos.empresa,
      datos.rubro,
      datos.correo,
      datos.telefono,
      datos.notas,
      origen,
      pais,
      perfil ? JSON.stringify(perfil) : null
    );

    filas.forEach((fila) => {
      insertarRespuesta.run(
        lastInsertRowid,
        fila.pregunta_id,
        fila.area,
        fila.pregunta,
        fila.tipo,
        fila.respuesta,
        fila.score
      );
    });

    areas.forEach((area) => {
      insertarArea.run(lastInsertRowid, area.area, area.puntaje, area.input, area.maximo);
    });

    return lastInsertRowid;
  });

  return obtenerDiagnostico(id);
}

export function actualizarDiagnostico(id, persona) {
  const datos = validarPersona(persona, false);
  const { changes } = actualizarPersona.run(
    datos.nombre,
    datos.empresa,
    datos.rubro,
    datos.correo,
    datos.telefono,
    datos.notas,
    id
  );

  if (!changes) {
    throw new ErrorApi('El registro no existe', 404);
  }

  return obtenerDiagnostico(id);
}

export function eliminarDiagnostico(id) {
  if (!borrar.run(id).changes) {
    throw new ErrorApi('El registro no existe', 404);
  }
}

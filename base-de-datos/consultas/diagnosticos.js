import { db, transaccion } from '../conexion.js';
import { ErrorApi, texto } from '../validaciones.js';
import { obtenerPreguntasConScore } from './preguntas.js';
import { listarInputs } from './inputs.js';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAXIMO_TEXTO_ABIERTO = 2000;

const insertarDiagnostico = db.prepare(
  'INSERT INTO diagnosticos (nombre, empresa, correo, telefono, notas, origen) VALUES (?, ?, ?, ?, ?, ?)'
);
const insertarRespuesta = db.prepare(
  'INSERT INTO diagnostico_respuestas (diagnostico_id, pregunta_id, area, pregunta, tipo, respuesta, score) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const insertarArea = db.prepare(
  'INSERT INTO diagnostico_areas (diagnostico_id, area, puntaje, input, maximo) VALUES (?, ?, ?, ?, ?)'
);
const buscar = db.prepare(
  'SELECT id, nombre, empresa, correo, telefono, notas, origen, creado_en FROM diagnosticos WHERE id = ?'
);
const respuestasDe = db.prepare(
  'SELECT pregunta_id, area, pregunta, tipo, respuesta, score FROM diagnostico_respuestas WHERE diagnostico_id = ? ORDER BY id'
);
const areasDe = db.prepare(
  'SELECT area, puntaje, input, maximo FROM diagnostico_areas WHERE diagnostico_id = ? ORDER BY id'
);
const listar = db.prepare(`
  SELECT id, nombre, empresa, correo, telefono, origen, creado_en
  FROM diagnosticos
  WHERE nombre LIKE ? OR empresa LIKE ? OR correo LIKE ? OR telefono LIKE ?
  ORDER BY creado_en DESC, id DESC
`);
const listarResumenes = db.prepare(
  'SELECT diagnostico_id, area, input, maximo FROM diagnostico_areas ORDER BY id'
);
const actualizarPersona = db.prepare(
  'UPDATE diagnosticos SET nombre = ?, empresa = ?, correo = ?, telefono = ?, notas = ? WHERE id = ?'
);
const borrar = db.prepare('DELETE FROM diagnosticos WHERE id = ?');

function validarPersona(persona, estricto) {
  const entrada = persona || {};
  const correo = texto(entrada.correo, 'el correo', { max: 160, obligatorio: estricto });

  if (correo && !CORREO.test(correo)) {
    throw new ErrorApi('Revisa el correo: no parece válido');
  }

  return {
    nombre: texto(entrada.nombre, 'el nombre', { max: 120 }),
    empresa: texto(entrada.empresa, 'la empresa', { max: 120, obligatorio: false }),
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

  return elegidas.map(({ alternativa, score }) => ({ respuesta: alternativa, score }));
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

export function obtenerDiagnostico(id) {
  const diagnostico = buscar.get(id);

  if (!diagnostico) {
    throw new ErrorApi('El registro no existe', 404);
  }

  return {
    ...diagnostico,
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
    ...fila,
    areas: resumenes.get(fila.id) || []
  }));
}

export function guardarDiagnostico(persona, respuestas, { origen, estricto }) {
  const datos = validarPersona(persona, estricto);
  const { filas, areas } = evaluar(respuestas, estricto);

  const id = transaccion(() => {
    const { lastInsertRowid } = insertarDiagnostico.run(
      datos.nombre,
      datos.empresa,
      datos.correo,
      datos.telefono,
      datos.notas,
      origen
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

import { db, transaccion } from '../conexion.js';
import { ErrorApi, entero, identificadores, texto } from '../validaciones.js';

const TIPOS = ['unica', 'multiple', 'abierta'];
const MAXIMO_ALTERNATIVAS = 20;

const SELECCION = `
  SELECT p.id, p.area_id, a.nombre AS area, p.pregunta, p.tipo, p.obligatoria, p.activa, p.orden
  FROM preguntas p
  JOIN areas a ON a.id = p.area_id
`;
const ORDEN = 'ORDER BY a.orden, a.id, p.orden, p.id';

const listarTodas = db.prepare(`${SELECCION} ${ORDEN}`);
const listarActivas = db.prepare(`${SELECCION} WHERE p.activa = 1 ${ORDEN}`);
const buscarPorId = db.prepare(`${SELECCION} WHERE p.id = ?`);
const listarAlternativas = db.prepare(
  'SELECT id, pregunta_id, alternativa, score FROM alternativas ORDER BY orden, id'
);
const alternativasDe = db.prepare(
  'SELECT id, pregunta_id, alternativa, score FROM alternativas WHERE pregunta_id = ? ORDER BY orden, id'
);
const buscarArea = db.prepare('SELECT id FROM areas WHERE id = ?');
const ultimoOrden = db.prepare(
  'SELECT COALESCE(MAX(orden), 0) AS ultimo FROM preguntas WHERE area_id = ?'
);
const areaDe = db.prepare('SELECT area_id FROM preguntas WHERE id = ?');
const insertar = db.prepare(
  'INSERT INTO preguntas (area_id, pregunta, tipo, obligatoria, activa, orden) VALUES (?, ?, ?, ?, ?, ?)'
);
const actualizar = db.prepare(
  'UPDATE preguntas SET area_id = ?, pregunta = ?, tipo = ?, obligatoria = ?, activa = ?, orden = ? WHERE id = ?'
);
const ordenActual = db.prepare('SELECT orden FROM preguntas WHERE id = ?');
const borrar = db.prepare('DELETE FROM preguntas WHERE id = ?');
const asignarOrden = db.prepare('UPDATE preguntas SET orden = ? WHERE id = ? AND area_id = ?');
const borrarAlternativas = db.prepare('DELETE FROM alternativas WHERE pregunta_id = ?');
const insertarAlternativa = db.prepare(
  'INSERT INTO alternativas (pregunta_id, alternativa, score, orden) VALUES (?, ?, ?, ?)'
);

function armar(filas, alternativas) {
  return filas.map((fila) => ({
    id: fila.id,
    area_id: fila.area_id,
    area: fila.area,
    pregunta: fila.pregunta,
    tipo: fila.tipo,
    obligatoria: Boolean(fila.obligatoria),
    activa: Boolean(fila.activa),
    orden: fila.orden,
    alternativas: alternativas
      .filter((alternativa) => alternativa.pregunta_id === fila.id)
      .map(({ id, alternativa, score }) => ({ id, alternativa, score }))
  }));
}

function validar(datos) {
  const entrada = datos || {};
  const areaId = entero(entrada.area_id, 'el área');
  const pregunta = texto(entrada.pregunta, 'la pregunta', { max: 500 });

  if (!buscarArea.get(areaId)) {
    throw new ErrorApi('El área no existe');
  }

  if (!TIPOS.includes(entrada.tipo)) {
    throw new ErrorApi('El tipo de pregunta no es válido');
  }

  const tipo = entrada.tipo;
  let alternativas = [];

  if (tipo !== 'abierta') {
    const lista = Array.isArray(entrada.alternativas) ? entrada.alternativas : [];
    const minimo = tipo === 'unica' ? 2 : 1;

    if (lista.length < minimo) {
      throw new ErrorApi(`Agrega al menos ${minimo} ${minimo === 1 ? 'opción' : 'alternativas'}`);
    }

    if (lista.length > MAXIMO_ALTERNATIVAS) {
      throw new ErrorApi(`Máximo ${MAXIMO_ALTERNATIVAS} alternativas por pregunta`);
    }

    alternativas = lista.map((item, indice) => ({
      alternativa: texto(item && item.alternativa, `la alternativa ${indice + 1}`, { max: 200 }),
      score: entero(item && item.score, `el score de la alternativa ${indice + 1}`)
    }));
  }

  return {
    areaId,
    pregunta,
    tipo,
    obligatoria: tipo === 'unica' || entrada.obligatoria ? 1 : 0,
    activa: entrada.activa === undefined || entrada.activa ? 1 : 0,
    alternativas
  };
}

function guardarAlternativas(preguntaId, alternativas) {
  borrarAlternativas.run(preguntaId);
  alternativas.forEach(({ alternativa, score }, posicion) => {
    insertarAlternativa.run(preguntaId, alternativa, score, posicion + 1);
  });
}

export function obtenerPreguntasConScore({ soloActivas = false } = {}) {
  const filas = (soloActivas ? listarActivas : listarTodas).all();
  return armar(filas, listarAlternativas.all());
}

export function obtenerPreguntasPublicas() {
  return obtenerPreguntasConScore({ soloActivas: true }).map((pregunta) => ({
    id: pregunta.id,
    area_id: pregunta.area_id,
    area: pregunta.area,
    pregunta: pregunta.pregunta,
    tipo: pregunta.tipo,
    obligatoria: pregunta.obligatoria,
    alternativas: pregunta.alternativas.map(({ id, alternativa }) => ({ id, alternativa }))
  }));
}

export function obtenerPregunta(id) {
  const fila = buscarPorId.get(id);

  if (!fila) {
    throw new ErrorApi('La pregunta no existe', 404);
  }

  return armar([fila], alternativasDe.all(id))[0];
}

export function crearPregunta(datos) {
  const { areaId, pregunta, tipo, obligatoria, activa, alternativas } = validar(datos);

  return transaccion(() => {
    const orden = ultimoOrden.get(areaId).ultimo + 1;
    const { lastInsertRowid } = insertar.run(areaId, pregunta, tipo, obligatoria, activa, orden);
    guardarAlternativas(lastInsertRowid, alternativas);
    return obtenerPregunta(lastInsertRowid);
  });
}

export function actualizarPregunta(id, datos) {
  const { areaId, pregunta, tipo, obligatoria, activa, alternativas } = validar(datos);
  const actual = areaDe.get(id);

  if (!actual) {
    throw new ErrorApi('La pregunta no existe', 404);
  }

  return transaccion(() => {
    const orden =
      actual.area_id === areaId ? ordenActual.get(id).orden : ultimoOrden.get(areaId).ultimo + 1;
    actualizar.run(areaId, pregunta, tipo, obligatoria, activa, orden, id);
    guardarAlternativas(id, alternativas);
    return obtenerPregunta(id);
  });
}

export function eliminarPregunta(id) {
  if (!borrar.run(id).changes) {
    throw new ErrorApi('La pregunta no existe', 404);
  }
}

export function ordenarPreguntas(areaId, ids) {
  const area = entero(areaId, 'el área');
  const lista = identificadores(ids, 'el orden');

  transaccion(() => {
    lista.forEach((id, posicion) => asignarOrden.run(posicion + 1, id, area));
  });
}

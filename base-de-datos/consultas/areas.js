import { db, transaccion } from '../conexion.js';
import { ErrorApi, identificadores, texto } from '../validaciones.js';
import { obtenerPreguntasConScore } from './preguntas.js';
import { listarInputs } from './inputs.js';

const listar = db.prepare('SELECT id, nombre, orden FROM areas ORDER BY orden, id');
const buscar = db.prepare('SELECT id, nombre, orden FROM areas WHERE id = ?');
const insertar = db.prepare(
  'INSERT INTO areas (nombre, orden) VALUES (?, (SELECT COALESCE(MAX(orden), 0) + 1 FROM areas))'
);
const renombrar = db.prepare('UPDATE areas SET nombre = ? WHERE id = ?');
const borrar = db.prepare('DELETE FROM areas WHERE id = ?');
const asignarOrden = db.prepare('UPDATE areas SET orden = ? WHERE id = ?');

function nombreValido(nombre) {
  return texto(nombre, 'el nombre del área', { max: 80 });
}

function conNombreUnico(operacion) {
  try {
    return operacion();
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      throw new ErrorApi('Ya existe un área con ese nombre', 409);
    }
    throw error;
  }
}

export function obtenerEstructura() {
  const preguntas = obtenerPreguntasConScore();
  const inputs = listarInputs();

  return listar.all().map(({ id, nombre, orden }) => ({
    id,
    nombre,
    orden,
    preguntas: preguntas.filter((pregunta) => pregunta.area_id === id),
    inputs: inputs.filter((input) => input.area_id === id)
  }));
}

export function crearArea(nombre) {
  const valido = nombreValido(nombre);
  const { lastInsertRowid } = conNombreUnico(() => insertar.run(valido));
  return { ...buscar.get(lastInsertRowid) };
}

export function actualizarArea(id, nombre) {
  const valido = nombreValido(nombre);
  const { changes } = conNombreUnico(() => renombrar.run(valido, id));

  if (!changes) {
    throw new ErrorApi('El área no existe', 404);
  }

  return { ...buscar.get(id) };
}

export function eliminarArea(id) {
  if (!borrar.run(id).changes) {
    throw new ErrorApi('El área no existe', 404);
  }
}

export function ordenarAreas(ids) {
  const lista = identificadores(ids, 'el orden');

  transaccion(() => {
    lista.forEach((id, posicion) => asignarOrden.run(posicion + 1, id));
  });
}

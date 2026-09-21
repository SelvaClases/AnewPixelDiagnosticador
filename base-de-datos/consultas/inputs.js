import { db } from '../conexion.js';
import { ErrorApi, entero } from '../validaciones.js';

const listar = db.prepare(
  'SELECT id, area_id, minimo, maximo, input FROM inputs ORDER BY area_id, minimo, id'
);
const buscar = db.prepare('SELECT id, area_id, minimo, maximo, input FROM inputs WHERE id = ?');
const buscarArea = db.prepare('SELECT id FROM areas WHERE id = ?');
const buscarCruce = db.prepare(
  'SELECT id FROM inputs WHERE area_id = ? AND id != ? AND minimo <= ? AND maximo >= ?'
);
const insertar = db.prepare(
  'INSERT INTO inputs (area_id, minimo, maximo, input) VALUES (?, ?, ?, ?)'
);
const actualizar = db.prepare(
  'UPDATE inputs SET area_id = ?, minimo = ?, maximo = ?, input = ? WHERE id = ?'
);
const borrar = db.prepare('DELETE FROM inputs WHERE id = ?');

function validar(datos, id = 0) {
  const entrada = datos || {};
  const areaId = entero(entrada.area_id, 'el área');
  const minimo = entero(entrada.minimo, 'el valor inicial del rango');
  const maximo = entero(entrada.maximo, 'el valor final del rango');
  const input = entero(entrada.input, 'el input');

  if (!buscarArea.get(areaId)) {
    throw new ErrorApi('El área no existe');
  }

  if (minimo > maximo) {
    throw new ErrorApi('El valor inicial no puede ser mayor que el final');
  }

  if (buscarCruce.get(areaId, id, maximo, minimo)) {
    throw new ErrorApi('El rango se cruza con otro que ya existe en esta área');
  }

  return { areaId, minimo, maximo, input };
}

export function listarInputs() {
  return listar.all().map(({ id, area_id, minimo, maximo, input }) => ({
    id,
    area_id,
    minimo,
    maximo,
    input
  }));
}

export function crearInput(datos) {
  const { areaId, minimo, maximo, input } = validar(datos);
  const { lastInsertRowid } = insertar.run(areaId, minimo, maximo, input);
  return { ...buscar.get(lastInsertRowid) };
}

export function actualizarInput(id, datos) {
  const { areaId, minimo, maximo, input } = validar(datos, id);

  if (!actualizar.run(areaId, minimo, maximo, input, id).changes) {
    throw new ErrorApi('El rango no existe', 404);
  }

  return { ...buscar.get(id) };
}

export function eliminarInput(id) {
  if (!borrar.run(id).changes) {
    throw new ErrorApi('El rango no existe', 404);
  }
}

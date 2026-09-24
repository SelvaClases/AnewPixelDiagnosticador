import { db } from '../conexion.js';

const listar = db.prepare(
  'SELECT id, pregunta_id, minimo, maximo, valor FROM ponderaciones ORDER BY pregunta_id, minimo, id'
);
const borrarDePregunta = db.prepare('DELETE FROM ponderaciones WHERE pregunta_id = ?');
const insertar = db.prepare(
  'INSERT INTO ponderaciones (pregunta_id, minimo, maximo, valor) VALUES (?, ?, ?, ?)'
);

export function listarPonderaciones() {
  return listar.all().map(({ id, pregunta_id, minimo, maximo, valor }) => ({
    id,
    pregunta_id,
    minimo,
    maximo,
    valor
  }));
}

export function guardarPonderaciones(preguntaId, ponderaciones) {
  borrarDePregunta.run(preguntaId);
  ponderaciones.forEach(({ minimo, maximo, valor }) => {
    insertar.run(preguntaId, minimo, maximo, valor);
  });
}

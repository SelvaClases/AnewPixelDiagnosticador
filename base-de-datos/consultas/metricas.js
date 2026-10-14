import { db, transaccion } from '../conexion.js';
import { ErrorApi, texto, entero } from '../validaciones.js';
import { respuestasLegibles } from './diagnosticos.js';

const registrar = db.prepare(`
  INSERT INTO sesiones_cuestionario (sesion_id, pregunta_actual, total_preguntas, pais, plataforma)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(sesion_id) DO UPDATE SET
    pregunta_actual = MAX(pregunta_actual, excluded.pregunta_actual),
    total_preguntas = excluded.total_preguntas,
    pais = CASE WHEN excluded.pais != '' THEN excluded.pais ELSE pais END,
    actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
`);

const completar = db.prepare(`
  UPDATE sesiones_cuestionario
  SET completado = 1, diagnostico_id = ?, actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  WHERE sesion_id = ?
`);

const listar = db.prepare(`
  SELECT
    s.id, s.sesion_id, s.pregunta_actual, s.total_preguntas, s.completado, s.diagnostico_id,
    s.pais, s.plataforma, s.creado_en, s.actualizado_en,
    d.nombre AS registro_nombre, d.correo AS registro_correo, d.telefono AS registro_telefono
  FROM sesiones_cuestionario s
  LEFT JOIN diagnosticos d ON d.id = s.diagnostico_id
  ORDER BY s.actualizado_en DESC
  LIMIT 500
`);

const borrarRespuestas = db.prepare('DELETE FROM sesion_cuestionario_respuestas WHERE sesion_id = ?');
const insertarRespuesta = db.prepare(`
  INSERT INTO sesion_cuestionario_respuestas (sesion_id, pregunta_id, area, pregunta, tipo, respuesta, score)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const respuestasDe = db.prepare(`
  SELECT pregunta_id, area, pregunta, tipo, respuesta, score
  FROM sesion_cuestionario_respuestas
  WHERE sesion_id = ?
  ORDER BY id
`);

export function registrarProgreso({ sesion_id, pregunta_actual, total_preguntas, pais, plataforma, respuestas }) {
  const sesionId = texto(sesion_id, 'la sesión', { max: 120 });
  const preguntaActual = entero(pregunta_actual, 'la pregunta actual');
  const totalPreguntas = entero(total_preguntas, 'el total de preguntas');

  if (preguntaActual < 0 || totalPreguntas < 0) {
    throw new ErrorApi('Revisa la pregunta actual: no puede ser negativa');
  }

  const filas = Array.isArray(respuestas) ? respuestasLegibles(respuestas) : [];

  transaccion(() => {
    registrar.run(sesionId, preguntaActual, totalPreguntas, (pais || '').slice(0, 10), (plataforma || '').slice(0, 300));
    borrarRespuestas.run(sesionId);
    filas.forEach((fila) => {
      insertarRespuesta.run(sesionId, fila.pregunta_id, fila.area, fila.pregunta, fila.tipo, fila.respuesta, fila.score);
    });
  });
}

export function marcarCompletado(sesionId, diagnosticoId) {
  const limpio = typeof sesionId === 'string' ? sesionId.trim() : '';
  if (!limpio) return;
  completar.run(diagnosticoId || null, limpio);
}

export function listarSesiones() {
  return listar.all();
}

export function obtenerRespuestasDeSesion(sesionId) {
  const limpio = texto(sesionId, 'la sesión', { max: 120 });
  return respuestasDe.all(limpio);
}

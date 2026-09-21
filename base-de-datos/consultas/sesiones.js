import { createHash, randomBytes } from 'node:crypto';
import { db } from '../conexion.js';

const AHORA = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";
const VIGENTE = `s.expira_en > ${AHORA} AND s.ultima_actividad > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours')`;
const MARGEN_ACTIVIDAD = 30 * 1000;
const TIEMPO_EN_LINEA = 3 * 60 * 1000;

const insertar = db.prepare(`
  INSERT INTO sesiones (usuario_id, token_hash, ip, navegador, expira_en)
  VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '+12 hours'))
`);
const buscar = db.prepare(`
  SELECT s.id, s.usuario_id, s.ultima_actividad, u.nombre, u.correo, u.debe_cambiar_clave
  FROM sesiones s
  JOIN usuarios u ON u.id = s.usuario_id
  WHERE s.token_hash = ? AND u.activo = 1 AND ${VIGENTE}
`);
const registrar = db.prepare(`UPDATE sesiones SET ultima_actividad = ${AHORA} WHERE id = ?`);
const cerrar = db.prepare('DELETE FROM sesiones WHERE id = ?');
const cerrarDeUsuario = db.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND id != ?');
const limpiar = db.prepare(`DELETE FROM sesiones WHERE expira_en <= ${AHORA} OR ultima_actividad <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours')`);
const listarActivas = db.prepare(`
  SELECT s.id, s.usuario_id, u.nombre, u.correo, s.ip, s.navegador, s.creado_en, s.ultima_actividad
  FROM sesiones s
  JOIN usuarios u ON u.id = s.usuario_id
  WHERE u.activo = 1 AND ${VIGENTE}
  ORDER BY s.ultima_actividad DESC
`);

const huella = (token) => createHash('sha256').update(token).digest('hex');

export function iniciarSesion(usuarioId, ip, navegador) {
  const token = randomBytes(32).toString('base64url');
  insertar.run(usuarioId, huella(token), String(ip || '').slice(0, 64), String(navegador || '').slice(0, 300));
  return token;
}

export function buscarSesion(token) {
  return buscar.get(huella(token));
}

export function registrarActividad(sesion) {
  if (Date.now() - Date.parse(sesion.ultima_actividad) > MARGEN_ACTIVIDAD) {
    registrar.run(sesion.id);
  }
}

export function cerrarSesion(id) {
  return cerrar.run(id).changes > 0;
}

export function cerrarSesionesDe(usuarioId, excepto = 0) {
  cerrarDeUsuario.run(usuarioId, excepto);
}

export function limpiarSesionesVencidas() {
  limpiar.run();
}

export function listarSesionesActivas() {
  return listarActivas.all().map((fila) => ({
    ...fila,
    en_linea: Date.now() - Date.parse(fila.ultima_actividad) < TIEMPO_EN_LINEA
  }));
}

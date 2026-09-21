import { db } from '../conexion.js';
import { cifrarClave, verificarClave } from '../claves.js';
import { administradorInicial } from '../datos.js';
import { ErrorApi, texto } from '../validaciones.js';
import { cerrarSesionesDe, listarSesionesActivas } from './sesiones.js';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLAVE_FALSA = cifrarClave('valor-que-nunca-se-usa');
const COLUMNAS = 'id, nombre, correo, activo, debe_cambiar_clave, creado_en, ultimo_acceso';

const buscarPorId = db.prepare(`SELECT ${COLUMNAS} FROM usuarios WHERE id = ?`);
const buscarPorCorreo = db.prepare(`SELECT ${COLUMNAS}, clave_hash FROM usuarios WHERE correo = ?`);
const claveDe = db.prepare('SELECT clave_hash FROM usuarios WHERE id = ?');
const listar = db.prepare(`SELECT ${COLUMNAS} FROM usuarios ORDER BY nombre COLLATE NOCASE, id`);
const contar = db.prepare('SELECT COUNT(*) AS total FROM usuarios');
const contarActivos = db.prepare('SELECT COUNT(*) AS total FROM usuarios WHERE activo = 1');
const insertar = db.prepare(
  'INSERT INTO usuarios (nombre, correo, clave_hash, activo, debe_cambiar_clave) VALUES (?, ?, ?, 1, ?)'
);
const actualizar = db.prepare('UPDATE usuarios SET nombre = ?, correo = ?, activo = ? WHERE id = ?');
const guardarClave = db.prepare('UPDATE usuarios SET clave_hash = ?, debe_cambiar_clave = ? WHERE id = ?');
const marcarAcceso = db.prepare(
  "UPDATE usuarios SET ultimo_acceso = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
);
const borrar = db.prepare('DELETE FROM usuarios WHERE id = ?');

function publico(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    correo: fila.correo,
    activo: Boolean(fila.activo),
    debe_cambiar_clave: Boolean(fila.debe_cambiar_clave),
    creado_en: fila.creado_en,
    ultimo_acceso: fila.ultimo_acceso
  };
}

function validarDatos(datos) {
  const entrada = datos || {};
  const correo = texto(entrada.correo, 'el correo', { max: 160 }).toLowerCase();

  if (!CORREO.test(correo)) {
    throw new ErrorApi('Revisa el correo: no parece válido');
  }

  return { nombre: texto(entrada.nombre, 'el nombre', { max: 120 }), correo };
}

function validarClave(clave) {
  const valor = typeof clave === 'string' ? clave : '';

  if (valor.length < 10 || valor.length > 128 || !/[A-Za-z]/.test(valor) || !/\d/.test(valor)) {
    throw new ErrorApi('La contraseña debe tener al menos 10 caracteres, con letras y números');
  }

  return valor;
}

function conCorreoUnico(operacion) {
  try {
    return operacion();
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      throw new ErrorApi('Ya existe un administrador con ese correo', 409);
    }
    throw error;
  }
}

function obtener(id) {
  const fila = buscarPorId.get(id);

  if (!fila) {
    throw new ErrorApi('El administrador no existe', 404);
  }

  return fila;
}

function comprobarQuedaUnoActivo(fila) {
  if (fila.activo && contarActivos.get().total <= 1) {
    throw new ErrorApi('Debe quedar al menos un administrador activo');
  }
}

export function crearAdministradorInicial() {
  if (contar.get().total > 0) return false;

  insertar.run(administradorInicial.nombre, administradorInicial.correo, administradorInicial.claveHash, 1);
  return true;
}

export function autenticar(correo, clave) {
  const normal = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  const intento = typeof clave === 'string' ? clave.slice(0, 200) : '';
  const fila = buscarPorCorreo.get(normal);
  const valida = verificarClave(intento, fila ? fila.clave_hash : CLAVE_FALSA);

  if (!fila || !valida || !fila.activo) return null;

  marcarAcceso.run(fila.id);
  return publico(fila);
}

export function verificarClaveActual(id, clave) {
  const guardada = claveDe.get(id);
  const intento = typeof clave === 'string' ? clave.slice(0, 200) : '';

  return Boolean(guardada) && verificarClave(intento, guardada.clave_hash);
}

export function cambiarClave(id, nueva, sesionId) {
  const valida = validarClave(nueva);

  if (verificarClave(valida, claveDe.get(id).clave_hash)) {
    throw new ErrorApi('La nueva contraseña debe ser distinta de la actual');
  }

  guardarClave.run(cifrarClave(valida), 0, id);
  cerrarSesionesDe(id, sesionId);
}

export function listarUsuarios() {
  const activas = listarSesionesActivas();

  return listar.all().map((fila) => {
    const propias = activas.filter((sesion) => sesion.usuario_id === fila.id);

    return {
      ...publico(fila),
      sesiones: propias.length,
      en_linea: propias.some((sesion) => sesion.en_linea),
      ultima_actividad: propias.length ? propias[0].ultima_actividad : null
    };
  });
}

export function crearUsuario(datos) {
  const { nombre, correo } = validarDatos(datos);
  const clave = validarClave((datos || {}).clave);
  const { lastInsertRowid } = conCorreoUnico(() => insertar.run(nombre, correo, cifrarClave(clave), 1));

  return publico(obtener(lastInsertRowid));
}

export function actualizarUsuario(id, datos, propioId) {
  const actual = obtener(id);
  const { nombre, correo } = validarDatos(datos);
  const activo = datos.activo === undefined ? Boolean(actual.activo) : Boolean(datos.activo);

  if (!activo && actual.activo) {
    if (id === propioId) {
      throw new ErrorApi('No puedes desactivar tu propia cuenta');
    }
    comprobarQuedaUnoActivo(actual);
  }

  conCorreoUnico(() => actualizar.run(nombre, correo, activo ? 1 : 0, id));

  if (!activo) cerrarSesionesDe(id);

  return publico(obtener(id));
}

export function restablecerClave(id, clave, propioId) {
  obtener(id);

  if (id === propioId) {
    throw new ErrorApi('Para cambiar tu propia contraseña usa la opción "Mi contraseña"');
  }

  guardarClave.run(cifrarClave(validarClave(clave)), 1, id);
  cerrarSesionesDe(id);
}

export function eliminarUsuario(id, propioId) {
  const actual = obtener(id);

  if (id === propioId) {
    throw new ErrorApi('No puedes eliminar tu propia cuenta');
  }

  comprobarQuedaUnoActivo(actual);
  borrar.run(id);
}

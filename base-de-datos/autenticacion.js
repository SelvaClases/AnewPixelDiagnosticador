import { buscarSesion, registrarActividad } from './consultas/sesiones.js';

export const COOKIE = 'sesion_anewpixel';
export const VIDA_COOKIE = 12 * 60 * 60 * 1000;

const PAGINA_LOGIN = '/login-anewpixel.html';
const MAXIMO_FALLOS = 5;
const VENTANA = 15 * 60 * 1000;
const intentos = new Map();

function leerCookie(req, nombre) {
  for (const par of (req.headers.cookie || '').split(';')) {
    const [clave, ...valor] = par.trim().split('=');

    if (clave === nombre) {
      try {
        return decodeURIComponent(valor.join('='));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function comoUsuario(sesion) {
  return {
    id: sesion.usuario_id,
    nombre: sesion.nombre,
    correo: sesion.correo,
    debe_cambiar_clave: Boolean(sesion.debe_cambiar_clave)
  };
}

export function guardarCookie(req, res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure,
    maxAge: VIDA_COOKIE,
    path: '/'
  });
}

export function borrarCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function requiereSesion(req, res, next) {
  const token = leerCookie(req, COOKIE);
  const sesion = token ? buscarSesion(token) : null;

  res.set('Cache-Control', 'no-store');

  if (!sesion) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'Inicia sesión para continuar' });
    }
    return res.redirect(PAGINA_LOGIN);
  }

  registrarActividad(sesion);
  req.sesion = { id: sesion.id };
  req.usuario = comoUsuario(sesion);
  next();
}

export function sinCambioPendiente(req, res, next) {
  if (req.usuario.debe_cambiar_clave) {
    return res
      .status(403)
      .json({ error: 'Debes cambiar tu contraseña para continuar', codigo: 'cambiar_clave' });
  }
  next();
}

export function segundosDeBloqueo(ip) {
  const registro = intentos.get(ip);

  if (!registro || !registro.bloqueadoHasta || registro.bloqueadoHasta <= Date.now()) return 0;

  return Math.ceil((registro.bloqueadoHasta - Date.now()) / 1000);
}

export function registrarFallo(ip) {
  const ahora = Date.now();
  const registro = intentos.get(ip) || { fallos: [], bloqueadoHasta: 0 };

  registro.fallos = registro.fallos.filter((momento) => ahora - momento < VENTANA);
  registro.fallos.push(ahora);

  if (registro.fallos.length >= MAXIMO_FALLOS) {
    registro.bloqueadoHasta = ahora + VENTANA;
    registro.fallos = [];
  }

  intentos.set(ip, registro);
}

export function limpiarFallos(ip) {
  intentos.delete(ip);
}

setInterval(() => {
  const ahora = Date.now();

  intentos.forEach((registro, ip) => {
    const vigentes = registro.fallos.filter((momento) => ahora - momento < VENTANA);
    if (!vigentes.length && registro.bloqueadoHasta <= ahora) intentos.delete(ip);
  });
}, 10 * 60 * 1000).unref();

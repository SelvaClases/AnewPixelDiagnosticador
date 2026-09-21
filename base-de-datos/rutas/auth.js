import { Router } from 'express';
import {
  requiereSesion,
  guardarCookie,
  borrarCookie,
  segundosDeBloqueo,
  registrarFallo,
  limpiarFallos
} from '../autenticacion.js';
import { autenticar, verificarClaveActual, cambiarClave } from '../consultas/usuarios.js';
import { iniciarSesion, cerrarSesion } from '../consultas/sesiones.js';
import { ErrorApi } from '../validaciones.js';

export const rutasAuth = Router();

function comprobarBloqueo(req, res) {
  const espera = segundosDeBloqueo(req.ip);

  if (espera) {
    const minutos = Math.ceil(espera / 60);

    res.set('Retry-After', String(espera));
    throw new ErrorApi(
      `Demasiados intentos. Vuelve a intentarlo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`,
      429
    );
  }
}

rutasAuth.post('/login', (req, res) => {
  comprobarBloqueo(req, res);

  const usuario = autenticar(req.body.correo, req.body.clave);

  if (!usuario) {
    registrarFallo(req.ip);
    throw new ErrorApi('Correo o contraseña incorrectos', 401);
  }

  limpiarFallos(req.ip);
  guardarCookie(req, res, iniciarSesion(usuario.id, req.ip, req.get('user-agent')));
  res.set('Cache-Control', 'no-store').json({ usuario });
});

rutasAuth.post('/logout', requiereSesion, (req, res) => {
  cerrarSesion(req.sesion.id);
  borrarCookie(res);
  res.json({ ok: true });
});

rutasAuth.get('/yo', requiereSesion, (req, res) => {
  res.json({ usuario: req.usuario });
});

rutasAuth.post('/clave', requiereSesion, (req, res) => {
  comprobarBloqueo(req, res);

  if (!verificarClaveActual(req.usuario.id, req.body.actual)) {
    registrarFallo(req.ip);
    throw new ErrorApi('La contraseña actual no es correcta');
  }

  cambiarClave(req.usuario.id, req.body.nueva, req.sesion.id);
  res.json({ ok: true });
});

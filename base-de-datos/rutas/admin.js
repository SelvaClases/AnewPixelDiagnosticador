import { Router } from 'express';
import { entero } from '../validaciones.js';
import {
  obtenerEstructura,
  crearArea,
  actualizarArea,
  eliminarArea,
  ordenarAreas
} from '../consultas/areas.js';
import {
  crearPregunta,
  actualizarPregunta,
  eliminarPregunta,
  ordenarPreguntas
} from '../consultas/preguntas.js';
import { crearInput, actualizarInput, eliminarInput } from '../consultas/inputs.js';
import {
  listarDiagnosticos,
  obtenerDiagnostico,
  guardarDiagnostico,
  actualizarDiagnostico,
  eliminarDiagnostico
} from '../consultas/diagnosticos.js';

import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  restablecerClave,
  eliminarUsuario
} from '../consultas/usuarios.js';
import { listarSesionesActivas, cerrarSesion } from '../consultas/sesiones.js';
import { borrarCookie } from '../autenticacion.js';
import { ErrorApi } from '../validaciones.js';

export const rutasAdmin = Router();

const identificador = (req) => entero(req.params.id, 'el identificador');
const listo = (res) => res.json({ ok: true });

rutasAdmin.get('/estructura', (req, res) => {
  res.json(obtenerEstructura());
});

rutasAdmin.post('/areas', (req, res) => {
  res.status(201).json(crearArea(req.body.nombre));
});

rutasAdmin.put('/areas/orden', (req, res) => {
  ordenarAreas(req.body.ids);
  listo(res);
});

rutasAdmin.put('/areas/:id', (req, res) => {
  res.json(actualizarArea(identificador(req), req.body.nombre));
});

rutasAdmin.delete('/areas/:id', (req, res) => {
  eliminarArea(identificador(req));
  listo(res);
});

rutasAdmin.post('/preguntas', (req, res) => {
  res.status(201).json(crearPregunta(req.body));
});

rutasAdmin.put('/preguntas/orden', (req, res) => {
  ordenarPreguntas(req.body.area_id, req.body.ids);
  listo(res);
});

rutasAdmin.put('/preguntas/:id', (req, res) => {
  res.json(actualizarPregunta(identificador(req), req.body));
});

rutasAdmin.delete('/preguntas/:id', (req, res) => {
  eliminarPregunta(identificador(req));
  listo(res);
});

rutasAdmin.post('/inputs', (req, res) => {
  res.status(201).json(crearInput(req.body));
});

rutasAdmin.put('/inputs/:id', (req, res) => {
  res.json(actualizarInput(identificador(req), req.body));
});

rutasAdmin.delete('/inputs/:id', (req, res) => {
  eliminarInput(identificador(req));
  listo(res);
});

rutasAdmin.get('/diagnosticos', (req, res) => {
  res.json(listarDiagnosticos(req.query.q));
});

rutasAdmin.post('/diagnosticos', (req, res) => {
  const registro = guardarDiagnostico(req.body.persona, req.body.respuestas, {
    origen: 'manual',
    estricto: false
  });
  res.status(201).json(registro);
});

rutasAdmin.get('/diagnosticos/:id', (req, res) => {
  res.json(obtenerDiagnostico(identificador(req)));
});

rutasAdmin.put('/diagnosticos/:id', (req, res) => {
  res.json(actualizarDiagnostico(identificador(req), req.body));
});

rutasAdmin.delete('/diagnosticos/:id', (req, res) => {
  eliminarDiagnostico(identificador(req));
  listo(res);
});

rutasAdmin.get('/usuarios', (req, res) => {
  res.json(listarUsuarios());
});

rutasAdmin.post('/usuarios', (req, res) => {
  res.status(201).json(crearUsuario(req.body));
});

rutasAdmin.put('/usuarios/:id/clave', (req, res) => {
  restablecerClave(identificador(req), req.body.clave, req.usuario.id);
  listo(res);
});

rutasAdmin.put('/usuarios/:id', (req, res) => {
  res.json(actualizarUsuario(identificador(req), req.body, req.usuario.id));
});

rutasAdmin.delete('/usuarios/:id', (req, res) => {
  eliminarUsuario(identificador(req), req.usuario.id);
  listo(res);
});

rutasAdmin.get('/sesiones', (req, res) => {
  res.json(
    listarSesionesActivas().map((sesion) => ({ ...sesion, actual: sesion.id === req.sesion.id }))
  );
});

rutasAdmin.delete('/sesiones/:id', (req, res) => {
  const id = identificador(req);

  if (!cerrarSesion(id)) {
    throw new ErrorApi('La sesión ya no existe', 404);
  }

  if (id === req.sesion.id) borrarCookie(res);
  listo(res);
});

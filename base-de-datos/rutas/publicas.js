import { Router } from 'express';
import { obtenerPreguntasPublicas } from '../consultas/preguntas.js';
import { guardarDiagnostico, vistaPreviaDiagnostico } from '../consultas/diagnosticos.js';
import { registrarProgreso, marcarCompletado } from '../consultas/metricas.js';
import { listarRedesSocialesPublicas } from '../consultas/redesSociales.js';
import { obtenerPantallaFinalPublica } from '../consultas/pantallaFinal.js';
import { paisDesdeHost } from '../paises.js';

export const rutasPublicas = Router();

rutasPublicas.get('/preguntas', (req, res) => {
  res.json(obtenerPreguntasPublicas());
});

rutasPublicas.get('/redes-sociales', (req, res) => {
  res.json(listarRedesSocialesPublicas());
});

rutasPublicas.get('/pantalla-final', (req, res) => {
  res.json(obtenerPantallaFinalPublica());
});

rutasPublicas.post('/vista-previa', (req, res) => {
  const { puntajeTotal, nivel, rango, fraccion } = vistaPreviaDiagnostico(req.body.respuestas);
  res.json({ puntaje_total: puntajeTotal, nivel, rango, fraccion });
});

rutasPublicas.post('/progreso-cuestionario', (req, res) => {
  const { sesion_id, pregunta_actual, total_preguntas, respuestas } = req.body || {};
  registrarProgreso({
    sesion_id,
    pregunta_actual,
    total_preguntas,
    respuestas,
    pais: paisDesdeHost(req.hostname),
    plataforma: req.headers['user-agent'] || ''
  });
  res.status(204).end();
});

rutasPublicas.post('/diagnosticos', (req, res) => {
  const { nombre, empresa, rubro, correo, telefono, sesion_id } = req.body.persona || {};
  const registro = guardarDiagnostico(
    { nombre, empresa, rubro, correo, telefono },
    req.body.respuestas,
    { origen: 'formulario', estricto: true, pais: paisDesdeHost(req.hostname) }
  );

  marcarCompletado(sesion_id, registro.id);
  res.status(201).json({ areas: registro.areas });
});

import { Router } from 'express';
import { obtenerPreguntasPublicas } from '../consultas/preguntas.js';
import { guardarDiagnostico } from '../consultas/diagnosticos.js';

export const rutasPublicas = Router();

rutasPublicas.get('/preguntas', (req, res) => {
  res.json(obtenerPreguntasPublicas());
});

rutasPublicas.post('/diagnosticos', (req, res) => {
  const { nombre, empresa, correo, telefono } = req.body.persona || {};
  const { areas } = guardarDiagnostico(
    { nombre, empresa, correo, telefono },
    req.body.respuestas,
    { origen: 'formulario', estricto: true }
  );

  res.status(201).json({ areas });
});

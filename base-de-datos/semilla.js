import { fileURLToPath } from 'node:url';
import { db, esquema, transaccion } from './conexion.js';
import { areas } from './datos.js';

const tablas = [
  'sesiones',
  'usuarios',
  'diagnostico_areas',
  'diagnostico_respuestas',
  'diagnosticos',
  'inputs',
  'alternativas',
  'preguntas',
  'areas'
];

function insertarEstructura() {
  const insertarArea = db.prepare('INSERT INTO areas (nombre, orden) VALUES (?, ?)');
  const insertarPregunta = db.prepare(
    "INSERT INTO preguntas (area_id, pregunta, tipo, obligatoria, activa, orden) VALUES (?, ?, 'unica', 1, 1, ?)"
  );
  const insertarAlternativa = db.prepare(
    'INSERT INTO alternativas (pregunta_id, alternativa, score, orden) VALUES (?, ?, ?, ?)'
  );
  const insertarInput = db.prepare(
    'INSERT INTO inputs (area_id, minimo, maximo, input) VALUES (?, ?, ?, ?)'
  );

  areas.forEach((area, posicionArea) => {
    const { lastInsertRowid: areaId } = insertarArea.run(area.nombre, posicionArea + 1);

    area.preguntas.forEach((pregunta, posicionPregunta) => {
      const { lastInsertRowid: preguntaId } = insertarPregunta.run(
        areaId,
        pregunta.pregunta,
        posicionPregunta + 1
      );

      pregunta.alternativas.forEach(([alternativa, score], posicion) => {
        insertarAlternativa.run(preguntaId, alternativa, score, posicion + 1);
      });
    });

    area.inputs.forEach(([minimo, maximo, input]) => {
      insertarInput.run(areaId, minimo, maximo, input);
    });
  });
}

export function sembrar() {
  transaccion(insertarEstructura);
}

export function reemplazarPreguntas() {
  transaccion(() => {
    db.exec('DELETE FROM areas');
    insertarEstructura();
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--preguntas')) {
    reemplazarPreguntas();
    console.log('Preguntas, alternativas e inputs cargados. El historial no se modificó');
  } else {
    db.exec('PRAGMA foreign_keys = OFF');
    tablas.forEach((tabla) => db.exec(`DROP TABLE IF EXISTS ${tabla}`));
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(esquema);
    sembrar();
    const { crearAdministradorInicial } = await import('./consultas/usuarios.js');
    crearAdministradorInicial();
    console.log('Base de datos reiniciada con las preguntas y el administrador inicial de datos.js');
  }
}

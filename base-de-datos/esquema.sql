CREATE TABLE IF NOT EXISTS areas (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS preguntas (
  id INTEGER PRIMARY KEY,
  area_id INTEGER NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'unica' CHECK (tipo IN ('unica', 'multiple', 'abierta')),
  obligatoria INTEGER NOT NULL DEFAULT 1,
  activa INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alternativas (
  id INTEGER PRIMARY KEY,
  pregunta_id INTEGER NOT NULL REFERENCES preguntas (id) ON DELETE CASCADE,
  alternativa TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inputs (
  id INTEGER PRIMARY KEY,
  area_id INTEGER NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
  minimo INTEGER NOT NULL,
  maximo INTEGER NOT NULL,
  input INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS diagnosticos (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  empresa TEXT NOT NULL DEFAULT '',
  correo TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  origen TEXT NOT NULL DEFAULT 'formulario' CHECK (origen IN ('formulario', 'manual')),
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS diagnostico_respuestas (
  id INTEGER PRIMARY KEY,
  diagnostico_id INTEGER NOT NULL REFERENCES diagnosticos (id) ON DELETE CASCADE,
  pregunta_id INTEGER,
  area TEXT NOT NULL,
  pregunta TEXT NOT NULL,
  tipo TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS diagnostico_areas (
  id INTEGER PRIMARY KEY,
  diagnostico_id INTEGER NOT NULL REFERENCES diagnosticos (id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  puntaje INTEGER NOT NULL,
  input INTEGER NOT NULL,
  maximo INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_preguntas_area ON preguntas (area_id);
CREATE INDEX IF NOT EXISTS idx_alternativas_pregunta ON alternativas (pregunta_id);
CREATE INDEX IF NOT EXISTS idx_inputs_area ON inputs (area_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_diagnostico ON diagnostico_respuestas (diagnostico_id);
CREATE INDEX IF NOT EXISTS idx_areas_diagnostico ON diagnostico_areas (diagnostico_id);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
  clave_hash TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  debe_cambiar_clave INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ultimo_acceso TEXT
);

CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  ip TEXT NOT NULL DEFAULT '',
  navegador TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ultima_actividad TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expira_en TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones (usuario_id);

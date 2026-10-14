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
  orden INTEGER NOT NULL DEFAULT 0,
  es_otro INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inputs (
  id INTEGER PRIMARY KEY,
  area_id INTEGER NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
  minimo INTEGER NOT NULL,
  maximo INTEGER NOT NULL,
  input INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ponderaciones (
  id INTEGER PRIMARY KEY,
  pregunta_id INTEGER NOT NULL REFERENCES preguntas (id) ON DELETE CASCADE,
  minimo INTEGER NOT NULL,
  maximo INTEGER NOT NULL,
  valor INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS diagnosticos (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  empresa TEXT NOT NULL DEFAULT '',
  rubro TEXT NOT NULL DEFAULT '',
  correo TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  origen TEXT NOT NULL DEFAULT 'formulario' CHECK (origen IN ('formulario', 'manual')),
  pais TEXT NOT NULL DEFAULT '',
  perfil TEXT,
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

CREATE TABLE IF NOT EXISTS niveles_generales (
  id INTEGER PRIMARY KEY,
  minimo INTEGER NOT NULL,
  maximo INTEGER NOT NULL,
  vehiculo TEXT NOT NULL DEFAULT 'cohete' CHECK (vehiculo IN ('cohete', 'avion', 'carro', 'scooter')),
  color TEXT NOT NULL DEFAULT '#d9a6f0',
  titulo TEXT NOT NULL,
  introduccion TEXT NOT NULL DEFAULT '',
  texto_intermedio TEXT NOT NULL DEFAULT '',
  cierre_titulo TEXT NOT NULL DEFAULT '',
  cierre_texto TEXT NOT NULL DEFAULT '',
  boton_texto TEXT NOT NULL DEFAULT '',
  boton_nota TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS nivel_oportunidades (
  id INTEGER PRIMARY KEY,
  nivel_id INTEGER NOT NULL REFERENCES niveles_generales (id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_preguntas_area ON preguntas (area_id);
CREATE INDEX IF NOT EXISTS idx_alternativas_pregunta ON alternativas (pregunta_id);
CREATE INDEX IF NOT EXISTS idx_inputs_area ON inputs (area_id);
CREATE INDEX IF NOT EXISTS idx_ponderaciones_pregunta ON ponderaciones (pregunta_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_diagnostico ON diagnostico_respuestas (diagnostico_id);
CREATE INDEX IF NOT EXISTS idx_areas_diagnostico ON diagnostico_areas (diagnostico_id);
CREATE INDEX IF NOT EXISTS idx_nivel_oportunidades_nivel ON nivel_oportunidades (nivel_id);

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

CREATE TABLE IF NOT EXISTS sesiones_cuestionario (
  id INTEGER PRIMARY KEY,
  sesion_id TEXT NOT NULL UNIQUE,
  pregunta_actual INTEGER NOT NULL DEFAULT 0,
  total_preguntas INTEGER NOT NULL DEFAULT 0,
  completado INTEGER NOT NULL DEFAULT 0,
  diagnostico_id INTEGER REFERENCES diagnosticos (id) ON DELETE SET NULL,
  pais TEXT NOT NULL DEFAULT '',
  plataforma TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sesiones_cuestionario_actualizado ON sesiones_cuestionario (actualizado_en DESC);

CREATE TABLE IF NOT EXISTS sesion_cuestionario_respuestas (
  id INTEGER PRIMARY KEY,
  sesion_id TEXT NOT NULL,
  pregunta_id INTEGER NOT NULL,
  area TEXT NOT NULL,
  pregunta TEXT NOT NULL,
  tipo TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sesion_cuestionario_respuestas_sesion ON sesion_cuestionario_respuestas (sesion_id);

CREATE TABLE IF NOT EXISTS redes_sociales (
  plataforma TEXT PRIMARY KEY,
  usuario TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0,
  estilo TEXT NOT NULL DEFAULT '{}'
);

INSERT OR IGNORE INTO redes_sociales (plataforma) VALUES
  ('instagram'), ('facebook'), ('linkedin'), ('tiktok'), ('youtube'), ('whatsapp');

-- Pantalla de agradecimiento al terminar el cuestionario: una sola fila (id = 1).
CREATE TABLE IF NOT EXISTS pantalla_final (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  etiqueta TEXT NOT NULL DEFAULT '',
  titulo TEXT NOT NULL DEFAULT '',
  mensajes TEXT NOT NULL DEFAULT '[]',
  redes_titulo TEXT NOT NULL DEFAULT '',
  boton_destino TEXT NOT NULL DEFAULT 'inicio' CHECK (boton_destino IN ('inicio', 'cuestionario', 'url', 'ninguno')),
  boton_texto TEXT NOT NULL DEFAULT '',
  boton_url TEXT NOT NULL DEFAULT '',
  boton_nueva_pestana INTEGER NOT NULL DEFAULT 1,
  estilos TEXT NOT NULL DEFAULT '{}',
  redes_estilo TEXT NOT NULL DEFAULT '{}'
);

INSERT OR IGNORE INTO pantalla_final (id, etiqueta, titulo, mensajes, redes_titulo, boton_destino, boton_texto) VALUES (
  1,
  '¡Listo!',
  'Gracias por registrarte',
  '["Ya tenemos tu diagnóstico. Estaremos al tanto de tu registro y te daremos seguimiento muy pronto."]',
  'Síguenos para conocernos más',
  'inicio',
  'Volver a empezar'
);

import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const archivo =
  process.env.DB_ARCHIVO || fileURLToPath(new URL('./diagnostico.db', import.meta.url));

export const esNueva = !existsSync(archivo);
export const esquema = readFileSync(new URL('./esquema.sql', import.meta.url), 'utf8');
export const db = new DatabaseSync(archivo);

db.exec('PRAGMA foreign_keys = ON');
db.exec(esquema);

function migrar() {
  const columnas = db.prepare('PRAGMA table_info(diagnosticos)').all();
  const tienePais = columnas.some((columna) => columna.name === 'pais');
  const tieneRubro = columnas.some((columna) => columna.name === 'rubro');

  if (!tienePais) {
    db.exec("ALTER TABLE diagnosticos ADD COLUMN pais TEXT NOT NULL DEFAULT ''");
  }

  if (!tieneRubro) {
    db.exec("ALTER TABLE diagnosticos ADD COLUMN rubro TEXT NOT NULL DEFAULT ''");
  }

  // Copia del perfil (JSON) al momento de guardar, para que no cambie si después se editan los niveles.
  if (!columnas.some((columna) => columna.name === 'perfil')) {
    db.exec('ALTER TABLE diagnosticos ADD COLUMN perfil TEXT');
  }

  const columnasAlternativas = db.prepare('PRAGMA table_info(alternativas)').all();
  const tieneEsOtro = columnasAlternativas.some((columna) => columna.name === 'es_otro');

  if (!tieneEsOtro) {
    db.exec('ALTER TABLE alternativas ADD COLUMN es_otro INTEGER NOT NULL DEFAULT 0');
  }

  const columnasSesiones = db.prepare('PRAGMA table_info(sesiones_cuestionario)').all();
  const tieneDiagnosticoId = columnasSesiones.some((columna) => columna.name === 'diagnostico_id');

  if (!tieneDiagnosticoId) {
    db.exec('ALTER TABLE sesiones_cuestionario ADD COLUMN diagnostico_id INTEGER REFERENCES diagnosticos (id) ON DELETE SET NULL');
  }

  const columnasPantallaFinal = db.prepare('PRAGMA table_info(pantalla_final)').all();

  if (!columnasPantallaFinal.some((columna) => columna.name === 'estilos')) {
    db.exec("ALTER TABLE pantalla_final ADD COLUMN estilos TEXT NOT NULL DEFAULT '{}'");
  }

  if (!columnasPantallaFinal.some((columna) => columna.name === 'redes_estilo')) {
    db.exec("ALTER TABLE pantalla_final ADD COLUMN redes_estilo TEXT NOT NULL DEFAULT '{}'");
  }

  const columnasRedes = db.prepare('PRAGMA table_info(redes_sociales)').all();

  if (!columnasRedes.some((columna) => columna.name === 'orden')) {
    db.exec('ALTER TABLE redes_sociales ADD COLUMN orden INTEGER NOT NULL DEFAULT 0');
  }

  if (!columnasRedes.some((columna) => columna.name === 'estilo')) {
    db.exec("ALTER TABLE redes_sociales ADD COLUMN estilo TEXT NOT NULL DEFAULT '{}'");
  }

  const columnasNiveles = db.prepare('PRAGMA table_info(niveles_generales)').all();
  const tieneColor = columnasNiveles.some((columna) => columna.name === 'color');

  if (!tieneColor) {
    db.exec("ALTER TABLE niveles_generales ADD COLUMN color TEXT NOT NULL DEFAULT '#d9a6f0'");

    // Colores iniciales en el orden de los rangos: verde, amarillo, naranja, rojo.
    const colores = ['#39d353', '#ffc15e', '#ff8a4c', '#ff5c70'];
    const ponerColor = db.prepare('UPDATE niveles_generales SET color = ? WHERE id = ?');

    db.prepare('SELECT id FROM niveles_generales ORDER BY minimo')
      .all()
      .forEach(({ id }, indice) => {
        if (indice < colores.length) ponerColor.run(colores[indice], id);
      });
  }
}

migrar();

export function transaccion(operaciones) {
  db.exec('BEGIN');

  try {
    const resultado = operaciones();
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

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

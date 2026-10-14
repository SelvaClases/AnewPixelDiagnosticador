import { db, transaccion } from '../conexion.js';
import { ErrorApi, entero, texto } from '../validaciones.js';

const VEHICULOS = ['cohete', 'avion', 'carro', 'scooter'];
const COLOR = /^#[0-9a-f]{6}$/i;
const MAXIMO_OPORTUNIDADES = 12;

const CAMPOS =
  'id, minimo, maximo, vehiculo, color, titulo, introduccion, texto_intermedio, cierre_titulo, cierre_texto, boton_texto, boton_nota';

const listarTodos = db.prepare(`SELECT ${CAMPOS} FROM niveles_generales ORDER BY minimo`);
const buscarPorId = db.prepare(`SELECT ${CAMPOS} FROM niveles_generales WHERE id = ?`);
const listarOportunidades = db.prepare('SELECT id, nivel_id, texto FROM nivel_oportunidades ORDER BY orden, id');
const oportunidadesDe = db.prepare('SELECT id, nivel_id, texto FROM nivel_oportunidades WHERE nivel_id = ? ORDER BY orden, id');
const buscarCruce = db.prepare(
  'SELECT id FROM niveles_generales WHERE id != ? AND minimo <= ? AND maximo >= ?'
);
const insertar = db.prepare(`
  INSERT INTO niveles_generales
    (minimo, maximo, vehiculo, color, titulo, introduccion, texto_intermedio, cierre_titulo, cierre_texto, boton_texto, boton_nota)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const actualizar = db.prepare(`
  UPDATE niveles_generales
  SET minimo = ?, maximo = ?, vehiculo = ?, color = ?, titulo = ?, introduccion = ?, texto_intermedio = ?,
      cierre_titulo = ?, cierre_texto = ?, boton_texto = ?, boton_nota = ?
  WHERE id = ?
`);
const borrar = db.prepare('DELETE FROM niveles_generales WHERE id = ?');
const borrarOportunidades = db.prepare('DELETE FROM nivel_oportunidades WHERE nivel_id = ?');
const insertarOportunidad = db.prepare(
  'INSERT INTO nivel_oportunidades (nivel_id, texto, orden) VALUES (?, ?, ?)'
);

function armar(filas, oportunidades) {
  return filas.map((fila) => ({
    ...fila,
    oportunidades: oportunidades
      .filter((item) => item.nivel_id === fila.id)
      .map(({ id, texto: contenido }) => ({ id, texto: contenido }))
  }));
}

function validar(datos, id = 0) {
  const entrada = datos || {};
  const minimo = entero(entrada.minimo, 'el puntaje inicial');
  const maximo = entero(entrada.maximo, 'el puntaje final');

  if (!VEHICULOS.includes(entrada.vehiculo)) {
    throw new ErrorApi('El vehículo no es válido');
  }

  if (!COLOR.test(entrada.color || '')) {
    throw new ErrorApi('El color no es válido');
  }

  if (minimo > maximo) {
    throw new ErrorApi('El puntaje inicial no puede ser mayor que el final');
  }

  if (buscarCruce.get(id, maximo, minimo)) {
    throw new ErrorApi('El rango se cruza con otro nivel que ya existe');
  }

  const lista = Array.isArray(entrada.oportunidades) ? entrada.oportunidades : [];

  if (!lista.length) {
    throw new ErrorApi('Agrega al menos una oportunidad');
  }

  if (lista.length > MAXIMO_OPORTUNIDADES) {
    throw new ErrorApi(`Máximo ${MAXIMO_OPORTUNIDADES} oportunidades por nivel`);
  }

  const oportunidades = lista.map((item, indice) => ({
    texto: texto(item && item.texto, `la oportunidad ${indice + 1}`, { max: 200 })
  }));

  return {
    minimo,
    maximo,
    vehiculo: entrada.vehiculo,
    color: entrada.color.toLowerCase(),
    titulo: texto(entrada.titulo, 'el título', { max: 200 }),
    introduccion: texto(entrada.introduccion, 'la introducción', { max: 1500, obligatorio: false }),
    textoIntermedio: texto(entrada.texto_intermedio, 'el texto intermedio', { max: 1500, obligatorio: false }),
    cierreTitulo: texto(entrada.cierre_titulo, 'el título de cierre', { max: 200, obligatorio: false }),
    cierreTexto: texto(entrada.cierre_texto, 'el texto de cierre', { max: 1000, obligatorio: false }),
    botonTexto: texto(entrada.boton_texto, 'el texto del botón', { max: 120 }),
    botonNota: texto(entrada.boton_nota, 'la nota del botón', { max: 300, obligatorio: false }),
    oportunidades
  };
}

function guardarOportunidades(nivelId, oportunidades) {
  borrarOportunidades.run(nivelId);
  oportunidades.forEach(({ texto: contenido }, posicion) => {
    insertarOportunidad.run(nivelId, contenido, posicion + 1);
  });
}

export function listarNiveles() {
  return armar(listarTodos.all(), listarOportunidades.all());
}

export function obtenerNivel(id) {
  const fila = buscarPorId.get(id);

  if (!fila) {
    throw new ErrorApi('El nivel no existe', 404);
  }

  return armar([fila], oportunidadesDe.all(id))[0];
}

export function rangoGlobal() {
  const todos = listarTodos.all();

  if (!todos.length) {
    return null;
  }

  return {
    minimo: Math.min(...todos.map((item) => item.minimo)),
    maximo: Math.max(...todos.map((item) => item.maximo))
  };
}

export function nivelParaPuntaje(puntaje) {
  const nivel = listarTodos.all().find((item) => puntaje >= item.minimo && puntaje <= item.maximo);
  return nivel ? obtenerNivel(nivel.id) : null;
}

export function crearNivel(datos) {
  const {
    minimo,
    maximo,
    vehiculo,
    color,
    titulo,
    introduccion,
    textoIntermedio,
    cierreTitulo,
    cierreTexto,
    botonTexto,
    botonNota,
    oportunidades
  } = validar(datos);

  return transaccion(() => {
    const { lastInsertRowid } = insertar.run(
      minimo,
      maximo,
      vehiculo,
      color,
      titulo,
      introduccion,
      textoIntermedio,
      cierreTitulo,
      cierreTexto,
      botonTexto,
      botonNota
    );
    guardarOportunidades(lastInsertRowid, oportunidades);
    return obtenerNivel(lastInsertRowid);
  });
}

export function actualizarNivel(id, datos) {
  const {
    minimo,
    maximo,
    vehiculo,
    color,
    titulo,
    introduccion,
    textoIntermedio,
    cierreTitulo,
    cierreTexto,
    botonTexto,
    botonNota,
    oportunidades
  } = validar(datos, id);

  return transaccion(() => {
    const { changes } = actualizar.run(
      minimo,
      maximo,
      vehiculo,
      color,
      titulo,
      introduccion,
      textoIntermedio,
      cierreTitulo,
      cierreTexto,
      botonTexto,
      botonNota,
      id
    );

    if (!changes) {
      throw new ErrorApi('El nivel no existe', 404);
    }

    guardarOportunidades(id, oportunidades);
    return obtenerNivel(id);
  });
}

export function eliminarNivel(id) {
  if (!borrar.run(id).changes) {
    throw new ErrorApi('El nivel no existe', 404);
  }
}

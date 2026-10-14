import { db, transaccion } from '../conexion.js';
import { ErrorApi, texto } from '../validaciones.js';
import { color, enteroEntre, estiloTexto, opcion } from './estilos.js';

const PLATAFORMAS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'whatsapp'];

// Diseño de los botones de redes (pantalla de agradecimiento). Todo es opcional:
// lo que no se define usa el diseño original de la página.
const CONTENIDOS = ['icono_texto', 'solo_icono'];
const ICONOS = ['circulo', 'color', 'blanco', 'circulo_blanco'];
const FONDOS = ['oscuro', 'marca', 'ninguno', 'personalizado'];
const FORMAS = ['pildora', 'redondeado', 'recto'];
const DISPOSICIONES = ['fila', 'columna'];
const TAMANO_ICONO = { minimo: 16, maximo: 96 };

const listarTodas = db.prepare('SELECT plataforma, usuario, url, activo, estilo FROM redes_sociales ORDER BY orden, rowid');
const listarActivas = db.prepare(
  "SELECT plataforma, usuario, url, estilo FROM redes_sociales WHERE activo = 1 AND url != '' ORDER BY orden, rowid"
);
const actualizarUna = db.prepare(
  'UPDATE redes_sociales SET usuario = ?, url = ?, activo = ?, orden = ?, estilo = ? WHERE plataforma = ?'
);
const leerEstiloGeneral = db.prepare('SELECT redes_estilo FROM pantalla_final WHERE id = 1');
const guardarEstiloGeneral = db.prepare('UPDATE pantalla_final SET redes_estilo = ? WHERE id = 1');

const conEstilo = (fila) => ({ ...fila, estilo: JSON.parse(fila.estilo || '{}') });

function validarUrl(valor, campo) {
  const limpio = texto(valor, campo, { max: 300, obligatorio: false });

  if (limpio && !/^https?:\/\//i.test(limpio)) {
    throw new ErrorApi(`Revisa ${campo}: debe empezar con http:// o https://`);
  }

  return limpio;
}

// Ajustes propios de una red: tamaño del icono y color de fondo.
function validarEstiloRed(entrada, nombre) {
  const estilo = {};
  if (!entrada || typeof entrada !== 'object') return estilo;

  if (entrada.tamano !== undefined) {
    estilo.tamano = enteroEntre(entrada.tamano, TAMANO_ICONO.minimo, TAMANO_ICONO.maximo, `el tamaño de ${nombre}`);
  }
  if (entrada.colorFondo !== undefined) estilo.colorFondo = color(entrada.colorFondo, `el fondo de ${nombre}`);

  return estilo;
}

function validarEstiloGeneral(entrada) {
  const estilo = {};
  if (!entrada || typeof entrada !== 'object') return estilo;

  if (entrada.contenido !== undefined) estilo.contenido = opcion(entrada.contenido, CONTENIDOS, 'el contenido de los botones');
  if (entrada.icono !== undefined) estilo.icono = opcion(entrada.icono, ICONOS, 'el estilo del icono');
  if (entrada.tamano !== undefined) {
    estilo.tamano = enteroEntre(entrada.tamano, TAMANO_ICONO.minimo, TAMANO_ICONO.maximo, 'el tamaño del icono');
  }
  if (entrada.fondo !== undefined) estilo.fondo = opcion(entrada.fondo, FONDOS, 'el fondo de los botones');
  if (entrada.colorFondo !== undefined) estilo.colorFondo = color(entrada.colorFondo, 'el fondo de los botones');
  if (entrada.colorBorde !== undefined) estilo.colorBorde = color(entrada.colorBorde, 'el borde de los botones');
  if (entrada.forma !== undefined) estilo.forma = opcion(entrada.forma, FORMAS, 'la forma de los botones');
  if (entrada.disposicion !== undefined) estilo.disposicion = opcion(entrada.disposicion, DISPOSICIONES, 'la disposición');
  if (entrada.separacion !== undefined) estilo.separacion = enteroEntre(entrada.separacion, 0, 48, 'la separación');

  const textoBotones = estiloTexto(entrada.texto, 'el texto de los botones', { tamanoMinimo: 10, tamanoMaximo: 40 });
  if (Object.keys(textoBotones).length) estilo.texto = textoBotones;

  return estilo;
}

export function estiloRedesPublico() {
  const fila = leerEstiloGeneral.get();
  return JSON.parse((fila && fila.redes_estilo) || '{}');
}

export function listarRedesSociales() {
  return listarTodas.all().map((fila) => ({ ...conEstilo(fila), activo: Boolean(fila.activo) }));
}

export function obtenerRedesSocialesAdmin() {
  return { redes: listarRedesSociales(), estilo: estiloRedesPublico() };
}

export function listarRedesSocialesPublicas() {
  return listarActivas.all().map(conEstilo);
}

// `lista` llega en el orden en que se deben mostrar.
export function actualizarRedesSociales(lista, estiloGeneral) {
  const entrada = Array.isArray(lista) ? lista : [];

  const validadas = entrada
    .filter((item) => item && PLATAFORMAS.includes(item.plataforma))
    .map((item, posicion) => ({
      plataforma: item.plataforma,
      usuario: texto(item.usuario, `el usuario de ${item.plataforma}`, { max: 120, obligatorio: false }),
      url: validarUrl(item.url, `el enlace de ${item.plataforma}`),
      activo: item.activo ? 1 : 0,
      orden: posicion + 1,
      estilo: JSON.stringify(validarEstiloRed(item.estilo, item.plataforma))
    }));

  const general = estiloGeneral === undefined ? null : JSON.stringify(validarEstiloGeneral(estiloGeneral));

  transaccion(() => {
    validadas.forEach(({ plataforma, usuario, url, activo, orden, estilo }) => {
      actualizarUna.run(usuario, url, activo, orden, estilo, plataforma);
    });
    if (general !== null) guardarEstiloGeneral.run(general);
  });

  return obtenerRedesSocialesAdmin();
}

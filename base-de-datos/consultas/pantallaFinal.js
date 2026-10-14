import { db } from '../conexion.js';
import { ErrorApi, texto } from '../validaciones.js';
import { listarRedesSocialesPublicas, estiloRedesPublico } from './redesSociales.js';
import { color, estiloTexto, opcion } from './estilos.js';

const DESTINOS = ['inicio', 'cuestionario', 'url', 'ninguno'];
const MAXIMO_MENSAJES = 10;

const ELEMENTOS = {
  etiqueta: 'la etiqueta',
  titulo: 'el título',
  mensajes: 'los mensajes',
  redes_titulo: 'el título de redes',
  boton: 'el botón'
};
const ALINEACIONES = ['izquierda', 'centro', 'derecha'];
const FORMAS_BOTON = ['pildora', 'redondeado', 'recto'];

const buscar = db.prepare(`
  SELECT etiqueta, titulo, mensajes, redes_titulo, boton_destino, boton_texto, boton_url, boton_nueva_pestana, estilos
  FROM pantalla_final WHERE id = 1
`);
const actualizar = db.prepare(`
  UPDATE pantalla_final
  SET etiqueta = ?, titulo = ?, mensajes = ?, redes_titulo = ?,
      boton_destino = ?, boton_texto = ?, boton_url = ?, boton_nueva_pestana = ?, estilos = ?
  WHERE id = 1
`);

// Los mensajes antiguos se guardaban como texto simple; ahora cada uno lleva su propio estilo.
const normalizarMensaje = (mensaje) =>
  typeof mensaje === 'string' ? { texto: mensaje, estilo: {} } : { texto: mensaje.texto, estilo: mensaje.estilo || {} };

function leer() {
  const fila = buscar.get();

  return {
    ...fila,
    mensajes: JSON.parse(fila.mensajes).map(normalizarMensaje),
    boton_nueva_pestana: Boolean(fila.boton_nueva_pestana),
    estilos: JSON.parse(fila.estilos || '{}')
  };
}

// Solo se guardan las propiedades que se cambiaron; lo que falta usa el estilo original de la página.
function validarEstiloElemento(entrada, nombre, campo = ELEMENTOS[nombre]) {
  const estilo = estiloTexto(entrada, campo);

  if (nombre === 'boton' && entrada && typeof entrada === 'object') {
    if (entrada.fondo !== undefined) estilo.fondo = color(entrada.fondo, 'el fondo del botón');
    if (entrada.forma !== undefined) estilo.forma = opcion(entrada.forma, FORMAS_BOTON, 'la forma del botón');
  }

  return estilo;
}

function validarEstilos(entrada) {
  const estilos = { elementos: {} };
  const datos = entrada && typeof entrada === 'object' ? entrada : {};

  if (datos.alineacion !== undefined) {
    if (!ALINEACIONES.includes(datos.alineacion)) throw new ErrorApi('La alineación no es válida');
    estilos.alineacion = datos.alineacion;
  }

  Object.keys(ELEMENTOS).forEach((nombre) => {
    const estilo = validarEstiloElemento(datos.elementos && datos.elementos[nombre], nombre);
    if (Object.keys(estilo).length) estilos.elementos[nombre] = estilo;
  });

  return estilos;
}

function validar(datos) {
  const entrada = datos || {};
  const destino = entrada.boton_destino;

  if (!DESTINOS.includes(destino)) {
    throw new ErrorApi('El destino del botón no es válido');
  }

  const lista = Array.isArray(entrada.mensajes) ? entrada.mensajes : [];

  if (lista.length > MAXIMO_MENSAJES) {
    throw new ErrorApi(`Máximo ${MAXIMO_MENSAJES} mensajes`);
  }

  const mensajes = lista
    .map((mensaje, indice) => {
      const { texto: contenido, estilo } = normalizarMensaje(mensaje || '');
      const campo = `el mensaje ${indice + 1}`;
      return {
        texto: texto(contenido, campo, { max: 1500, obligatorio: false }),
        estilo: validarEstiloElemento(estilo, 'mensajes', campo)
      };
    })
    .filter((mensaje) => mensaje.texto);

  const botonUrl = texto(entrada.boton_url, 'el enlace del botón', { max: 500, obligatorio: destino === 'url' });

  // Solo http(s): evita enlaces javascript: u otros esquemas en una página pública.
  if (destino === 'url' && !/^https?:\/\//i.test(botonUrl)) {
    throw new ErrorApi('El enlace del botón debe empezar con http:// o https://');
  }

  return {
    etiqueta: texto(entrada.etiqueta, 'la etiqueta', { max: 60, obligatorio: false }),
    titulo: texto(entrada.titulo, 'el título', { max: 200 }),
    mensajes,
    redesTitulo: texto(entrada.redes_titulo, 'el título de redes', { max: 120, obligatorio: false }),
    destino,
    botonTexto: texto(entrada.boton_texto, 'el texto del botón', { max: 80, obligatorio: destino !== 'ninguno' }),
    botonUrl,
    nuevaPestana: entrada.boton_nueva_pestana ? 1 : 0,
    estilos: validarEstilos(entrada.estilos)
  };
}

export function obtenerPantallaFinal() {
  return leer();
}

export function obtenerPantallaFinalPublica() {
  return { ...leer(), redes: listarRedesSocialesPublicas(), redes_estilo: estiloRedesPublico() };
}

export function actualizarPantallaFinal(datos) {
  const valores = validar(datos);

  actualizar.run(
    valores.etiqueta,
    valores.titulo,
    JSON.stringify(valores.mensajes),
    valores.redesTitulo,
    valores.destino,
    valores.botonTexto,
    valores.botonUrl,
    valores.nuevaPestana,
    JSON.stringify(valores.estilos)
  );

  return obtenerPantallaFinal();
}

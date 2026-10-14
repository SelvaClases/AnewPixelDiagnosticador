import { crear } from '../utilidades.js';
import { obtenerPantallaFinal, actualizarPantallaFinal, obtenerRedesSociales } from '../consultas.js';
import { campo, entrada, boton, ejecutar } from './interfaz.js';
import { redesVisibles } from './vistaPrevia.js';
import { barraEstilo as barraBase, segmentado } from './controlesEstilo.js';

const DESTINOS = [
  { valor: 'inicio', etiqueta: 'Volver a la pantalla de inicio' },
  { valor: 'cuestionario', etiqueta: 'Empezar el cuestionario de nuevo' },
  { valor: 'url', etiqueta: 'Abrir un enlace (URL)' },
  { valor: 'ninguno', etiqueta: 'No mostrar botón' }
];

// Cómo se ve cada parte sin personalizar (lo que define el CSS de la página pública).
// Sirve de punto de partida para el tamaño, el color y la negrita.
const ORIGINAL = {
  etiqueta: { tamano: 15, color: '#ffffff', negrita: true, cursiva: false },
  titulo: { tamano: 42, color: '#ffffff', negrita: true, cursiva: false },
  mensajes: { tamano: 18, color: '#d9d9d9', negrita: false, cursiva: false },
  redes_titulo: { tamano: 14, color: '#b3b3b3', negrita: true, cursiva: false },
  boton: { tamano: 20, color: '#ffffff', negrita: true, cursiva: false, fondo: '#22c84a', forma: 'redondeado' }
};

const barraEstilo = (nombre, inicial) =>
  barraBase(ORIGINAL[nombre], inicial, { conBoton: nombre === 'boton', conAlineacion: nombre === 'redes_titulo' });

export async function montar(contenedor, { vistaPrevia } = {}) {
  const [pantalla, { redes: todasLasRedes, estilo: estiloRedes }] = await Promise.all([
    obtenerPantallaFinal(),
    obtenerRedesSociales()
  ]);
  const estilos = pantalla.estilos || {};
  const estilosDe = (nombre) => (estilos.elementos && estilos.elementos[nombre]) || {};

  const disenio = seccionDisenio(estilos);
  const etiqueta = seccionTexto('Etiqueta superior', 'etiqueta', pantalla.etiqueta, estilosDe('etiqueta'), {
    maxlength: 60,
    placeholder: '¡Listo!',
    ayuda: 'Texto pequeño sobre el título. Déjalo vacío para ocultarlo.'
  });
  const titulo = seccionTexto('Título', 'titulo', pantalla.titulo, estilosDe('titulo'), { maxlength: 200, required: '' });
  const mensajes = seccionMensajes(pantalla.mensajes, estilosDe('mensajes'));
  const redes = seccionTexto('Título de redes sociales', 'redes_titulo', pantalla.redes_titulo, estilosDe('redes_titulo'), {
    maxlength: 120,
    placeholder: 'Síguenos para conocernos más',
    ayuda: 'Va sobre los botones de redes. Déjalo vacío para ocultarlo. Qué redes se muestran se elige en la pestaña "Redes sociales".'
  });
  const botonFinal = seccionBoton(pantalla, estilosDe('boton'));
  const secciones = { etiqueta, titulo, mensajes, redes_titulo: redes, boton: botonFinal };

  const leer = () => ({
    etiqueta: etiqueta.leerTexto(),
    titulo: titulo.leerTexto(),
    mensajes: mensajes.leerTexto(),
    redes_titulo: redes.leerTexto(),
    ...botonFinal.leerDatos(),
    estilos: {
      ...disenio.leer(),
      elementos: Object.fromEntries(Object.entries(secciones).map(([nombre, seccion]) => [nombre, seccion.estilo.leer()]))
    }
  });

  const barra = crear('div', 'barra');
  const titulos = crear('div');
  const acciones = crear('div', 'herramientas');
  const pendiente = crear('span', 'chip chip-alerta', 'Cambios sin guardar');
  let guardado = JSON.stringify(leer());

  const guardar = boton('Guardar cambios', 'boton-primario', async () => {
    const datos = leer();
    const resultado = await ejecutar(() => actualizarPantallaFinal(datos), 'Cambios guardados');
    if (resultado) {
      guardado = JSON.stringify(datos);
      revisarPendiente();
    }
  });

  function revisarPendiente() {
    const hayCambios = JSON.stringify(leer()) !== guardado;
    pendiente.hidden = !hayCambios;
    guardar.disabled = !hayCambios;
  }

  titulos.append(
    crear('h2', '', 'Agradecimientos'),
    crear('p', 'ayuda', 'Lo que ve la persona al enviar el formulario. Edita los textos y su diseño; la vista previa muestra cómo quedará.')
  );
  acciones.append(pendiente, guardar);
  barra.append(titulos, acciones);

  disenio.alRestablecerTodo(() => Object.values(secciones).forEach((seccion) => seccion.estilo.restablecer()));

  contenedor.replaceChildren(
    barra,
    disenio.elemento,
    etiqueta.elemento,
    titulo.elemento,
    mensajes.elemento,
    redes.elemento,
    botonFinal.elemento
  );

  const alCambiar = () => {
    revisarPendiente();
    if (vistaPrevia) {
      vistaPrevia.mostrar({
        tipo: 'agradecimiento',
        pantalla: { ...leer(), redes: redesVisibles(todasLasRedes), redes_estilo: estiloRedes }
      });
    }
  };

  // Los botones (añadir mensaje, negrita, restablecer…) no disparan "input": se revisa después del clic.
  contenedor.addEventListener('input', alCambiar);
  contenedor.addEventListener('change', alCambiar);
  contenedor.addEventListener('click', () => setTimeout(alCambiar));
  alCambiar();
}

function bloque(titulo, ayuda) {
  const seccion = crear('section', 'bloque-final');
  seccion.append(crear('h3', '', titulo));
  if (ayuda) seccion.append(crear('p', 'ayuda', ayuda));
  return seccion;
}

function seccionDisenio(estilos) {
  const seccion = bloque('Diseño general');
  const fila = crear('div', 'fila-disenio');
  const etiquetaAlineacion = crear('div', 'campo-en-linea');
  let alRestablecer = () => {};

  const alineacion = segmentado(
    [
      { valor: 'izquierda', texto: 'Izquierda' },
      { valor: 'centro', texto: 'Centro' },
      { valor: 'derecha', texto: 'Derecha' }
    ],
    estilos.alineacion || 'centro'
  );

  const restablecerTodo = boton('↺ Volver todo al diseño original', 'boton-secundario boton-chico', () => {
    alineacion.marcar('centro');
    alRestablecer();
  });

  etiquetaAlineacion.append(crear('span', 'campo-etiqueta', 'Alineación'), alineacion.elemento);
  fila.append(etiquetaAlineacion, restablecerTodo);
  seccion.append(fila);

  return {
    elemento: seccion,
    leer: () => (alineacion.leer() === 'centro' ? {} : { alineacion: alineacion.leer() }),
    alRestablecerTodo: (funcion) => {
      alRestablecer = funcion;
    }
  };
}

function seccionTexto(titulo, nombre, valor, estiloInicial, { ayuda, ...atributos }) {
  const seccion = bloque(titulo);
  const campoTexto = entrada('text', valor, atributos);
  const estilo = barraEstilo(nombre, estiloInicial);

  seccion.append(campo('Texto', campoTexto, ayuda), estilo.elemento);

  return { elemento: seccion, estilo, leerTexto: () => campoTexto.value };
}

// Cada mensaje es una tarjeta con su texto y su propia barra de formato.
// `estiloGeneral` es el diseño común que se usaba antes para todos: queda como punto de partida.
function seccionMensajes(iniciales, estiloGeneral) {
  const seccion = bloque(
    'Mensajes',
    'Se muestran uno debajo del otro, cada uno con su propio diseño. Separa párrafos con una línea en blanco y usa **negritas** con doble asterisco.'
  );
  const nuevoMensaje = (mensaje = { texto: '', estilo: {} }) => ({
    texto: mensaje.texto,
    barra: barraEstilo('mensajes', { ...estiloGeneral, ...mensaje.estilo })
  });
  const lista = (iniciales.length ? iniciales : [undefined]).map(nuevoMensaje);
  const filas = crear('div', 'filas-alternativas');

  const agregar = boton('+ Añadir mensaje', 'boton-secundario boton-chico', () => {
    lista.push(nuevoMensaje());
    pintar();
    filas.querySelector('.tarjeta-mensaje:last-child textarea').focus();
  });

  function mover(indice, paso) {
    const destino = indice + paso;
    [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
    pintar();
  }

  function pintar() {
    filas.replaceChildren(
      ...lista.map((item, indice) => {
        const tarjeta = crear('div', 'tarjeta-mensaje');
        const cabecera = crear('div', 'tarjeta-mensaje-cabecera');
        const area = crear('textarea', 'entrada', undefined, {
          rows: 3,
          maxlength: 1500,
          placeholder: 'Escribe el mensaje…',
          'aria-label': `Mensaje ${indice + 1}`
        });
        const acciones = crear('div', 'acciones-mensaje');
        const subir = boton('↑', 'boton-secundario boton-mini', () => mover(indice, -1));
        const bajar = boton('↓', 'boton-secundario boton-mini', () => mover(indice, 1));
        const quitar = boton('×', 'boton-peligro boton-mini', () => {
          lista.splice(indice, 1);
          pintar();
        });

        area.value = item.texto;
        area.addEventListener('input', () => {
          item.texto = area.value;
        });

        subir.disabled = indice === 0;
        bajar.disabled = indice === lista.length - 1;
        subir.title = 'Subir mensaje';
        bajar.title = 'Bajar mensaje';
        quitar.title = 'Quitar mensaje';
        subir.setAttribute('aria-label', 'Subir mensaje');
        bajar.setAttribute('aria-label', 'Bajar mensaje');
        quitar.setAttribute('aria-label', 'Quitar mensaje');

        acciones.append(subir, bajar, quitar);
        cabecera.append(crear('strong', '', `Mensaje ${indice + 1}`), acciones);
        // La barra se reutiliza (no se recrea) para conservar su diseño al mover o quitar mensajes.
        tarjeta.append(cabecera, area, item.barra.elemento);
        return tarjeta;
      })
    );
  }

  pintar();
  seccion.append(filas, agregar);

  return {
    elemento: seccion,
    // El diseño va dentro de cada mensaje; ya no hay un estilo general de mensajes.
    estilo: {
      leer: () => ({}),
      restablecer: () => lista.forEach((item) => item.barra.restablecer())
    },
    leerTexto: () => lista.map((item) => ({ texto: item.texto, estilo: item.barra.leer() }))
  };
}

function seccionBoton(pantalla, estiloInicial) {
  const seccion = bloque('Botón final');
  const destino = crear('select', 'entrada');
  const texto = entrada('text', pantalla.boton_texto, { maxlength: 80, placeholder: 'Volver a empezar' });
  const url = entrada('url', pantalla.boton_url, { maxlength: 500, placeholder: 'https://...' });
  const nuevaPestana = crear('input', '', undefined, { type: 'checkbox' });
  const casillaPestana = crear('label', 'casilla');
  const campoTexto = campo('Texto del botón', texto);
  const campoUrl = campo('Enlace', url);
  const rejilla = crear('div', 'rejilla');
  const estilo = barraEstilo('boton', estiloInicial);

  DESTINOS.forEach((item) => destino.append(new Option(item.etiqueta, item.valor)));
  destino.value = pantalla.boton_destino;
  nuevaPestana.checked = pantalla.boton_nueva_pestana;
  casillaPestana.append(nuevaPestana, crear('span', '', 'Abrir en una pestaña nueva'));

  function actualizarVisibles() {
    const esUrl = destino.value === 'url';
    const sinBoton = destino.value === 'ninguno';
    campoTexto.hidden = sinBoton;
    estilo.elemento.hidden = sinBoton;
    campoUrl.hidden = !esUrl;
    casillaPestana.hidden = !esUrl;
  }

  destino.addEventListener('change', actualizarVisibles);
  actualizarVisibles();

  rejilla.append(campo('¿A dónde lleva?', destino), campoTexto);
  seccion.append(rejilla, campoUrl, casillaPestana, estilo.elemento);

  return {
    elemento: seccion,
    estilo,
    leerDatos: () => ({
      boton_destino: destino.value,
      boton_texto: texto.value,
      boton_url: url.value,
      boton_nueva_pestana: nuevaPestana.checked
    })
  };
}

import { crear } from '../utilidades.js';
import {
  obtenerRedesSociales,
  actualizarRedesSociales,
  obtenerPantallaFinal,
  actualizarPantallaFinal,
  listarNiveles
} from '../consultas.js';
import { NOMBRES_RED, iconoRed } from '../iconosRedes.js';
import { campo, entrada, boton, ejecutar } from './interfaz.js';
import { redesVisibles } from './vistaPrevia.js';
import { barraEstilo, controlColor, controlNumero, segmentado } from './controlesEstilo.js';

// Diseño original de los botones (lo que muestra la página sin personalizar).
const ORIGINAL = {
  contenido: 'icono_texto',
  icono: 'circulo',
  tamano: 32,
  fondo: 'oscuro',
  forma: 'pildora',
  disposicion: 'fila',
  separacion: 12,
  colorFondo: '#1c0f45',
  colorBorde: '#d9a6f0',
  texto: { tamano: 14, color: '#ffffff', negrita: true, cursiva: false }
};

const OPCIONES = {
  contenido: [
    { valor: 'icono_texto', texto: 'Icono y texto' },
    { valor: 'solo_icono', texto: 'Solo icono' }
  ],
  icono: [
    { valor: 'circulo', texto: 'Círculo de color' },
    { valor: 'color', texto: 'Icono a color' },
    { valor: 'blanco', texto: 'Icono blanco' },
    { valor: 'circulo_blanco', texto: 'Círculo blanco' }
  ],
  fondo: [
    { valor: 'oscuro', texto: 'Oscuro con borde' },
    { valor: 'marca', texto: 'Color de la red' },
    { valor: 'ninguno', texto: 'Sin fondo' },
    { valor: 'personalizado', texto: 'Personalizado' }
  ],
  forma: [
    { valor: 'pildora', texto: 'Píldora' },
    { valor: 'redondeado', texto: 'Redondeado' },
    { valor: 'recto', texto: 'Recto' }
  ],
  disposicion: [
    { valor: 'fila', texto: 'En fila' },
    { valor: 'columna', texto: 'En columna' }
  ]
};

export async function montar(contenedor, { vistaPrevia } = {}) {
  const [{ redes, estilo }, pantalla, niveles] = await Promise.all([
    obtenerRedesSociales(),
    obtenerPantallaFinal(),
    listarNiveles().catch(() => [])
  ]);

  // Un nivel cualquiera, solo para que la vista previa se vea como la pantalla real
  // de diagnóstico (el contenido del nivel no se guarda desde aquí).
  const nivelDeMuestra = niveles[0] || null;

  const disenio = seccionDisenio(estilo);
  const lista = seccionRedes(redes);
  const tituloRedes = entrada('text', pantalla.redes_titulo, { maxlength: 120, placeholder: 'Síguenos para conocernos más' });

  const leer = () => ({ redes: lista.leer(), estilo: disenio.leer(), redesTitulo: tituloRedes.value });

  const barra = crear('div', 'barra');
  const titulos = crear('div');
  const acciones = crear('div', 'herramientas');
  const pendiente = crear('span', 'chip chip-alerta', 'Cambios sin guardar');
  let guardado = JSON.stringify(leer());

  const guardar = boton('Guardar cambios', 'boton-primario', async () => {
    const datos = leer();
    const resultado = await ejecutar(async () => {
      const redesGuardadas = await actualizarRedesSociales(datos.redes, datos.estilo);
      await actualizarPantallaFinal({ ...pantalla, redes_titulo: datos.redesTitulo });
      return redesGuardadas;
    }, 'Cambios guardados');
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
    crear('h2', '', 'Redes sociales'),
    crear('p', 'ayuda', 'Botones que se muestran debajo de "Volver a hacer el test", en la pantalla de diagnóstico. Elige su diseño y qué redes mostrar; la vista previa muestra cómo quedará.')
  );
  acciones.append(pendiente, guardar);
  barra.append(titulos, acciones);

  const bloqueTitulo = bloque('Título sobre las redes');
  bloqueTitulo.append(campo('Texto', tituloRedes, 'Va justo arriba de los botones. Déjalo vacío para ocultarlo.'));

  contenedor.replaceChildren(barra, disenio.elemento, bloqueTitulo, lista.elemento);

  const alCambiar = () => {
    disenio.actualizarVisibles();
    revisarPendiente();
    if (vistaPrevia && nivelDeMuestra) {
      const datos = leer();
      vistaPrevia.mostrar({
        tipo: 'resumen',
        nivel: nivelDeMuestra,
        fraccion: 1,
        redes: { redes: redesVisibles(datos.redes), redes_estilo: datos.estilo, redes_titulo: datos.redesTitulo }
      });
    }
  };

  // Los botones (↑ ↓, opciones, restablecer) no disparan "input": se revisa después del clic.
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

function filaOpcion(etiqueta, ...controles) {
  const fila = crear('div', 'fila-opcion');
  const grupo = crear('div', 'fila-opcion-controles');
  grupo.append(...controles);
  fila.append(crear('span', 'campo-etiqueta', etiqueta), grupo);
  return fila;
}

function seccionDisenio(inicial) {
  const seccion = bloque('Diseño de los botones', 'Se aplica a todas las redes. Puedes ajustar el tamaño y el fondo de cada una más abajo.');
  const opcionesSegmentadas = {};

  Object.entries(OPCIONES).forEach(([clave, opciones]) => {
    opcionesSegmentadas[clave] = segmentado(opciones, inicial[clave] || ORIGINAL[clave]);
  });

  const tamano = controlNumero({
    valor: inicial.tamano,
    porDefecto: ORIGINAL.tamano,
    minimo: 16,
    maximo: 96,
    paso: 4,
    titulo: 'Tamaño del icono'
  });
  const separacion = controlNumero({
    valor: inicial.separacion,
    porDefecto: ORIGINAL.separacion,
    minimo: 0,
    maximo: 48,
    paso: 4,
    titulo: 'Separación entre botones'
  });
  const colorFondo = controlColor('Fondo', inicial.colorFondo, ORIGINAL.colorFondo);
  const colorBorde = controlColor('Borde', inicial.colorBorde, ORIGINAL.colorBorde);
  const coloresPersonalizados = crear('div', 'fila-opcion-controles');
  coloresPersonalizados.append(colorFondo.elemento, colorBorde.elemento);

  const texto = barraEstilo(ORIGINAL.texto, inicial.texto || {}, { tamanoMaximo: 40 });
  const filaTexto = filaOpcion('Texto', texto.elemento);
  const filaColores = filaOpcion('Colores del fondo', coloresPersonalizados);

  const restablecer = boton('↺ Volver al diseño original', 'boton-secundario boton-chico', () => {
    Object.entries(opcionesSegmentadas).forEach(([clave, control]) => control.marcar(ORIGINAL[clave]));
    tamano.restablecer();
    separacion.restablecer();
    colorFondo.restablecer();
    colorBorde.restablecer();
    texto.restablecer();
  });

  seccion.append(
    filaOpcion('Contenido', opcionesSegmentadas.contenido.elemento),
    filaOpcion('Estilo del icono', opcionesSegmentadas.icono.elemento),
    filaOpcion('Tamaño del icono', tamano.elemento),
    filaOpcion('Fondo del botón', opcionesSegmentadas.fondo.elemento),
    filaColores,
    filaOpcion('Forma', opcionesSegmentadas.forma.elemento),
    filaOpcion('Disposición', opcionesSegmentadas.disposicion.elemento, separacion.elemento),
    filaTexto,
    restablecer
  );

  return {
    elemento: seccion,
    actualizarVisibles() {
      filaColores.hidden = opcionesSegmentadas.fondo.leer() !== 'personalizado';
      filaTexto.hidden = opcionesSegmentadas.contenido.leer() === 'solo_icono';
    },
    // Solo lo que difiere del diseño original.
    leer() {
      const estilo = {};
      Object.entries(opcionesSegmentadas).forEach(([clave, control]) => {
        if (control.leer() !== ORIGINAL[clave]) estilo[clave] = control.leer();
      });
      if (tamano.leer()) estilo.tamano = tamano.leer();
      if (separacion.leer() !== undefined) estilo.separacion = separacion.leer();
      if (estilo.fondo === 'personalizado') {
        if (colorFondo.leer()) estilo.colorFondo = colorFondo.leer();
        if (colorBorde.leer()) estilo.colorBorde = colorBorde.leer();
      }
      const estiloTexto = texto.leer();
      if (Object.keys(estiloTexto).length) estilo.texto = estiloTexto;
      return estilo;
    }
  };
}

function tarjetaRed(red) {
  const tarjeta = crear('div', 'tarjeta-red');
  const cabecera = crear('div', 'tarjeta-mensaje-cabecera');
  const nombre = crear('strong', `fila-red-nombre red-${red.plataforma}`);
  const icono = crear('span', 'red-icono');
  const orden = crear('div', 'acciones-mensaje');
  const subir = boton('↑', 'boton-secundario boton-mini');
  const bajar = boton('↓', 'boton-secundario boton-mini');
  const usuario = entrada('text', red.usuario, { maxlength: 120, placeholder: '@usuario' });
  const url = entrada('url', red.url, { maxlength: 300, placeholder: 'https://...' });
  const activo = crear('input', '', undefined, { type: 'checkbox' });
  const casillaActiva = crear('label', 'casilla');
  const rejilla = crear('div', 'rejilla');
  const estilo = red.estilo || {};

  const tamano = controlNumero({
    valor: estilo.tamano,
    porDefecto: ORIGINAL.tamano,
    sugerencia: 'auto',
    minimo: 16,
    maximo: 96,
    paso: 4,
    titulo: 'Tamaño propio del icono'
  });
  const fondo = controlColor('Fondo propio', estilo.colorFondo, '#1c0f45');
  const restablecer = boton('↺', 'boton-secundario boton-mini', () => {
    tamano.restablecer();
    fondo.restablecer();
  });
  restablecer.title = 'Usar el diseño general';
  restablecer.setAttribute('aria-label', 'Usar el diseño general en esta red');

  subir.title = 'Subir';
  bajar.title = 'Bajar';
  subir.setAttribute('aria-label', `Subir ${NOMBRES_RED[red.plataforma]}`);
  bajar.setAttribute('aria-label', `Bajar ${NOMBRES_RED[red.plataforma]}`);
  activo.checked = red.activo;

  icono.append(iconoRed(red.plataforma));
  nombre.append(icono, crear('span', '', NOMBRES_RED[red.plataforma] || red.plataforma));
  orden.append(subir, bajar);
  cabecera.append(nombre, orden);
  casillaActiva.append(activo, crear('span', '', 'Mostrar'));
  rejilla.append(campo('Usuario a mostrar', usuario), campo('Enlace', url));

  const ajustes = crear('div', 'barra-estilo');
  ajustes.append(crear('span', 'secundario', 'Ajustes de esta red:'), tamano.elemento, fondo.elemento, restablecer);

  tarjeta.append(cabecera, rejilla, casillaActiva, ajustes);

  return {
    elemento: tarjeta,
    subir,
    bajar,
    leer() {
      const propio = {};
      if (tamano.leer()) propio.tamano = tamano.leer();
      if (fondo.leer()) propio.colorFondo = fondo.leer();
      return {
        plataforma: red.plataforma,
        usuario: usuario.value,
        url: url.value,
        activo: activo.checked,
        estilo: propio
      };
    }
  };
}

function seccionRedes(redes) {
  const seccion = bloque('Redes', 'Marca "Mostrar" en las que quieras que aparezcan (necesitan un enlace). Usa ↑ ↓ para cambiar el orden.');
  const filas = crear('div', 'campos');
  const tarjetas = redes.map(tarjetaRed);

  function mover(tarjeta, paso) {
    const indice = tarjetas.indexOf(tarjeta);
    const destino = indice + paso;
    if (destino < 0 || destino >= tarjetas.length) return;
    [tarjetas[indice], tarjetas[destino]] = [tarjetas[destino], tarjetas[indice]];
    pintar();
  }

  function pintar() {
    tarjetas.forEach((tarjeta, i) => {
      tarjeta.subir.disabled = i === 0;
      tarjeta.bajar.disabled = i === tarjetas.length - 1;
    });
    // Se reutilizan las tarjetas para no perder lo escrito al reordenar.
    filas.replaceChildren(...tarjetas.map((tarjeta) => tarjeta.elemento));
  }

  tarjetas.forEach((tarjeta) => {
    tarjeta.subir.addEventListener('click', () => mover(tarjeta, -1));
    tarjeta.bajar.addEventListener('click', () => mover(tarjeta, 1));
  });

  pintar();
  seccion.append(filas);

  return { elemento: seccion, leer: () => tarjetas.map((tarjeta) => tarjeta.leer()) };
}

import { listarNiveles, crearNivel, actualizarNivel, eliminarNivel } from '../consultas.js';
import { crear } from '../utilidades.js';
import { avisar, boton, campo, confirmar, ejecutar, entrada, formularioModal } from './interfaz.js';

const VEHICULOS = [
  { valor: 'cohete', etiqueta: 'Cohete' },
  { valor: 'avion', etiqueta: 'Avión' },
  { valor: 'carro', etiqueta: 'Carro' },
  { valor: 'scooter', etiqueta: 'Scooter' }
];

const COLORES_SUGERIDOS = ['#39d353', '#ffc15e', '#ff8a4c', '#ff5c70'];

let raiz;
let vistaPrevia = null;
let seleccionado = null;

export async function montar(contenedor, contexto = {}) {
  raiz = contenedor;
  vistaPrevia = contexto.vistaPrevia || null;
  seleccionado = null;
  await pintar();
}

// Misma posición del astronauta que calcula el servidor: el primer nivel queda al final de la barra.
function fraccionDe(indice, total) {
  return 1 - (indice + 0.5) / total;
}

function mostrarVistaPrevia(niveles) {
  if (!vistaPrevia) return;

  const indice = Math.max(0, niveles.findIndex((nivel) => nivel.id === seleccionado));
  const nivel = niveles[indice];

  if (!nivel) return;

  seleccionado = nivel.id;
  raiz.querySelectorAll('.nivel-admin').forEach((tarjeta) => {
    tarjeta.classList.toggle('en-vista-previa', Number(tarjeta.dataset.id) === nivel.id);
  });
  vistaPrevia.mostrar({ tipo: 'resumen', nivel, fraccion: fraccionDe(indice, niveles.length) });
}

async function pintar() {
  const niveles = await listarNiveles();
  const barra = crear('div', 'barra');
  const titulos = crear('div');

  titulos.append(
    crear('h2', '', 'Niveles del resultado'),
    crear(
      'p',
      'ayuda',
      'Según la suma de los niveles (inputs) de todas las áreas, se muestra uno de estos mensajes justo antes del formulario de contacto.'
    )
  );
  barra.append(titulos, boton('+ Nuevo nivel', 'boton-primario', () => formularioNivel()));

  raiz.replaceChildren(
    barra,
    ...(niveles.length
      ? niveles.map((nivel) => tarjetaNivel(nivel))
      : [crear('p', 'vacio', 'Aún no hay niveles configurados.')])
  );

  raiz.querySelectorAll('.nivel-admin').forEach((tarjeta) => {
    tarjeta.querySelector('.ver-vista-previa').addEventListener('click', () => {
      seleccionado = Number(tarjeta.dataset.id);
      mostrarVistaPrevia(niveles);
    });
  });
  mostrarVistaPrevia(niveles);
}

function vehiculoEtiqueta(valor) {
  return (VEHICULOS.find((item) => item.valor === valor) || {}).etiqueta || valor;
}

function tarjetaNivel(nivel) {
  const tarjeta = crear('div', 'pregunta-admin nivel-admin', undefined, {
    style: `--color-nivel: ${nivel.color}`,
    'data-id': nivel.id
  });
  const encabezado = crear('div', 'pregunta-encabezado');
  const acciones = crear('div', 'acciones');
  const etiquetas = crear('div', 'etiquetas');
  const lista = crear('ul', 'alternativas-admin');

  acciones.append(
    ...(vistaPrevia ? [boton('Vista previa', 'boton-secundario boton-chico ver-vista-previa')] : []),
    boton('Editar', 'boton-secundario boton-chico', () => formularioNivel(nivel)),
    boton('Eliminar', 'boton-peligro boton-chico', () => borrarNivel(nivel))
  );

  encabezado.append(
    crear('span', 'pastilla pastilla-nivel', `${nivel.minimo}–${nivel.maximo}`, { title: `Color ${nivel.color}` }),
    crear('p', 'pregunta-texto', nivel.titulo),
    acciones
  );

  etiquetas.append(crear('span', 'chip', vehiculoEtiqueta(nivel.vehiculo)));

  nivel.oportunidades.forEach((oportunidad) => {
    const fila = crear('li');
    fila.append(crear('span', 'punto-vista'), crear('span', 'alternativa-texto', oportunidad.texto));
    lista.append(fila);
  });

  tarjeta.append(encabezado, etiquetas, lista);
  return tarjeta;
}

async function borrarNivel(nivel) {
  if (!(await confirmar(`¿Eliminar el nivel "${nivel.titulo}" (${nivel.minimo}–${nivel.maximo})?`))) return;

  await ejecutar(() => eliminarNivel(nivel.id), 'Nivel eliminado');
  await pintar();
}

function formularioNivel(nivel) {
  const editando = Boolean(nivel);
  const estado = {
    oportunidades: editando ? nivel.oportunidades.map(({ texto }) => ({ texto })) : [{ texto: '' }]
  };

  const minimo = entrada('number', editando ? nivel.minimo : '', { step: 1, required: '' });
  const maximo = entrada('number', editando ? nivel.maximo : '', { step: 1, required: '' });

  const selectorVehiculo = crear('select', 'entrada');
  VEHICULOS.forEach((item) => {
    const opcion = crear('option', '', item.etiqueta);
    opcion.value = item.valor;
    selectorVehiculo.append(opcion);
  });
  selectorVehiculo.value = editando ? nivel.vehiculo : 'cohete';

  const color = entrada('color', editando ? nivel.color : COLORES_SUGERIDOS[0]);
  const muestras = crear('div', 'muestras-color');
  const selectorColor = crear('div', 'selector-color');

  COLORES_SUGERIDOS.forEach((valor) => {
    const muestra = boton('', 'muestra-color', () => {
      color.value = valor;
    });
    muestra.style.background = valor;
    muestra.setAttribute('aria-label', `Usar color ${valor}`);
    muestras.append(muestra);
  });
  selectorColor.append(color, muestras);

  const titulo = entrada('text', editando ? nivel.titulo : '', { maxlength: 200, required: '' });

  const introduccion = crear('textarea', 'entrada', undefined, { rows: 4, maxlength: 1500 });
  introduccion.value = editando ? nivel.introduccion : '';

  const filas = crear('div', 'filas-alternativas');
  const agregar = boton('+ Añadir oportunidad', 'boton-secundario boton-chico', () => {
    estado.oportunidades.push({ texto: '' });
    pintarFilas();
    filas.querySelector('.fila-oportunidad:last-child input').focus();
  });

  function pintarFilas() {
    filas.replaceChildren(
      ...estado.oportunidades.map((item, indice) => {
        const fila = crear('div', 'fila-oportunidad');
        const campoTexto = entrada('text', item.texto, {
          maxlength: 200,
          placeholder: `Oportunidad ${indice + 1}`,
          'aria-label': `Oportunidad ${indice + 1}`
        });
        const quitar = boton('×', 'boton-peligro boton-cuadrado', () => {
          estado.oportunidades.splice(indice, 1);
          pintarFilas();
        });

        campoTexto.addEventListener('input', () => {
          item.texto = campoTexto.value;
        });
        campoTexto.addEventListener('keydown', (evento) => {
          if (evento.key === 'Enter') evento.preventDefault();
        });

        quitar.setAttribute('aria-label', 'Quitar oportunidad');
        fila.append(campoTexto, quitar);
        return fila;
      })
    );
  }

  pintarFilas();

  const bloqueOportunidades = crear('div', 'campo');
  bloqueOportunidades.append(
    crear('span', 'campo-etiqueta', 'Oportunidades'),
    crear('small', 'campo-ayuda', 'Se muestran como lista con un ícono verde antes del texto.'),
    filas,
    agregar
  );

  const textoIntermedio = crear('textarea', 'entrada', undefined, { rows: 3, maxlength: 1500 });
  textoIntermedio.value = editando ? nivel.texto_intermedio : '';

  const cierreTitulo = entrada('text', editando ? nivel.cierre_titulo : '', { maxlength: 200 });
  const cierreTexto = crear('textarea', 'entrada', undefined, { rows: 3, maxlength: 1000 });
  cierreTexto.value = editando ? nivel.cierre_texto : '';

  const botonTexto = entrada('text', editando ? nivel.boton_texto : '', { maxlength: 120, required: '' });
  const botonNota = entrada('text', editando ? nivel.boton_nota : '', { maxlength: 300 });

  const rejilla = crear('div', 'rejilla');
  rejilla.append(campo('Desde (suma de niveles)', minimo), campo('Hasta (suma de niveles)', maximo));

  const cuerpo = crear('div', 'campos');
  cuerpo.append(
    rejilla,
    campo('Vehículo', selectorVehiculo),
    campo('Color', selectorColor, 'Identifica el rango en el admin y el perfil de cada persona en el historial.'),
    campo(
      'Título',
      titulo,
      'Incluye el emoji si quieres, ej: ¡Genial! Tu empresa va por buen camino 🚀'
    ),
    campo(
      'Introducción',
      introduccion,
      'Va antes de la lista de oportunidades. Separa párrafos con una línea en blanco y usa **negritas** con doble asterisco.'
    ),
    bloqueOportunidades,
    campo('Texto intermedio', textoIntermedio, 'Va después de la lista, antes del título de cierre.'),
    campo('Título de cierre', cierreTitulo),
    campo('Texto de cierre', cierreTexto, 'Va justo antes del botón.'),
    campo('Texto del botón', botonTexto),
    campo('Nota debajo del botón', botonNota)
  );

  formularioModal({
    titulo: editando ? 'Editar nivel' : 'Nuevo nivel',
    ancho: 760,
    cuerpo,
    alGuardar: async () => {
      const datos = {
        minimo: minimo.value,
        maximo: maximo.value,
        vehiculo: selectorVehiculo.value,
        color: color.value,
        titulo: titulo.value,
        introduccion: introduccion.value,
        oportunidades: estado.oportunidades,
        texto_intermedio: textoIntermedio.value,
        cierre_titulo: cierreTitulo.value,
        cierre_texto: cierreTexto.value,
        boton_texto: botonTexto.value,
        boton_nota: botonNota.value
      };

      const guardado = editando ? await actualizarNivel(nivel.id, datos) : await crearNivel(datos);
      seleccionado = guardado.id;

      await pintar();
      avisar(editando ? 'Nivel actualizado' : 'Nivel creado');
    }
  });
}

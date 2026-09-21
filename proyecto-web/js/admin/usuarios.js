import {
  listarUsuarios,
  listarSesiones,
  crearUsuario,
  actualizarUsuario,
  restablecerClave,
  eliminarUsuario,
  cerrarSesionDe
} from '../consultas.js';
import { crear, formatearFecha, hace, plural } from '../utilidades.js';
import { avisar, boton, campo, confirmar, ejecutar, entrada, formularioModal } from './interfaz.js';

const REFRESCO = 30 * 1000;
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const NUMEROS = '23456789';
let raiz;
let refresco;

export async function montar(contenedor) {
  raiz = contenedor;
  clearInterval(refresco);
  await pintar();

  refresco = setInterval(() => {
    if (!raiz.isConnected) {
      clearInterval(refresco);
      return;
    }
    if (!document.querySelector('dialog[open]')) pintar().catch(() => {});
  }, REFRESCO);
}

async function pintar() {
  const [usuarios, sesiones] = await Promise.all([listarUsuarios(), listarSesiones()]);
  const barra = crear('div', 'barra');
  const titulos = crear('div');

  titulos.append(
    crear('h2', '', 'Administradores'),
    crear('p', 'ayuda', 'Quiénes tienen acceso y quiénes están dentro ahora mismo. Se actualiza solo cada 30 segundos.')
  );
  barra.append(titulos, boton('+ Nuevo administrador', 'boton-primario', () => formularioNuevo()));

  raiz.replaceChildren(barra, seccionConectados(sesiones), seccionUsuarios(usuarios, sesiones));
}

function describirNavegador(agente) {
  const texto = agente || '';
  const navegador =
    (/Edg\//.test(texto) && 'Edge') ||
    (/OPR\//.test(texto) && 'Opera') ||
    (/Firefox\//.test(texto) && 'Firefox') ||
    (/Chrome\//.test(texto) && 'Chrome') ||
    (/Safari\//.test(texto) && 'Safari') ||
    'Navegador';
  const sistema =
    (/iPhone|iPad/.test(texto) && 'iOS') ||
    (/Android/.test(texto) && 'Android') ||
    (/Windows/.test(texto) && 'Windows') ||
    (/Mac OS X/.test(texto) && 'macOS') ||
    (/Linux/.test(texto) && 'Linux') ||
    '';

  return sistema ? `${navegador} en ${sistema}` : navegador;
}

function generarClave() {
  const todos = LETRAS + NUMEROS;
  const sorteo = (fuente) => fuente[crypto.getRandomValues(new Uint32Array(1))[0] % fuente.length];
  const caracteres = [sorteo(LETRAS), sorteo(NUMEROS)];

  while (caracteres.length < 14) caracteres.push(sorteo(todos));

  return caracteres.sort(() => crypto.getRandomValues(new Uint8Array(1))[0] - 128).join('');
}

function seccionConectados(sesiones) {
  const seccion = crear('section', 'seccion-usuarios');
  const encabezado = crear('div', 'seccion-cabecera');
  const enLinea = sesiones.filter((sesion) => sesion.en_linea).length;

  encabezado.append(
    crear('h4', '', 'Conectados ahora'),
    crear('span', 'chip chip-ok', plural(enLinea, 'en línea', 'en línea'))
  );
  seccion.append(encabezado);

  if (!sesiones.length) {
    seccion.append(crear('p', 'vacio', 'No hay sesiones abiertas.'));
    return seccion;
  }

  const lista = crear('div', 'sesiones');

  sesiones.forEach((sesion) => {
    const tarjeta = crear('article', sesion.actual ? 'sesion sesion-actual' : 'sesion');
    const datos = crear('div', 'sesion-datos');
    const titulo = crear('div', 'sesion-titulo');

    titulo.append(
      crear('strong', '', sesion.nombre),
      crear('span', sesion.en_linea ? 'chip chip-ok' : 'chip', sesion.en_linea ? 'En línea' : 'Inactivo')
    );
    if (sesion.actual) titulo.append(crear('span', 'chip tipo-unica', 'Tu sesión'));

    datos.append(
      titulo,
      crear('small', 'secundario', sesion.correo),
      crear(
        'small',
        'secundario',
        `${sesion.ip || 'IP desconocida'} · ${describirNavegador(sesion.navegador)}`
      ),
      crear(
        'small',
        'secundario',
        `Entró ${hace(sesion.creado_en)} · Última actividad ${hace(sesion.ultima_actividad)}`
      )
    );

    tarjeta.append(
      datos,
      boton(sesion.actual ? 'Cerrar mi sesión' : 'Cerrar sesión', 'boton-peligro boton-chico', () =>
        cerrarSesionAjena(sesion)
      )
    );
    lista.append(tarjeta);
  });

  seccion.append(lista);
  return seccion;
}

function seccionUsuarios(usuarios, sesiones) {
  const seccion = crear('section', 'seccion-usuarios');
  const propio = sesiones.find((sesion) => sesion.actual);
  const tabla = crear('table', 'tabla');
  const encabezado = crear('thead');
  const cuerpo = crear('tbody');
  const titulos = crear('tr');
  const envoltura = crear('div', 'tabla-envoltura');
  const encabezadoSeccion = crear('div', 'seccion-cabecera');

  encabezadoSeccion.append(crear('h4', '', 'Cuentas'));
  seccion.append(encabezadoSeccion);

  ['Administrador', 'Estado', 'Conexión', 'Acceso', ''].forEach((titulo) => {
    titulos.append(crear('th', '', titulo));
  });
  encabezado.append(titulos);

  usuarios.forEach((usuario) => cuerpo.append(filaUsuario(usuario, propio && propio.usuario_id === usuario.id)));

  tabla.append(encabezado, cuerpo);
  envoltura.append(tabla);
  seccion.append(envoltura);
  return seccion;
}

function filaUsuario(usuario, esPropio) {
  const fila = crear('tr');
  const persona = crear('td');
  const estado = crear('td');
  const conexion = crear('td');
  const acceso = crear('td');
  const acciones = crear('td', 'acciones-tabla');
  const nombre = crear('strong', '', usuario.nombre);

  if (esPropio) nombre.append(' ', crear('span', 'chip tipo-unica', 'Tú'));
  persona.append(nombre, crear('small', 'secundario', usuario.correo));

  estado.append(crear('span', usuario.activo ? 'chip' : 'chip chip-alerta', usuario.activo ? 'Activo' : 'Desactivado'));
  if (usuario.debe_cambiar_clave) estado.append(crear('small', 'secundario', 'Debe cambiar su contraseña'));

  conexion.append(
    crear('span', usuario.en_linea ? 'chip chip-ok' : 'chip', usuario.en_linea ? 'En línea' : 'Desconectado')
  );
  if (usuario.sesiones) conexion.append(crear('small', 'secundario', plural(usuario.sesiones, 'sesión abierta', 'sesiones abiertas')));

  acceso.append(
    crear('span', '', usuario.ultimo_acceso ? formatearFecha(usuario.ultimo_acceso) : 'Nunca ha entrado')
  );
  acceso.append(crear('small', 'secundario', `Creado ${formatearFecha(usuario.creado_en)}`));

  acciones.append(boton('Editar', 'boton-secundario boton-chico', () => formularioEditar(usuario, esPropio)));
  if (!esPropio) {
    acciones.append(
      boton('Contraseña', 'boton-secundario boton-chico', () => formularioClave(usuario)),
      boton('Eliminar', 'boton-peligro boton-chico', () => borrar(usuario))
    );
  }

  fila.append(persona, estado, conexion, acceso, acciones);
  return fila;
}

async function cerrarSesionAjena(sesion) {
  const mensaje = sesion.actual
    ? '¿Cerrar tu sesión actual? Tendrás que volver a iniciar sesión.'
    : `¿Cerrar la sesión de ${sesion.nombre}? Tendrá que iniciar sesión de nuevo.`;

  if (!(await confirmar(mensaje, { textoConfirmar: 'Cerrar sesión' }))) return;

  await ejecutar(() => cerrarSesionDe(sesion.id), 'Sesión cerrada');

  if (sesion.actual) {
    location.href = '/login-anewpixel.html';
    return;
  }

  await pintar();
}

async function borrar(usuario) {
  const mensaje = `¿Eliminar a ${usuario.nombre} (${usuario.correo})? Perderá el acceso y se cerrarán sus sesiones.`;

  if (!(await confirmar(mensaje))) return;

  await ejecutar(() => eliminarUsuario(usuario.id), 'Administrador eliminado');
  await pintar();
}

function campoClave(etiqueta, ayuda) {
  const clave = entrada('text', '', { required: '', minlength: 10, maxlength: 128, autocomplete: 'off' });
  const generar = boton('Generar', 'boton-secundario', () => {
    clave.value = generarClave();
  });
  const fila = crear('div', 'campo-clave');

  fila.append(clave, generar);

  const contenedor = crear('div', 'campo');
  contenedor.append(crear('span', 'campo-etiqueta', etiqueta), fila, crear('small', 'campo-ayuda', ayuda));
  return { clave, contenedor };
}

function formularioNuevo() {
  const nombre = entrada('text', '', { required: '', maxlength: 120 });
  const correo = entrada('email', '', { required: '', maxlength: 160 });
  const { clave, contenedor } = campoClave(
    'Contraseña temporal',
    'Compártela con la persona por un medio seguro. Al entrar por primera vez deberá cambiarla.'
  );
  const cuerpo = crear('div', 'campos');

  cuerpo.append(campo('Nombre', nombre), campo('Correo', correo), contenedor);

  formularioModal({
    titulo: 'Nuevo administrador',
    ancho: 520,
    cuerpo,
    textoGuardar: 'Crear administrador',
    alGuardar: async () => {
      await crearUsuario({ nombre: nombre.value, correo: correo.value, clave: clave.value });
      await pintar();
      avisar('Administrador creado');
    }
  });
}

function formularioEditar(usuario, esPropio) {
  const nombre = entrada('text', usuario.nombre, { required: '', maxlength: 120 });
  const correo = entrada('email', usuario.correo, { required: '', maxlength: 160 });
  const activo = crear('input', '', undefined, { type: 'checkbox' });
  const etiqueta = crear('label', 'casilla');
  const cuerpo = crear('div', 'campos');

  activo.checked = usuario.activo;
  activo.disabled = esPropio;
  etiqueta.append(activo, crear('span', '', esPropio ? 'Cuenta activa (no puedes desactivar la tuya)' : 'Cuenta activa'));
  cuerpo.append(campo('Nombre', nombre), campo('Correo', correo), etiqueta);

  formularioModal({
    titulo: 'Editar administrador',
    ancho: 520,
    cuerpo,
    alGuardar: async () => {
      await actualizarUsuario(usuario.id, {
        nombre: nombre.value,
        correo: correo.value,
        activo: activo.checked
      });
      await pintar();
      avisar('Administrador actualizado');
    }
  });
}

function formularioClave(usuario) {
  const { clave, contenedor } = campoClave(
    'Nueva contraseña temporal',
    'Se cerrarán sus sesiones abiertas y deberá cambiarla al volver a entrar.'
  );
  const cuerpo = crear('div', 'campos');

  cuerpo.append(crear('p', 'ayuda', `Restablecer la contraseña de ${usuario.nombre}.`), contenedor);

  formularioModal({
    titulo: 'Restablecer contraseña',
    ancho: 520,
    cuerpo,
    textoGuardar: 'Restablecer',
    alGuardar: async () => {
      await restablecerClave(usuario.id, clave.value);
      await pintar();
      avisar('Contraseña restablecida');
    }
  });
}

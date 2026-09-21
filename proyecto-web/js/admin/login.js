import { iniciarSesion, obtenerSesion, cambiarClave } from '../consultas.js';

const $ = (id) => document.getElementById(id);
const DESTINO = '/admin-anewpixel.html';

function mostrarPaso(paso) {
  $('formulario-login').hidden = paso !== 'login';
  $('formulario-clave').hidden = paso !== 'clave';
}

function mostrarError(id, mensaje) {
  const error = $(id);
  error.textContent = mensaje;
  error.hidden = !mensaje;
}

async function enviar(evento, boton, errorId, accion) {
  evento.preventDefault();
  mostrarError(errorId, '');
  boton.disabled = true;

  try {
    await accion();
  } catch (error) {
    mostrarError(errorId, error.message);
    boton.disabled = false;
  }
}

$('formulario-login').addEventListener('submit', (evento) => {
  const formulario = evento.currentTarget;

  enviar(evento, $('entrar'), 'error-login', async () => {
    const clave = formulario.clave.value;
    const { usuario } = await iniciarSesion(formulario.correo.value, clave);

    if (usuario.debe_cambiar_clave) {
      $('clave-actual').value = clave;
      $('entrar').disabled = false;
      mostrarPaso('clave');
      $('clave-nueva').focus();
      return;
    }

    location.href = DESTINO;
  });
});

$('formulario-clave').addEventListener('submit', (evento) => {
  enviar(evento, $('guardar-clave'), 'error-clave', async () => {
    if ($('clave-nueva').value !== $('clave-repetida').value) {
      throw new Error('Las contraseñas nuevas no coinciden');
    }

    await cambiarClave($('clave-actual').value, $('clave-nueva').value);
    location.href = DESTINO;
  });
});

document.querySelector('[data-ver]').addEventListener('click', (evento) => {
  const campo = evento.currentTarget.previousElementSibling;
  const oculto = campo.type === 'password';

  campo.type = oculto ? 'text' : 'password';
  evento.currentTarget.textContent = oculto ? 'Ocultar' : 'Mostrar';
});

obtenerSesion()
  .then(({ usuario }) => {
    if (usuario.debe_cambiar_clave) mostrarPaso('clave');
    else location.href = DESTINO;
  })
  .catch(() => {});

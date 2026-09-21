import { crear } from '../utilidades.js';
import { obtenerSesion, cerrarSesion, cambiarClave } from '../consultas.js';
import { avisar, campo, entrada, formularioModal } from './interfaz.js';
import * as preguntas from './preguntas.js';
import * as orden from './orden.js';
import * as historial from './historial.js';
import * as usuarios from './usuarios.js';

const LOGIN = '/login-anewpixel.html';
const LATIDO = 60 * 1000;
const vistas = { preguntas, orden, historial, usuarios };
const contenido = document.getElementById('contenido');
const botones = document.querySelectorAll('[data-vista]');

function irAlLogin() {
  location.href = LOGIN;
}

async function mostrar(nombre) {
  const panel = crear('div', 'panel');

  botones.forEach((boton) => {
    const activo = boton.dataset.vista === nombre;
    boton.classList.toggle('activa', activo);
    boton.setAttribute('aria-current', activo ? 'page' : 'false');
  });

  history.replaceState(null, '', `#${nombre}`);
  contenido.replaceChildren(panel);

  try {
    await vistas[nombre].montar(panel);
  } catch (error) {
    panel.replaceChildren(crear('p', 'error-panel', error.message));
  }
}

function abrirCambioDeClave() {
  const atributos = { required: '', maxlength: 128 };
  const actual = entrada('password', '', { ...atributos, autocomplete: 'current-password' });
  const nueva = entrada('password', '', { ...atributos, autocomplete: 'new-password', minlength: 10 });
  const repetida = entrada('password', '', { ...atributos, autocomplete: 'new-password', minlength: 10 });
  const cuerpo = crear('div', 'campos');

  cuerpo.append(
    crear('p', 'ayuda', 'Mínimo 10 caracteres, con letras y números. Se cerrarán tus otras sesiones abiertas.'),
    campo('Contraseña actual', actual),
    campo('Nueva contraseña', nueva),
    campo('Repite la nueva contraseña', repetida)
  );

  formularioModal({
    titulo: 'Mi contraseña',
    ancho: 480,
    cuerpo,
    alGuardar: async () => {
      if (nueva.value !== repetida.value) {
        throw new Error('Las contraseñas nuevas no coinciden');
      }

      await cambiarClave(actual.value, nueva.value);
      avisar('Contraseña actualizada');
    }
  });
}

async function arrancar() {
  let usuario;

  try {
    ({ usuario } = await obtenerSesion());
  } catch {
    return irAlLogin();
  }

  if (usuario.debe_cambiar_clave) return irAlLogin();

  document.getElementById('nombre-usuario').textContent = usuario.nombre;
  document.getElementById('cambiar-clave').addEventListener('click', abrirCambioDeClave);
  document.getElementById('salir').addEventListener('click', async () => {
    await cerrarSesion().catch(() => {});
    irAlLogin();
  });

  botones.forEach((boton) => {
    boton.addEventListener('click', () => mostrar(boton.dataset.vista));
  });

  setInterval(() => {
    obtenerSesion().catch((error) => {
      if (error.estado === 401) irAlLogin();
    });
  }, LATIDO);

  const inicial = location.hash.slice(1);
  mostrar(vistas[inicial] ? inicial : 'preguntas');
}

arrancar();

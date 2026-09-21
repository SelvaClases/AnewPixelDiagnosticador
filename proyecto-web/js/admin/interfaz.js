import { crear } from '../utilidades.js';

export function boton(texto, clase, alClic) {
  const elemento = crear('button', `boton ${clase}`, texto, { type: 'button' });
  if (alClic) elemento.addEventListener('click', alClic);
  return elemento;
}

export function entrada(tipo, valor = '', atributos = {}) {
  const elemento = crear('input', 'entrada', undefined, { type: tipo, ...atributos });
  elemento.value = valor;
  return elemento;
}

export function campo(etiqueta, control, ayuda) {
  const contenedor = crear('label', 'campo');
  contenedor.append(crear('span', 'campo-etiqueta', etiqueta), control);
  if (ayuda) contenedor.append(crear('small', 'campo-ayuda', ayuda));
  return contenedor;
}

export function avisar(mensaje, tipo = 'ok') {
  const aviso = crear('div', `aviso aviso-${tipo}`, mensaje);
  document.getElementById('avisos').append(aviso);
  setTimeout(() => aviso.remove(), 4000);
}

export async function ejecutar(operacion, exito) {
  try {
    const resultado = await operacion();
    if (exito) avisar(exito);
    return resultado;
  } catch (error) {
    avisar(error.message, 'error');
    return undefined;
  }
}

export function abrirModal({ titulo, cuerpo, ancho = 640 }) {
  const dialogo = crear('dialog', 'modal');
  const cabecera = crear('header', 'modal-cabecera');
  const cerrar = () => dialogo.close();

  cabecera.append(crear('h2', '', titulo), boton('×', 'boton-icono', cerrar));
  cabecera.lastChild.setAttribute('aria-label', 'Cerrar');

  dialogo.style.setProperty('--ancho', `${ancho}px`);
  dialogo.append(cabecera, cuerpo);
  dialogo.addEventListener('close', () => dialogo.remove());

  document.body.append(dialogo);
  dialogo.showModal();

  return { dialogo, cerrar };
}

export function formularioModal({
  titulo,
  cuerpo,
  ancho,
  textoGuardar = 'Guardar',
  extras = [],
  alGuardar
}) {
  const formulario = crear('form', 'modal-contenido');
  const contenido = crear('div', 'modal-cuerpo');
  const error = crear('p', 'error-modal', undefined, { role: 'alert' });
  const izquierda = crear('div', 'pie-izquierda');
  const cancelar = boton('Cancelar', 'boton-secundario');
  const guardar = crear('button', 'boton boton-primario', textoGuardar, { type: 'submit' });
  const pie = crear('footer', 'modal-pie');

  error.hidden = true;
  contenido.append(cuerpo);
  izquierda.append(...extras);
  pie.append(error, izquierda, cancelar, guardar);
  formulario.append(contenido, pie);

  const modal = abrirModal({ titulo, cuerpo: formulario, ancho });
  cancelar.addEventListener('click', modal.cerrar);

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    error.hidden = true;
    guardar.disabled = true;

    try {
      await alGuardar();
      modal.cerrar();
    } catch (fallo) {
      error.textContent = fallo.message;
      error.hidden = false;
      guardar.disabled = false;
    }
  });

  return modal;
}

export function confirmar(mensaje, { titulo = 'Confirmar', textoConfirmar = 'Eliminar' } = {}) {
  return new Promise((resolver) => {
    let confirmado = false;
    const contenedor = crear('div', 'modal-contenido');
    const cuerpo = crear('div', 'modal-cuerpo');
    const pie = crear('footer', 'modal-pie');
    const aceptar = boton(textoConfirmar, 'boton-peligro');
    const cancelar = boton('Cancelar', 'boton-secundario');

    cuerpo.append(crear('p', 'confirmacion', mensaje));
    pie.append(cancelar, aceptar);
    contenedor.append(cuerpo, pie);

    const modal = abrirModal({ titulo, cuerpo: contenedor, ancho: 460 });

    aceptar.addEventListener('click', () => {
      confirmado = true;
      modal.cerrar();
    });
    cancelar.addEventListener('click', modal.cerrar);
    modal.dialogo.addEventListener('close', () => resolver(confirmado));
  });
}

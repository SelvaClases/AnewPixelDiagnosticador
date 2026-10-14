import { crear } from '../utilidades.js';

// Panel con la página pública real en un iframe (modo ?vista-previa), escalada para caber.
// El lado, el tamaño y el dispositivo los elige cada persona y se recuerdan en este navegador.

const CLAVE_PREFERENCIAS = 'admin-vista-previa';
const DISPOSITIVOS = {
  escritorio: { nombre: 'Escritorio', ancho: 1280 },
  movil: { nombre: 'Móvil', ancho: 390 }
};
const TAMANOS = { S: 0.3, M: 0.4, L: 0.55 };
const FRACCION_MINIMA = 0.22;
const FRACCION_MAXIMA = 0.7;

// Las redes como las ve el cliente: solo las marcadas y con enlace.
export function redesVisibles(redes) {
  return redes
    .filter((red) => red.activo && red.url.trim())
    .map(({ plataforma, usuario, url, estilo }) => ({ plataforma, usuario: usuario.trim(), url: url.trim(), estilo: estilo || {} }));
}

function leerPreferencias() {
  const porDefecto = { lado: 'derecha', fraccion: TAMANOS.M, dispositivo: 'escritorio' };

  try {
    return { ...porDefecto, ...JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS) || '{}') };
  } catch {
    return porDefecto;
  }
}

function guardarPreferencias(preferencias) {
  try {
    localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(preferencias));
  } catch {
    // sin almacenamiento disponible: se usan los valores por defecto la próxima vez
  }
}

function grupo(opciones, alElegir) {
  const contenedor = crear('div', 'segmentado');
  const botones = opciones.map(({ valor, texto, titulo }) => {
    const boton = crear('button', '', texto, { type: 'button', title: titulo || texto });
    boton.addEventListener('click', () => alElegir(valor));
    boton.dataset.valor = valor;
    contenedor.append(boton);
    return boton;
  });

  return {
    elemento: contenedor,
    marcar: (valor) => botones.forEach((boton) => boton.classList.toggle('activa', boton.dataset.valor === valor))
  };
}

// `contenedor` es el elemento con la rejilla (formulario + vista previa).
export function crearVistaPrevia(contenedor) {
  const preferencias = leerPreferencias();
  const panel = crear('aside', 'vista-previa', undefined, { 'aria-label': 'Vista previa' });
  const cabecera = crear('div', 'vista-previa-cabecera');
  const controles = crear('div', 'vista-previa-controles');
  const marco = crear('div', 'vista-previa-marco');
  const iframe = crear('iframe', '', undefined, {
    src: '/?vista-previa=1',
    title: 'Vista previa de la pantalla del cliente',
    tabindex: '-1'
  });
  const tirador = crear('div', 'vista-previa-tirador', undefined, {
    role: 'separator',
    'aria-label': 'Arrastra para cambiar el tamaño de la vista previa'
  });
  let ultimo = null;
  let lista = false;

  const lado = grupo(
    [
      { valor: 'izquierda', texto: '◧', titulo: 'Vista previa a la izquierda' },
      { valor: 'derecha', texto: '◨', titulo: 'Vista previa a la derecha' }
    ],
    (valor) => cambiar({ lado: valor })
  );
  const tamano = grupo(
    Object.keys(TAMANOS).map((clave) => ({ valor: clave, texto: clave, titulo: `Tamaño ${clave}` })),
    (clave) => cambiar({ fraccion: TAMANOS[clave] })
  );
  const dispositivo = grupo(
    Object.entries(DISPOSITIVOS).map(([valor, { nombre }]) => ({ valor, texto: nombre })),
    (valor) => cambiar({ dispositivo: valor })
  );

  function aplicar() {
    contenedor.classList.toggle('vista-izquierda', preferencias.lado === 'izquierda');
    contenedor.style.setProperty('--ancho-vista', `${(preferencias.fraccion * 100).toFixed(1)}%`);
    lado.marcar(preferencias.lado);
    dispositivo.marcar(preferencias.dispositivo);
    tamano.marcar(Object.keys(TAMANOS).find((clave) => Math.abs(TAMANOS[clave] - preferencias.fraccion) < 0.01) || '');
    requestAnimationFrame(escalar);
  }

  function cambiar(cambios) {
    Object.assign(preferencias, cambios);
    guardarPreferencias(preferencias);
    aplicar();
  }

  // Alto disponible: lo que queda visible del área de contenido bajo los encabezados fijos.
  function ajustarAlto() {
    const area = document.getElementById('contenido');
    const subpestanas = document.querySelector('.subpestanas');
    const disponible = area.clientHeight - (subpestanas ? subpestanas.offsetHeight : 0) - 32;
    panel.style.height = `${Math.max(320, disponible)}px`;
  }

  function escalar() {
    const { ancho } = DISPOSITIVOS[preferencias.dispositivo] || DISPOSITIVOS.escritorio;
    const anchoMarco = marco.clientWidth;
    const altoMarco = marco.clientHeight;

    if (!anchoMarco || !altoMarco) return;

    const escala = Math.min(1, anchoMarco / ancho);
    iframe.style.width = `${ancho}px`;
    iframe.style.height = `${altoMarco / escala}px`;
    iframe.style.transform = `scale(${escala})`;
    iframe.style.left = `${Math.max(0, (anchoMarco - ancho * escala) / 2)}px`;
  }

  function enviar() {
    if (lista && ultimo && iframe.contentWindow) {
      iframe.contentWindow.postMessage(ultimo, location.origin);
    }
  }

  function alMensaje(evento) {
    if (evento.origin !== location.origin || evento.source !== iframe.contentWindow) return;
    if (evento.data && evento.data.tipo === 'vista-previa-lista') {
      lista = true;
      enviar();
    }
  }

  tirador.addEventListener('pointerdown', (evento) => {
    evento.preventDefault();
    tirador.setPointerCapture(evento.pointerId);
    panel.classList.add('arrastrando');
  });

  tirador.addEventListener('pointermove', (evento) => {
    if (!tirador.hasPointerCapture(evento.pointerId)) return;

    const rect = contenedor.getBoundingClientRect();
    const ancho = preferencias.lado === 'izquierda' ? evento.clientX - rect.left : rect.right - evento.clientX;
    const fraccion = Math.min(FRACCION_MAXIMA, Math.max(FRACCION_MINIMA, ancho / rect.width));

    preferencias.fraccion = fraccion;
    aplicar();
  });

  const soltar = (evento) => {
    if (!tirador.hasPointerCapture(evento.pointerId)) return;
    tirador.releasePointerCapture(evento.pointerId);
    panel.classList.remove('arrastrando');
    guardarPreferencias(preferencias);
  };
  tirador.addEventListener('pointerup', soltar);
  tirador.addEventListener('pointercancel', soltar);

  const observador = new ResizeObserver(() => {
    ajustarAlto();
    escalar();
  });
  observador.observe(marco);
  observador.observe(document.getElementById('contenido'));
  window.addEventListener('message', alMensaje);

  controles.append(lado.elemento, tamano.elemento, dispositivo.elemento);
  cabecera.append(crear('strong', '', 'Vista previa'), controles);
  marco.append(iframe);
  panel.append(tirador, cabecera, marco, crear('p', 'vista-previa-nota', 'Así se verá para el cliente. Los botones no funcionan aquí.'));

  aplicar();
  ajustarAlto();

  return {
    elemento: panel,
    mostrar(mensaje) {
      ultimo = mensaje;
      enviar();
    },
    destruir() {
      observador.disconnect();
      window.removeEventListener('message', alMensaje);
    }
  };
}

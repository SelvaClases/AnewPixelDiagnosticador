// Meta Pixel (Facebook Ads). Un Pixel por país, igual que el resto del sitio detecta
// México vs Perú por el subdominio (diagnostico-app-mx.anewpixel.com / -pe.anewpixel.com).
// El de México todavía falta: pégalo aquí cuando lo tengas (son números públicos,
// aparecen en el código fuente de cualquier sitio con Pixel, no son secretos).
const PIXEL_ID_MX = '';
const PIXEL_ID_PE = '1425141415652751';

function idDelPixel() {
  const id = location.hostname.includes('-mx') ? PIXEL_ID_MX : PIXEL_ID_PE;
  return /^\d+$/.test(id) ? id : '';
}

let listo = false;

// Inserta el snippet oficial de Meta la primera vez que hace falta. No se carga en la
// vista previa del admin (iframe ?vista-previa) para no contar clics de quien está editando.
function activarPixel() {
  if (listo || new URLSearchParams(location.search).has('vista-previa')) return false;
  const id = idDelPixel();
  if (!id) return false;

  listo = true;

  const fb = (window.fbq = function fbq() {
    (fb.callMethod ? fb.callMethod.apply(fb, arguments) : fb.queue.push(arguments));
  });

  if (!window._fbq) window._fbq = fb;
  fb.push = fb;
  fb.loaded = true;
  fb.version = '2.0';
  fb.queue = [];

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  fb('init', id);
  fb('track', 'PageView');
  return true;
}

// nombre: evento estándar de Meta ('ViewContent', 'InitiateCheckout', 'Lead'…).
// datos: parámetros opcionales (ej. { content_name: 'Nivel 2' }).
export function registrarEvento(nombre, datos) {
  activarPixel();
  if (typeof window.fbq === 'function') window.fbq('track', nombre, datos);
}

// Eventos con nombre propio (no estándar de Meta), pedidos tal cual: 'BotonInicial' en el
// botón de inicio y 'BotonFinal' en "Agenda una sesión exploratoria". Se usa trackCustom,
// que es lo que corresponde para un nombre que Meta no reconoce como evento estándar.
export function registrarEventoPersonalizado(nombre, datos) {
  activarPixel();
  if (typeof window.fbq === 'function') window.fbq('trackCustom', nombre, datos);
}

// Se activa solo con abrir la página (como hacía el snippet de Meta), no hace falta
// que alguien haga clic en algo para que se cuente la visita (PageView).
activarPixel();




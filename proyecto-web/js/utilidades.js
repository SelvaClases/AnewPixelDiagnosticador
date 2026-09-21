export function crear(etiqueta, clase, texto, atributos = {}) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  Object.entries(atributos).forEach(([nombre, valor]) => elemento.setAttribute(nombre, valor));
  return elemento;
}

export function plural(cantidad, singular, varios) {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`;
}

export function formatearFecha(iso) {
  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) return '';

  return fecha.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

export function hace(iso) {
  const segundos = Math.round((Date.now() - new Date(iso).getTime()) / 1000);

  if (Number.isNaN(segundos)) return '';
  if (segundos < 60) return 'hace un momento';
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`;

  return `hace ${Math.floor(segundos / 86400)} d`;
}

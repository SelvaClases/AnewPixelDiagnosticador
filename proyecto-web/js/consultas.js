const API = '/api';

async function consultar(ruta, metodo = 'GET', cuerpo) {
  let respuesta;

  try {
    respuesta = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
  } catch {
    throw new Error('No hay conexión con el servidor');
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 401 && ruta.startsWith('/admin')) {
      location.href = '/login-anewpixel.html';
    }

    const error = new Error((datos && datos.error) || 'No se pudo completar la operación');
    error.estado = respuesta.status;
    throw error;
  }

  return datos;
}

export function obtenerPreguntas() {
  return consultar('/preguntas');
}

export function guardarDiagnostico(persona, respuestas) {
  return consultar('/diagnosticos', 'POST', { persona, respuestas });
}

export function obtenerEstructura() {
  return consultar('/admin/estructura');
}

export function crearArea(nombre) {
  return consultar('/admin/areas', 'POST', { nombre });
}

export function actualizarArea(id, nombre) {
  return consultar(`/admin/areas/${id}`, 'PUT', { nombre });
}

export function eliminarArea(id) {
  return consultar(`/admin/areas/${id}`, 'DELETE');
}

export function ordenarAreas(ids) {
  return consultar('/admin/areas/orden', 'PUT', { ids });
}

export function crearPregunta(datos) {
  return consultar('/admin/preguntas', 'POST', datos);
}

export function actualizarPregunta(id, datos) {
  return consultar(`/admin/preguntas/${id}`, 'PUT', datos);
}

export function eliminarPregunta(id) {
  return consultar(`/admin/preguntas/${id}`, 'DELETE');
}

export function ordenarPreguntas(areaId, ids) {
  return consultar('/admin/preguntas/orden', 'PUT', { area_id: areaId, ids });
}

export function crearInput(datos) {
  return consultar('/admin/inputs', 'POST', datos);
}

export function actualizarInput(id, datos) {
  return consultar(`/admin/inputs/${id}`, 'PUT', datos);
}

export function eliminarInput(id) {
  return consultar(`/admin/inputs/${id}`, 'DELETE');
}

export function listarDiagnosticos(busqueda = '') {
  return consultar(`/admin/diagnosticos?q=${encodeURIComponent(busqueda)}`);
}

export function obtenerDiagnostico(id) {
  return consultar(`/admin/diagnosticos/${id}`);
}

export function crearDiagnostico(persona, respuestas) {
  return consultar('/admin/diagnosticos', 'POST', { persona, respuestas });
}

export function actualizarDiagnostico(id, persona) {
  return consultar(`/admin/diagnosticos/${id}`, 'PUT', persona);
}

export function eliminarDiagnostico(id) {
  return consultar(`/admin/diagnosticos/${id}`, 'DELETE');
}

export function iniciarSesion(correo, clave) {
  return consultar('/auth/login', 'POST', { correo, clave });
}

export function cerrarSesion() {
  return consultar('/auth/logout', 'POST', {});
}

export function obtenerSesion() {
  return consultar('/auth/yo');
}

export function cambiarClave(actual, nueva) {
  return consultar('/auth/clave', 'POST', { actual, nueva });
}

export function listarUsuarios() {
  return consultar('/admin/usuarios');
}

export function crearUsuario(datos) {
  return consultar('/admin/usuarios', 'POST', datos);
}

export function actualizarUsuario(id, datos) {
  return consultar(`/admin/usuarios/${id}`, 'PUT', datos);
}

export function restablecerClave(id, clave) {
  return consultar(`/admin/usuarios/${id}/clave`, 'PUT', { clave });
}

export function eliminarUsuario(id) {
  return consultar(`/admin/usuarios/${id}`, 'DELETE');
}

export function listarSesiones() {
  return consultar('/admin/sesiones');
}

export function cerrarSesionDe(id) {
  return consultar(`/admin/sesiones/${id}`, 'DELETE');
}

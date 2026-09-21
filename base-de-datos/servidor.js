import express from 'express';
import { fileURLToPath } from 'node:url';
import { esNueva } from './conexion.js';
import { sembrar } from './semilla.js';
import { requiereSesion, sinCambioPendiente } from './autenticacion.js';
import { crearAdministradorInicial } from './consultas/usuarios.js';
import { limpiarSesionesVencidas } from './consultas/sesiones.js';
import { ErrorApi } from './validaciones.js';
import { rutasPublicas } from './rutas/publicas.js';
import { rutasAdmin } from './rutas/admin.js';
import { rutasAuth } from './rutas/auth.js';

if (esNueva) {
  sembrar();
}

crearAdministradorInicial();
limpiarSesionesVencidas();
setInterval(limpiarSesionesVencidas, 60 * 60 * 1000).unref();

const app = express();
const puerto = process.env.PORT || 4173;
const carpetaWeb = fileURLToPath(new URL('../proyecto-web', import.meta.url));

function esRutaAdmin(req) {
  try {
    const ruta = decodeURIComponent(req.path).toLowerCase();
    return ruta.startsWith('/api/admin') || ruta.includes('admin-anewpixel');
  } catch {
    return true;
  }
}

app.set('trust proxy', Number(process.env.CONFIAR_PROXY ?? 1));
app.use(express.json({ limit: '200kb' }));
app.use('/api/auth', rutasAuth);
app.use((req, res, next) => (esRutaAdmin(req) ? requiereSesion(req, res, next) : next()));
app.use('/api/admin', sinCambioPendiente, rutasAdmin);
app.use('/api', rutasPublicas);
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});
app.use(express.static(carpetaWeb));

app.use((error, req, res, next) => {
  if (error instanceof ErrorApi) {
    return res.status(error.estado).json({ error: error.message });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El contenido enviado no es válido' });
  }

  console.error(error);
  res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor' });
});

app.listen(puerto, () => {
  console.log(`Diagnosticador disponible en http://localhost:${puerto}`);
  console.log(`Administración en http://localhost:${puerto}/admin-anewpixel.html`);
});

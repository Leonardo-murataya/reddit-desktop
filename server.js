require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const { getStorageDir } = require('./pipeline/pipelineManager');

const app = express();
const PORT = process.env.PORT || 31826;

// Middlewares
const allowedOrigins = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  'null' // Para file:// o entornos locales empaquetados
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir solicitudes locales directas (sin Origin header) como herramientas locales, Electron o scripts
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern instanceof RegExp) return pattern.test(origin);
      return pattern === origin;
    });
    if (isAllowed) {
      return callback(null, true);
    }
    return callback(new Error('Bloqueado por política CORS: Acceso no autorizado desde origen externo.'));
  },
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Directorios de almacenamiento seguro
const TEMP_DIR = getStorageDir('temp');
const PREVIEWS_DIR = path.join(TEMP_DIR, 'previews');
if (!fs.existsSync(PREVIEWS_DIR)) {
  try { fs.mkdirSync(PREVIEWS_DIR, { recursive: true }); } catch (e) {}
}

const AVATARS_DIR = path.join(TEMP_DIR, 'avatars');
if (!fs.existsSync(AVATARS_DIR)) {
  try { fs.mkdirSync(AVATARS_DIR, { recursive: true }); } catch (e) {}
}

// Servir carpetas estáticas para avatares y vistas previas
app.use('/avatars', express.static(AVATARS_DIR));
app.use('/avatars', express.static(path.join(__dirname, 'temp', 'avatars')));
app.use('/avatars', express.static(path.join(__dirname, 'frontend', 'public', 'assets')));
app.use('/previews', express.static(PREVIEWS_DIR));

// Endpoint dinámico para resolución de avatares
app.get('/avatars/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const possiblePaths = [
    path.join(AVATARS_DIR, filename),
    path.join(__dirname, 'temp', 'avatars', filename),
    path.join(__dirname, 'frontend', 'public', 'assets', filename),
    path.join(__dirname, 'frontend', 'public', filename)
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return res.sendFile(p);
    }
  }
  const defAvatar = path.join(__dirname, 'frontend', 'public', 'assets', 'reddit-avatar.png');
  if (fs.existsSync(defAvatar)) {
    return res.sendFile(defAvatar);
  }
  res.status(404).send('Avatar not found');
});

// ----------------------------------------------------
// RUTAS MODULARES DE LA API
// ----------------------------------------------------
const settingsRoutes = require('./routes/settings.routes');
const profilesRoutes = require('./routes/profiles.routes');
const templatesRoutes = require('./routes/templates.routes');
const fontsRoutes = require('./routes/fonts.routes');
const dialogsRoutes = require('./routes/dialogs.routes');
const jobsRoutes = require('./routes/jobs.routes');
const updatesRoutes = require('./routes/updates.routes');

app.use('/api', settingsRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/fonts', fontsRoutes);
app.use('/api', dialogsRoutes);
app.use('/api', jobsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/updates', updatesRoutes);
app.use('/api/updater', updatesRoutes);

// Servir frontend en producción si existe dist
const FRONTEND_DIST = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/avatars') || req.path.startsWith('/previews')) {
      return next();
    }
    if (req.method === 'GET') {
      return res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    }
    next();
  });
}

// Iniciar Servidor Express
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Servidor Reddit Generator (Modular Pipeline Suite)`);
  console.log(` Corriendo en puerto: ${PORT}`);
  console.log(`====================================================`);
});

// Manejo de apagado limpio
function gracefulShutdown(signal) {
  console.log(`[Server] Recibida señal ${signal}. Cerrando servidor local...`);
  server.close(() => {
    console.log('[Server] Servidor cerrado correctamente.');
    process.exit(0);
  });
  setTimeout(() => {
    process.exit(0);
  }, 3000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = app;

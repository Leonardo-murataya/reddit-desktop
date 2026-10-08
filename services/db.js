const fs = require('fs');
const path = require('path');

function getDbPath() {
  const localDb = path.join(__dirname, '..', 'db.json');
  // En desarrollo, el directorio src-tauri existe en la raíz del proyecto
  const isDev = fs.existsSync(path.join(__dirname, '..', 'src-tauri'));

  if (isDev) {
    return localDb;
  }

  if (process.env.APPDATA) {
    const userDir = path.join(process.env.APPDATA, 'Reddit Video Generator');
    if (!fs.existsSync(userDir)) {
      try { fs.mkdirSync(userDir, { recursive: true }); } catch (e) {}
    }
    const userDb = path.join(userDir, 'db.json');
    if (!fs.existsSync(userDb)) {
      const defaultDbPath = path.join(__dirname, '..', 'default_db.json');
      if (fs.existsSync(defaultDbPath)) {
        try { fs.copyFileSync(defaultDbPath, userDb); } catch (e) {}
      } else {
        try { fs.writeFileSync(userDb, JSON.stringify(INITIAL_DB, null, 2), 'utf8'); } catch (e) {}
      }
    }
    return userDb;
  }

  return localDb;
}

const DB_PATH = getDbPath();

const INITIAL_DB = {
  profiles: [
    {
      id: 'default-gemini',
      name: 'Perfil Estándar Gemini',
      apiKey: '',
      model: 'gemini-3.8-flash',
      systemPrompt: 'Eres un narrador experto de historias de Reddit. Genera historias cautivadoras, intrigantes y realistas que mantengan al espectador enganchado segundo a segundo.',
      backgroundFolder: '',
      primaryAttempts: 2,
      fallbackAttempts: 3,
      maxAttempts: 5,
      fallbackModel: 'gemini-3.7-flash',
      fallbackModels: [
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash'
      ],
      renderEngine: 'global',
      cleanTxtReport: false,
      hashtags: '#HistoriasDeReddit #RedditEnEspañol #reddit',
      reportFolderSameAsVideo: true,
      reportFolder: ''
    }
  ],
  templates: [
    {
      id: 'default-template',
      name: 'TikTok Reddit Pop (Negro/Amarillo)',
      profileId: 'default-gemini',
      maleVoice: 'es-MX-JorgeNeural',
      femaleVoice: 'es-MX-DaliaNeural',
      font: 'Arial Bold',
      fontSize: 100,
      subtitleColor: '#FFFF00', // Yellow active
      passiveColor: '#FFFFFF', // White passive
      animation: 'tiktok-pop',
      cardTheme: 'dark',
      cardAvatar: '/assets/reddit-avatar.png',
      cardUsername: 'reddit_stories',
      cardSubreddit: 'r/AskReddit',
      upvotes: '14.5k',
      comments: '1.2k',
      showShare: true
    }
  ],
  timeline: {
    currentVideoIndex: 0,
    currentOffset: 0,
    backgroundVideos: []
  },
  settings: {
    exportFolder: '',
    defaultProfileId: 'default-gemini',
    defaultTemplateId: 'default-template'
  }
};

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(INITIAL_DB);
      return INITIAL_DB;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading local db.json:', error.message);
    const bakPath = DB_PATH + '.bak';
    if (fs.existsSync(bakPath)) {
      try {
        console.warn('Intentando recuperar base de datos desde copia de seguridad .bak...');
        const bakData = fs.readFileSync(bakPath, 'utf8');
        const parsed = JSON.parse(bakData);
        // Restaurar archivo principal desde el backup
        writeDb(parsed);
        return parsed;
      } catch (bakError) {
        console.error('Error al recuperar desde backup .bak:', bakError.message);
      }
    }
    return INITIAL_DB;
  }
}

// Limpiar archivos temporales huérfanos que hayan quedado de caídas anteriores
function cleanOrphanTmpFiles() {
  try {
    const dir = path.dirname(DB_PATH);
    const baseName = path.basename(DB_PATH);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.startsWith(baseName) && file.endsWith('.tmp')) {
          try {
            fs.unlinkSync(path.join(dir, file));
          } catch {}
        }
      }
    }
  } catch {}
}
cleanOrphanTmpFiles();

function writeDb(data) {
  const tempPath = `${DB_PATH}.${Date.now()}_${Math.random().toString(36).substring(2, 6)}.tmp`;
  const bakPath = DB_PATH + '.bak';
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    // 1. Escribir primero en archivo temporal
    fs.writeFileSync(tempPath, jsonStr, 'utf8');

    // 2. Si el archivo actual existe y no está vacío, actualizar el backup .bak
    if (fs.existsSync(DB_PATH)) {
      try {
        fs.copyFileSync(DB_PATH, bakPath);
      } catch (copyErr) {
        // No bloquear la escritura principal si falla el backup
      }
    }

    // 3. Renombrado atómico en el sistema de archivos con reintentos para Windows (EBUSY / EPERM)
    let renamed = false;
    let attempts = 0;
    while (!renamed && attempts < 4) {
      try {
        attempts++;
        fs.renameSync(tempPath, DB_PATH);
        renamed = true;
      } catch (renameErr) {
        if (attempts >= 4) {
          // Fallback directo si el renombrado fue bloqueado temporalmente por Windows
          try {
            fs.writeFileSync(DB_PATH, jsonStr, 'utf8');
            renamed = true;
          } catch (writeFallbackErr) {
            throw renameErr;
          }
        } else {
          // Pausa no consumidora de CPU delegada al planificador del sistema operativo
          try {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30 * attempts);
          } catch {
            // Fallback pasivo
          }
        }
      }
    }

    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}

    return true;
  } catch (error) {
    console.error('Error writing atomically to local db.json:', error);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (cleanErr) {}
    return false;
  }
}

module.exports = {
  readDb,
  writeDb
};


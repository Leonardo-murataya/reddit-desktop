const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const ffprobe = require('ffprobe-static');
const db = require('./db');

/**
 * Obtiene la duración exacta de un archivo de video en segundos usando ffprobe.
 * @param {string} filePath - Ruta absoluta del archivo de video
 * @returns {number} Duración en segundos
 */
function getVideoDuration(filePath) {
  try {
    // Pasar los argumentos como array para evitar la interpolación de cmd.exe
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ];
    const output = execFileSync(ffprobe.path, args, { encoding: 'utf8' }).trim();
    const duration = parseFloat(output);
    if (isNaN(duration)) {
      return 600; // Fallback a 10 minutos
    }
    return duration;
  } catch (error) {
    console.error(`Error al obtener duración con ffprobe para ${filePath}:`, error.message);
    return 600; // Fallback a 10 minutos
  }
}

/**
 * Escanea una carpeta en búsqueda de archivos de video válidos (.mp4, .mkv, .mov, .avi).
 * @param {string} folderPath - Ruta de la carpeta
 * @returns {Array<string>} Lista de rutas absolutas de videos ordenados alfabéticamente
 */
function scanBackgroundVideos(folderPath) {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return [];
  }

  const extensions = ['.mp4', '.mkv', '.mov', '.avi'];
  try {
    const files = fs.readdirSync(folderPath);
    return files
      .filter(file => extensions.includes(path.extname(file).toLowerCase()))
      .map(file => path.join(folderPath, file))
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    console.error('Error escaneando carpeta de videos de fondo:', error);
    return [];
  }
}

function normalizePath(p) {
  if (!p) return '';
  return p.replace(/\\/g, '/').toLowerCase().trim();
}

/**
 * Calcula y consume los segmentos de video de fondo necesarios para una duración dada.
 * Actualiza el playhead en la base de datos local y retorna los segmentos.
 * @param {number} duration - Duración requerida en segundos (ej. 150 segundos)
 * @param {string} folderPath - Carpeta donde se escanean los videos de fondo
 * @param {string} profileId - ID del perfil de IA activo (para aislar la línea de tiempo)
 * @returns {{segments: Array<{path: string, start: number, duration: number}>, playheadState: object}}
 */
function getBackgroundSegments(duration, folderPath, profileId = 'global') {
  const currentDb = db.readDb();
  
  // Buscar el perfil de IA activo
  const profile = currentDb.profiles?.find(p => p.id === profileId);

  // Aislar y resolver el estado de playhead (timelineState) para este canal/perfil
  let timelineState = null;
  if (profile) {
    if (!profile.timeline) {
      profile.timeline = {
        currentVideoIndex: 0,
        currentOffset: 0,
        backgroundVideos: []
      };
    }
    timelineState = profile.timeline;
  } else {
    if (!currentDb.timeline) {
      currentDb.timeline = {
        currentVideoIndex: 0,
        currentOffset: 0,
        backgroundVideos: []
      };
    }
    timelineState = currentDb.timeline;
  }
  
  let videos = [];
  if (profile && Array.isArray(profile.selectedFiles) && profile.selectedFiles.length > 0) {
    // Filtrar solo archivos que realmente existen físicamente en este equipo
    videos = profile.selectedFiles.filter(f => f && typeof f === 'string' && fs.existsSync(f));
  } else if (!profile && currentDb.settings?.selectedFiles && currentDb.settings.selectedFiles.length > 0) {
    videos = currentDb.settings.selectedFiles.filter(f => f && typeof f === 'string' && fs.existsSync(f));
  }
  
  if (videos.length === 0 && profile && profile.backgroundFolder && fs.existsSync(profile.backgroundFolder)) {
    // Escaneamos la carpeta del perfil si existe en esta PC
    videos = scanBackgroundVideos(profile.backgroundFolder);
  }

  if (videos.length === 0 && folderPath && fs.existsSync(folderPath)) {
    // Escaneamos la carpeta pasada como parámetro
    videos = scanBackgroundVideos(folderPath);
  }

  if (videos.length === 0 && currentDb.settings?.backgroundFolder && fs.existsSync(currentDb.settings.backgroundFolder)) {
    // Fallback a la carpeta de fondo global si existe en esta PC
    videos = scanBackgroundVideos(currentDb.settings.backgroundFolder);
  }
  
  if (videos.length === 0) {
    throw new Error(
      `No se encontraron videos de fondo válidos (.mp4, .mov, etc.) en este equipo.\n` +
      `La ruta configurada no existe en esta computadora. Por favor ve a Ajustes de Ruta o Perfiles de IA y selecciona tu carpeta de videos de fondo.`
    );
  }

  let { currentVideoIndex = 0, currentOffset = 0, backgroundVideos = [] } = timelineState;

  // Si la lista de videos cambió (se añadieron/quitaron archivos o cambió de carpeta),
  // reseteamos el índice y el offset a cero para evitar desajustes
  const isDifferent = (a, b) => {
    if (!a || !b || a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (normalizePath(a[i]) !== normalizePath(b[i])) return true;
    }
    return false;
  };

  if (isDifferent(videos, backgroundVideos)) {
    console.log(`[Timeline - ${profile ? profile.name : 'Global'}] La lista de videos de fondo cambió. Sincronizando playhead (Index: 0, Offset: 0)`);
    currentVideoIndex = 0;
    currentOffset = 0;
  } else if (currentVideoIndex >= videos.length) {
    currentVideoIndex = 0;
    currentOffset = 0;
  }

  const segments = [];
  let remainingNeeded = duration;

  console.log(`[Timeline - Perfil: ${profile ? profile.name : 'Global'}] Calculando segmentos de fondo. Necesario: ${duration}s. Iniciando en Video #${currentVideoIndex} offset: ${currentOffset}s`);

  // Bucle para recolectar trozos de video hasta completar la duración requerida
  let safetyLoopCounter = 0;
  while (remainingNeeded > 0 && safetyLoopCounter < 1000) {
    safetyLoopCounter++;
    const currentVideoPath = videos[currentVideoIndex];
    const totalVideoDuration = getVideoDuration(currentVideoPath);

    const availableTimeInCurrentVideo = totalVideoDuration - currentOffset;

    if (availableTimeInCurrentVideo <= 0) {
      // El video actual ya se agotó, saltamos al siguiente
      currentVideoIndex = (currentVideoIndex + 1) % videos.length;
      currentOffset = 0;
      continue;
    }

    if (remainingNeeded <= availableTimeInCurrentVideo) {
      // El fragmento cabe entero en el video actual
      segments.push({
        path: currentVideoPath,
        start: Number(currentOffset.toFixed(3)),
        duration: Number(remainingNeeded.toFixed(3))
      });
      currentOffset += remainingNeeded;
      remainingNeeded = 0;
    } else {
      // El fragmento desborda el video actual. Slicemos lo disponible y pasemos al siguiente
      segments.push({
        path: currentVideoPath,
        start: Number(currentOffset.toFixed(3)),
        duration: Number(availableTimeInCurrentVideo.toFixed(3))
      });
      remainingNeeded -= availableTimeInCurrentVideo;
      currentVideoIndex = (currentVideoIndex + 1) % videos.length;
      currentOffset = 0;
    }
  }

  // Guardar y persistir el estado del playhead en el objeto correspondiente de la DB
  const newTimelineState = {
    currentVideoIndex,
    currentOffset: Number(currentOffset.toFixed(3)),
    backgroundVideos: videos
  };

  if (profile) {
    profile.timeline = newTimelineState;
  } else {
    currentDb.timeline = newTimelineState;
  }
  
  db.writeDb(currentDb);

  console.log('Segmentos de fondo asignados:', segments);
  console.log(`Nuevo estado de línea de tiempo: Video Index #${currentVideoIndex}, Offset: ${currentOffset.toFixed(2)}s`);

  return {
    segments,
    playheadState: profile ? profile.timeline : currentDb.timeline
  };
}

module.exports = {
  scanBackgroundVideos,
  getVideoDuration,
  getBackgroundSegments
};

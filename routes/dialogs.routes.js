const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');
const dialogs = require('../services/dialogs');
const timeline = require('../services/timeline');
const tts = require('../services/tts');
const ffmpeg = require('../services/ffmpeg');
const { getStorageDir } = require('../pipeline/pipelineManager');

const TEMP_DIR = getStorageDir('temp');
const PREVIEWS_DIR = path.join(TEMP_DIR, 'previews');
if (!fs.existsSync(PREVIEWS_DIR)) {
  try { fs.mkdirSync(PREVIEWS_DIR, { recursive: true }); } catch (e) {}
}

// Escaneo de videos de fondo
const handleBackgroundScan = (req, res) => {
  try {
    const currentDb = db.readDb();
    const bgFolder = req.query.folder || req.body?.folder || currentDb.settings.backgroundFolder || currentDb.timeline.backgroundFolder || '';
    const profileId = req.query.profileId || req.body?.profileId || 'global';

    const profile = profileId !== 'global' ? currentDb.profiles?.find(p => p.id === profileId) : null;
    const playhead = profile ? (profile.timeline || { currentVideoIndex: 0, currentOffset: 0, backgroundVideos: [] }) : (currentDb.timeline || { currentVideoIndex: 0, currentOffset: 0, backgroundVideos: [] });

    if (!bgFolder || !fs.existsSync(bgFolder)) {
      return res.json({ count: 0, totalDuration: 0, duration: 0, files: [], playhead });
    }

    const videos = timeline.scanBackgroundVideos(bgFolder);
    let totalDur = 0;

    const fileInfos = videos.map(videoPath => {
      const dur = timeline.getVideoDuration(videoPath);
      totalDur += dur;
      return {
        name: path.basename(videoPath),
        path: videoPath,
        duration: Math.round(dur)
      };
    });

    res.json({
      count: fileInfos.length,
      totalDuration: Math.round(totalDur),
      duration: Math.round(totalDur),
      files: fileInfos,
      playhead: playhead
    });
  } catch (error) {
    res.status(500).json({ error: error.message, count: 0, totalDuration: 0, files: [], playhead: {} });
  }
};

router.get('/background-videos', handleBackgroundScan);
router.post('/background-videos', handleBackgroundScan);
router.get('/background/status', handleBackgroundScan);
router.post('/background/status', handleBackgroundScan);

// Diálogos nativos
router.get('/dialog/folder', (req, res) => {
  try {
    const title = req.query.title || 'Selecciona una carpeta';
    const initialPath = req.query.initialPath || '';
    const selectedPath = dialogs.selectLocalFolder(title, initialPath);
    res.json({ path: selectedPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dialog/files', (req, res) => {
  try {
    const title = req.query.title || 'Selecciona tus videos de fondo';
    const initialPath = req.query.initialPath || '';
    const selectedFiles = dialogs.selectLocalFiles(title, initialPath);
    res.json({ files: selectedFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dialog/save', (req, res) => {
  try {
    const defaultName = req.query.defaultName || 'plantilla_template.json';
    const title = req.query.title || 'Guardar Plantilla de Video';
    const selectedPath = dialogs.selectSaveLocation(defaultName, title);
    res.json({ path: selectedPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/dialog/save-template', (req, res) => {
  try {
    const { templatePackage, defaultName, title } = req.body;
    if (!templatePackage) {
      return res.status(400).json({ error: 'Datos de la plantilla requeridos' });
    }
    const safeName = defaultName || 'plantilla_template.json';
    const dialogTitle = title || 'Guardar Plantilla de Video';
    const chosenPath = dialogs.selectSaveLocation(safeName, dialogTitle);

    if (!chosenPath) {
      return res.json({ success: false, cancelled: true });
    }

    fs.writeFileSync(chosenPath, JSON.stringify(templatePackage, null, 2), 'utf8');
    res.json({ success: true, path: chosenPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dialog/avatar', (req, res) => {
  try {
    const imgData = dialogs.selectLocalImage('Selecciona la foto de perfil');
    res.json(imgData || { path: '', base64: '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dialog/watermark-image', (req, res) => {
  try {
    const imgData = dialogs.selectLocalImage('Selecciona la imagen de marca de agua');
    res.json(imgData || { path: '', base64: '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dialog/overlay-media', (req, res) => {
  try {
    const selectedFile = dialogs.selectLocalOverlayMedia();
    res.json({ path: selectedFile || '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vista previa de un overlay con el croma aplicado (PNG transparente en base64)
router.post('/overlays/preview', async (req, res) => {
  try {
    const { file, chromaEnabled, chromaColor, chromaSimilarity, chromaBlend } = req.body || {};
    if (!file || typeof file !== 'string' || file.length > 1024) {
      return res.status(400).json({ error: 'Ruta de overlay inválida.' });
    }
    const preview = await ffmpeg.renderOverlayPreview({ file, chromaEnabled, chromaColor, chromaSimilarity, chromaBlend });
    res.json(preview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dialog/music', (req, res) => {
  try {
    const selectedFile = dialogs.selectLocalAudio('Selecciona tu música de fondo');
    res.json({ path: selectedFile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/utils/file-exists', (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string' || filePath.length > 1024) {
      return res.json({ exists: false });
    }
    const exists = fs.existsSync(filePath);
    res.json({ exists });
  } catch (error) {
    res.status(500).json({ error: error.message, exists: false });
  }
});

// Generación de preview TTS
router.post('/tts/preview', async (req, res) => {
  const { text, voice, rate } = req.body;
  if (!text || !voice) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: text o voice.' });
  }

  try {
    const filename = `preview_${uuidv4().substring(0, 8)}.mp3`;
    const outputPath = path.join(PREVIEWS_DIR, filename);

    await tts.generateSpeechAndTimestamps(text, voice, outputPath, { rate: rate || '+0%' });

    const audioUrl = `/previews/${filename}`;
    res.json({ success: true, audioUrl });

    // Autodestrucción en 1 minuto
    setTimeout(() => {
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (err) {}
    }, 60000).unref();
  } catch (error) {
    console.error('Error al generar preview de TTS:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

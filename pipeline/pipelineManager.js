const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');
const { executeScriptStage } = require('./scriptStage');
const { executeVoiceStage } = require('./voiceStage');
const { executeVisualStage } = require('./visualStage');
const { executeSubtitleStage } = require('./subtitleStage');
const { executeRenderStage } = require('./renderStage');

function getStorageDir(subfolder) {
  const localDir = path.join(__dirname, '..', subfolder);
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, '.write_test');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    if (!__dirname.includes('_up_') && !__dirname.includes('Program Files')) {
      return localDir;
    }
  } catch (e) {}

  if (process.env.APPDATA) {
    const userDir = path.join(process.env.APPDATA, 'Reddit Video Generator', subfolder);
    if (!fs.existsSync(userDir)) {
      try { fs.mkdirSync(userDir, { recursive: true }); } catch (e) {}
    }
    return userDir;
  }
  return localDir;
}

const TEMP_DIR = getStorageDir('temp');

/**
 * Ejecuta el pipeline completo para un único video.
 */
async function runSingleVideo({
  index,
  job,
  currentItem,
  template,
  profile,
  backgroundFolder,
  exportFolder,
  normalizedBatch,
  broadcastProgress,
  getStatus,
  onScriptReady
}) {
  const videoNumStr = `[Video ${job.currentVideoIndex}/${job.totalCount}]`;
  const isCancelRequested = getStatus().isCancelRequested;

  if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');

  const jobTempDir = path.join(TEMP_DIR, `video_${index}_${uuidv4().substring(0, 8)}`);
  if (!fs.existsSync(jobTempDir)) {
    fs.mkdirSync(jobTempDir, { recursive: true });
  }

  try {
    // -----------------------------------------------------------------
    // ETAPA 1: Generación de Guion con IA (Google Gemini o Prefetch)
    // -----------------------------------------------------------------
    let scriptData = null;

    if (currentItem.prefetchedScriptPromise) {
      broadcastProgress({
        type: 'status',
        status: 'processing',
        activeJob: job,
        log: `${videoNumStr} ⚡ Esperando guion pre-generado en segundo plano...`
      });
      try {
        scriptData = await currentItem.prefetchedScriptPromise;
      } catch (err) {
        console.warn(`[Prefetch] Error esperando prefetch para ${videoNumStr}:`, err.message);
        scriptData = null;
      }
    }

    if (!scriptData) {
      scriptData = await executeScriptStage({
        profile,
        template,
        prompt: currentItem.prompt,
        customStory: currentItem.customStory,
        videoNumStr,
        broadcastProgress,
        job,
        isPrefetch: false
      });
    } else {
      job.stage = 'script';
      job.progress = 15;
      job.currentStep = 'Guion pre-generado listo';
      broadcastProgress({
        type: 'status',
        status: 'processing',
        activeJob: job,
        log: `${videoNumStr} ⚡ ¡Guion ya estaba listo! Título: "${scriptData.story.title}". Pasando directamente a voz...`
      });
    }

    const { story, currentPrompt } = scriptData;

    // Disparar en segundo plano la pre-generación del siguiente video mientras este renderiza
    if (typeof onScriptReady === 'function') {
      try {
        onScriptReady();
      } catch (err) {
        console.warn('[Prefetch] Error al invocar onScriptReady:', err.message);
      }
    }

    if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');

    // -----------------------------------------------------------------
    // ETAPA 2: Síntesis de Voz Neuronal y Timestamps (Edge-TTS)
    // -----------------------------------------------------------------
    const voiceData = await executeVoiceStage({
      story,
      template,
      jobTempDir,
      videoNumStr,
      broadcastProgress,
      job,
      isCancelRequested
    });

    if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');

    // -----------------------------------------------------------------
    // ETAPA 3: Renderizado de Recursos Visuales (Card y Fondo)
    // -----------------------------------------------------------------
    const visualData = await executeVisualStage({
      story,
      template,
      profile,
      totalDuration: voiceData.totalDuration,
      bgFolder: backgroundFolder,
      jobTempDir,
      videoNumStr,
      broadcastProgress,
      job,
      isCancelRequested
    });

    if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');

    // Sanitizar título para nombre de archivo en Windows
    const cleanTitle = story.title
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const maxTitleLength = 60;
    const safeTitle = (cleanTitle.length > maxTitleLength ? cleanTitle.substring(0, maxTitleLength).trim() : cleanTitle)
      || `video_${uuidv4().substring(0, 8)}`;

    const formatMode = template.exportFormat || '9-16';

    // -----------------------------------------------------------------
    // ETAPA 4: Generación de Subtítulos Dinámicos (.ass)
    // -----------------------------------------------------------------
    const subtitleData = await executeSubtitleStage({
      bodyTimestamps: voiceData.bodyTimestamps,
      titleTimestamps: voiceData.titleTimestamps,
      template,
      titleDuration: voiceData.titleDuration,
      formatMode,
      jobTempDir,
      videoNumStr,
      broadcastProgress,
      job,
      isCancelRequested
    });

    // Guardar metadatos locales de la historia
    const storyMetaPath = path.join(jobTempDir, 'story_meta.json');
    const storyMetaData = {
      title: story.title,
      content: story.content,
      gender: story.gender,
      activeVoice: voiceData.activeVoice,
      prompt: currentPrompt,
      templateName: template.name,
      exportFormat: formatMode
    };
    fs.writeFileSync(storyMetaPath, JSON.stringify(storyMetaData, null, 2), 'utf8');

    if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');

    // -----------------------------------------------------------------
    // ETAPA 5: Compilación y Renderizado Acelerado por GPU con FFmpeg
    // -----------------------------------------------------------------
    const currentDb = db.readDb();
    const renderResult = await executeRenderStage({
      formatMode,
      subtitleData,
      segments: visualData.segments,
      activeCardPath: visualData.activeCardPath,
      titleAudioPath: voiceData.titleAudioPath,
      bodyAudioPath: voiceData.bodyAudioPath,
      titleDuration: voiceData.titleDuration,
      totalDuration: voiceData.totalDuration,
      template,
      profile,
      currentDb,
      exportFolder,
      safeTitle,
      videoIndex: job.currentVideoIndex,
      videoNumStr,
      broadcastProgress,
      job,
      isCancelRequested
    });

    const finalHashtags = profile.hashtags !== undefined ? profile.hashtags : (currentDb.settings.hashtags || '');

    const reportItem = {
      index: job.currentVideoIndex,
      title: story.title,
      files: renderResult.generatedFiles,
      safeTitle: safeTitle,
      isBoth: renderResult.isBoth,
      hashtags: finalHashtags
    };

    job.stage = 'done';
    job.currentStep = 'Video completado y guardado';
    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `${videoNumStr} Video compilado con éxito. Guardado en: ${renderResult.primaryVideoPath}`
    });

    return {
      title: story.title,
      finalVideoPath: renderResult.primaryVideoPath,
      reportItem
    };
  } finally {
    // Limpieza garantizada de la subcarpeta temporal del video
    try {
      if (fs.existsSync(jobTempDir)) {
        fs.rmSync(jobTempDir, { recursive: true, force: true });
        console.log(`[Pipeline] Subcarpeta temporal eliminada: ${jobTempDir}`);
      }
    } catch (rmErr) {
      console.warn('[Pipeline] No se pudo borrar subcarpeta temporal:', rmErr.message);
    }
  }
}

/**
 * Guarda o actualiza el archivo de reporte consolidado en texto (.txt) del lote.
 * Se invoca incrementalmente tras la generación exitosa de cada video para garantizar
 * que el usuario disponga del reporte de inmediato en la carpeta configurada.
 */
function saveBatchReport({
  batchReportItems = [],
  job = {},
  profile = null,
  currentDb = null,
  exportFolder = '',
  videoNumStr = '',
  broadcastProgress = () => {}
}) {
  if (!batchReportItems || batchReportItems.length === 0) return null;

  const totalCount = job?.totalCount || batchReportItems.length;
  const jobId = job?.id || 'manual';

  let batchContent = `============================================================\n`;
  batchContent += `REPORTE DE GENERACIÓN DE VIDEOS\n`;
  batchContent += `============================================================\n`;
  batchContent += `ID de Lote: ${jobId}\n`;
  batchContent += `Total de Videos Solicitados: ${totalCount}\n`;
  batchContent += `Videos Generados Exitosamente: ${batchReportItems.length}\n\n`;

  // Ordenar siempre los videos por índice ascendente (1, 2, 3...) para garantizar secuencia perfecta
  const sortedItems = [...batchReportItems].sort((a, b) => (parseInt(a.index) || 0) - (parseInt(b.index) || 0));

  for (const reportItem of sortedItems) {
    batchContent += `------------------------------------------------------------\n`;
    batchContent += `[Video ${reportItem.index}/${totalCount}]\n`;
    batchContent += `Título: ${reportItem.title}\n\n`;
    if (reportItem.hashtags) {
      batchContent += `${reportItem.hashtags}\n\n`;
    }
    if (reportItem.isBoth && reportItem.files && reportItem.files.length >= 2) {
      batchContent += `Archivos de Video Generados:\n- ${reportItem.files[0]}\n- ${reportItem.files[1]}\n`;
    } else if (reportItem.files && reportItem.files.length > 0) {
      batchContent += `Archivo de Video Generado:\n- ${reportItem.files[0]}\n`;
    }
  }
  batchContent += `------------------------------------------------------------\n`;

  let activeReportFolder = exportFolder;
  const dbSettings = currentDb?.settings || {};
  const pReportSame = profile ? profile.reportFolderSameAsVideo : dbSettings.reportFolderSameAsVideo;
  const reportSame = pReportSame !== false;

  if (!reportSame) {
    const pReportFolder = profile ? profile.reportFolder : dbSettings.reportFolder;
    if (pReportFolder && pReportFolder.trim()) {
      activeReportFolder = pReportFolder.trim();
    }
  }

  if (!activeReportFolder || !activeReportFolder.trim()) {
    activeReportFolder = exportFolder || getStorageDir('temp');
  }

  const idSuffix = (typeof jobId === 'string' && jobId.length >= 8) ? jobId.substring(0, 8) : Date.now().toString().slice(-8);
  const batchReportPath = job?.batchReportPath || path.join(activeReportFolder, `reporte_lote_${idSuffix}.txt`);
  if (job && !job.batchReportPath) {
    job.batchReportPath = batchReportPath;
  }

  try {
    const reportDir = path.dirname(batchReportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    const fileExisted = fs.existsSync(batchReportPath);
    fs.writeFileSync(batchReportPath, batchContent, 'utf8');
    console.log(`[Pipeline] Reporte consolidado unificado de texto guardado en: ${batchReportPath}`);

    const prefix = videoNumStr ? `${videoNumStr} ` : '';
    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `${prefix}Reporte consolidado unificado de texto ${fileExisted ? 'actualizado' : 'creado'} en: ${batchReportPath}`
    });
    return batchReportPath;
  } catch (txtErr) {
    console.error('[Pipeline] Error al escribir el archivo de reporte consolidado:', txtErr);
    const prefix = videoNumStr ? `${videoNumStr} ` : '';
    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `[ADVERTENCIA] ${prefix}No se pudo guardar el reporte de texto (.txt): ${txtErr.message}`
    });
    return null;
  }
}

/**
 * Función de compatibilidad para llamadas previas a generateBatchReports
 */
function generateBatchReports(params) {
  return saveBatchReport(params);
}

module.exports = {
  getStorageDir,
  runSingleVideo,
  saveBatchReport,
  generateBatchReports
};

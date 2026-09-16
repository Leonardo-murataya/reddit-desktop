const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');
const notifier = require('../services/notifier');
const pipelineManager = require('../pipeline/pipelineManager');

// Estado en memoria de la cola
let activeJob = null;
let jobLogs = [];
const sseClients = new Set();
let cancelRequested = false;
let pauseRequested = false;
let isPaused = false;
let failedItems = [];
let batchStartTime = null;

function getEtaSeconds(job) {
  if (!batchStartTime) return null;
  const elapsedMs = Date.now() - batchStartTime;
  const finishedCount = job.currentVideoIndex - 1;
  const progressRatio = (job.progress || 0) / 100;
  const estimatedCompletedVideos = finishedCount + progressRatio;

  if (estimatedCompletedVideos < 0.05) {
    return 90 * job.totalCount;
  }

  const avgTimePerVideo = elapsedMs / estimatedCompletedVideos;
  const remainingVideos = job.totalCount - estimatedCompletedVideos;
  return Math.max(0, Math.round((avgTimePerVideo * remainingVideos) / 1000));
}

function broadcastProgress(data) {
  if (activeJob && batchStartTime) {
    activeJob.elapsedSeconds = Math.round((Date.now() - batchStartTime) / 1000);
    activeJob.etaSeconds = getEtaSeconds(activeJob);
    activeJob.failedCount = failedItems.length;
    activeJob.pauseRequested = pauseRequested;
    activeJob.isPaused = isPaused;
  }
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  });
  if (data.log) {
    jobLogs.push(`[${new Date().toLocaleTimeString()}] ${data.log}`);
  }
}

function addSseClient(res) {
  sseClients.add(res);
}

function removeSseClient(res) {
  sseClients.delete(res);
}

function getActiveJob() {
  return activeJob;
}

function getJobLogs() {
  return jobLogs;
}

function getFailedItemsCount() {
  return failedItems.length;
}

function cancelJob() {
  if (!activeJob) {
    return { success: false, error: 'No hay ningún trabajo activo para cancelar.' };
  }
  cancelRequested = true;
  pauseRequested = false;
  isPaused = false;
  activeJob.status = 'cancelling';
  activeJob.currentStep = 'Cancelando generación...';
  broadcastProgress({
    type: 'status',
    status: 'cancelling',
    activeJob,
    log: 'Solicitud de cancelación recibida. Deteniendo tareas de renderizado...'
  });
  return { success: true, message: 'Cancelación solicitada.' };
}

function pauseJob() {
  if (!activeJob) {
    return { success: false, error: 'No hay ningún trabajo activo para pausar.' };
  }
  if (pauseRequested || isPaused) {
    return { success: false, error: 'El trabajo ya está pausado o en proceso de pausa.' };
  }
  pauseRequested = true;
  activeJob.pauseRequested = true;
  broadcastProgress({
    type: 'status',
    status: 'pausing',
    activeJob,
    log: 'Solicitud de pausa recibida. Se congelará al completar el paso actual.'
  });
  return { success: true, message: 'Pausa solicitada.' };
}

function resumeJob() {
  if (!activeJob) {
    return { success: false, error: 'No hay ningún trabajo activo para reanudar.' };
  }
  if (!pauseRequested && !isPaused) {
    return { success: false, error: 'El trabajo no se encuentra pausado.' };
  }
  pauseRequested = false;
  isPaused = false;
  activeJob.pauseRequested = false;
  activeJob.isPaused = false;
  broadcastProgress({
    type: 'status',
    status: 'resuming',
    activeJob,
    log: 'Reanudando cola de generación...'
  });
  return { success: true, message: 'Generación reanudada.' };
}

async function startBatch({ batchItems, prompt, count = 1, templateId, profileId, backgroundFolder }) {
  if (activeJob) {
    throw new Error('Ya hay un trabajo de generación en curso.');
  }

  const currentDb = db.readDb();
  let normalizedBatch = [];

  if (Array.isArray(batchItems) && batchItems.length > 0) {
    normalizedBatch = batchItems.map(item => ({
      prompt: item.prompt || prompt || '',
      count: parseInt(item.count) || 1,
      templateId: item.templateId || templateId || currentDb.settings.defaultTemplateId,
      profileId: item.profileId || profileId || currentDb.settings.defaultProfileId
    }));
  } else {
    normalizedBatch = [{
      prompt: prompt || '',
      count: parseInt(count) || 1,
      templateId: templateId || currentDb.settings.defaultTemplateId,
      profileId: profileId || currentDb.settings.defaultProfileId
    }];
  }

  const totalVideos = normalizedBatch.reduce((sum, item) => sum + item.count, 0);
  if (totalVideos <= 0) {
    throw new Error('La cantidad de videos debe ser mayor a cero.');
  }

  const firstItem = normalizedBatch[0];
  const firstTmpl = currentDb.templates?.find(t => t.id === firstItem.templateId) || currentDb.templates?.[0];
  const firstProfId = firstItem.profileId || firstTmpl?.profileId || currentDb.settings?.defaultProfileId;
  const firstProf = currentDb.profiles?.find(p => p.id === firstProfId) || currentDb.profiles?.[0];

  activeJob = {
    id: uuidv4(),
    prompt: normalizedBatch.length > 1 ? `Lote de ${normalizedBatch.length} plantillas` : (normalizedBatch[0].prompt || 'Generación rápida'),
    totalCount: totalVideos,
    currentVideoIndex: 1,
    status: 'starting',
    progress: 0,
    stage: 'script',
    currentStep: 'Iniciando cola de renderizado',
    currentProfileId: firstProfId || null,
    currentProfileName: firstProf?.name || null,
    currentTemplateId: firstTmpl?.id || null,
    currentTemplateName: firstTmpl?.name || null,
    elapsedSeconds: 0,
    etaSeconds: null
  };
  jobLogs = [];
  cancelRequested = false;
  pauseRequested = false;
  isPaused = false;
  failedItems = [];

  // Notificar inmediatamente a clientes SSE para que la UI reaccione al instante
  broadcastProgress({
    type: 'status',
    status: 'starting',
    activeJob,
    log: `Iniciando cola de generación: ${totalVideos} videos solicitados.`
  });

  // Iniciar ejecución asíncrona de la cola
  runGenerationQueue(activeJob, normalizedBatch, backgroundFolder || currentDb.settings.backgroundFolder).catch(err => {
    console.error('[QueueController] Error crítico en la cola:', err);
    activeJob = null;
    broadcastProgress({ type: 'error', error: err.message, log: `ERROR CRÍTICO: ${err.message}` });
  });

  return { success: true, jobId: activeJob.id };
}

async function retryFailedJobs() {
  if (activeJob) {
    throw new Error('Ya hay un trabajo en curso. Espera a que finalice para reintentar.');
  }
  if (!failedItems || failedItems.length === 0) {
    throw new Error('No hay videos fallidos registrados para reintentar.');
  }

  const currentDb = db.readDb();
  const retryBatch = [...failedItems];
  failedItems = [];

  activeJob = {
    id: uuidv4(),
    prompt: `Reintento de ${retryBatch.length} videos fallidos`,
    totalCount: retryBatch.length,
    currentVideoIndex: 0,
    status: 'starting',
    progress: 0,
    currentStep: 'Reintentando videos fallidos'
  };
  jobLogs = [];
  cancelRequested = false;
  pauseRequested = false;
  isPaused = false;

  runGenerationQueue(activeJob, retryBatch, currentDb.settings.backgroundFolder).catch(err => {
    console.error('[QueueController] Error crítico en cola de reintento:', err);
    activeJob = null;
    broadcastProgress({ type: 'error', error: err.message, log: `ERROR CRÍTICO: ${err.message}` });
  });

  return { success: true, jobId: activeJob.id };
}

async function runGenerationQueue(job, normalizedBatch, defaultBackgroundFolder) {
  batchStartTime = Date.now();
  pauseRequested = false;
  isPaused = false;
  failedItems = [];

  const currentDb = db.readDb();
  const defaultExportFolder = currentDb.settings.exportFolder || path.join(__dirname, '..', 'temp');
  const batchReportItems = [];
  let exportFolder = defaultExportFolder;

  const usedTemplates = new Set();
  const usedProfiles = new Set();

  const getStatus = () => ({
    isCancelRequested: () => cancelRequested,
    isPauseRequested: () => pauseRequested,
    getIsPaused: () => isPaused,
    setIsPaused: (val) => { isPaused = val; }
  });

  try {
    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `Iniciando generación de lote: ${job.totalCount} videos solicitados.`
    });

    for (let index = 0; index < job.totalCount; index++) {
      if (cancelRequested) {
        throw new Error('La generación fue cancelada por solicitud del usuario.');
      }

      // Manejo de pausa entre videos
      if (pauseRequested && !cancelRequested) {
        isPaused = true;
        job.status = 'paused';
        job.currentStep = 'Proceso pausado temporalmente';
        broadcastProgress({
          type: 'status',
          status: 'paused',
          activeJob: job,
          log: `Generación pausada antes de iniciar el Video #${index + 1}. El proceso está congelado.`
        });

        while (pauseRequested && !cancelRequested) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        isPaused = false;
        if (!cancelRequested) {
          job.status = 'processing';
          job.currentStep = 'Reanudando generación';
          broadcastProgress({
            type: 'status',
            status: 'processing',
            activeJob: job,
            log: 'Generación reanudada. Continuando con la cola.'
          });
        }
      }

      job.currentVideoIndex = index + 1;

      // Determinar plantilla y perfil para este video
      let accumulatedCount = 0;
      let currentItem = null;
      for (const item of normalizedBatch) {
        accumulatedCount += item.count;
        if (index < accumulatedCount) {
          currentItem = item;
          break;
        }
      }

      if (!currentItem) {
        throw new Error('Error al determinar la plantilla del lote actual.');
      }

      const freshDb = db.readDb();
      const template = freshDb.templates.find(t => t.id === currentItem.templateId) || freshDb.templates[0];
      const finalProfileId = currentItem.profileId || template?.profileId || freshDb.settings.defaultProfileId;
      const profile = freshDb.profiles.find(p => p.id === finalProfileId) || freshDb.profiles[0];

      job.currentProfileId = finalProfileId;
      job.currentProfileName = profile ? profile.name : null;
      job.currentTemplateId = template?.id;
      job.currentTemplateName = template ? template.name : null;

      if (template && template.name) usedTemplates.add(template.name);
      if (profile && profile.name) usedProfiles.add(profile.name);

      const activeBgFolder = (profile && profile.backgroundFolder && profile.backgroundFolder.trim())
        ? profile.backgroundFolder
        : (freshDb.settings.backgroundFolder || defaultBackgroundFolder);
      exportFolder = (profile && profile.exportFolder && profile.exportFolder.trim())
        ? profile.exportFolder.trim()
        : (freshDb.settings.exportFolder && freshDb.settings.exportFolder.trim())
          ? freshDb.settings.exportFolder.trim()
          : defaultExportFolder;

      try {
        const result = await pipelineManager.runSingleVideo({
          index,
          job,
          currentItem,
          template,
          profile,
          backgroundFolder: activeBgFolder,
          exportFolder,
          normalizedBatch,
          broadcastProgress,
          getStatus
        });

        batchReportItems.push(result.reportItem);

        // Guardar/actualizar incrementalmente el reporte unificado en disco y emitir SSE log
        const videoNumStr = job.totalCount > 1 ? `[Video ${job.currentVideoIndex}/${job.totalCount}]` : '';
        pipelineManager.saveBatchReport({
          batchReportItems,
          job,
          profile,
          currentDb: freshDb,
          exportFolder,
          videoNumStr,
          broadcastProgress
        });

        const durationMs = Date.now() - batchStartTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        const durationStr = `${minutes}m ${seconds}s`;

        notifier.sendNotification({
          status: 'video_completed',
          index: job.currentVideoIndex,
          totalCount: job.totalCount,
          title: result.title,
          filePath: result.finalVideoPath,
          durationStr
        });
      } catch (videoError) {
        console.error(`[QueueController] Error procesando Video #${job.currentVideoIndex}:`, videoError);

        if (cancelRequested) {
          throw videoError;
        }

        failedItems.push(currentItem);
        broadcastProgress({
          type: 'status',
          status: 'processing',
          activeJob: job,
          log: `⚠️ ERROR en Video #${job.currentVideoIndex}: ${videoError.message}. Saltando al siguiente...`
        });
      }
    }

    // Fin de la cola
    const durationMs = Date.now() - batchStartTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const durationStr = `${minutes}m ${seconds}s`;

    // Generar / actualizar reporte final consolidado de lote
    pipelineManager.saveBatchReport({
      batchReportItems,
      job,
      profile: null,
      currentDb: db.readDb(),
      exportFolder,
      videoNumStr: '',
      broadcastProgress
    });

    const successCount = job.totalCount - failedItems.length;
    job.status = failedItems.length > 0 ? 'completed_with_errors' : 'completed';
    job.currentStep = failedItems.length > 0 ? 'Lote finalizado con errores' : 'Lote completado con éxito';
    job.progress = 100;

    broadcastProgress({
      type: 'status',
      status: job.status,
      activeJob: job,
      log: `🏁 ${job.currentStep}. ${successCount} de ${job.totalCount} videos exitosos en ${durationStr}.`
    });

    notifier.sendNotification({
      status: job.status,
      successCount,
      totalCount: job.totalCount,
      failedCount: failedItems.length,
      durationStr,
      profileList: Array.from(usedProfiles).join(', ') || 'Estándar',
      templateList: Array.from(usedTemplates).join(', ') || 'Estándar',
      exportFolder
    });

    activeJob = null;
    cancelRequested = false;
  } catch (error) {
    console.error('[QueueController] Error general en cola:', error);

    // Asegurar persistencia del reporte si hubo videos completados antes del fallo o cancelación
    if (batchReportItems && batchReportItems.length > 0) {
      try {
        pipelineManager.saveBatchReport({
          batchReportItems,
          job,
          profile: null,
          currentDb: db.readDb(),
          exportFolder,
          videoNumStr: '',
          broadcastProgress
        });
      } catch (repErr) {
        console.warn('[QueueController] No se pudo actualizar reporte parcial tras fallo:', repErr.message);
      }
    }

    const durationMs = Date.now() - (batchStartTime || Date.now());
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const durationStr = `${minutes}m ${seconds}s`;

    if (cancelRequested) {
      job.status = 'cancelled';
      job.currentStep = 'Cancelado por el usuario';
      broadcastProgress({
        type: 'status',
        status: 'cancelled',
        activeJob: job,
        log: 'PROCESO CANCELADO: La generación de videos fue detenida por el usuario.'
      });
      notifier.sendNotification({
        status: 'cancelled',
        successCount: job.currentVideoIndex,
        totalCount: job.totalCount,
        durationStr
      });
    } else {
      job.status = 'failed';
      job.currentStep = 'Error en el proceso';
      broadcastProgress({
        type: 'status',
        status: 'failed',
        activeJob: job,
        error: error.message,
        log: `Error en el proceso: ${error.message}`
      });
      notifier.sendNotification({
        status: 'failed',
        successCount: job.currentVideoIndex,
        totalCount: job.totalCount,
        durationStr,
        errorMsg: error.message
      });
    }
    activeJob = null;
    cancelRequested = false;
  }
}

module.exports = {
  addSseClient,
  removeSseClient,
  getActiveJob,
  getJobLogs,
  getFailedItemsCount,
  broadcastProgress,
  startBatch,
  cancelJob,
  pauseJob,
  resumeJob,
  retryFailedJobs
};

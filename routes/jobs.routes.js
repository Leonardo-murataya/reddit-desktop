const express = require('express');
const router = express.Router();
const db = require('../services/db');
const queueController = require('../controllers/queueController');
const fs = require('fs');

// 1. Canal SSE para progreso en vivo
const handleSseProgress = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  queueController.addSseClient(res);

  // Enviar estado actual del trabajo al conectarse
  res.write(`data: ${JSON.stringify({
    type: 'init',
    activeJob: queueController.getActiveJob(),
    logs: queueController.getJobLogs()
  })}\n\n`);

  req.on('close', () => {
    queueController.removeSseClient(res);
  });
};

router.get('/progress', handleSseProgress);
router.get('/jobs/progress', handleSseProgress);

// 2. Disparar generación
const handleGenerate = async (req, res) => {
  try {
    const { prompt, count = 1, profileId, templateId, backgroundFolder, batch, seeds } = req.body;

    if (queueController.getActiveJob()) {
      return res.status(400).json({ error: 'Ya hay un proceso de renderizado en curso. Por favor espera a que finalice.' });
    }

    const currentDb = db.readDb();
    if (!currentDb.templates || currentDb.templates.length === 0) {
      return res.status(400).json({ error: 'No hay plantillas de video guardadas. Crea al menos una plantilla en el Diseñador de Plantillas.' });
    }

    let normalizedBatch = [];
    if (seeds && Array.isArray(seeds) && seeds.length > 0) {
      normalizedBatch = seeds.map(s => {
        const explicitTmplId = s.templateId || templateId;
        let targetTmpl = null;
        if (explicitTmplId) {
          targetTmpl = currentDb.templates.find(t => String(t.id).trim() === String(explicitTmplId).trim());
        }
        if (!targetTmpl && s.profileId) {
          targetTmpl = currentDb.templates.find(t => String(t.profileId).trim() === String(s.profileId).trim());
        }
        if (!targetTmpl) {
          targetTmpl = currentDb.templates.find(t => t.id === currentDb.settings.defaultTemplateId) || currentDb.templates[0];
        }

        const tmplId = targetTmpl ? targetTmpl.id : (explicitTmplId || currentDb.templates[0]?.id);
        const profId = s.profileId || targetTmpl?.profileId || profileId || currentDb.settings.defaultProfileId || currentDb.profiles[0]?.id;
        const customStory = s.customStory || (req.body.customStory ? req.body.customStory : null);
        return {
          templateId: tmplId,
          count: 1,
          prompt: (s.prompt || customStory?.title || '').trim(),
          profileId: profId,
          customStory
        };
      });
    } else if (batch && Array.isArray(batch)) {
      normalizedBatch = batch.map(item => {
        let targetTmpl = currentDb.templates.find(t => t.id === item.templateId);
        if (!targetTmpl && item.profileId) {
          targetTmpl = currentDb.templates.find(t => t.profileId === item.profileId);
        }
        if (!targetTmpl) {
          targetTmpl = currentDb.templates.find(t => t.id === templateId) ||
                       currentDb.templates.find(t => t.id === currentDb.settings.defaultTemplateId) ||
                       currentDb.templates[0];
        }
        const tmplId = targetTmpl ? targetTmpl.id : (item.templateId || templateId);
        const profId = item.profileId || targetTmpl?.profileId || profileId || currentDb.settings.defaultProfileId || currentDb.profiles[0]?.id;
        const customStory = item.customStory || null;
        return {
          templateId: tmplId,
          count: parseInt(item.count) || 1,
          prompt: item.prompt || customStory?.title || '',
          profileId: profId,
          customStory
        };
      });
    } else {
      let targetTmpl = currentDb.templates.find(t => t.id === templateId);
      if (!targetTmpl && profileId) {
        targetTmpl = currentDb.templates.find(t => t.profileId === profileId);
      }
      if (!targetTmpl) {
        targetTmpl = currentDb.templates.find(t => t.id === currentDb.settings.defaultTemplateId) || currentDb.templates[0];
      }
      const tmplId = targetTmpl ? targetTmpl.id : templateId;
      const profId = profileId || targetTmpl?.profileId || currentDb.settings.defaultProfileId || currentDb.profiles[0]?.id;
      const customStory = req.body.customStory || null;
      normalizedBatch = [{
        templateId: tmplId,
        count: parseInt(count) || 1,
        prompt: prompt || customStory?.title || '',
        profileId: profId,
        customStory
      }];
    }

    // Validar plantillas, perfiles y carpetas
    const exportFolderGlobal = currentDb.settings.exportFolder;
    for (const item of normalizedBatch) {
      const template = currentDb.templates.find(t => t.id === item.templateId);
      if (!template) {
        return res.status(400).json({ error: `No se encontró la plantilla de video requerida (ID: ${item.templateId || 'no especificado'}).` });
      }

      const isCustom = !!item.customStory;
      const finalProfileId = item.profileId || template.profileId || currentDb.settings.defaultProfileId;
      const profile = currentDb.profiles.find(p => p.id === finalProfileId) || currentDb.profiles[0] || { name: 'Perfil por defecto' };

      // Solo exigir API Key si NO es una historia personalizada directa
      if (!isCustom && (!profile || !profile.apiKey)) {
        return res.status(400).json({ error: `La plantilla "${template.name}" requiere un perfil de IA con API Key configurada.` });
      }

      // Validar contenido de historia personalizada si aplica
      if (isCustom) {
        const rawContent = (item.customStory.content || item.customStory.text || '').trim();
        if (!rawContent) {
          return res.status(400).json({ error: 'La historia personalizada no puede estar vacía.' });
        }
        if (!item.customStory.title || !item.customStory.title.trim()) {
          const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const firstLine = lines[0] || 'Historia de Reddit';
          item.customStory.title = firstLine.length > 85 ? firstLine.substring(0, 82) + '...' : firstLine;
        }
      }

      const activeBgFolder = (profile && profile.backgroundFolder && profile.backgroundFolder.trim())
        ? profile.backgroundFolder
        : (currentDb.settings.backgroundFolder || backgroundFolder);
      if (!activeBgFolder || !fs.existsSync(activeBgFolder)) {
        return res.status(400).json({ error: `La carpeta de videos de fondo para la plantilla "${template.name}" no está configurada o no existe.` });
      }

      const activeExportFolder = (profile && profile.exportFolder && profile.exportFolder.trim())
        ? profile.exportFolder
        : (exportFolderGlobal || path.join(__dirname, '..', 'temp'));
      if (!activeExportFolder || !activeExportFolder.trim()) {
        return res.status(400).json({ error: `La carpeta de exportación para la plantilla "${template.name}" no está configurada.` });
      }
    }

    const result = await queueController.startBatch({
      batchItems: normalizedBatch,
      backgroundFolder
    });

    res.json(result);
  } catch (error) {
    console.error('[JobsRoute] Error iniciando generación:', error);
    res.status(400).json({ error: error.message });
  }
};

router.post('/generate', handleGenerate);
router.post('/jobs/generate', handleGenerate);

// 3. Cancelar
const handleCancel = (req, res) => {
  const result = queueController.cancelJob();
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  // Detener ffmpeg si está corriendo
  try {
    const { execSync } = require('child_process');
    execSync('taskkill /F /IM ffmpeg.exe', { stdio: 'ignore' });
  } catch {}
  res.json(result);
};

router.post('/jobs/cancel', handleCancel);
router.post('/cancel', handleCancel);

// 4. Pausar
const handlePause = (req, res) => {
  const result = queueController.pauseJob();
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
};

router.post('/jobs/pause', handlePause);
router.post('/pause', handlePause);

// 5. Reanudar
const handleResume = (req, res) => {
  const result = queueController.resumeJob();
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
};

router.post('/jobs/resume', handleResume);
router.post('/resume', handleResume);

// 6. Contador de fallidos
const handleFailedCount = (req, res) => {
  res.json({ failedCount: queueController.getFailedItemsCount() });
};

router.get('/jobs/failed-count', handleFailedCount);
router.get('/failed-count', handleFailedCount);

// 7. Reintentar fallidos
const handleRetryFailed = async (req, res) => {
  try {
    const result = await queueController.retryFailedJobs();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

router.post('/jobs/retry-failed', handleRetryFailed);
router.post('/retry-failed', handleRetryFailed);

module.exports = router;

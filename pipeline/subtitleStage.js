const path = require('path');
const subtitles = require('../services/subtitles');

/**
 * Etapa 4 del Pipeline: Generación de Subtítulos Dinámicos (.ass)
 */
async function executeSubtitleStage({ bodyTimestamps, template, titleDuration, formatMode, jobTempDir, videoNumStr, broadcastProgress, job, isCancelRequested }) {
  job.stage = 'subtitles';
  job.currentStep = 'Generando subtítulos sincronizados';

  if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');

  if (formatMode === 'both') {
    const assPath916 = path.join(jobTempDir, 'subtitles_9_16.ass');
    const assPath169 = path.join(jobTempDir, 'subtitles_16_9.ass');

    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `${videoNumStr} Generando script de subtítulos ASS para 9:16...`
    });
    await subtitles.generateAssSubtitles(bodyTimestamps, assPath916, template, titleDuration, false);

    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `${videoNumStr} Generando script de subtítulos ASS para 16:9...`
    });
    await subtitles.generateAssSubtitles(bodyTimestamps, assPath169, template, titleDuration, true);

    return {
      isBoth: true,
      assPath916,
      assPath169
    };
  } else {
    const isLandscape = formatMode === '16-9';
    const assPath = path.join(jobTempDir, 'subtitles.ass');

    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `${videoNumStr} Generando script de subtítulos ASS (Modo: ${isLandscape ? '16:9' : '9:16'})...`
    });

    await subtitles.generateAssSubtitles(bodyTimestamps, assPath, template, titleDuration, isLandscape);

    return {
      isBoth: false,
      isLandscape,
      assPath
    };
  }
}

module.exports = {
  executeSubtitleStage
};

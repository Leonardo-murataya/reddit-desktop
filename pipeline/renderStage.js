const path = require('path');
const ffmpeg = require('../services/ffmpeg');

/**
 * Etapa 5 del Pipeline: Compilación y Renderizado Acelerado por GPU con FFmpeg
 */
async function executeRenderStage({
  formatMode,
  subtitleData,
  segments,
  activeCardPath,
  titleAudioPath,
  bodyAudioPath,
  titleDuration,
  totalDuration,
  template,
  profile,
  currentDb,
  exportFolder,
  safeTitle,
  videoIndex,
  videoNumStr,
  broadcastProgress,
  job,
  isCancelRequested
}) {
  job.stage = 'render';

  if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');

  const renderEngine = (profile && profile.renderEngine && profile.renderEngine !== 'global')
    ? profile.renderEngine
    : (currentDb.settings.renderEngine || 'auto');

  const baseParams = {
    backgroundSegments: segments,
    cardImagePath: activeCardPath,
    titleAudioPath,
    bodyAudioPath,
    titleDuration,
    totalDuration,
    renderEngine,
    musicEnabled: template.musicEnabled || false,
    musicFile: template.musicFile || '',
    musicVolume: template.musicVolume !== undefined ? template.musicVolume : -20,
    cardSfxEnabled: template.cardSfxEnabled || false,
    cardSfxSound: template.cardSfxSound || 'whoosh',
    cardSfxVolume: template.cardSfxVolume !== undefined ? template.cardSfxVolume : -6,
    backgroundBlur: template.backgroundBlur !== undefined ? template.backgroundBlur : 0,
    backgroundBlurMode: template.backgroundBlurMode || 'card-only',
    vignetteStrength: template.vignetteStrength !== undefined ? template.vignetteStrength : 0,
    backgroundSaturation: template.backgroundSaturation !== undefined ? template.backgroundSaturation : 1.0,
    backgroundContrast: template.backgroundContrast !== undefined ? template.backgroundContrast : 1.0,
    watermarkEnabled: template.watermarkEnabled || false,
    watermarkType: template.watermarkType || 'text',
    watermarkImageFile: template.watermarkImageFile || '',
    watermarkImageScale: template.watermarkImageScale !== undefined ? template.watermarkImageScale : 0.15,
    watermarkImageOpacity: template.watermarkImageOpacity !== undefined ? template.watermarkImageOpacity : 0.5,
    watermarkImageAlignment: template.watermarkImageAlignment !== undefined ? template.watermarkImageAlignment : 9,
    watermarkImageOffsetX: template.watermarkImageOffsetX !== undefined ? template.watermarkImageOffsetX : 20,
    watermarkImageOffsetY: template.watermarkImageOffsetY !== undefined ? template.watermarkImageOffsetY : 20,
    cardEntryAnimation: template.cardEntryAnimation || 'none',
    cardExitAnimation: template.cardExitAnimation || 'none',
    cardEntryDuration: template.cardEntryDuration !== undefined ? template.cardEntryDuration : 0.4,
    cardExitDuration: template.cardExitDuration !== undefined ? template.cardExitDuration : 0.4
  };

  if (formatMode === 'both') {
    // 1. Compilar 9:16 vertical
    const finalVideoPath916 = path.join(exportFolder, `video ${videoIndex} 9-16 ${safeTitle}.mp4`);
    job.currentStep = 'Codificando formato 9:16 con FFmpeg';
    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `${videoNumStr} Compilando formato 9:16 vertical (Archivo: video ${videoIndex} 9-16 ${safeTitle}.mp4)...`
    });

    let lastLogged916 = -1;
    let lastBroadcast916 = 0;
    let pendingLog916 = null;
    await ffmpeg.compileVideo({
      ...baseParams,
      assSubtitlesPath: subtitleData.assPath916,
      outputPath: finalVideoPath916,
      cardOffsetX: template.cardOffsetX || 0,
      cardOffsetY: template.cardOffsetY || 0,
      cardScale: template.cardScale !== undefined ? template.cardScale : 1.0,
      aspectRatio: '9:16'
    }, (percent, metrics) => {
      job.progress = Math.round(percent * 0.5);
      if (metrics) {
        job.gpuFps = metrics.fps;
        job.renderSpeed = metrics.speed;
        job.renderEta = metrics.etaSeconds;
      }
      if (percent > 0 && percent !== lastLogged916) {
        lastLogged916 = percent;
        pendingLog916 = `${videoNumStr} Progreso de codificación 9:16: ${percent}% ${metrics?.fps ? `(${metrics.fps} FPS - ${metrics.speed}x)` : ''}`;
      }
      const now = Date.now();
      if (now - lastBroadcast916 >= 250 || percent === 100) {
        lastBroadcast916 = now;
        const logToSend = pendingLog916;
        pendingLog916 = null;
        broadcastProgress({
          type: 'progress',
          activeJob: job,
          percent: job.progress,
          metrics: metrics || null,
          log: logToSend
        });
      }
    });

    if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');

    // 2. Compilar 16:9 horizontal
    const finalVideoPath169 = path.join(exportFolder, `video ${videoIndex} 16-9 ${safeTitle}.mp4`);
    job.currentStep = 'Codificando formato 16:9 con FFmpeg';
    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `${videoNumStr} Compilando formato 16:9 horizontal (Archivo: video ${videoIndex} 16-9 ${safeTitle}.mp4)...`
    });

    let lastLogged169 = -1;
    let lastBroadcast169 = 0;
    let pendingLog169 = null;
    await ffmpeg.compileVideo({
      ...baseParams,
      assSubtitlesPath: subtitleData.assPath169,
      outputPath: finalVideoPath169,
      cardOffsetX_16_9: template.cardOffsetX_16_9 !== undefined ? template.cardOffsetX_16_9 : 0,
      cardOffsetY_16_9: template.cardOffsetY_16_9 !== undefined ? template.cardOffsetY_16_9 : 0,
      cardScale_16_9: template.cardScale_16_9 !== undefined ? template.cardScale_16_9 : 1.0,
      aspectRatio: '16:9'
    }, (percent, metrics) => {
      job.progress = 50 + Math.round(percent * 0.5);
      if (metrics) {
        job.gpuFps = metrics.fps;
        job.renderSpeed = metrics.speed;
        job.renderEta = metrics.etaSeconds;
      }
      if (percent > 0 && percent !== lastLogged169) {
        lastLogged169 = percent;
        pendingLog169 = `${videoNumStr} Progreso de codificación 16:9: ${percent}% ${metrics?.fps ? `(${metrics.fps} FPS - ${metrics.speed}x)` : ''}`;
      }
      const now = Date.now();
      if (now - lastBroadcast169 >= 250 || percent === 100) {
        lastBroadcast169 = now;
        const logToSend = pendingLog169;
        pendingLog169 = null;
        broadcastProgress({
          type: 'progress',
          activeJob: job,
          percent: job.progress,
          metrics: metrics || null,
          log: logToSend
        });
      }
    });

    return {
      isBoth: true,
      primaryVideoPath: finalVideoPath916,
      secondaryVideoPath: finalVideoPath169,
      generatedFiles: [
        `Formato Vertical (9:16): video ${videoIndex} 9-16 ${safeTitle}.mp4`,
        `Formato Horizontal (16:9): video ${videoIndex} 16-9 ${safeTitle}.mp4`
      ]
    };
  } else {
    const isLandscape = formatMode === '16-9';
    const videoName = isLandscape ? `video ${videoIndex} 16-9 ${safeTitle}` : `video ${videoIndex} 9-16 ${safeTitle}`;
    const finalVideoPath = path.join(exportFolder, `${videoName}.mp4`);

    job.currentStep = 'Codificando video con FFmpeg';
    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `${videoNumStr} Iniciando codificación FFmpeg (Archivo: ${videoName}.mp4)...`
    });

    let lastLoggedPercent = -1;
    let lastBroadcastSingle = 0;
    let pendingLogSingle = null;
    await ffmpeg.compileVideo({
      ...baseParams,
      assSubtitlesPath: subtitleData.assPath,
      outputPath: finalVideoPath,
      cardOffsetX: template.cardOffsetX || 0,
      cardOffsetY: template.cardOffsetY || 0,
      cardScale: template.cardScale !== undefined ? template.cardScale : 1.0,
      cardOffsetX_16_9: template.cardOffsetX_16_9 !== undefined ? template.cardOffsetX_16_9 : 0,
      cardOffsetY_16_9: template.cardOffsetY_16_9 !== undefined ? template.cardOffsetY_16_9 : 0,
      cardScale_16_9: template.cardScale_16_9 !== undefined ? template.cardScale_16_9 : 1.0,
      aspectRatio: isLandscape ? '16:9' : '9:16'
    }, (percent, metrics) => {
      job.progress = percent;
      if (metrics) {
        job.gpuFps = metrics.fps;
        job.renderSpeed = metrics.speed;
        job.renderEta = metrics.etaSeconds;
      }
      if (percent > 0 && percent !== lastLoggedPercent) {
        lastLoggedPercent = percent;
        pendingLogSingle = `${videoNumStr} Progreso de codificación FFmpeg: ${percent}% ${metrics?.fps ? `(${metrics.fps} FPS - ${metrics.speed}x)` : ''}`;
      }
      const now = Date.now();
      if (now - lastBroadcastSingle >= 250 || percent === 100) {
        lastBroadcastSingle = now;
        const logToSend = pendingLogSingle;
        pendingLogSingle = null;
        broadcastProgress({
          type: 'progress',
          activeJob: job,
          percent: job.progress,
          metrics: metrics || null,
          log: logToSend
        });
      }
    });

    return {
      isBoth: false,
      primaryVideoPath: finalVideoPath,
      generatedFiles: [
        `${isLandscape ? 'Formato Horizontal (16:9)' : 'Formato Vertical (9:16)'}: ${videoName}.mp4`
      ]
    };
  }
}

module.exports = {
  executeRenderStage
};

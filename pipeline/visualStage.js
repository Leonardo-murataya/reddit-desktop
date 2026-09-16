const path = require('path');
const cardRenderer = require('../services/cardRenderer');
const timeline = require('../services/timeline');

/**
 * Etapa 3 del Pipeline: Renderizado de Recursos Visuales (Tarjeta Reddit y Segmentos de Fondo)
 */
async function executeVisualStage({ story, template, profile, totalDuration, bgFolder, jobTempDir, videoNumStr, broadcastProgress, job, isCancelRequested }) {
  job.stage = 'subtitles';
  job.currentStep = 'Renderizando tarjeta Reddit y preparando fondo';

  if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');

  // 1. Renderizar Tarjeta de Reddit con Canvas
  broadcastProgress({
    type: 'status',
    status: 'processing',
    activeJob: job,
    log: `${videoNumStr} Renderizando Tarjeta de Reddit con Motor de Lienzo Nativo...`
  });

  const cardImagePath = path.join(jobTempDir, 'card.png');
  const cardData = {
    title: story.title,
    username: template.cardUsername,
    subreddit: template.cardSubreddit,
    avatar: template.cardAvatar,
    upvotes: template.upvotes,
    comments: template.comments,
    theme: template.cardTheme,
    cardType: template.cardType || 'static',
    cardShowVerified: template.cardShowVerified !== undefined ? template.cardShowVerified : true,
    cardShowAwards: template.cardShowAwards !== undefined ? template.cardShowAwards : true,
    cardSelectedAwards: template.cardSelectedAwards || [],
    cardWidth: template.cardWidth !== undefined ? template.cardWidth : 260,
    cardBorderRadius: template.cardBorderRadius !== undefined ? template.cardBorderRadius : 11,
    cardPadding: template.cardPadding !== undefined ? template.cardPadding : 12,
    cardGap: template.cardGap !== undefined ? template.cardGap : 7
  };

  const finalCardPath = await cardRenderer.renderCard(cardData, cardImagePath);
  const activeCardPath = finalCardPath || cardImagePath;

  broadcastProgress({
    type: 'status',
    status: 'processing',
    activeJob: job,
    log: `${videoNumStr} Tarjeta de Reddit renderizada con éxito.`
  });

  if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');

  // 2. Resolver Segmentos de Video de Fondo (Con continuidad de timeline por perfil)
  broadcastProgress({
    type: 'status',
    status: 'processing',
    activeJob: job,
    log: `${videoNumStr} Consultando línea de tiempo de video continuo...`
  });

  const { segments } = timeline.getBackgroundSegments(totalDuration, bgFolder, profile ? profile.id : 'global');

  broadcastProgress({
    type: 'status',
    status: 'processing',
    activeJob: job,
    log: `${videoNumStr} Pista de fondo virtual asignada (${segments.length} segmento(s)).`
  });

  return {
    activeCardPath,
    cardImagePath,
    segments
  };
}

module.exports = {
  executeVisualStage
};

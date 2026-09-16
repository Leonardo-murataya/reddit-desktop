const gemini = require('../services/gemini');

/**
 * Etapa 1 del Pipeline: Generación de Guion con IA (Google Gemini)
 */
async function executeScriptStage({ profile, template, prompt, videoNumStr, broadcastProgress, job }) {
  if (!profile || !profile.apiKey) {
    throw new Error(`El perfil asignado para "${template?.name || 'la plantilla'}" no tiene API Key configurada.`);
  }

  job.stage = 'script';
  job.currentStep = 'Generando historia con IA';
  job.progress = 0;

  broadcastProgress({
    type: 'status',
    status: 'processing',
    activeJob: job,
    log: `${videoNumStr} Generando guion usando Gemini API...`
  });

  const currentPrompt = prompt || template.defaultIdea || 'Inventa una historia dramática';

  let effectiveSystemPrompt = profile.systemPrompt;
  if (template.multiVoiceEnabled) {
    const extension = template.multiVoicePromptExtension || '';
    effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n[INSTRUCCIÓN DE DIÁLOGOS MULTI-VOZ ACTIVA]\n${extension}\nLímite máximo de voces/personajes a usar: ${template.multiVoiceMaxVoices || 4}.`;
  }

  const primaryAttempts = profile.primaryAttempts !== undefined ? parseInt(profile.primaryAttempts) : 2;
  const fallbackAttempts = profile.fallbackAttempts !== undefined ? parseInt(profile.fallbackAttempts) : 3;
  const fallbackModels = profile.fallbackModels || profile.fallbackModel || 'gemini-2.5-flash';

  const story = await gemini.generateStory(
    profile.apiKey,
    profile.model,
    currentPrompt,
    effectiveSystemPrompt,
    primaryAttempts,
    fallbackAttempts,
    fallbackModels
  );

  if (story.dialogues && !story.content) {
    story.content = story.dialogues.map(d => `${d.role}: "${d.text}"`).join('\n');
  }

  const genderLabel = story.gender === 'male' ? 'Masculino (Jorge)' : 'Femenino (Dalia)';
  broadcastProgress({
    type: 'status',
    status: 'processing',
    activeJob: job,
    log: `${videoNumStr} Guion generado con éxito. Título: "${story.title}". Género clasificado: ${genderLabel}`
  });

  return {
    story,
    currentPrompt,
    effectiveSystemPrompt
  };
}

module.exports = {
  executeScriptStage
};

const gemini = require('../services/gemini');

function detectStoryGender(text) {
  if (!text) return 'male';
  const lower = text.toLowerCase();
  const femaleMatches = (lower.match(/\b(soy una mujer|soy mujer|mi esposo|mi marido|mi novio|estaba embarazada|qued[eé] embarazada|estaba cansada|fui madre|mi prometido|estoy casada|fui enga[ñn]ada|como mujer|como madre|estaba desesperada|estaba sola)\b/g) || []).length;
  const maleMatches = (lower.match(/\b(soy un hombre|soy hombre|mi esposa|mi mujer|mi novia|estaba cansado|fui padre|mi prometida|estoy casado|fui enga[ñn]ado|como hombre|como padre|estaba desesperado|estaba solo)\b/g) || []).length;
  if (femaleMatches > maleMatches) return 'female';
  if (maleMatches > femaleMatches) return 'male';
  return 'male';
}

/**
 * Etapa 1 del Pipeline: Generación de Guion con IA (Google Gemini)
 */
async function executeScriptStage({ profile, template, prompt, customStory, videoNumStr, broadcastProgress, job, isPrefetch = false }) {
  if (job?.status === 'cancelling' || job?.status === 'cancelled') {
    throw new Error('Generación cancelada por el usuario.');
  }

  if (!isPrefetch && job) {
    job.stage = 'script';
    job.progress = 0;
  }

  // 1. MODO HISTORIA PROPIA (OMITIR GEMINI API TOTALMENTE)
  if (customStory && (customStory.content || customStory.text)) {
    const rawContent = (customStory.content || customStory.text || '').trim();
    let title = (customStory.title || '').trim();
    let content = rawContent;

    // Si no se proporcionó título explícito, extraer de la primera línea
    if (!title) {
      const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        let firstLine = lines[0];
        firstLine = firstLine.replace(/^(?:t[ií]tulo|title|asunto)\s*[:\-]\s*/i, '').replace(/^#+\s*/, '').trim();
        title = firstLine.length > 85 ? firstLine.substring(0, 82) + '...' : firstLine;
        if (lines.length > 1) {
          content = lines.slice(1).join('\n').trim();
        }
      }
    }

    if (!title) {
      title = 'Historia de Reddit';
    }

    // Determinar género y voz exclusivamente de la plantilla
    let gender = 'male';
    if (template?.narratorGender === 'female') {
      gender = 'female';
    } else if (template?.narratorGender === 'male') {
      gender = 'male';
    } else if (customStory.gender === 'male' || customStory.gender === 'female') {
      gender = customStory.gender;
    } else {
      gender = detectStoryGender(content);
    }

    const resolvedVoice = gender === 'male' 
      ? (template?.maleVoice || 'es-MX-JorgeNeural') 
      : (template?.femaleVoice || 'es-MX-DaliaNeural');
    const voiceCleanName = resolvedVoice.split('-').slice(2).join(' ') || resolvedVoice;
    const genderLabel = `${gender === 'male' ? 'Masculino' : 'Femenino'} (${voiceCleanName})`;

    if (!isPrefetch && job) {
      job.currentStep = 'Procesando historia personalizada';
    }

    if (job?.status !== 'cancelling' && job?.status !== 'cancelled') {
      if (isPrefetch) {
        broadcastProgress({
          type: 'log',
          log: `${videoNumStr} 📝 Historia personalizada cargada (Gemini API omitida). Título: "${title}". Voz: ${genderLabel}`
        });
      } else {
        broadcastProgress({
          type: 'status',
          status: 'processing',
          activeJob: job,
          log: `${videoNumStr} 📝 Historia personalizada cargada (Gemini API omitida). Título: "${title}". Voz de plantilla: ${genderLabel}`
        });
      }
    }

    const story = {
      title,
      content,
      gender,
      dialogues: Array.isArray(customStory.dialogues) ? customStory.dialogues : []
    };

    return {
      story,
      currentPrompt: title,
      effectiveSystemPrompt: '[HISTORIA PROPIA DIRECTA]'
    };
  }

  // 2. MODO GENERACIÓN CON IA (GOOGLE GEMINI)
  if (!profile || !profile.apiKey) {
    throw new Error(`El perfil asignado para "${template?.name || 'la plantilla'}" no tiene API Key configurada.`);
  }

  if (!isPrefetch && job) {
    job.currentStep = 'Generando historia con IA';
  }

  if (job?.status !== 'cancelling' && job?.status !== 'cancelled') {
    if (isPrefetch) {
      broadcastProgress({
        type: 'log',
        log: `${videoNumStr} Generando guion en segundo plano usando Gemini API...`
      });
    } else {
      broadcastProgress({
        type: 'status',
        status: 'processing',
        activeJob: job,
        log: `${videoNumStr} Generando guion usando Gemini API...`
      });
    }
  }

  const currentPrompt = prompt || template.defaultIdea || 'Inventa una historia dramática';

  let effectiveSystemPrompt = profile.systemPrompt;
  if (template.multiVoiceEnabled) {
    const extension = template.multiVoicePromptExtension || '';
    effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n[INSTRUCCIÓN DE DIÁLOGOS MULTI-VOZ ACTIVA]\n${extension}\nLímite máximo de voces/personajes a usar: ${template.multiVoiceMaxVoices || 4}.`;
  }

  const primaryAttempts = profile.primaryAttempts !== undefined ? parseInt(profile.primaryAttempts) : 2;
  const fallbackAttempts = profile.fallbackAttempts !== undefined ? parseInt(profile.fallbackAttempts) : 3;
  const fallbackModels = profile.fallbackModels || profile.fallbackModel || 'gemini-2.5-flash';
  const maxOutputTokens = profile.maxOutputTokens !== undefined ? parseInt(profile.maxOutputTokens) : 1200;

  const story = await gemini.generateStory(
    profile.apiKey,
    profile.model,
    currentPrompt,
    effectiveSystemPrompt,
    primaryAttempts,
    fallbackAttempts,
    fallbackModels,
    maxOutputTokens,
    (msg) => {
      if (job?.status === 'cancelling' || job?.status === 'cancelled') return;
      if (isPrefetch) {
        broadcastProgress({
          type: 'log',
          log: `${videoNumStr} ${msg}`
        });
      } else {
        broadcastProgress({
          type: 'status',
          status: 'processing',
          activeJob: job,
          log: `${videoNumStr} ${msg}`
        });
      }
    }
  );

  if (job?.status === 'cancelling' || job?.status === 'cancelled') {
    throw new Error('Generación cancelada por el usuario.');
  }

  if (story.dialogues && !story.content) {
    story.content = story.dialogues.map(d => `${d.role}: "${d.text}"`).join('\n');
  }

  const chosenVoice = story.gender === 'male' ? (template?.maleVoice || 'es-MX-JorgeNeural') : (template?.femaleVoice || 'es-MX-DaliaNeural');
  const voiceCleanName = chosenVoice.split('-').slice(2).join(' ') || chosenVoice;
  const genderLabel = `${story.gender === 'male' ? 'Masculino' : 'Femenino'} (${voiceCleanName})`;

  if (job?.status !== 'cancelling' && job?.status !== 'cancelled') {
    if (isPrefetch) {
      broadcastProgress({
        type: 'log',
        log: `${videoNumStr} ⚡ Guion en segundo plano listo. Título: "${story.title}". Voz: ${genderLabel}`
      });
    } else {
      broadcastProgress({
        type: 'status',
        status: 'processing',
        activeJob: job,
        log: `${videoNumStr} Guion generado con éxito. Título: "${story.title}". Género clasificado: ${genderLabel}`
      });
    }
  }

  return {
    story,
    currentPrompt,
    effectiveSystemPrompt
  };
}

module.exports = {
  executeScriptStage
};

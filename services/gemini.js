const { GoogleGenerativeAI } = require('@google/generative-ai');

// Mapa dinámico en memoria para registrar modelos temporalmente agotados o sobrecargados
const exhaustedModels = new Map(); // modelName -> expiryTimestamp

function markModelAsExhausted(modelName, durationMs = 30 * 60 * 1000) {
  console.log(`[Gemini] Marcando modelo ${modelName} como agotado/sobrecargado/inactivo temporalmente por ${durationMs / 1000}s`);
  exhaustedModels.set(modelName, Date.now() + durationMs);
}

function isModelExhausted(modelName) {
  if (!exhaustedModels.has(modelName)) return false;
  const expiry = exhaustedModels.get(modelName);
  if (Date.now() > expiry) {
    exhaustedModels.delete(modelName);
    return false;
  }
  return true;
}

/**
 * Genera una historia estructurada de Reddit basada en el prompt del usuario
 * @param {string} apiKey - Gemini API Key
 * @param {string} modelName - Nombre del modelo (ej. gemini-1.5-flash)
 * @param {string} userPrompt - Lo que el usuario quiere contar (ej. "historias de terror")
 * @param {string} systemPrompt - Instrucciones de comportamiento para la IA
 * @returns {Promise<{title: string, content: string, gender: string}>}
 */
async function generateStory(apiKey, modelName, userPrompt, systemPrompt, primaryAttempts = 2, fallbackAttempts = 3, customFallbackModels = 'gemini-2.5-flash') {
  if (!apiKey) {
    throw new Error('API Key de Gemini no proporcionada. Por favor, configúrala en Ajustes.');
  }

  const keys = [];
  if (Array.isArray(apiKey)) {
    keys.push(...apiKey.filter(k => k && k.trim()));
  } else if (typeof apiKey === 'string' && apiKey.trim()) {
    keys.push(...apiKey.split(/\r?\n|,/).map(k => k.trim()).filter(Boolean));
  }

  if (keys.length === 0) {
    throw new Error('API Key de Gemini no proporcionada o vacía. Por favor, configúrala en Ajustes.');
  }

  let keyIndex = 0;

  // Importar el SDK de Google Gen AI.
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  
  // Inicializamos el cliente
  // NOTA IMPORTANTE PARA EL USUARIO:
  // Si deseas actualizar el prompt del sistema o entender cómo funciona la detección de género:
  // 1. Mandamos al modelo un esquema estructurado (responseSchema) para evitar que retorne texto plano.
  // 2. Le pedimos explícitamente que analice pronombres y relaciones (ej: "mi novia" -> masculino, "mi esposo" -> femenino)
  //    para categorizar el género como "male" o "female".
  
  let activeModel = modelName || 'gemini-3.7-flash';
  
  // Normalizar la lista de modelos de prioridad secuencial
  const fallbackModels = (Array.isArray(customFallbackModels) ? customFallbackModels : [customFallbackModels])
    .filter(Boolean)
    .map(model => {
      let m = model || 'gemini-3.7-flash';
      if (m === 'gemini-1.5-flash' || m === 'gemini-2.5-flash') return 'gemini-3.5-flash';
      if (m === 'gemini-3-flash') return 'gemini-3-flash-preview';
      if (m === 'gemini-3.1-flash') return 'gemini-3.1-flash-lite';
      if (m === 'gemini-3.7') return 'gemini-3.7-flash';
      return m;
    });

  if (fallbackModels.length === 0) {
    fallbackModels.push('gemini-3.7-flash');
    fallbackModels.push('gemini-3.6-flash');
    fallbackModels.push('gemini-3.5-flash');
  }

  // Normalizar nombres de modelos del principal
  if (activeModel === 'gemini-1.5-flash' || activeModel === 'gemini-2.5-flash') {
    activeModel = 'gemini-3.5-flash';
  } else if (activeModel === 'gemini-3-flash') {
    activeModel = 'gemini-3-flash-preview';
  } else if (activeModel === 'gemini-3.1-flash') {
    activeModel = 'gemini-3.1-flash-lite';
  } else if (activeModel === 'gemini-3.7') {
    activeModel = 'gemini-3.7-flash';
  }

  // Helper para buscar el siguiente modelo disponible de la lista que no esté agotado
  function getNextAvailableModel(currentModel) {
    for (const model of fallbackModels) {
      if (!isModelExhausted(model) && model !== currentModel) {
        return model;
      }
    }
    const backupUniversal = 'gemini-3.5-flash';
    if (currentModel !== backupUniversal && !isModelExhausted(backupUniversal)) {
      return backupUniversal;
    }
    return fallbackModels[0] || 'gemini-3.7-flash';
  }

  // Si el modelo principal está marcado temporalmente como agotado o sobrecargado,
  // redirigimos de forma inmediata al siguiente modelo disponible de la lista.
  if (isModelExhausted(activeModel)) {
    const nextModel = getNextAvailableModel(activeModel);
    console.log(`[Gemini] El modelo principal ${activeModel} está marcado como agotado/sobrecargado. Redirigiendo de inmediato a: ${nextModel}`);
    activeModel = nextModel;
  }

  // La inicialización de la instancia de AI se realiza de forma dinámica por clave en el bucle de generación.

  const isMultiVoice = systemPrompt && systemPrompt.includes('[INSTRUCCIÓN DE DIÁLOGOS MULTI-VOZ ACTIVA]');

  const schema = isMultiVoice ? {
    type: 'OBJECT',
    properties: {
      title: {
        type: 'STRING',
        description: 'Un título corto, extremadamente llamativo e intrigante de la historia de Reddit (máximo 15 palabras).'
      },
      dialogues: {
        type: 'ARRAY',
        description: 'La lista ordenada de frases y diálogos que componen el drama completo de la historia.',
        items: {
          type: 'OBJECT',
          properties: {
            role: {
              type: 'STRING',
              description: 'El nombre del hablante. Usa "narrator" para el narrador/protagonista principal. Usa nombres cortos en minúsculas (ej: "alejandro", "sofia", "mama", "suegro") para los demás personajes.'
            },
            text: {
              type: 'STRING',
              description: 'El diálogo corto hablado por el personaje (máximo 25 palabras por intervención). Debe ser fluido.'
            },
            gender: {
              type: 'STRING',
              enum: ['male', 'female'],
              description: 'Género de la voz del personaje.'
            }
          },
          required: ['role', 'text', 'gender']
        }
      },
      gender: {
        type: 'STRING',
        enum: ['male', 'female'],
        description: 'Género de la protagonista principal (narrator).'
      }
    },
    required: ['title', 'dialogues', 'gender']
  } : {
    type: 'OBJECT',
    properties: {
      title: {
        type: 'STRING',
        description: 'Un título corto, extremadamente llamativo e intrigante de la historia de Reddit (máximo 15 palabras).'
      },
      content: {
        type: 'STRING',
        description: 'El cuerpo de la historia. Debe estar redactado en primera persona de manera fluida, natural, interesante y cautivadora, listo para ser convertido a audio sin marcas raras ni emojis (excepto puntuación normal).'
      },
      gender: {
        type: 'STRING',
        enum: ['male', 'female'],
        description: 'Clasificación de género del narrador de la historia. Si es un hombre contando (menciona "mi esposa", "mi novia", etc.) usa "male". Si es una mujer contando (menciona "mi novio", "mi esposo", etc.) usa "female". Si es neutral o ambiguo, asigna el género que mejor encaje dramáticamente.'
      }
    },
    required: ['title', 'content', 'gender']
  };

  const promptCompleto = `
Genera una historia única basada en el siguiente tema o prompt:
"${userPrompt}"

Reglas estrictas de redacción:
- Debe parecer una publicación real de Reddit en foros como r/nosleep, r/confessions, o r/AskReddit.
- Empieza directamente con el relato, sin introducciones decorativas como "Aquí tienes tu historia".
- Evita caracteres especiales extraños o emojis, ya que esto será leído por un sintetizador de voz (TTS).
`;

  const maxAttempts = (parseInt(primaryAttempts) || 2) + (parseInt(fallbackAttempts) || 3);
  let attempt = 0;
  const delay = 5000; // Retardo constante de 5 segundos para reintentos

  while (attempt < maxAttempts) {
    attempt++;
    const currentKey = keys[keyIndex % keys.length];
    console.log(`[Gemini] Intento de generación ${attempt}/${maxAttempts} usando el modelo: ${activeModel} (Clave API #${(keyIndex % keys.length) + 1}/${keys.length})`);
    const ai = new GoogleGenerativeAI(currentKey);
    
    try {
      const model = ai.getGenerativeModel({
        model: activeModel,
        systemInstruction: systemPrompt
      });

      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('TIMEOUT: La solicitud a Gemini superó el límite de 60 segundos.'));
        }, 60000);
      });

      let result;
      try {
        const generatePromise = model.generateContent({
          contents: [{ role: 'user', parts: [{ text: promptCompleto }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.9
          }
        });
        result = await Promise.race([generatePromise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }

      let responseText = result.response.text();
      console.log('Respuesta cruda de Gemini:', responseText);
      
      // Sanitizar la respuesta en caso de que Gemini añada bloques de código markdown
      if (responseText.includes('```')) {
        responseText = responseText.replace(/```json|```/g, '').trim();
      }
      
      const storyData = JSON.parse(responseText);
      
      if (!storyData.title || (!storyData.content && !storyData.dialogues) || !storyData.gender) {
        throw new Error('La respuesta de Gemini no coincide con el esquema requerido.');
      }
      
      const fixSpelling = (str) => {
        if (typeof str !== 'string') return str;
        return str
          .replace(/\banos\b/g, 'años')
          .replace(/\bAnos\b/g, 'Años')
          .replace(/\bANOS\b/g, 'AÑOS');
      };

      if (storyData.title) storyData.title = fixSpelling(storyData.title);
      if (storyData.content) storyData.content = fixSpelling(storyData.content);
      if (Array.isArray(storyData.dialogues)) {
        storyData.dialogues = storyData.dialogues.map(d => ({
          ...d,
          text: fixSpelling(d.text)
        }));
      }

      return storyData;
    } catch (error) {
      console.error(`[Gemini] Error en intento ${attempt}:`, error.message || error);

      // Si es el último intento, lanzamos el error
      if (attempt >= maxAttempts) {
        throw error;
      }

      // Identificar si el error es definitivamente de autenticación o de API Key inválida/no activa
      const isAuthError = (error.status === 400 && error.message && error.message.includes('API key')) ||
        (error.message && (
          error.message.includes('API key not valid') ||
          error.message.includes('invalid API key') ||
          error.message.includes('expired') ||
          error.message.includes('key not active')
        ));

      const isQuotaError = (error.status === 429) || 
        (error.message && (
          error.message.includes('429') ||
          error.message.includes('RESOURCE_EXHAUSTED') ||
          error.message.includes('Quota exceeded') ||
          error.message.includes('rate limit')
        ));

      const isServiceUnavailable = (error.status === 503) ||
        (error.message && (
          error.message.includes('503') ||
          error.message.includes('Service Unavailable') ||
          error.message.includes('high demand') ||
          error.message.includes('overloaded') ||
          error.message.includes('temporary spike')
        ));

      const isTimeoutError = (error.message && (
        error.message.includes('TIMEOUT') ||
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT')
      ));

      const isModelNotFoundError = (error.status === 404) ||
        (error.message && (
          error.message.includes('404') ||
          error.message.includes('not found') ||
          error.message.includes('not supported')
        ));

      // ROTACIÓN DE CLAVES API
      if (isQuotaError || isServiceUnavailable || isTimeoutError || isAuthError) {
        if (keyIndex + 1 < keys.length) {
          keyIndex++;
          console.log(`[Gemini] Error crítico/cuota/autenticación detectado con la clave actual. Rotando a la clave API #${keyIndex + 1} de ${keys.length}...`);
          attempt--; // No contar esta rotación de clave como un intento fallido del modelo
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        } else {
          // Si ya probamos todas las claves para este modelo, reiniciamos el índice de clave para el modelo de fallback
          keyIndex = 0;
        }
      }

      // Si es un error de autenticación y ya no tenemos más claves para probar, lanzamos el error inmediatamente
      if (isAuthError) {
        throw error;
      }

      // Todos los demás errores transitorios son procesados aquí
      if (isQuotaError || isServiceUnavailable || isModelNotFoundError || isTimeoutError) {
        // Registrar el error crítico y marcar el modelo actual como agotado/sobrecargado
        const errorType = isQuotaError 
          ? '429 (Cuota Agotada)' 
          : (isServiceUnavailable 
            ? '503 (Servicio Sobrecargado)' 
            : (isModelNotFoundError 
              ? '404 (Modelo no Encontrado)' 
              : 'TIMEOUT (Tiempo de Espera Agotado)'));
        console.log(`[Gemini] Error crítico tipo ${errorType} para el modelo: ${activeModel}`);
        markModelAsExhausted(activeModel);

        // Cambiar inmediatamente al siguiente modelo alternativo de la lista
        const oldModel = activeModel;
        const nextModel = getNextAvailableModel(activeModel);
        console.log(`[Gemini] Aplicando fallback inmediato a: ${nextModel}`);
        activeModel = nextModel;

        // Si el modelo cambió con éxito, reintentamos de inmediato sin esperar el retardo largo
        if (activeModel !== oldModel) {
          console.log(`[Gemini] Reintentando generación inmediatamente con el modelo de respaldo: ${activeModel}`);
          await new Promise(resolve => setTimeout(resolve, 200));
          continue;
        }
      } else {
        // Si seguimos fallando por otros errores transitorios (ej: JSON inválido, etc.), después de los intentos principales cambiamos al modelo de fallback
        const switchAttempt = (parseInt(primaryAttempts) || 2) + 1;
        if (attempt === switchAttempt) {
          const nextModel = getNextAvailableModel(activeModel);
          console.log(`[Gemini] Se agotaron los ${primaryAttempts} intentos con el modelo activo. Aplicando fallback automático a: ${nextModel}`);
          activeModel = nextModel;
        }
      }

      const currentDelay = delay;
      console.log(`[Gemini] Error transitorio detectado. Reintentando en ${currentDelay / 1000} segundos...`);
      
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
  }
}

module.exports = {
  generateStory
};

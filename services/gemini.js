const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

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

// Mapa dinámico en memoria para registrar API Keys agotadas por límite de cuota (429 / ResourceExhausted)
const exhaustedKeys = new Map(); // apiKey -> expiryTimestamp

function markKeyAsExhausted(key, durationMs = 15 * 60 * 1000) {
  const maskedKey = key && key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : '****';
  console.log(`[Gemini] ⚠️ API Key (${maskedKey}) marcada como agotada por cuota (429) por ${durationMs / 60000} minutos.`);
  exhaustedKeys.set(key, Date.now() + durationMs);
}

function isKeyExhausted(key) {
  if (!exhaustedKeys.has(key)) return false;
  const expiry = exhaustedKeys.get(key);
  if (Date.now() > expiry) {
    exhaustedKeys.delete(key);
    return false;
  }
  return true;
}

/**
 * Consulta en tiempo real los modelos oficiales de Google disponibles para la clave API provista.
 */
async function listAvailableModels(apiKey) {
  const keys = [];
  if (Array.isArray(apiKey)) {
    keys.push(...apiKey.filter(k => k && k.trim()));
  } else if (typeof apiKey === 'string' && apiKey.trim()) {
    keys.push(...apiKey.split(/\r?\n|,/).map(k => k.trim()).filter(Boolean));
  }

  const defaultGuaranteed = [
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' }
  ];

  if (keys.length === 0) return defaultGuaranteed;

  const keyToTest = keys.find(k => !isKeyExhausted(k)) || keys[0];
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${keyToTest}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.models && Array.isArray(data.models)) {
      const filtered = data.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => {
          const rawId = m.name.replace(/^models\//, '');
          return {
            id: rawId,
            name: m.displayName || rawId,
            description: m.description || ''
          };
        });
      if (filtered.length > 0) return filtered;
    }
  } catch (err) {
    console.warn('[Gemini] No se pudo consultar la lista en vivo de modelos:', err.message);
  }

  return defaultGuaranteed;
}

/**
 * Intenta reparar y parsear JSON truncado o con artefactos de LLMs (self-healing parser)
 */
function repairAndParseJson(rawText) {
  let cleaned = (rawText || '').trim();
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
  }

  // 1. Intentar parseo directo
  try {
    return JSON.parse(cleaned);
  } catch (initialErr) {
    // 2. Intentar reparar si fue cortado a mitad de camino
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace === -1) throw initialErr;
    let textToFix = cleaned.substring(firstBrace);

    let inString = false;
    let escaped = false;
    let openBraces = 0;
    let openBrackets = 0;

    for (let i = 0; i < textToFix.length; i++) {
      const char = textToFix[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') openBraces++;
        else if (char === '}') openBraces--;
        else if (char === '[') openBrackets++;
        else if (char === ']') openBrackets--;
      }
    }

    let repaired = textToFix;
    if (inString) {
      repaired += '"'; // Cerrar comilla abierta
    }
    while (openBrackets > 0) {
      repaired += ']';
      openBrackets--;
    }
    while (openBraces > 0) {
      repaired += '}';
      openBraces--;
    }

    try {
      const parsed = JSON.parse(repaired);
      console.log('[Gemini] 🛠️ JSON truncado reparado exitosamente por self-healing parser');
      return parsed;
    } catch (secondErr) {
      throw initialErr;
    }
  }
}

/**
 * Genera una historia estructurada de Reddit basada en el prompt del usuario
 */
async function generateStory(
  apiKey,
  modelName,
  userPrompt,
  systemPrompt,
  primaryAttempts = 2,
  fallbackAttempts = 3,
  customFallbackModels = 'gemini-3.5-flash-lite, gemini-3.1-flash-lite',
  maxOutputTokens = 8192,
  onLog = null
) {
  if (!apiKey) {
    throw new Error('API Key de Gemini no proporcionada. Por favor, configúrala en Ajustes.');
  }

  const rawKeys = [];
  if (Array.isArray(apiKey)) {
    rawKeys.push(...apiKey.filter(k => k && k.trim()));
  } else if (typeof apiKey === 'string' && apiKey.trim()) {
    rawKeys.push(...apiKey.split(/\r?\n|,/).map(k => k.trim()).filter(Boolean));
  }

  if (rawKeys.length === 0) {
    throw new Error('API Key de Gemini no proporcionada o vacía. Por favor, configúrala en Ajustes.');
  }

  // Ordenar priorizando las claves que NO estén en cooldown por cuota (429)
  const freshKeys = rawKeys.filter(k => !isKeyExhausted(k));
  const keys = freshKeys.length > 0 ? freshKeys : rawKeys;

  let keyIndex = 0;
  
  // Inicializamos el cliente
  // NOTA IMPORTANTE PARA EL USUARIO:
  // Si deseas actualizar el prompt del sistema o entender cómo funciona la detección de género:
  // 1. Mandamos al modelo un esquema estructurado (responseSchema) para evitar que retorne texto plano.
  // 2. Le pedimos explícitamente que analice pronombres y relaciones (ej: "mi novia" -> masculino, "mi esposo" -> femenino)
  //    para categorizar el género como "male" o "female".
  
  let activeModel = (modelName || 'gemini-3.7-flash').trim();
  if (activeModel.includes('2.5') || activeModel === 'gemini-flash-lite-latest') {
    activeModel = 'gemini-3.7-flash';
  }
  
  // Normalizar la lista de modelos de prioridad secuencial
  let rawFallbackList = [];
  if (Array.isArray(customFallbackModels)) {
    rawFallbackList = customFallbackModels;
  } else if (typeof customFallbackModels === 'string' && customFallbackModels.trim()) {
    rawFallbackList = customFallbackModels.split(/\r?\n|,/).map(m => m.trim()).filter(Boolean);
  }

  const fallbackModels = rawFallbackList
    .filter(Boolean)
    .map(model => {
      let m = (model || '').trim();
      if (m === 'gemini-1.5-flash') return 'gemini-3.5-flash';
      if (m === 'gemini-3-flash') return 'gemini-3-flash-preview';
      if (m === 'gemini-3.1-flash') return 'gemini-3.1-flash-lite';
      if (m === 'gemini-3.7') return 'gemini-3.7-flash';
      if (m === 'gemini-3.8') return 'gemini-3.8-flash';
      return m;
    })
    .filter(m => !m.includes('2.5') && m !== 'gemini-flash-lite-latest');

  // Lista de modelos garantizados oficiales con nombres normales
  const guaranteedModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview'];
  guaranteedModels.forEach(m => {
    if (!fallbackModels.includes(m)) fallbackModels.push(m);
  });

  // Normalizar nombre del modelo activo si viene con alias antiguo
  if (activeModel === 'gemini-1.5-flash') {
    activeModel = 'gemini-3.5-flash';
  } else if (activeModel === 'gemini-3-flash') {
    activeModel = 'gemini-3-flash-preview';
  } else if (activeModel === 'gemini-3.1-flash') {
    activeModel = 'gemini-3.1-flash-lite';
  } else if (activeModel === 'gemini-3.5-lite') {
    activeModel = 'gemini-3.5-flash-lite';
  } else if (activeModel === 'gemini-3.7') {
    activeModel = 'gemini-3.7-flash';
  } else if (activeModel === 'gemini-3.8') {
    activeModel = 'gemini-3.8-flash';
  }

  // Helper para buscar el siguiente modelo disponible de la lista que no esté agotado
  function getNextAvailableModel(currentModel) {
    // 1. Buscar en fallbackModels configurados
    for (const model of fallbackModels) {
      if (!isModelExhausted(model) && model !== currentModel) {
        return model;
      }
    }
    // 2. Probar en modelos garantizados
    for (const model of ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview']) {
      if (!isModelExhausted(model) && model !== currentModel) {
        return model;
      }
    }
    // 3. Devolver cualquiera que sea DIFERENTE al modelo actual
    for (const model of ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']) {
      if (model !== currentModel) return model;
    }
    return currentModel === 'gemini-3.8-flash' ? 'gemini-3.5-flash-lite' : 'gemini-3.8-flash';
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
        description: 'El cuerpo de la historia completa. Debe estar redactado en primera persona de manera fluida, natural y con amplio desarrollo dramático, respetando estrictamente la meta de palabras y extensión especificada en las instrucciones del sistema, listo para ser convertido a audio sin marcas raras ni emojis (excepto puntuación normal).'
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
- REQUISITO CRÍTICO DE EXTENSIÓN: Desarrolla el relato con máxima minuciosidad y progresión dramática, detallando los acontecimientos día a día, las confrontaciones y los giros para cumplir rigurosamente con la meta de palabras indicada en tus instrucciones del sistema. No resumas ni apresures el desenlace; desglosa los hechos con la amplitud necesaria para alcanzar la extensión completa requerida.
`;

  const maxAttempts = (parseInt(primaryAttempts) || 2) + (parseInt(fallbackAttempts) || 3);
  let attempt = 0;
  let currentMaxTokens = Math.max(parseInt(maxOutputTokens) || 8192, 8192);
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  let isSafetyRetry = false;

  while (attempt < maxAttempts) {
    attempt++;
    const currentKey = keys[keyIndex % keys.length];
    console.log(`[Gemini] Intento de generación ${attempt}/${maxAttempts} usando el modelo: ${activeModel} (Clave API #${(keyIndex % keys.length) + 1}/${keys.length})`);
    const ai = new GoogleGenerativeAI(currentKey);
    
    try {
      const model = ai.getGenerativeModel({
        model: activeModel,
        systemInstruction: systemPrompt,
        safetySettings
      });

      let promptToSend = promptCompleto;
      if (isSafetyRetry) {
        promptToSend += `\n\n[AVISO DE POLÍTICAS]: Asegúrate de adaptar cualquier elemento de conflicto o tensión para que cumpla con los lineamientos comunitarios (evita autolesiones, violencia gráfica o lenguaje prohibido) manteniendo el suspenso y la intriga.`;
      }

      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('TIMEOUT: La solicitud a Gemini superó el límite de 90 segundos.'));
        }, 90000);
      });

      let result;
      try {
        const generatePromise = model.generateContent({
          contents: [{ role: 'user', parts: [{ text: promptToSend }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.9,
            maxOutputTokens: currentMaxTokens
          },
          safetySettings
        });
        result = await Promise.race([generatePromise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }

      const candidate = result.response?.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (finishReason === 'MAX_TOKENS') {
        const nextTokens = Math.min(currentMaxTokens * 2, 16384);
        console.warn(`[Gemini] ⚠️ Respuesta truncada por límite de tokens (MAX_TOKENS) con ${currentMaxTokens}. Aumentando a ${nextTokens}...`);
        if (typeof onLog === 'function') {
          onLog(`⚠️ Historia truncada por límite de tokens. Aumentando límite de tokens a ${nextTokens} y reintentando...`);
        }
        currentMaxTokens = nextTokens;
        throw new Error(`TOKEN_LIMIT_EXCEEDED: Generación truncada por límite de tokens (${currentMaxTokens})`);
      }

      if (finishReason === 'SAFETY') {
        throw new Error(`Contenido bloqueado por filtros de seguridad de Gemini (${finishReason})`);
      }

      let responseText = '';
      try {
        responseText = result.response.text();
      } catch (textErr) {
        const blockReason = result.response?.promptFeedback?.blockReason;
        throw new Error(`Contenido bloqueado por filtros de seguridad de Gemini (${finishReason || blockReason || textErr.message})`);
      }

      console.log('Respuesta cruda de Gemini (extracto):', responseText.length > 250 ? responseText.substring(0, 250) + '...' : responseText);
      
      const storyData = repairAndParseJson(responseText);
      
      if (!storyData.title || (!storyData.content && !storyData.dialogues) || !storyData.gender) {
        throw new Error('La respuesta de Gemini no coincide con el esquema requerido o quedó incompleta.');
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

      // Log amigable y limpio según la respuesta de Google
      if (isQuotaError) {
        console.log(`[Gemini] ℹ️ Cuota de Google para "${activeModel}" alcanzada (Límite 429).`);
      } else if (isServiceUnavailable) {
        console.log(`[Gemini] ℹ️ Modelo "${activeModel}" con alta demanda en Google (503).`);
      } else if (isTimeoutError) {
        console.log(`[Gemini] ℹ️ Tiempo de espera agotado para "${activeModel}".`);
      } else {
        console.warn(`[Gemini] Aviso en intento ${attempt}:`, (error.message || '').substring(0, 120));
      }

      // Si es el último intento, lanzamos el error
      if (attempt >= maxAttempts) {
        throw error;
      }

      const isTokenLimit = (error.message && (
        error.message.includes('TOKEN_LIMIT_EXCEEDED') ||
        error.message.includes('Unterminated string') ||
        error.message.includes('Unexpected end of JSON') ||
        error.message.includes('incompleta')
      ));

      if (isTokenLimit) {
        const nextTokens = Math.min(Math.max(currentMaxTokens * 2, 8192), 16384);
        console.log(`[Gemini] ⚠️ Generación incompleta o truncada (${currentMaxTokens} tokens). Ajustando a ${nextTokens} tokens y reintentando de inmediato...`);
        if (typeof onLog === 'function') {
          onLog(`⚠️ Generación incompleta. Ajustando automáticamente a ${nextTokens} tokens y reintentando...`);
        }
        currentMaxTokens = nextTokens;
        await new Promise(resolve => setTimeout(resolve, 800));
        continue;
      }

      // ROTACIÓN DE CLAVES API
      if (isQuotaError || isServiceUnavailable || isTimeoutError || isAuthError) {
        if (isQuotaError) {
          markKeyAsExhausted(currentKey, 15 * 60 * 1000);
          const masked = currentKey.length > 8 ? `${currentKey.substring(0, 4)}...${currentKey.substring(currentKey.length - 4)}` : '****';
          if (typeof onLog === 'function') {
            onLog(`⚠️ API Key (#${(keyIndex % keys.length) + 1} ${masked}) silenciada por cuota agotada (429).`);
          }
        }
        if (keyIndex + 1 < keys.length) {
          keyIndex++;
          const nextKey = keys[keyIndex % keys.length];
          const maskedNext = nextKey.length > 8 ? `${nextKey.substring(0, 4)}...${nextKey.substring(nextKey.length - 4)}` : '****';
          console.log(`[Gemini] 🔑 Rotando a la clave API #${keyIndex + 1} de ${keys.length} (${maskedNext})...`);
          if (typeof onLog === 'function') {
            onLog(`🔑 Rotando automáticamente a la clave API #${keyIndex + 1} de ${keys.length}...`);
          }
          attempt--; // No contar esta rotación de clave como un intento fallido del modelo
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        } else {
          // Si ya probamos todas las claves para este modelo, reiniciamos el índice de clave para el modelo de fallback
          keyIndex = 0;
        }
      }

      const isSafetyError = (error.message && (
        error.message.includes('SAFETY') ||
        error.message.includes('filtros de seguridad') ||
        error.message.includes('blockReason') ||
        error.message.includes('blocked due to')
      ));

      if (isSafetyError) {
        isSafetyRetry = true;
        console.log('[Gemini] Filtro de seguridad activado por temática. Suavizando contexto y probando modelo alternativo...');
        const nextModel = getNextAvailableModel(activeModel);
        activeModel = nextModel;
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Si es un error de autenticación y ya no tenemos más claves para probar, lanzamos el error inmediatamente
      if (isAuthError) {
        throw error;
      }

      // Fallback a modelo alternativo
      if (isQuotaError || isServiceUnavailable || isModelNotFoundError || isTimeoutError) {
        markModelAsExhausted(activeModel);

        // Cambiar inmediatamente al siguiente modelo alternativo de la lista
        const oldModel = activeModel;
        const nextModel = getNextAvailableModel(activeModel);
        console.log(`[Gemini] 🔄 Cambiando automáticamente al modelo de respaldo: ${nextModel}`);
        activeModel = nextModel;

        // Si el modelo cambió con éxito, reintentamos de inmediato sin esperar el retardo largo
        if (activeModel !== oldModel) {
          keyIndex = 0; // Iniciar desde la primera clave con el nuevo modelo
          console.log(`[Gemini] ▶️ Generando historia con el modelo de respaldo: ${activeModel}...`);
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

      // Backoff exponencial con jitter dinámico para recuperación óptima
      const baseDelay = 1500;
      const maxDelay = 8000;
      const jitter = Math.floor(Math.random() * 500);
      const currentDelay = Math.min(baseDelay * Math.pow(1.8, Math.max(0, attempt - 1)), maxDelay) + jitter;
      console.log(`[Gemini] Reintentando en ${(currentDelay / 1000).toFixed(1)} segundos (Backoff exponencial + jitter)...`);
      
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
  }
}

module.exports = {
  generateStory,
  listAvailableModels,
  markModelAsExhausted,
  isModelExhausted,
  markKeyAsExhausted,
  isKeyExhausted,
  exhaustedKeys,
  exhaustedModels
};

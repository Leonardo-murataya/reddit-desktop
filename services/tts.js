const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { execSync } = require('child_process');
const ffprobe = require('ffprobe-static');
const ffmpegStatic = require('ffmpeg-static');

/**
 * Obtiene la duración exacta de un archivo de audio usando ffprobe.
 * @param {string} filePath - Ruta del archivo
 * @returns {number} Duración en segundos
 */
function getAudioDuration(filePath) {
  try {
    const cmd = `"${ffprobe.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const output = execSync(cmd, { encoding: 'utf8' }).trim();
    const duration = parseFloat(output);
    return isNaN(duration) ? 0 : duration;
  } catch (error) {
    console.error(`Error al obtener duración de audio para ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * Divide un texto en fragmentos (chunks) respetando los límites de oraciones.
 * @param {string} text - Texto completo
 * @param {number} maxChunkLength - Límite de caracteres por fragmento
 * @returns {Array<string>} Fragmentos de texto
 */
function splitTextIntoChunks(text, maxChunkLength = 4000) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkLength) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Genera el audio para un texto dado y extrae los metadatos de sincronización de palabras (timestamps).
 * Segmenta textos muy largos para evitar cortes en WebSocket de la API de Edge TTS.
 * @param {string} text - El texto a convertir a voz
 * @param {string} voice - Nombre de la voz de Edge TTS (ej. es-MX-JorgeNeural)
 * @param {string} outputAudioPath - Ruta del archivo MP3 de salida
 * @param {object} options - Opciones de velocidad (rate) y tono (pitch)
 * @returns {Promise<Array<{word: string, start: number, end: number, duration: number}>>}
 */
async function generateSpeechAndTimestamps(text, voice, outputAudioPath, options = {}) {
  const { EdgeTTS } = require('@andresaya/edge-tts');
  
  // Auto-corregir erratas comunes de ortografía (ej. 'anos' -> 'años') para que la locución no diga 'anos'
  const cleanText = (text || '')
    .replace(/\banos\b/g, 'años')
    .replace(/\bAnos\b/g, 'Años')
    .replace(/\bANOS\b/g, 'AÑOS');

  // Creamos la carpeta contenedora del audio si no existe
  const dir = path.dirname(outputAudioPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const chunks = splitTextIntoChunks(cleanText, 1000);
  console.log(`[TTS] Texto de longitud ${text.length} dividido en ${chunks.length} fragmentos para síntesis segura.`);

  const synthesisOptions = {
    rate: options.voiceRate || options.rate || '100%', // e.g. '+0%', '+10%'
    pitch: options.pitch || '0Hz' // e.g. '+0Hz'
  };

  const partAudioPaths = [];
  const allWords = [];
  let accumulatedDuration = 0;

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const partFilename = `part_${i}_${uuidv4().substring(0, 8)}.mp3`;
      const partAudioPath = path.join(dir, partFilename);
      
      let success = false;
      let attempts = 0;
      const maxAttempts = 4;
      let ttsInstance = null;
      let rawBoundaries = [];
      let partDuration = 0;

      while (!success && attempts < maxAttempts) {
        attempts++;
        try {
          console.log(`[TTS] Sintetizando fragmento ${i + 1}/${chunks.length} (${chunk.length} caracteres) - Intento ${attempts}/${maxAttempts}...`);
          ttsInstance = new EdgeTTS();
          await ttsInstance.synthesize(chunk, voice, synthesisOptions);
          
          let savePath = partAudioPath;
          if (savePath.toLowerCase().endsWith('.mp3')) {
            savePath = savePath.substring(0, savePath.length - 4);
          }
          await ttsInstance.toFile(savePath);
          
          // Esperar a que el archivo de audio esté completamente escrito y listo en disco
          const ready = await waitForFileToBeReady(partAudioPath);
          if (!ready) {
            throw new Error("El archivo de audio temporal no se escribió completamente a tiempo.");
          }

          // Obtener la duración exacta física del fragmento de audio temporal
          partDuration = getAudioDuration(partAudioPath);
          if (partDuration <= 0) {
            throw new Error("El archivo de audio temporal tiene una duración física inválida o cero.");
          }

          // Obtener los límites de palabra (Word Boundaries) ordenados explícitamente
          rawBoundaries = (ttsInstance.getWordBoundaries() || []).sort((a, b) => {
            const offsetA = a.offset !== undefined ? a.offset : a.audioOffset;
            const offsetB = b.offset !== undefined ? b.offset : b.audioOffset;
            return offsetA - offsetB;
          });

          // Validar que el audio no esté recortado/incompleto comparando palabras
          const expectedWordCount = chunk.split(/\s+/).filter(w => w.trim()).length;
          const actualWordCount = rawBoundaries.length;
          if (expectedWordCount > 10 && actualWordCount < expectedWordCount * 0.80) {
            throw new Error(`La síntesis se cortó de forma prematura. Palabras en texto: ${expectedWordCount}, palabras en audio: ${actualWordCount}.`);
          }

          success = true;
        } catch (attemptError) {
          console.warn(`[TTS] Intento ${attempts}/${maxAttempts} de síntesis falló:`, attemptError.message);
          
          // Limpiar archivo parcial si existe
          if (fs.existsSync(partAudioPath)) {
            try { fs.unlinkSync(partAudioPath); } catch (e) {}
          }

          if (attempts >= maxAttempts) {
            throw new Error(`Edge TTS falló tras ${maxAttempts} intentos para el fragmento ${i + 1}: ${attemptError.message}`);
          }

          // Espera exponencial
          const delay = attempts * 3000;
          console.log(`[TTS] Esperando ${delay}ms antes de reintentar fragmento...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }

      partAudioPaths.push(partAudioPath);
      
      const scaleFactor = 1.0;
      console.log(`[TTS] Marcas de tiempo procesadas para el fragmento ${i + 1} (Duración física: ${partDuration.toFixed(2)}s)`);

      const chunkWords = rawBoundaries.map((b) => {
        const rawOffset = b.offset !== undefined ? b.offset : b.audioOffset;
        const normalStart = rawOffset / 10000000;
        const normalDuration = b.duration / 10000000;

        // Escalar inicios y duraciones según la velocidad real del audio físico
        const startSec = (normalStart * scaleFactor) + accumulatedDuration;
        const durationSec = normalDuration * scaleFactor;
        const endSec = startSec + durationSec;

        return {
          word: b.text,
          start: Number(startSec.toFixed(3)),
          end: Number(endSec.toFixed(3)),
          duration: Number(durationSec.toFixed(3))
        };
      });
      allWords.push(...chunkWords);

      // Incrementar el acumulado con la duración física real para el siguiente fragmento
      accumulatedDuration += partDuration;
    }

    // Concatenar todos los audios generados si hay más de un fragmento
    if (partAudioPaths.length > 1) {
      console.log(`[TTS] Concatenando ${partAudioPaths.length} fragmentos de audio a: ${outputAudioPath}`);
      const concatListPath = path.join(dir, `concat_${uuidv4().substring(0, 8)}.txt`);
      const fileEntries = partAudioPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(concatListPath, fileEntries, 'utf8');

      // Ejecutar ffmpeg para concatenar re-codificando a MP3 de alta fidelidad, uniendo PCM continuo y eliminando delays de decodificación
      const cmd = `"${ffmpegStatic}" -y -f concat -safe 0 -i "${concatListPath}" -c:a libmp3lame -b:a 192k "${outputAudioPath}"`;
      execSync(cmd, { stdio: 'ignore' });

      // Limpieza de archivos temporales
      fs.unlinkSync(concatListPath);
      for (const partPath of partAudioPaths) {
        if (fs.existsSync(partPath)) {
          fs.unlinkSync(partPath);
        }
      }
    } else if (partAudioPaths.length === 1) {
      // Si solo hay un fragmento, simplemente lo movemos/renombramos a la ruta de salida definitiva
      if (fs.existsSync(outputAudioPath)) {
        fs.unlinkSync(outputAudioPath);
      }
      fs.renameSync(partAudioPaths[0], outputAudioPath);
    }

    console.log(`[TTS] Síntesis de voz finalizada con éxito. Duración total: ${accumulatedDuration.toFixed(2)}s. Timestamps extraídos: ${allWords.length}`);
    return allWords;

  } catch (error) {
    console.error('Error en la síntesis de Edge TTS fragmentada:', error);
    // Limpieza en caso de error
    for (const partPath of partAudioPaths) {
      try {
        if (fs.existsSync(partPath)) {
          fs.unlinkSync(partPath);
        }
      } catch (e) {
        // Ignorar
      }
    }
    throw error;
  }
}

/**
 * Espera a que un archivo de audio esté completamente escrito y cerrado en el disco.
 * Verifica que el archivo exista, su tamaño sea mayor a 0 y que el tamaño se haya estabilizado (sin cambios).
 * @param {string} filePath - Ruta absoluta del archivo
 * @param {number} timeoutMs - Tiempo de espera máximo en milisegundos
 * @returns {Promise<boolean>} Retorna true si el archivo está listo, false si expiró el tiempo de espera
 */
function waitForFileToBeReady(filePath, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let lastSize = -1;
    let stableCount = 0;

    const interval = setInterval(() => {
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          const currentSize = stats.size;

          if (currentSize > 0) {
            if (currentSize === lastSize) {
              stableCount++;
              // Si el tamaño permanece constante durante 3 ciclos (300ms), está completamente escrito
              if (stableCount >= 3) {
                clearInterval(interval);
                resolve(true);
                return;
              }
            } else {
              lastSize = currentSize;
              stableCount = 0; // Se reinicia el contador de estabilidad
            }
          }
        }
      } catch (err) {
        stableCount = 0;
      }

      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        console.warn(`[TTS] Límite de tiempo alcanzado esperando estabilidad de: ${path.basename(filePath)}`);
        resolve(false);
      }
    }, 100);
  });
}

/**
 * Concatena una lista de archivos de audio MP3 en un único archivo de salida.
 * @param {Array<string>} filePaths - Array de rutas a archivos de audio locales
 * @param {string} outputPath - Ruta del archivo final concatenado
 */
function concatAudioFiles(filePaths, outputPath) {
  if (filePaths.length === 0) return;
  const dir = path.dirname(outputPath);
  
  if (filePaths.length > 1) {
    const concatListPath = path.join(dir, `concat_${uuidv4().substring(0, 8)}.txt`);
    const fileEntries = filePaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, fileEntries, 'utf8');

    const cmd = `"${ffmpegStatic}" -y -f concat -safe 0 -i "${concatListPath}" -c:a libmp3lame -b:a 192k "${outputPath}"`;
    execSync(cmd, { stdio: 'ignore' });

    // Limpieza de archivos temporales
    fs.unlinkSync(concatListPath);
    for (const partPath of filePaths) {
      if (fs.existsSync(partPath)) {
        try { fs.unlinkSync(partPath); } catch (e) {}
      }
    }
  } else if (filePaths.length === 1) {
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch (e) {}
    }
    fs.renameSync(filePaths[0], outputPath);
  }
}

module.exports = {
  generateSpeechAndTimestamps,
  concatAudioFiles
};

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const gpu = require('./gpuDetector');

/**
 * Compila el video completo usando FFmpeg combinando fondo, card, audios y subtítulos.
 * @param {object} params - Parámetros de renderizado
 * @param {Array<{path: string, start: number, duration: number}>} params.backgroundSegments - Trozos de video de fondo
 * @param {string} params.cardImagePath - Imagen PNG del card de Reddit
 * @param {string} params.titleAudioPath - Audio MP3 del título
 * @param {string} params.bodyAudioPath - Audio MP3 del cuerpo
 * @param {string} params.assSubtitlesPath - Ruta del archivo .ass de subtítulos
 * @param {number} params.titleDuration - Duración del audio de título en segundos
 * @param {number} params.totalDuration - Duración total de los audios combinados en segundos
 * @param {string} params.outputPath - Ruta del video MP4 final
 * @param {function} params.onProgress - Callback para reportar el porcentaje de avance (0 a 100)
 * @returns {Promise<string>} Ruta del archivo compilado
 */
async function compileVideo(params, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const {
      backgroundSegments,
      cardImagePath,
      titleAudioPath,
      bodyAudioPath,
      assSubtitlesPath,
      titleDuration,
      totalDuration,
      outputPath,
      cardOffsetX = 0,
      cardOffsetY = 0,
      cardScale = 1.0,
      cardOffsetX_16_9 = 0,
      cardOffsetY_16_9 = 0,
      cardScale_16_9 = 1.0,
      aspectRatio = '9:16',
      cardEntryAnimation = 'none',
      cardExitAnimation = 'none',
      cardEntryDuration = 0.4,
      cardExitDuration = 0.4,
      renderEngine = 'auto',
      musicEnabled = false,
      musicFile = '',
      musicVolume = -20,
      watermarkEnabled = false,
      watermarkType = 'text',
      watermarkImageFile = '',
      watermarkImageScale = 0.15,
      watermarkImageOpacity = 0.5,
      watermarkImageAlignment = 9,
      watermarkImageOffsetX = 20,
      watermarkImageOffsetY = 20
    } = params;

    const activeCardOffsetX = aspectRatio === '16:9' ? (params.cardOffsetX_16_9 !== undefined ? params.cardOffsetX_16_9 : 0) : cardOffsetX;
    const activeCardOffsetY = aspectRatio === '16:9' ? (params.cardOffsetY_16_9 !== undefined ? params.cardOffsetY_16_9 : 0) : cardOffsetY;
    const activeCardScale = aspectRatio === '16:9' ? (params.cardScale_16_9 !== undefined ? params.cardScale_16_9 : 1.0) : cardScale;

    // Asegurar directorio de salida
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Autodetectar hardware gráfico
    const autoHw = gpu.detectHardware();
    
    // Determinar códec de renderizado final
    let activeCodec = autoHw.codec;
    let activeHwaccel = autoHw.hwaccel;
    
    if (renderEngine && renderEngine !== 'auto') {
      if (renderEngine.startsWith('gpu:')) {
        const gpuName = renderEngine.substring(4);
        const mapped = gpu.getCodecForGpuName(gpuName);
        activeCodec = mapped.codec;
        activeHwaccel = mapped.hwaccel;
      } else {
        activeCodec = renderEngine;
        if (renderEngine === 'h264_nvenc') activeHwaccel = 'cuda';
        else if (renderEngine === 'h264_amf') activeHwaccel = 'd3d11va';
        else if (renderEngine === 'h264_qsv') activeHwaccel = 'qsv';
        else activeHwaccel = ''; // libx264
      }
    }

    // Construir los argumentos del comando FFmpeg
    const args = [];

    // 1. Agregar los segmentos de video de fondo como entradas
    for (const seg of backgroundSegments) {
      if (!fs.existsSync(seg.path)) {
        return reject(new Error(`El archivo de video de fondo no existe en este equipo:\n"${seg.path}"\nPor favor ve a "Ajustes de Ruta" o "Perfiles de IA" y selecciona tu propia carpeta de videos de fondo (.mp4).`));
      }
      args.push('-ss', seg.start.toString(), '-t', seg.duration.toString(), '-i', seg.path);
    }

    const S = backgroundSegments.length; // Índice de entradas posterior a los fondos

    // 2. Agregar la imagen o video animado del card de Reddit
    const isAnimatedCard = typeof cardImagePath === 'string' && (cardImagePath.endsWith('.gif') || cardImagePath.endsWith('.webm') || cardImagePath.endsWith('.mov'));
    if (isAnimatedCard) {
      args.push('-stream_loop', '-1', '-i', cardImagePath); // Entrada S (en bucle continuo)
    } else {
      args.push('-loop', '1', '-i', cardImagePath); // Entrada S
    }

    // 3. Agregar los audios
    args.push('-i', titleAudioPath); // Entrada S+1
    args.push('-i', bodyAudioPath);  // Entrada S+2

    const hasMusic = musicEnabled && musicFile && fs.existsSync(musicFile);
    if (hasMusic) {
      args.push('-stream_loop', '-1', '-i', musicFile); // Entrada S+3
    }

    let watermarkInputIdx = -1;
    let currentInputIdx = S + 3 + (hasMusic ? 1 : 0);
    const hasImgWatermark = watermarkEnabled && watermarkType === 'image' && watermarkImageFile && fs.existsSync(watermarkImageFile);
    if (hasImgWatermark) {
      args.push('-i', watermarkImageFile);
      watermarkInputIdx = currentInputIdx;
      currentInputIdx++;
    }

    // 4. Diseñar el filtro complejo (-filter_complex)
    let filterComplex = '';

    // A. Concatenar y recortar videos de fondo
    if (S > 1) {
      // Concatenamos los segmentos de fondo
      let concatInputs = '';
      for (let i = 0; i < S; i++) {
        concatInputs += `[${i}:v]`;
      }
      filterComplex += `${concatInputs}concat=n=${S}:v=1:a=0[v_bg_raw];`;
      // Recorte adaptativo inteligente e infalible
      if (aspectRatio === '16:9') {
        filterComplex += `[v_bg_raw]crop=w='if(gte(in_w/in_h, 16/9), in_h*16/9, in_w)':h='if(gte(in_w/in_h, 16/9), in_h, in_w*9/16)',scale=1920:1080:flags=bicubic[v_bg];`;
      } else {
        filterComplex += `[v_bg_raw]crop=w='if(gte(in_w/in_h, 9/16), in_h*9/16, in_w)':h='if(gte(in_w/in_h, 9/16), in_h, in_w*16/9)',scale=1080:1920:flags=bicubic[v_bg];`;
      }
    } else {
      // Un solo segmento: Recorte adaptativo inteligente e infalible
      if (aspectRatio === '16:9') {
        filterComplex += `[0:v]crop=w='if(gte(in_w/in_h, 16/9), in_h*16/9, in_w)':h='if(gte(in_w/in_h, 16/9), in_h, in_w*9/16)',scale=1920:1080:flags=bicubic[v_bg];`;
      } else {
        filterComplex += `[0:v]crop=w='if(gte(in_w/in_h, 9/16), in_h*9/16, in_w)':h='if(gte(in_w/in_h, 9/16), in_h, in_w*16/9)',scale=1080:1920:flags=bicubic[v_bg];`;
      }
    }

    // A2. Aplicar escalado del card inteligente (HD con flags=lanczos y h=-2 para garantizar alto divisible por 2)
    // El card original de Puppeteer es de ~1200px. Calculamos el ancho ideal según la orientación
    // para que quepa perfectamente sin desbordarse ni recortarse a los lados, usando el multiplicador de escala del usuario.
    const baseCardWidth = aspectRatio === '16:9'
      ? 1920 * 0.40 * activeCardScale  // ~768px de ancho en horizontal (40% de pantalla)
      : 1080 * 0.74 * activeCardScale; // ~800px de ancho en vertical (74% de pantalla)

    let cardInputLabel = '[card_scaled]';
    filterComplex += `[${S}:v]scale=w=${Math.round(baseCardWidth)}:h=-2:flags=bicubic[card_scaled];`;

    // B. Procesar animaciones del card (Fades de entrada y salida)
    let cardLabel = cardInputLabel;
    
    // Normalizar duraciones para evitar división por cero en fórmulas matemáticas de FFmpeg
    const safeEntryDuration = cardEntryDuration <= 0 ? 0.01 : cardEntryDuration;
    const safeExitDuration = cardExitDuration <= 0 ? 0.01 : cardExitDuration;

    // Aplicamos fade de entrada y/o salida según la animación elegida
    const hasFadeIn = cardEntryAnimation === 'fade-in' || cardEntryAnimation === 'zoom-in';
    const hasFadeOut = cardExitAnimation === 'fade-out' || cardExitAnimation === 'zoom-out';
    
    if (hasFadeIn && hasFadeOut) {
      filterComplex += `${cardInputLabel}fade=t=in:st=0:d=${safeEntryDuration}:alpha=1,fade=t=out:st=${titleDuration - safeExitDuration}:d=${safeExitDuration}:alpha=1[card_processed];`;
      cardLabel = '[card_processed]';
    } else if (hasFadeIn) {
      filterComplex += `${cardInputLabel}fade=t=in:st=0:d=${safeEntryDuration}:alpha=1[card_processed];`;
      cardLabel = '[card_processed]';
    } else if (hasFadeOut) {
      filterComplex += `${cardInputLabel}fade=t=out:st=${titleDuration - safeExitDuration}:d=${safeExitDuration}:alpha=1[card_processed];`;
      cardLabel = '[card_processed]';
    }

    // C. Calcular posicionamiento dinámico y animaciones de movimiento (Slide e Intro/Outro)
    let xExpr = `((W-w)/2)+${activeCardOffsetX}`;
    let yExpr = `((H-h)/2)+${activeCardOffsetY}`;

    // Animaciones de entrada (primeros safeEntryDuration segundos)
    let entryX = `((W-w)/2)+${activeCardOffsetX}`;
    let entryY = `((H-h)/2)+${activeCardOffsetY}`;

    if (cardEntryAnimation === 'slide-in-left') {
      entryX = `-w+(((W-w)/2)+${activeCardOffsetX}+w)*(t/${safeEntryDuration})`;
    } else if (cardEntryAnimation === 'slide-in-right') {
      entryX = `W-((W-(((W-w)/2)+${activeCardOffsetX}))*(t/${safeEntryDuration}))`;
    } else if (cardEntryAnimation === 'slide-in-bottom') {
      entryY = `H-((H-(((H-h)/2)+${activeCardOffsetY}))*(t/${safeEntryDuration}))`;
    } else if (cardEntryAnimation === 'slide-in-top') {
      entryY = `-h+(((H-h)/2)+${activeCardOffsetY}+h)*(t/${safeEntryDuration})`;
    } else if (cardEntryAnimation === 'zoom-in') {
      // Entrada elástica de zoom
      entryY = `((H-h)/2)+${activeCardOffsetY} - (60 * (1 - (t/${safeEntryDuration})))`;
    }

    // Animaciones de salida (últimos safeExitDuration segundos del titleDuration)
    let exitX = `((W-w)/2)+${activeCardOffsetX}`;
    let exitY = `((H-h)/2)+${activeCardOffsetY}`;
    const exitStartTime = `(${titleDuration}-${safeExitDuration})`;

    if (cardExitAnimation === 'slide-out-left') {
      exitX = `(((W-w)/2)+${activeCardOffsetX}) - w * ((t-${exitStartTime})/${safeExitDuration})`;
    } else if (cardExitAnimation === 'slide-out-right') {
      exitX = `(((W-w)/2)+${activeCardOffsetX}) + W * ((t-${exitStartTime})/${safeExitDuration})`;
    } else if (cardExitAnimation === 'slide-out-bottom') {
      exitY = `(((H-h)/2)+${activeCardOffsetY}) + H * ((t-${exitStartTime})/${safeExitDuration})`;
    } else if (cardExitAnimation === 'slide-out-top') {
      exitY = `(((H-h)/2)+${activeCardOffsetY}) - H * ((t-${exitStartTime})/${safeExitDuration})`;
    } else if (cardExitAnimation === 'zoom-out') {
      exitY = `(((H-h)/2)+${activeCardOffsetY}) + (60 * ((t-${exitStartTime})/${safeExitDuration}))`;
    }

    // Unimos los 3 estados: entrada, estático y salida
    xExpr = `if(lt(t,${safeEntryDuration}), ${entryX}, if(gt(t,${exitStartTime}), ${exitX}, ((W-w)/2)+${activeCardOffsetX}))`;
    yExpr = `if(lt(t,${safeEntryDuration}), ${entryY}, if(gt(t,${exitStartTime}), ${exitY}, ((H-h)/2)+${activeCardOffsetY}))`;

    // D. Superponer la tarjeta de Reddit (Title Card) durante el título de la historia
    filterComplex += `[v_bg]${cardLabel}overlay=x='${xExpr}':y='${yExpr}':enable='between(t,0,${titleDuration})'[v_overlaid];`;

    // E. Quemar los subtítulos ASS sobre el video forzando codificación UTF-8 para acentos correctos en Windows
    const escapedSubPath = assSubtitlesPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const fontsDir = path.join(__dirname, '..', 'fonts').replace(/\\/g, '/').replace(/:/g, '\\:');

    if (hasImgWatermark) {
      filterComplex += `[v_overlaid]subtitles='${escapedSubPath}':charenc=UTF-8:fontsdir='${fontsDir}'[v_subtitled];`;
      
      const canvasWidth = aspectRatio === '16:9' ? 1920 : 1080;
      const targetWidth = Math.round(canvasWidth * (parseFloat(watermarkImageScale) || 0.15));
      const opacityVal = watermarkImageOpacity !== undefined ? parseFloat(watermarkImageOpacity) : 0.5;
      
      filterComplex += `[${watermarkInputIdx}:v]scale=w=${targetWidth}:h=-2:flags=lanczos,format=rgba,colorchannelmixer=aa=${opacityVal}[wm_processed];`;
      
      const align = parseInt(watermarkImageAlignment || 9);
      const offX = parseInt(watermarkImageOffsetX !== undefined ? watermarkImageOffsetX : 20);
      const offY = parseInt(watermarkImageOffsetY !== undefined ? watermarkImageOffsetY : 20);
      
      let xExpr = `W-w-${offX}`;
      let yExpr = `${offY}`;
      
      if (align === 7) {
        xExpr = `${offX}`;
        yExpr = `${offY}`;
      } else if (align === 9) {
        xExpr = `W-w-${offX}`;
        yExpr = `${offY}`;
      } else if (align === 1) {
        xExpr = `${offX}`;
        yExpr = `H-h-${offY}`;
      } else if (align === 3) {
        xExpr = `W-w-${offX}`;
        yExpr = `H-h-${offY}`;
      } else if (align === 5) {
        xExpr = `(W-w)/2`;
        yExpr = `(H-h)/2`;
      }
      
      filterComplex += `[v_subtitled][wm_processed]overlay=x='${xExpr}':y='${yExpr}'[v_final];`;
    } else {
      filterComplex += `[v_overlaid]subtitles='${escapedSubPath}':charenc=UTF-8:fontsdir='${fontsDir}'[v_final];`;
    }

    // F. Concatenar y mezclar los audios en orden (con música si está activa)
    if (hasMusic) {
      filterComplex += `[${S+1}:a][${S+2}:a]concat=n=2:v=0:a=1[a_tts];`;
      filterComplex += `[${S+3}:a]volume=${musicVolume}dB[a_music_vol];`;
      filterComplex += `[a_tts][a_music_vol]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[a_final]`;
    } else {
      filterComplex += `[${S+1}:a][${S+2}:a]concat=n=2:v=0:a=1[a_final]`;
    }

    args.push('-filter_complex', filterComplex);

    // 5. Vincular mapa de flujos de salida
    args.push('-map', '[v_final]', '-map', '[a_final]');

    // Activar soporte multihilo completo para acelerar filtros de CPU (libass, crop, scale)
    args.push('-threads', '0');

    // 6. Configurar el codificador de video de acuerdo a la GPU seleccionada (o autodetectada) con alto rendimiento y máxima fidelidad Full HD
    if (activeCodec === 'h264_nvenc') {
      // NVIDIA NVENC: Optimizado para renderizado ultra-rápido por hardware en tiempo récord
      args.push(
        '-c:v', 'h264_nvenc',
        '-preset', 'p4', // Preset optimizado (p4 = velocidad/calidad balanceada ultra veloz)
        '-tune', 'hq',
        '-profile:v', 'high',
        '-rc', 'vbr',
        '-cq', '18', // Visualmente indistinguible de lossless en 1080p y hasta 3x más rápido
        '-b:v', '15M',
        '-maxrate:v', '30M',
        '-bufsize:v', '30M',
        '-pix_fmt', 'yuv420p'
      );
    } else if (activeCodec === 'h264_amf') {
      // AMD AMF: Aceleración balanceada para GPUs Radeon
      args.push(
        '-c:v', 'h264_amf',
        '-quality', 'speed',
        '-rc', 'vbr_peak',
        '-b:v', '15M',
        '-maxrate:v', '30M',
        '-pix_fmt', 'yuv420p'
      );
    } else if (activeCodec === 'h264_qsv') {
      // Intel QuickSync: Aceleración por hardware para iGPU Intel
      args.push(
        '-c:v', 'h264_qsv',
        '-preset', 'faster',
        '-global_quality', '18',
        '-pix_fmt', 'yuv420p'
      );
    } else {
      // CPU Standard (libx264): Optimizado para velocidad con CRF 18
      args.push(
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '18',
        '-pix_fmt', 'yuv420p'
      );
    }

    // Codificación de audio estándar ultra-rápida
    args.push('-c:a', 'aac', '-b:a', '192k');

    // Duración máxima de salida igual a la de los audios para evitar desbordamientos
    args.push('-t', totalDuration.toString());

    // Sobrescribir archivo de salida si existe
    args.push('-y', outputPath);

    console.log(`Iniciando compilación con FFmpeg (${activeCodec})...`);
    console.log('Comando FFmpeg completo:', ffmpegPath, args.join(' '));

    // Generar archivo fonts.conf dinámicamente para soporte de fuentes locales y del sistema en Windows
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const fontsConfPath = path.join(tempDir, 'fonts.conf');
    const localFontsDir = path.join(__dirname, '..', 'fonts').replace(/\\/g, '/');
    const fontsConfContent = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${localFontsDir}</dir>
  <dir>C:/Windows/Fonts</dir>
</fontconfig>`;

    try {
      fs.writeFileSync(fontsConfPath, fontsConfContent, 'utf8');
      console.log(`[Fontconfig] Archivo fonts.conf generado exitosamente en: ${fontsConfPath}`);
    } catch (err) {
      console.error('Error escribiendo fonts.conf temporal:', err.message);
    }

    const ffmpegProcess = spawn(ffmpegPath, args, {
      env: {
        ...process.env,
        FONTCONFIG_FILE: fontsConfPath
      },
      windowsHide: true
    });

    // Asignar prioridad Below Normal en Windows para garantizar fluidez absoluta de la pantalla y el navegador
    if (ffmpegProcess && ffmpegProcess.pid) {
      try {
        const os = require('os');
        os.setPriority(ffmpegProcess.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
        console.log(`[FFmpeg Priority] Proceso PID ${ffmpegProcess.pid} asignado con prioridad BELOW_NORMAL.`);
      } catch (pErr) {
        // Ignorar si el sistema operativo no soporta ajuste dinámico de prioridad
      }
    }

    let stderrAccumulator = '';

    // FFmpeg reporta el progreso en stderr
    ffmpegProcess.stderr.on('data', (data) => {
      const text = data.toString();
      stderrAccumulator += text;
      
      // Parsear la cadena de tiempo "time=HH:MM:SS.xx"
      const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (timeMatch) {
        const hrs = parseInt(timeMatch[1]);
        const mins = parseInt(timeMatch[2]);
        const secs = parseInt(timeMatch[3]);
        const ms = parseInt(timeMatch[4]);
        
        const currentSeconds = (hrs * 3600) + (mins * 60) + secs + (ms / 100);
        const percent = Math.min(100, Math.max(0, Math.round((currentSeconds / totalDuration) * 100)));
        
        onProgress(percent);
      }
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Video renderizado y guardado en: ${outputPath}`);
        resolve(outputPath);
      } else {
        console.error(`FFmpeg falló con el código de salida: ${code}`);
        const logPath = path.join(tempDir, 'ffmpeg-last-error.log');
        try {
          fs.writeFileSync(logPath, stderrAccumulator, 'utf8');
          console.log(`[FFmpeg Error Log] Guardado en: ${logPath}`);
        } catch (err) {
          console.error('No se pudo guardar el log de error de FFmpeg:', err.message);
        }

        // Obtener las últimas líneas de stderr para dar detalles
        const stderrLines = stderrAccumulator.split('\n').map(l => l.trim()).filter(l => l);
        const lastLines = stderrLines.slice(-10).join('\n');
        
        reject(new Error(`FFmpeg finalizó con error de compilación (código ${code}).\nDetalle:\n${lastLines}`));
      }
    });

    ffmpegProcess.on('error', (err) => {
      console.error('Error al iniciar el proceso de FFmpeg:', err);
      reject(new Error(`No se pudo ejecutar FFmpeg local. Asegúrate de tenerlo agregado a las variables de entorno de tu Windows. ${err.message}`));
    });
  });
}

module.exports = {
  compileVideo
};

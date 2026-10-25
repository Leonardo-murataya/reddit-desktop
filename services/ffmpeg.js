const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const gpu = require('./gpuDetector');

let activeFfmpegProcess = null;

/**
 * Detiene forzosamente cualquier proceso de renderizado activo de FFmpeg
 * para evitar procesos zombies en segundo plano si el usuario cancela la cola.
 */
function killActiveProcess() {
  if (activeFfmpegProcess && !activeFfmpegProcess.killed) {
    try {
      console.log(`[FFmpeg] Cancelando y terminando proceso de FFmpeg (PID ${activeFfmpegProcess.pid})...`);
      if (process.platform === 'win32' && activeFfmpegProcess.pid) {
        const { execSync } = require('child_process');
        try {
          execSync(`taskkill /pid ${activeFfmpegProcess.pid} /T /F`, { stdio: 'ignore' });
        } catch {}
      }
      activeFfmpegProcess.kill('SIGKILL');
      activeFfmpegProcess = null;
      return true;
    } catch (err) {
      console.warn('[FFmpeg] Error al terminar proceso activo:', err.message);
      activeFfmpegProcess = null;
    }
  }
  return false;
}

const OVERLAY_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];
const MAX_OVERLAY_OCCURRENCES = 30;

/**
 * Obtiene la duración de un archivo multimedia con ffprobe (0 si no se puede leer).
 */
function probeMediaDuration(filePath) {
  try {
    const ffprobePath = require('ffprobe-static').path;
    const { execFileSync } = require('child_process');
    const out = execFileSync(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], { encoding: 'utf8' }).trim();
    const dur = parseFloat(out);
    return isNaN(dur) ? 0 : dur;
  } catch (err) {
    console.warn(`[Overlays] No se pudo leer la duración de ${filePath}:`, err.message);
    return 0;
  }
}

/**
 * Convierte '#00FF00' al formato 0x00FF00 que espera el filtro chromakey.
 */
function hexToFfmpegColor(hex) {
  const clean = String(hex || '#00FF00').replace('#', '').trim();
  return /^[0-9a-fA-F]{6}$/.test(clean) ? `0x${clean.toUpperCase()}` : '0x00FF00';
}

function clampNumber(value, min, max, fallback) {
  const num = parseFloat(value);
  if (isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/**
 * Normaliza los overlays de la plantilla y calcula en qué segundos aparece cada uno.
 * Descarta los desactivados, los que no tienen archivo o los que empiezan después del final.
 */
function prepareOverlays(overlays, totalDuration) {
  if (!Array.isArray(overlays)) return [];

  return overlays
    .filter(ov => ov && ov.enabled !== false && ov.file && fs.existsSync(ov.file))
    .map(ov => {
      const isImage = OVERLAY_IMAGE_EXTS.includes(path.extname(ov.file).toLowerCase());
      const mediaDuration = isImage ? 0 : probeMediaDuration(ov.file);
      const requested = clampNumber(ov.duration, 0, 600, 0);

      // Imágenes: duración pedida (5s por defecto). Videos: el clip completo o lo que se pida, lo que sea menor.
      let clipDuration = isImage
        ? (requested > 0 ? requested : 5)
        : (requested > 0 && mediaDuration > 0 ? Math.min(requested, mediaDuration) : mediaDuration);
      if (!clipDuration || clipDuration <= 0) return null;

      const startTime = clampNumber(ov.startTime, 0, 36000, 0);
      const repeatEvery = clampNumber(ov.repeatEvery, 0, 36000, 0);
      const startTimes = [];
      for (let t = startTime; t < totalDuration && startTimes.length < MAX_OVERLAY_OCCURRENCES; t += repeatEvery) {
        startTimes.push(Number(t.toFixed(3)));
        if (repeatEvery <= 0) break;
      }
      if (startTimes.length === 0) return null;

      return {
        file: ov.file,
        isImage,
        clipDuration: Number(clipDuration.toFixed(3)),
        startTimes,
        chromaEnabled: !!ov.chromaEnabled,
        chromaColor: hexToFfmpegColor(ov.chromaColor),
        chromaSimilarity: clampNumber(ov.chromaSimilarity, 0.01, 1, 0.25),
        chromaBlend: clampNumber(ov.chromaBlend, 0, 1, 0.08),
        scale: clampNumber(ov.scale, 0.02, 1.5, 0.6),
        posX: clampNumber(ov.posX, -0.5, 1.5, 0.5),
        posY: clampNumber(ov.posY, -0.5, 1.5, 0.8),
        opacity: clampNumber(ov.opacity, 0, 1, 1)
      };
    })
    .filter(Boolean);
}

/**
 * Genera un PNG transparente de un cuadro del overlay con el croma aplicado,
 * para mostrarlo en la vista previa del editor de plantillas.
 * @returns {Promise<{image: string, duration: number, isImage: boolean}>}
 */
function renderOverlayPreview({ file, chromaEnabled, chromaColor, chromaSimilarity, chromaBlend }) {
  return new Promise((resolve, reject) => {
    if (!file || !fs.existsSync(file)) {
      return reject(new Error('El archivo del overlay no existe.'));
    }
    const isImage = OVERLAY_IMAGE_EXTS.includes(path.extname(file).toLowerCase());
    const duration = isImage ? 0 : probeMediaDuration(file);
    const seekTime = isImage ? 0 : Math.min(2, duration / 2);
    const keyFilter = chromaEnabled
      ? `chromakey=${hexToFfmpegColor(chromaColor)}:${clampNumber(chromaSimilarity, 0.01, 1, 0.25)}:${clampNumber(chromaBlend, 0, 1, 0.08)},`
      : '';

    const args = [
      '-v', 'error',
      ...(isImage ? [] : ['-ss', seekTime.toString()]),
      '-i', file,
      '-frames:v', '1',
      '-vf', `${keyFilter}format=rgba,scale=w='min(720,iw)':h=-2`,
      '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1'
    ];

    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    const chunks = [];
    let stderr = '';
    proc.stdout.on('data', d => chunks.push(d));
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== 0 || chunks.length === 0) {
        return reject(new Error(stderr.trim() || 'No se pudo generar la vista previa del overlay.'));
      }
      resolve({
        image: `data:image/png;base64,${Buffer.concat(chunks).toString('base64')}`,
        duration: Number(duration.toFixed(2)),
        isImage
      });
    });
  });
}

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
      cardSfxEnabled = false,
      cardSfxSound = 'whoosh',
      cardSfxVolume = -6,
      backgroundBlur = 0,
      backgroundBlurMode = 'card-only',
      vignetteStrength = 0,
      backgroundSaturation = 1.0,
      backgroundContrast = 1.0,
      watermarkEnabled = false,
      watermarkType = 'text',
      watermarkImageFile = '',
      watermarkImageScale = 0.15,
      watermarkImageOpacity = 0.5,
      watermarkImageAlignment = 9,
      watermarkImageOffsetX = 20,
      watermarkImageOffsetY = 20,
      overlays = []
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

    let nextInputIdx = S + 3;
    let musicInputIdx = -1;
    const hasMusic = musicEnabled && musicFile && fs.existsSync(musicFile);
    if (hasMusic) {
      args.push('-stream_loop', '-1', '-i', musicFile);
      musicInputIdx = nextInputIdx++;
    }

    let sfxInputIdx = -1;
    const possibleSfxPath = path.join(__dirname, '..', 'frontend', 'public', 'assets', 'sfx', `${cardSfxSound || 'whoosh'}.wav`);
    const hasSfx = cardSfxEnabled && fs.existsSync(possibleSfxPath);
    if (hasSfx) {
      args.push('-i', possibleSfxPath);
      sfxInputIdx = nextInputIdx++;
    }

    let watermarkInputIdx = -1;
    const hasImgWatermark = watermarkEnabled && watermarkType === 'image' && watermarkImageFile && fs.existsSync(watermarkImageFile);
    if (hasImgWatermark) {
      args.push('-i', watermarkImageFile);
      watermarkInputIdx = nextInputIdx++;
    }

    // Overlays personalizados (logos, globos con croma, etc.) del mini editor
    const activeOverlays = prepareOverlays(overlays, totalDuration);
    for (const ov of activeOverlays) {
      if (ov.isImage) {
        args.push('-loop', '1', '-t', ov.clipDuration.toString(), '-i', ov.file);
      } else {
        args.push('-i', ov.file);
      }
      ov.inputIdx = nextInputIdx++;
    }
    const preOverlayLabel = activeOverlays.length > 0 ? '[v_pre_overlays]' : '[v_final]';

    // 4. Diseñar el filtro complejo (-filter_complex)
    let filterComplex = '';

    // A. Concatenar y recortar videos de fondo
    if (S > 1) {
      let concatInputs = '';
      for (let i = 0; i < S; i++) {
        concatInputs += `[${i}:v]`;
      }
      filterComplex += `${concatInputs}concat=n=${S}:v=1:a=0[v_bg_raw];`;
      if (aspectRatio === '16:9') {
        filterComplex += `[v_bg_raw]crop=w='if(gte(in_w/in_h, 16/9), in_h*16/9, in_w)':h='if(gte(in_w/in_h, 16/9), in_h, in_w*9/16)',scale=1920:1080:flags=bicubic[v_bg_base];`;
      } else {
        filterComplex += `[v_bg_raw]crop=w='if(gte(in_w/in_h, 9/16), in_h*9/16, in_w)':h='if(gte(in_w/in_h, 9/16), in_h, in_w*16/9)',scale=1080:1920:flags=bicubic[v_bg_base];`;
      }
    } else {
      if (aspectRatio === '16:9') {
        filterComplex += `[0:v]crop=w='if(gte(in_w/in_h, 16/9), in_h*16/9, in_w)':h='if(gte(in_w/in_h, 16/9), in_h, in_w*9/16)',scale=1920:1080:flags=bicubic[v_bg_base];`;
      } else {
        filterComplex += `[0:v]crop=w='if(gte(in_w/in_h, 9/16), in_h*9/16, in_w)':h='if(gte(in_w/in_h, 9/16), in_h, in_w*16/9)',scale=1080:1920:flags=bicubic[v_bg_base];`;
      }
    }

    // A1. Tratamiento Cinematográfico del Fondo (Filtros Drift: Color Grading, Viñeta y Desenfoque)
    let currentBgLabel = '[v_bg_base]';
    const satVal = parseFloat(backgroundSaturation !== undefined ? backgroundSaturation : 1.0);
    const conVal = parseFloat(backgroundContrast !== undefined ? backgroundContrast : 1.0);
    if (satVal !== 1.0 || conVal !== 1.0) {
      filterComplex += `${currentBgLabel}eq=saturation=${satVal}:contrast=${conVal}[v_bg_graded];`;
      currentBgLabel = '[v_bg_graded]';
    }

    const vigVal = parseFloat(vignetteStrength !== undefined ? vignetteStrength : 0);
    if (vigVal > 0) {
      const vigAngle = (Math.max(0.01, Math.min(1.0, vigVal)) * (Math.PI / 2)).toFixed(4);
      filterComplex += `${currentBgLabel}vignette=angle=${vigAngle}[v_bg_vig];`;
      currentBgLabel = '[v_bg_vig]';
    }

    const blurVal = parseInt(backgroundBlur !== undefined ? backgroundBlur : 0);
    if (blurVal > 0) {
      if (backgroundBlurMode === 'all') {
        filterComplex += `${currentBgLabel}gblur=sigma=${blurVal}[v_bg_blurred];`;
        currentBgLabel = '[v_bg_blurred]';
      } else {
        // Modo adaptativo: Desenfoque únicamente mientras la tarjeta está en pantalla
        filterComplex += `${currentBgLabel}split[bg_clear][bg_to_blur];`;
        filterComplex += `[bg_to_blur]gblur=sigma=${blurVal}[bg_blurred_seg];`;
        filterComplex += `[bg_clear][bg_blurred_seg]overlay=enable='between(t,0,${titleDuration})'[v_bg_adapt_blur];`;
        currentBgLabel = '[v_bg_adapt_blur]';
      }
    }

    // A2. Aplicar escalado del card inteligente (HD con flags=lanczos y h=-2 para garantizar alto divisible por 2)
    const baseCardWidth = aspectRatio === '16:9'
      ? 1920 * 0.40 * activeCardScale
      : 1080 * 0.74 * activeCardScale;

    let cardInputLabel = '[card_scaled]';
    filterComplex += `[${S}:v]scale=w=${Math.round(baseCardWidth)}:h=-2:flags=bicubic[card_scaled];`;

    // B. Procesar animaciones del card (Fades de entrada y salida)
    let cardLabel = cardInputLabel;
    
    const safeEntryDuration = cardEntryDuration <= 0 ? 0.01 : cardEntryDuration;
    const safeExitDuration = cardExitDuration <= 0 ? 0.01 : cardExitDuration;

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

    // C. Calcular posicionamiento dinámico y animaciones de movimiento con Curvas Bézier / Spring Physics
    let xExpr = `((W-w)/2)+${activeCardOffsetX}`;
    let yExpr = `((H-h)/2)+${activeCardOffsetY}`;

    // Progreso dinámico suave con interpolación sinusoidal (aceleración y desaceleración orgánica de Drift)
    const easeInProg = `sin((t/${safeEntryDuration})*1.570796)`;
    const exitStartTime = `(${titleDuration}-${safeExitDuration})`;
    const easeOutProg = `(1-cos(((t-${exitStartTime})/${safeExitDuration})*1.570796))`;

    let entryX = `((W-w)/2)+${activeCardOffsetX}`;
    let entryY = `((H-h)/2)+${activeCardOffsetY}`;

    if (cardEntryAnimation === 'slide-in-left') {
      entryX = `-w+(((W-w)/2)+${activeCardOffsetX}+w)*${easeInProg}`;
    } else if (cardEntryAnimation === 'slide-in-right') {
      entryX = `W-((W-(((W-w)/2)+${activeCardOffsetX}))*${easeInProg})`;
    } else if (cardEntryAnimation === 'slide-in-bottom') {
      entryY = `H-((H-(((H-h)/2)+${activeCardOffsetY}))*${easeInProg})`;
    } else if (cardEntryAnimation === 'slide-in-top') {
      entryY = `-h+(((H-h)/2)+${activeCardOffsetY}+h)*${easeInProg}`;
    } else if (cardEntryAnimation === 'zoom-in') {
      entryY = `((H-h)/2)+${activeCardOffsetY} - (60 * (1 - ${easeInProg}))`;
    }

    let exitX = `((W-w)/2)+${activeCardOffsetX}`;
    let exitY = `((H-h)/2)+${activeCardOffsetY}`;

    if (cardExitAnimation === 'slide-out-left') {
      exitX = `(((W-w)/2)+${activeCardOffsetX}) - w * ${easeOutProg}`;
    } else if (cardExitAnimation === 'slide-out-right') {
      exitX = `(((W-w)/2)+${activeCardOffsetX}) + W * ${easeOutProg}`;
    } else if (cardExitAnimation === 'slide-out-bottom') {
      exitY = `(((H-h)/2)+${activeCardOffsetY}) + H * ${easeOutProg}`;
    } else if (cardExitAnimation === 'slide-out-top') {
      exitY = `(((H-h)/2)+${activeCardOffsetY}) - H * ${easeOutProg}`;
    } else if (cardExitAnimation === 'zoom-out') {
      exitY = `(((H-h)/2)+${activeCardOffsetY}) + (60 * ${easeOutProg})`;
    }

    // Unimos los 3 estados: entrada con easing, estático y salida con easing
    xExpr = `if(lt(t,${safeEntryDuration}), ${entryX}, if(gt(t,${exitStartTime}), ${exitX}, ((W-w)/2)+${activeCardOffsetX}))`;
    yExpr = `if(lt(t,${safeEntryDuration}), ${entryY}, if(gt(t,${exitStartTime}), ${exitY}, ((H-h)/2)+${activeCardOffsetY}))`;

    // D. Superponer la tarjeta de Reddit (Title Card) sobre el fondo tratado
    filterComplex += `${currentBgLabel}${cardLabel}overlay=x='${xExpr}':y='${yExpr}':enable='between(t,0,${titleDuration})'[v_overlaid];`;

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
      
      filterComplex += `[v_subtitled][wm_processed]overlay=x='${xExpr}':y='${yExpr}'${preOverlayLabel};`;
    } else {
      filterComplex += `[v_overlaid]subtitles='${escapedSubPath}':charenc=UTF-8:fontsdir='${fontsDir}'${preOverlayLabel};`;
    }

    // E2. Overlays del mini editor: encima de todo, como la pista superior de un editor
    if (activeOverlays.length > 0) {
      const canvasWidth = aspectRatio === '16:9' ? 1920 : 1080;
      let currentLabel = preOverlayLabel;
      activeOverlays.forEach((ov, i) => {
        const targetWidth = Math.max(2, Math.round(canvasWidth * ov.scale / 2) * 2);
        const keyFilter = ov.chromaEnabled
          ? `chromakey=${ov.chromaColor}:${ov.chromaSimilarity}:${ov.chromaBlend},`
          : '';
        const n = ov.startTimes.length;
        const splitLabels = ov.startTimes.map((_, k) => `[ov${i}_${k}]`).join('');
        filterComplex += `[${ov.inputIdx}:v]${keyFilter}format=rgba,scale=w=${targetWidth}:h=-2:flags=lanczos,colorchannelmixer=aa=${ov.opacity}`;
        filterComplex += n > 1 ? `,split=${n}${splitLabels};` : `[ov${i}_0];`;

        ov.startTimes.forEach((start, k) => {
          const isLast = i === activeOverlays.length - 1 && k === n - 1;
          const outLabel = isLast ? '[v_final]' : `[v_ov${i}_${k}]`;
          filterComplex += `[ov${i}_${k}]trim=duration=${ov.clipDuration},setpts=PTS-STARTPTS+${start}/TB[ov${i}_${k}_t];`;
          filterComplex += `${currentLabel}[ov${i}_${k}_t]overlay=x='W*${ov.posX}-w/2':y='H*${ov.posY}-h/2':eof_action=pass${outLabel};`;
          currentLabel = outLabel;
        });
      });
    }

    // F. Concatenar y mezclar los audios en orden (TTS + Música + Efectos de Sonido SFX)
    filterComplex += `[${S+1}:a][${S+2}:a]concat=n=2:v=0:a=1[a_tts];`;
    const mixAudioStreams = ['[a_tts]'];

    if (hasMusic) {
      filterComplex += `[${musicInputIdx}:a]volume=${musicVolume}dB[a_music_vol];`;
      mixAudioStreams.push('[a_music_vol]');
    }

    if (hasSfx) {
      filterComplex += `[${sfxInputIdx}:a]volume=${cardSfxVolume}dB[a_sfx_vol];`;
      mixAudioStreams.push('[a_sfx_vol]');
    }

    if (mixAudioStreams.length > 1) {
      filterComplex += `${mixAudioStreams.join('')}amix=inputs=${mixAudioStreams.length}:duration=first:dropout_transition=2:normalize=0[a_final]`;
    } else {
      filterComplex += `[a_tts]anull[a_final]`;
    }

    args.push('-filter_complex', filterComplex);

    // 5. Vincular mapa de flujos de salida
    args.push('-map', '[v_final]', '-map', '[a_final]');

    // Activar soporte multihilo completo para acelerar filtros de CPU (libass, crop, scale)
    args.push('-threads', '0');

    // 6. Configurar el codificador de video de acuerdo a la GPU seleccionada (o autodetectada) con perfiles optimizados de Drift
    if (activeCodec === 'hevc_nvenc') {
      // NVIDIA HEVC / H.265 (Ultra eficiencia y nitidez en 1080p vertical/horizontal)
      args.push(
        '-c:v', 'hevc_nvenc',
        '-preset', 'p4',
        '-tune', 'hq',
        '-rc', 'vbr',
        '-cq', '20',
        '-spatial-aq', '1',
        '-b:v', '10M',
        '-maxrate:v', '20M',
        '-bufsize:v', '20M',
        '-pix_fmt', 'yuv420p'
      );
    } else if (activeCodec === 'h264_nvenc') {
      // NVIDIA NVENC: H.264 acelerado por hardware CUDA
      args.push(
        '-c:v', 'h264_nvenc',
        '-preset', 'p4', // Preset optimizado (p4 = velocidad/calidad balanceada de estudio)
        '-tune', 'hq',
        '-profile:v', 'high',
        '-rc', 'vbr',
        '-cq', '21', // Nitidez alta sin inflar el archivo (antes cq 18 producía ~26 Mbps reales)
        '-spatial-aq', '1',
        '-b:v', '10M',
        '-maxrate:v', '14M',
        '-bufsize:v', '20M',
        '-pix_fmt', 'yuv420p'
      );
    } else if (activeCodec === 'hevc_amf') {
      // AMD AMF HEVC
      args.push(
        '-c:v', 'hevc_amf',
        '-quality', 'balanced',
        '-rc', 'vbr_peak',
        '-b:v', '10M',
        '-maxrate:v', '20M',
        '-pix_fmt', 'yuv420p'
      );
    } else if (activeCodec === 'h264_amf') {
      // AMD AMF: Aceleración balanceada para GPUs Radeon
      args.push(
        '-c:v', 'h264_amf',
        '-quality', 'balanced',
        '-rc', 'vbr_peak',
        '-b:v', '10M',
        '-maxrate:v', '14M',
        '-pix_fmt', 'yuv420p'
      );
    } else if (activeCodec === 'hevc_qsv') {
      // Intel QuickSync HEVC
      args.push(
        '-c:v', 'hevc_qsv',
        '-preset', 'medium',
        '-global_quality', '20',
        '-pix_fmt', 'yuv420p'
      );
    } else if (activeCodec === 'h264_qsv') {
      // Intel QuickSync H.264
      args.push(
        '-c:v', 'h264_qsv',
        '-preset', 'faster',
        '-global_quality', '18',
        '-pix_fmt', 'yuv420p'
      );
    } else if (activeCodec === 'libx265') {
      // CPU HEVC
      args.push(
        '-c:v', 'libx265',
        '-preset', 'fast',
        '-crf', '22',
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

    // Codificación de audio: estéreo a 44.1 kHz como un export de editor convencional
    // (Edge-TTS entrega mono a 24 kHz, una firma típica de contenido automatizado)
    args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2');

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

    activeFfmpegProcess = ffmpegProcess;

    // Asignar prioridad Normal en Windows para evitar que el planificador de energía (EcoQoS) 
    // reduzca a la mitad la velocidad del encoder de video al minimizar o cambiar de ventana
    if (ffmpegProcess && ffmpegProcess.pid) {
      try {
        const os = require('os');
        os.setPriority(ffmpegProcess.pid, os.constants.priority.PRIORITY_NORMAL);
        console.log(`[FFmpeg Priority] Proceso PID ${ffmpegProcess.pid} asignado con prioridad NORMAL (EcoQoS deshabilitado).`);
      } catch (pErr) {
        // Ignorar si el sistema operativo no soporta ajuste dinámico de prioridad
      }
    }

    let stderrAccumulator = '';
    let lastDataTime = Date.now();

    // Watchdog de inactividad: si FFmpeg no emite ningún dato en stderr durante 3 minutos, se considera colgado
    const watchdogInterval = setInterval(() => {
      if (Date.now() - lastDataTime > 180000) {
        clearInterval(watchdogInterval);
        console.error('[FFmpeg Watchdog] Proceso congelado sin responder durante 3 minutos. Terminando...');
        killActiveProcess();
        reject(new Error('FFmpeg no respondió durante más de 3 minutos (inactividad detectada por Watchdog).'));
      }
    }, 15000);

    // FFmpeg reporta el progreso y telemetría en stderr
    ffmpegProcess.stderr.on('data', (data) => {
      lastDataTime = Date.now();
      const text = data.toString();
      stderrAccumulator += text;
      
      // Parsear la cadena de tiempo "time=HH:MM:SS.xx" y telemetría en tiempo real
      const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      const fpsMatch = text.match(/fps=\s*([\d.]+)/);
      const speedMatch = text.match(/speed=\s*([\d.]+)x/);
      const frameMatch = text.match(/frame=\s*(\d+)/);

      if (timeMatch) {
        const hrs = parseInt(timeMatch[1]);
        const mins = parseInt(timeMatch[2]);
        const secs = parseInt(timeMatch[3]);
        const ms = parseInt(timeMatch[4]);
        
        const currentSeconds = (hrs * 3600) + (mins * 60) + secs + (ms / 100);
        const percent = Math.min(100, Math.max(0, Math.round((currentSeconds / totalDuration) * 100)));
        
        const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 0;
        const speed = speedMatch ? parseFloat(speedMatch[1]) : 0;
        const frame = frameMatch ? parseInt(frameMatch[1]) : 0;
        const remainingSeconds = Math.max(0, totalDuration - currentSeconds);
        const etaSeconds = speed > 0 ? Math.round(remainingSeconds / speed) : 0;

        onProgress(percent, {
          fps,
          speed,
          frame,
          currentSeconds: Math.round(currentSeconds),
          totalDuration: Math.round(totalDuration),
          etaSeconds
        });
      }
    });

    ffmpegProcess.on('close', (code) => {
      clearInterval(watchdogInterval);
      if (activeFfmpegProcess === ffmpegProcess) {
        activeFfmpegProcess = null;
      }

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
      clearInterval(watchdogInterval);
      if (activeFfmpegProcess === ffmpegProcess) {
        activeFfmpegProcess = null;
      }
      console.error('Error al iniciar el proceso de FFmpeg:', err);
      reject(new Error(`No se pudo ejecutar FFmpeg local. Asegúrate de tenerlo agregado a las variables de entorno de tu Windows. ${err.message}`));
    });
  });
}

module.exports = {
  compileVideo,
  killActiveProcess,
  renderOverlayPreview
};

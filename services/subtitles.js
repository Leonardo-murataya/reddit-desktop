const fs = require('fs');
const path = require('path');
const textMetrics = require('./textMetrics');

// Convierte un color Hex de CSS (#RRGGBB) a formato ASS Hex (&H00BBGGRR&)
function colorToAss(hex) {
  if (!hex) return '&H00FFFFFF&';
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 6) {
    const r = cleanHex.substring(0, 2);
    const g = cleanHex.substring(2, 4);
    const b = cleanHex.substring(4, 6);
    return `&H00${b}${g}${r}&`; // Formato: BGR
  }
  return '&H00FFFFFF&';
}

// Formatea segundos (ej. 3.42) a formato de tiempo ASS (h:mm:ss.cs)
function formatTimeASS(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds - hrs * 3600) / 60);
  const secs = Math.floor(seconds - hrs * 3600 - mins * 60);
  const ms = Math.floor((seconds % 1) * 100);

  const hStr = hrs.toString();
  const mStr = mins.toString().padStart(2, '0');
  const sStr = secs.toString().padStart(2, '0');
  const msStr = ms.toString().padStart(2, '0');

  return `${hStr}:${mStr}:${sStr}.${msStr}`;
}

const TEXT_LAYER_BASE = 900000; // las capas de texto siempre van encima de los subtítulos
const MAX_TEXT_OCCURRENCES = 30;
const WIGGLE_STEP_MS = 160; // cada cuánto cambia la inclinación de cada letra
const WIGGLE_CHUNK_MS = 6000; // las capas largas se parten en bloques para no generar líneas gigantes

function clampNum(value, min, max, fallback) {
  const num = parseFloat(value);
  if (isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

// Generador pseudoaleatorio determinista: el mismo texto siempre se bambolea igual
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Genera las líneas Dialogue de las capas de texto (overlays de tipo 'text').
 * Animaciones: none, fade, pop, slide-down, pulse y wiggle (bamboleo letra por letra estilo CapCut).
 */
function buildTextLayerEvents(overlays, { resX, resY, videoEnd }) {
  if (!Array.isArray(overlays)) return '';
  let events = '';

  overlays
    .filter(ov => ov && ov.type === 'text' && ov.enabled !== false && String(ov.text || '').trim())
    .forEach((ov, layerIdx) => {
      const font = ov.font || 'Bangers';
      const fontSize = Math.round(clampNum(ov.fontSize, 10, 400, 90));
      const spacing = clampNum(ov.letterSpacing, -10, 40, 0);
      const outline = clampNum(ov.outlineWidth, 0, 30, 6);
      const x = Math.round(resX * clampNum(ov.posX, -0.5, 1.5, 0.5));
      const y = Math.round(resY * clampNum(ov.posY, -0.5, 1.5, 0.12));
      const lines = String(ov.text).replace(/[{}\\]/g, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const baseTags = `\\fn${font}\\fs${fontSize}\\fsp${spacing}\\b1\\c${colorToAss(ov.color || '#FFD400')}\\3c${colorToAss(ov.outlineColor || '#000000')}\\bord${outline}\\shad0`;
      const animation = ov.animation || 'wiggle';

      const startTime = clampNum(ov.startTime, 0, 36000, 0);
      const repeatEvery = clampNum(ov.repeatEvery, 0, 36000, 0);
      const requestedDuration = clampNum(ov.duration, 0, 36000, 0);
      const occurrences = [];
      for (let t = startTime; t < videoEnd && occurrences.length < MAX_TEXT_OCCURRENCES; t += repeatEvery) {
        const end = requestedDuration > 0 ? Math.min(t + requestedDuration, videoEnd) : videoEnd;
        occurrences.push([t, end]);
        if (repeatEvery <= 0) break;
      }

      const layer = TEXT_LAYER_BASE + layerIdx * 10;
      const measurer = textMetrics.createTextMeasurer(font, fontSize, spacing);
      // Interlineado compacto como en CapCut (basado en la altura de mayúsculas); sin medidor, el de libass
      let lineHeight = fontSize * 0.95;
      if (measurer) {
        const { capTop, baseline } = measurer.lineBox(0);
        lineHeight = (baseline - capTop) * 1.35;
      }
      const lineCenterY = (li) => Math.round(y + (li - (lines.length - 1) / 2) * lineHeight);

      occurrences.forEach(([t0, t1], occIdx) => {
        const durMs = Math.round((t1 - t0) * 1000);
        const fullText = lines.join('\\N');

        if (animation === 'wiggle' && measurer) {
          // Cada letra es su propia línea con su propio eje de giro, así se inclinan de forma independiente
          const rand = seededRandom(fullText.length * 7919 + layerIdx * 104729 + occIdx * 31);
          lines.forEach((line, li) => {
            const chars = [...line];
            const lineWidth = measurer.widthOf(line);
            const left = x - lineWidth / 2;
            const cy = lineCenterY(li);
            chars.forEach((ch, ci) => {
              if (!ch.trim()) return;
              const cx = Math.round(left + measurer.widthOf(chars.slice(0, ci).join('')) + (measurer.widthOf(ch) - spacing) / 2);
              const angles = [];
              for (let s = 0; s <= Math.ceil(durMs / WIGGLE_STEP_MS); s++) angles.push(Math.round((rand() * 2 - 1) * 7));

              for (let chunkStart = 0; chunkStart < durMs; chunkStart += WIGGLE_CHUNK_MS) {
                const chunkEnd = Math.min(durMs, chunkStart + WIGGLE_CHUNK_MS);
                const firstStep = Math.floor(chunkStart / WIGGLE_STEP_MS);
                let tags = `\\an5\\pos(${cx},${cy})\\org(${cx},${cy})${baseTags}\\frz${angles[firstStep]}`;
                for (let s = firstStep + 1; s * WIGGLE_STEP_MS < chunkEnd; s++) {
                  const relStart = (s - 1) * WIGGLE_STEP_MS - chunkStart;
                  tags += `\\t(${Math.max(0, relStart)},${relStart + WIGGLE_STEP_MS},\\frz${angles[s]})`;
                }
                const fadeIn = chunkStart === 0 ? 150 : 0;
                const fadeOut = chunkEnd === durMs ? 300 : 0;
                if (fadeIn || fadeOut) tags += `\\fad(${fadeIn},${fadeOut})`;
                events += `Dialogue: ${layer},${formatTimeASS(t0 + chunkStart / 1000)},${formatTimeASS(t0 + chunkEnd / 1000)},CapaTexto,,0,0,0,,{${tags}}${ch}\n`;
              }
            });
          });
          return;
        }

        // Con medidor, cada renglón va en su propia línea para usar el interlineado compacto
        const rows = measurer && lines.length > 1
          ? lines.map((line, li) => ({ text: line, cy: lineCenterY(li) }))
          : [{ text: fullText, cy: y }];

        let animTags = '';
        if (animation === 'fade') {
          animTags = '\\fad(300,300)';
        } else if (animation === 'pop') {
          animTags = '\\fscx30\\fscy30\\t(0,160,\\fscx112\\fscy112)\\t(160,260,\\fscx100\\fscy100)\\fad(0,250)';
        } else if (animation === 'slide-down') {
          animTags = '\\fad(150,250)';
        } else if (animation === 'pulse') {
          for (let s = 0; s * 500 < Math.min(durMs, 60000); s++) {
            const scaleTo = s % 2 === 0 ? 108 : 100;
            animTags += `\\t(${s * 500},${(s + 1) * 500},\\fscx${scaleTo}\\fscy${scaleTo})`;
          }
          animTags += '\\fad(150,250)';
        } else if (animation === 'wiggle') {
          // Respaldo si la fuente no se pudo medir: bamboleo de la capa completa
          for (let s = 0; s * 250 < Math.min(durMs, 60000); s++) {
            animTags += `\\t(${s * 250},${(s + 1) * 250},\\frz${s % 2 === 0 ? 3 : -3})`;
          }
          animTags += '\\fad(150,300)';
        }
        rows.forEach(({ text, cy }) => {
          const posTags = animation === 'slide-down'
            ? `\\move(${x},${cy - Math.round(fontSize * 1.5)},${x},${cy},0,300)`
            : `\\pos(${x},${cy})`;
          // Todas las filas giran/escalan alrededor del centro de la capa completa
          events += `Dialogue: ${layer},${formatTimeASS(t0)},${formatTimeASS(t1)},CapaTexto,,0,0,0,,{\\an5${posTags}\\org(${x},${y})${baseTags}${animTags}}${text}\n`;
        });
      });
    });

  return events;
}

/**
 * Genera un archivo de subtítulos .ass altamente dinámico y estilizado.
 * @param {Array<{word: string, start: number, end: number, duration: number}>} wordTimestamps - Timestamps de palabras
 * @param {string} outputPath - Ruta de salida para el archivo .ass
 * @param {object} template - Plantilla con configuraciones de estilo
 * @param {number} startOffset - Segundo en el que finaliza el Title Card y deben comenzar los subtítulos
 * @returns {Promise<string>} - Ruta del archivo .ass generado
 */
async function generateAssSubtitles(wordTimestamps, outputPath, template, startOffset = 0, isLandscape = false) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 1. Clonar y ordenar los timestamps cronológicamente para evitar cualquier desajuste
  // Se introduce una compensación de retraso (subtitleDelay) por defecto de +0.15 segundos (150ms)
  // para corregir el silencio inicial y latencia de decodificación de Edge TTS
  const delayAdjustment = template.subtitleDelay !== undefined ? parseFloat(template.subtitleDelay) : 0.15;
  const timestamps = wordTimestamps
    .map(wt => ({
      ...wt,
      start: wt.start + delayAdjustment,
      end: wt.end + delayAdjustment
    }))
    .sort((a, b) => a.start - b.start);

  // 2. Sanear tiempos para evitar solapamientos y colisiones visuales de subtítulos en libass
  for (let i = 0; i < timestamps.length - 1; i++) {
    const minGap = 0.02; // 20ms de separación física garantizada para evitar colisiones en libass
    if (timestamps[i].end > timestamps[i + 1].start - minGap) {
      timestamps[i].end = Math.max(timestamps[i].start + 0.01, timestamps[i + 1].start - minGap);
      timestamps[i].duration = timestamps[i].end - timestamps[i].start;
    }
  }

  const {
    font = 'Arial Bold',
    fontSize = 26,
    subtitleColor = '#FFFF00', // Color activo
    passiveColor = '#FFFFFF', // Color pasivo
    animation = 'tiktok-pop', // tiktok-pop, bounce-pop, active-highlight, glow-karaoke, clean-fade, borde-emergente-2
    subtitleOffsetX = 0, // Desplazamiento horizontal manual (defecto 0)
    subtitleOffsetY = 0, // Desplazamiento vertical manual (defecto 0)
    subtitleAnimationSpeed = 80, // Velocidad de zoom/pop en milisegundos (defecto 80ms)
    subtitleBorderStyle = 'outline', // outline, heavy-outline, box
    subtitleLetterSpacing = 0, // Separación de letras por píxeles
    fontSize_16_9 = 24,
    subtitleOffsetX_16_9 = 0,
    subtitleOffsetY_16_9 = 0,
    watermarkEnabled = false,
    watermarkType = 'text',
    watermarkText = '@marca_agua',
    watermarkFont = 'Arial Bold',
    watermarkSize = 24,
    watermarkColor = '#FFFFFF',
    watermarkOpacity = 0.4,
    watermarkAlignment = 9,
    watermarkOffsetX = 20,
    watermarkOffsetY = 20,
    watermarkAnimation = 'none',
    watermarkSpeed = 2.5
  } = template;

  // Calcular canal alfa de transparencia para el color de la marca de agua (00 = opaco, FF = transparente)
  const wmOpacityVal = watermarkOpacity !== undefined ? parseFloat(watermarkOpacity) : 0.4;
  const wmAlphaHex = Math.round((1 - wmOpacityVal) * 255).toString(16).padStart(2, '0').toUpperCase();
  
  // Convertir color de marca de agua a BGR de ASS
  const cleanWmColor = watermarkColor ? watermarkColor.replace('#', '') : 'FFFFFF';
  let wmAssColor = '&H00FFFFFF&';
  if (cleanWmColor.length === 6) {
    const r = cleanWmColor.substring(0, 2);
    const g = cleanWmColor.substring(2, 4);
    const b = cleanWmColor.substring(4, 6);
    wmAssColor = `&H${wmAlphaHex}${b}${g}${r}&`; // Formato: &HAABBGGRR&
  } else {
    wmAssColor = `&H${wmAlphaHex}FFFFFF&`;
  }

  const activeFontSize = isLandscape ? (fontSize_16_9 !== undefined ? fontSize_16_9 : 24) : fontSize;
  const activeOffsetX = isLandscape ? (subtitleOffsetX_16_9 !== undefined ? subtitleOffsetX_16_9 : 0) : subtitleOffsetX;
  const activeOffsetY = isLandscape ? (subtitleOffsetY_16_9 !== undefined ? subtitleOffsetY_16_9 : 0) : subtitleOffsetY;

  const assActiveColor = colorToAss(subtitleColor);
  const assPassiveColor = colorToAss(passiveColor);
  const assOutlineColor = '&H00000000&'; // Borde negro absoluto

  // Mapear el estilo de contorno de subtítulos de ASS
  let assBorderStyle = '1';
  let assOutlineSize = '3.5';
  let assShadowSize = '0.5';
  let assBackColour = '&H00000000&'; // Fondo negro

  if (subtitleBorderStyle === 'heavy-outline') {
    assBorderStyle = '1';
    assOutlineSize = '5.0';
    assShadowSize = '0';
  } else if (subtitleBorderStyle === 'box') {
    assBorderStyle = '3'; // Caja de fondo sólida (Estilo Capcut/TikTok)
    assOutlineSize = '1.0'; // Pequeño margen interno en la caja
    assShadowSize = '0';
    assBackColour = '&H80000000&'; // Negro con 50% de opacidad para efecto premium
  }

  // Coordenadas físicas calculadas sobre lienzo
  const resX = isLandscape ? 1920 : 1080;
  const resY = isLandscape ? 1080 : 1920;
  const X = (resX / 2) + parseInt(activeOffsetX);
  const Y = (resY / 2) + parseInt(activeOffsetY);
  const speed = parseInt(subtitleAnimationSpeed);

  // Encabezado del script ASS
  let assContent = `[Script Info]
Title: Reddit Auto Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${resX}
PlayResY: ${resY}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${activeFontSize},${assPassiveColor},&H000000FF&,${assOutlineColor},${assBackColour},-1,0,0,0,100,100,${subtitleLetterSpacing},0,${assBorderStyle},${assOutlineSize},${assShadowSize},5,60,60,650,1
Style: Karaoke,${font},${activeFontSize},${assActiveColor},${assPassiveColor},${assOutlineColor},${assBackColour},-1,0,0,0,100,100,${subtitleLetterSpacing},0,${assBorderStyle},${assOutlineSize},${assShadowSize},5,60,60,650,1
Style: TitleCard,${font},28,&H00FFFFFF&,&H000000FF&,${assOutlineColor},&H00000000&,-1,0,0,0,100,100,0,0,1,3.5,0.5,5,60,60,650,1
Style: Watermark,${watermarkFont},${watermarkSize},${wmAssColor},&H000000FF&,&H00000000&,&H00000000&,-1,0,0,0,100,100,0,0,1,1.5,0,${watermarkAlignment},10,10,10,1
Style: CapaTexto,Arial,60,&H00FFFFFF&,&H000000FF&,&H00000000&,&H00000000&,-1,0,0,0,100,100,0,0,1,4,0,5,0,0,0,1
`;

  // Estilos dedicados de Borde Emergente II (caja morada redondeada estilo CapCut)
  // - CajaCapCut: rectángulo vectorial (\p1) medido para quedar exactamente detrás de la palabra activa.
  // - BordeEmergente (respaldo si la fuente no se puede medir): contorno muy grueso con relleno invisible;
  //   libass une los trazos con juntas redondas y queda una caja redondeada que sigue la forma del texto.
  if (animation === 'borde-emergente-2') {
    const boxBgColor = '&H00E80A83&'; // Morado CapCut en BGR (#830AE8)
    const boxPadding = Math.max(8, Math.round(activeFontSize * 0.3));
    assContent += `Style: BordeEmergente,${font},${activeFontSize},&HFF000000&,&HFF0000FF&,${boxBgColor},&HFF000000&,-1,0,0,0,100,100,${subtitleLetterSpacing},0,1,${boxPadding},0,5,60,60,650,1\n`;
    assContent += `Style: CajaCapCut,Arial,20,${boxBgColor},&H000000FF&,&H00000000&,&H00000000&,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1\n`;
  }

  assContent += `
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Estilo 1: TikTok Pop (Una palabra a la vez en el centro de la pantalla, efecto de escala y resalte rápido)
  if (animation === 'tiktok-pop') {
    timestamps.forEach((wt, idx) => {
      const start = formatTimeASS(wt.start + startOffset);
      const end = formatTimeASS(wt.end + startOffset);
      
      const cleanWord = wt.word.toUpperCase();
      // Aplicamos \\pos(X,Y) y control de velocidad en la marca temporal \\t
      const text = `{\\pos(${X},${Y})\\fscx125\\fscy125\\c${assActiveColor}\\t(0, ${speed}, \\fscx100\\fscy100)}${cleanWord}`;
      
      assContent += `Dialogue: ${idx},${start},${end},Default,,0,0,0,,${text}\n`;
    });
  } 
  
  // Estilo 1b: Bounce Pop (Efecto rebote elástico por palabra, alta retención)
  else if (animation === 'bounce-pop') {
    const halfSpeed = Math.round(speed / 2);
    timestamps.forEach((wt, idx) => {
      const start = formatTimeASS(wt.start + startOffset);
      const end = formatTimeASS(wt.end + startOffset);
      
      const cleanWord = wt.word.toUpperCase();
      // El rebote utiliza dos transiciones consecutivas escaladas según el tiempo de velocidad
      const text = `{\\pos(${X},${Y})\\fscx145\\fscy145\\c${assActiveColor}\\t(0, ${halfSpeed}, \\fscx92\\fscy92)\\t(${halfSpeed}, ${speed}, \\fscx100\\fscy100)}${cleanWord}`;
      
      assContent += `Dialogue: ${idx},${start},${end},Default,,0,0,0,,${text}\n`;
    });
  }

  // Estilo 1b: Bounce Pop (Efecto rebote elástico por palabra, alta retención)
  else if (animation === 'bounce-pop') {
    const halfSpeed = Math.round(speed / 2);
    timestamps.forEach((wt, idx) => {
      const start = formatTimeASS(wt.start + startOffset);
      const end = formatTimeASS(wt.end + startOffset);
      
      const cleanWord = wt.word.toUpperCase();
      // El rebote utiliza dos transiciones consecutivas escaladas según el tiempo de velocidad
      const text = `{\\pos(${X},${Y})\\fscx145\\fscy145\\c${assActiveColor}\\t(0, ${halfSpeed}, \\fscx92\\fscy92)\\t(${halfSpeed}, ${speed}, \\fscx100\\fscy100)}${cleanWord}`;
      
      assContent += `Dialogue: ${idx},${start},${end},Default,,0,0,0,,${text}\n`;
    });
  }

  // Estilo 1d: Kinetic Wave (Onda cinética con micro-giro y oscilación orgánica, estilo Drift)
  else if (animation === 'kinetic-wave') {
    const halfSpeed = Math.max(30, Math.round(speed / 2));
    timestamps.forEach((wt, idx) => {
      const start = formatTimeASS(wt.start + startOffset);
      const end = formatTimeASS(wt.end + startOffset);
      const cleanWord = wt.word.toUpperCase();
      
      const text = `{\\pos(${X},${Y})\\frz-4\\fscx130\\fscy130\\c${assActiveColor}\\t(0, ${halfSpeed}, \\frz3\\fscx108\\fscy108)\\t(${halfSpeed}, ${speed}, \\frz0\\fscx100\\fscy100)}${cleanWord}`;
      assContent += `Dialogue: ${idx},${start},${end},Default,,0,0,0,,${text}\n`;
    });
  }

  // Estilo 1e: Typewriter (Máquina de escribir cinemática con revelado rápido y resalte de cursor)
  else if (animation === 'typewriter') {
    timestamps.forEach((wt, idx) => {
      const start = formatTimeASS(wt.start + startOffset);
      const end = formatTimeASS(wt.end + startOffset);
      const cleanWord = wt.word.toUpperCase();
      
      // Aparición instantánea con fundido milimétrico y foco nítido
      const text = `{\\pos(${X},${Y})\\fad(35,0)\\c${assActiveColor}\\fscx105\\fscy105}${cleanWord}`;
      assContent += `Dialogue: ${idx},${start},${end},Default,,0,0,0,,${text}\n`;
    });
  }

  // Estilo 1f: Neon Glow (Resplandor de neón de alto contraste y desenfoque perimetral para máxima visibilidad)
  else if (animation === 'neon-glow') {
    timestamps.forEach((wt, idx) => {
      const start = formatTimeASS(wt.start + startOffset);
      const end = formatTimeASS(wt.end + startOffset);
      const cleanWord = wt.word.toUpperCase();
      
      const text = `{\\pos(${X},${Y})\\blur4\\3c${assActiveColor}\\c&H00FFFFFF&\\fscx120\\fscy120\\t(0, ${speed}, \\fscx100\\fscy100)}${cleanWord}`;
      assContent += `Dialogue: ${idx},${start},${end},Karaoke,,0,0,0,,${text}\n`;
    });
  }

  // Estilo 1g: Slide Up (Deslizamiento ascendente suave desde la base del cuadro)
  else if (animation === 'slide-up') {
    const slideOffset = isLandscape ? 35 : 45;
    timestamps.forEach((wt, idx) => {
      const start = formatTimeASS(wt.start + startOffset);
      const end = formatTimeASS(wt.end + startOffset);
      const cleanWord = wt.word.toUpperCase();
      
      const text = `{\\pos(${X},${Y + slideOffset})\\c${assActiveColor}\\fad(50,0)\\t(0, ${speed}, \\pos(${X},${Y}))}${cleanWord}`;
      assContent += `Dialogue: ${idx},${start},${end},Default,,0,0,0,,${text}\n`;
    });
  }

  // Estilo 1c: Borde Emergente II (Caja morada plana sin borde blanco que emerge sobre la palabra de la frase en bloque sin zoom)
  else if (animation === 'borde-emergente-2') {
    const maxWordsPerPhrase = 4;
    const phrases = [];
    let currentPhrase = [];

    // Segmentación inteligente basada en puntuación (.!?) y silencios (>0.4s) para evitar combinar oraciones distintas
    for (let i = 0; i < timestamps.length; i++) {
      const wt = timestamps[i];
      currentPhrase.push(wt);

      const hasEndingPunctuation = /[.!?]/.test(wt.word);
      const isTooLong = currentPhrase.length >= maxWordsPerPhrase;
      
      // Cerrar frase si la siguiente palabra tiene una pausa de silencio significativa (>0.4s)
      let hasSignificantPause = false;
      if (i < timestamps.length - 1) {
        const nextWt = timestamps[i + 1];
        if (nextWt.start - wt.end > 0.4) {
          hasSignificantPause = true;
        }
      }

      if (hasEndingPunctuation || isTooLong || hasSignificantPause) {
        phrases.push(currentPhrase);
        currentPhrase = [];
      }
    }
    if (currentPhrase.length > 0) {
      phrases.push(currentPhrase);
    }

    const measurer = textMetrics.createTextMeasurer(font, activeFontSize, subtitleLetterSpacing);
    const maxLineWidth = resX - 120; // márgenes izquierdo/derecho del estilo (60 + 60)
    // Proporciones tomadas de un export real de CapCut (caja #830AE8 sobre texto en mayúsculas)
    const boxPadX = activeFontSize * 0.11;
    const boxPadY = activeFontSize * 0.19;
    const boxRadius = activeFontSize * 0.09;
    if (!measurer) {
      console.warn(`[Subtítulos] No se encontró el archivo de la fuente "${font}"; se usa la caja de respaldo.`);
    }

    let dialogueIdx = 0;
    phrases.forEach((phrase) => {
      const cleanWords = phrase.map((wt) => (wt.word ? wt.word.replace(/[\{\}\\]/g, '').toUpperCase() : ''));
      const lineText = cleanWords.join(' ');
      const lineWidth = measurer ? measurer.widthOf(lineText) : 0;
      // Si la frase no cabe en una línea libass la parte en dos y la medición ya no aplica
      const canDrawBox = measurer && lineWidth <= maxLineWidth;

      phrase.forEach((activeWt, wIdx) => {
        const wordStart = formatTimeASS(activeWt.start + startOffset);
        // Determinar fin de diálogo: si no es la última palabra del bloque, termina exactamente al inicio de la siguiente
        const endVal = (wIdx < phrase.length - 1) ? phrase[wIdx + 1].start : activeWt.end;
        const wordEnd = formatTimeASS(endVal + startOffset);

        // Capa inferior: la caja morada detrás de la palabra activa, que "emerge" con un pop rápido
        let boxDialogue;
        if (canDrawBox) {
          const textBefore = cleanWords.slice(0, wIdx).join(' ') + (wIdx > 0 ? ' ' : '');
          const wordLeft = X - lineWidth / 2 + measurer.widthOf(textBefore);
          const wordWidth = measurer.widthOf(cleanWords[wIdx]) - (parseFloat(subtitleLetterSpacing) || 0);
          const { capTop, baseline } = measurer.lineBox(Y);
          const boxW = wordWidth + boxPadX * 2;
          const boxH = baseline - capTop + boxPadY * 2;
          const centerX = Math.round(wordLeft + wordWidth / 2);
          const centerY = Math.round((capTop + baseline) / 2);
          const drawing = textMetrics.roundedRectDrawing(boxW, boxH, boxRadius);
          boxDialogue = `CajaCapCut,,0,0,0,,{\\an5\\pos(${centerX},${centerY})\\fscx88\\fscy88\\alpha&H40&\\t(0,${speed},\\fscx100\\fscy100\\alpha&H00&)\\p1}${drawing}{\\p0}`;
        } else {
          // Respaldo: contorno grueso solo en la palabra activa (las demás ocupan su espacio pero son invisibles).
          // Se anima la opacidad y no el grosor, porque animar \bord desplaza la línea en libass.
          const boxTextParts = phrase.map((wt, i) => {
            if (wt === activeWt) {
              return `{\\3a&HC0&\\t(0,${speed},\\3a&H00&)}${cleanWords[i]}{\\3a&HFF&}`;
            }
            return cleanWords[i];
          });
          boxDialogue = `BordeEmergente,,0,0,0,,{\\pos(${X},${Y})\\3a&HFF&}${boxTextParts.join(' ')}`;
        }

        // Capa superior (Default): la frase completa con su contorno negro, incluida la palabra activa
        const textDialogueText = `{\\pos(${X},${Y})}${lineText}`;

        // Escribimos ambas capas en el mismo intervalo de tiempo (la caja debajo del texto)
        const layerBox = dialogueIdx * 2;
        const layerText = dialogueIdx * 2 + 1;
        assContent += `Dialogue: ${layerBox},${wordStart},${wordEnd},${boxDialogue}\n`;
        assContent += `Dialogue: ${layerText},${wordStart},${wordEnd},Default,,0,0,0,,${textDialogueText}\n`;
        dialogueIdx++;
      });
    });
  }

  // Estilo 2: Active Highlight (Muestra bloques de frase de 4 palabras, iluminando la palabra activa, sin zoom)
  else if (animation === 'active-highlight') {
    const maxWordsPerPhrase = 4;
    const phrases = [];
    let currentPhrase = [];

    // Segmentación inteligente basada en puntuación (.!?) y silencios (>0.4s) para evitar combinar oraciones distintas
    for (let i = 0; i < timestamps.length; i++) {
      const wt = timestamps[i];
      currentPhrase.push(wt);

      const hasEndingPunctuation = /[.!?]/.test(wt.word);
      const isTooLong = currentPhrase.length >= maxWordsPerPhrase;
      
      // Cerrar frase si la siguiente palabra tiene una pausa de silencio significativa (>0.4s)
      let hasSignificantPause = false;
      if (i < timestamps.length - 1) {
        const nextWt = timestamps[i + 1];
        if (nextWt.start - wt.end > 0.4) {
          hasSignificantPause = true;
        }
      }

      if (hasEndingPunctuation || isTooLong || hasSignificantPause) {
        phrases.push(currentPhrase);
        currentPhrase = [];
      }
    }
    if (currentPhrase.length > 0) {
      phrases.push(currentPhrase);
    }

    let dialogueIdx = 0;
    phrases.forEach((phrase) => {
      phrase.forEach((activeWt, wIdx) => {
        const wordStart = formatTimeASS(activeWt.start + startOffset);
        // Determinar fin de diálogo: si no es la última palabra del bloque, termina exactamente al inicio de la siguiente
        const endVal = (wIdx < phrase.length - 1) ? phrase[wIdx + 1].start : activeWt.end;
        const wordEnd = formatTimeASS(endVal + startOffset);

        // Capa 1: Capa Pasiva (Default) - Todas las letras en blanco/pasivo, la palabra activa es transparente
        const passiveTextParts = phrase.map((wt) => {
          const cleanWord = wt.word ? wt.word.replace(/[\{\}\\]/g, '').toUpperCase() : '';
          if (wt === activeWt) {
            return `{\\alpha&HFF&}${cleanWord}{\\alpha&H00&}`;
          } else {
            return cleanWord;
          }
        });
        const passiveDialogueText = `{\\pos(${X},${Y})}${passiveTextParts.join(' ')}`;

        // Capa 2: Capa Activa (Karaoke) - Todas las letras transparentes, la palabra activa es opaca en color activo
        const activeTextParts = phrase.map((wt) => {
          const cleanWord = wt.word ? wt.word.replace(/[\{\}\\]/g, '').toUpperCase() : '';
          if (wt === activeWt) {
            return `{\\alpha&H00&}${cleanWord}{\\alpha&HFF&}`;
          } else {
            return cleanWord;
          }
        });
        const activeDialogueText = `{\\pos(${X},${Y})}{\\alpha&HFF&}${activeTextParts.join(' ')}`;

        // Escribimos ambas capas en el mismo intervalo de tiempo
        const layerPassive = dialogueIdx * 2;
        const layerActive = dialogueIdx * 2 + 1;
        assContent += `Dialogue: ${layerPassive},${wordStart},${wordEnd},Default,,0,0,0,,${passiveDialogueText}\n`;
        assContent += `Dialogue: ${layerActive},${wordStart},${wordEnd},Karaoke,,0,0,0,,${activeDialogueText}\n`;
        dialogueIdx++;
      });
    });
  } 
  
  // Estilo 2b: Glow Karaoke (Línea de frase bloque con resalte de contorno brillante estilo Neón, sin zoom)
  else if (animation === 'glow-karaoke') {
    const maxWordsPerPhrase = 4;
    const phrases = [];
    let currentPhrase = [];

    // Segmentación inteligente basada en puntuación (.!?) y silencios (>0.4s) para evitar combinar oraciones distintas
    for (let i = 0; i < timestamps.length; i++) {
      const wt = timestamps[i];
      currentPhrase.push(wt);

      const hasEndingPunctuation = /[.!?]/.test(wt.word);
      const isTooLong = currentPhrase.length >= maxWordsPerPhrase;
      
      // Cerrar frase si la siguiente palabra tiene una pausa de silencio significativa (>0.4s)
      let hasSignificantPause = false;
      if (i < timestamps.length - 1) {
        const nextWt = timestamps[i + 1];
        if (nextWt.start - wt.end > 0.4) {
          hasSignificantPause = true;
        }
      }

      if (hasEndingPunctuation || isTooLong || hasSignificantPause) {
        phrases.push(currentPhrase);
        currentPhrase = [];
      }
    }
    if (currentPhrase.length > 0) {
      phrases.push(currentPhrase);
    }

    let dialogueIdx = 0;
    phrases.forEach((phrase) => {
      phrase.forEach((activeWt, wIdx) => {
        const wordStart = formatTimeASS(activeWt.start + startOffset);
        // Determinar fin de diálogo: si no es la última palabra del bloque, termina exactamente al inicio de la siguiente
        const endVal = (wIdx < phrase.length - 1) ? phrase[wIdx + 1].start : activeWt.end;
        const wordEnd = formatTimeASS(endVal + startOffset);

        // Capa 1: Capa Pasiva (Default) - Todas las letras en blanco/pasivo, la palabra activa es transparente
        const passiveTextParts = phrase.map((wt) => {
          const cleanWord = wt.word ? wt.word.replace(/[\{\}\\]/g, '').toUpperCase() : '';
          if (wt === activeWt) {
            return `{\\alpha&HFF&}${cleanWord}{\\alpha&H00&}`;
          } else {
            return cleanWord;
          }
        });
        const passiveDialogueText = `{\\pos(${X},${Y})}${passiveTextParts.join(' ')}`;

        // Capa 2: Capa Activa (Karaoke) - Todas las letras transparentes, la palabra activa es opaca en color activo con contorno activo de Neón
        const activeTextParts = phrase.map((wt) => {
          const cleanWord = wt.word ? wt.word.replace(/[\{\}\\]/g, '').toUpperCase() : '';
          if (wt === activeWt) {
            return `{\\alpha&H00&\\3c${assActiveColor}}${cleanWord}{\\alpha&HFF&\\3c${assOutlineColor}}`;
          } else {
            return cleanWord;
          }
        });
        const activeDialogueText = `{\\pos(${X},${Y})}{\\alpha&HFF&}${activeTextParts.join(' ')}`;

        // Escribimos ambas capas en el mismo intervalo de tiempo
        const layerPassive = dialogueIdx * 2;
        const layerActive = dialogueIdx * 2 + 1;
        assContent += `Dialogue: ${layerPassive},${wordStart},${wordEnd},Default,,0,0,0,,${passiveDialogueText}\n`;
        assContent += `Dialogue: ${layerActive},${wordStart},${wordEnd},Karaoke,,0,0,0,,${activeDialogueText}\n`;
        dialogueIdx++;
      });
    });
  }

  // Estilo 3: Clean Fade (Minimimalista, bloques que aparecen con fundido suave)
  else {
    const wordsPerBlock = 5;
    let dialogueIdx = 0;
    for (let i = 0; i < timestamps.length; i += wordsPerBlock) {
      const block = timestamps.slice(i, i + wordsPerBlock);
      const start = formatTimeASS(block[0].start + startOffset);
      const end = formatTimeASS(block[block.length - 1].end + startOffset);
      
      const blockText = block.map(w => w.word).join(' ');
      const text = `{\\pos(${X},${Y})\\fad(100,100)\\c${assPassiveColor}}${blockText}`;
      
      assContent += `Dialogue: ${dialogueIdx},${start},${end},Default,,0,0,0,,${text}\n`;
      dialogueIdx++;
    }
  }

  // Lógica para añadir marca de agua si está habilitada
  if (watermarkEnabled && (!watermarkType || watermarkType === 'text')) {
    const endOffsetTime = timestamps.length > 0 ? (timestamps[timestamps.length - 1].end + startOffset + 2) : 60;
    const endOffsetTimeStr = formatTimeASS(endOffsetTime);

    if (watermarkAnimation === 'none') {
      const align = parseInt(watermarkAlignment || 9);
      const offX = parseInt(watermarkOffsetX !== undefined ? watermarkOffsetX : 20);
      const offY = parseInt(watermarkOffsetY !== undefined ? watermarkOffsetY : 20);
      
      let mL = 10, mR = 10, mV = 10;
      if (align === 1 || align === 4 || align === 7) mL = offX;
      if (align === 3 || align === 6 || align === 9) mR = offX;
      mV = offY;
      
      assContent += `Dialogue: 0,0:00:00.00,${endOffsetTimeStr},Watermark,,${mL},${mR},${mV},,${watermarkText}\n`;
    } 
    else if (watermarkAnimation === 'bounce' || watermarkAnimation === 'bounce-wobble') {
      const durMs = Math.round(endOffsetTime * 1000);
      const intervalMs = Math.round((watermarkSpeed !== undefined ? parseFloat(watermarkSpeed) : 2.5) * 1000);
      const numSteps = Math.ceil(durMs / intervalMs);
      
      // Estimar ancho y alto del texto de la marca de agua (factor 0.65 para fuentes gruesas)
      const wmSize = parseInt(watermarkSize || 24);
      const textWidth = Math.round(watermarkText.length * wmSize * 0.65);
      const textHeight = wmSize;
      
      const halfW = Math.round(textWidth / 2);
      const halfH = Math.round(textHeight / 2);
      
      // Safe Zone optimizada para máxima amplitud sin salirse de los límites
      const marginX = 15; // Margen mínimo de 15px para que el texto roce los bordes izquierdo/derecho
      const marginY = isLandscape ? 30 : 50; // Margen vertical mínimo para que roce el borde superior/inferior
      
      // Limitar el tamaño de la caja de colisión horizontal y vertical para textos extra-largos
      const maxHalfW = Math.round(resX / 2 - marginX - 10);
      const safeHalfW = Math.min(halfW, maxHalfW > 0 ? maxHalfW : 50);
      
      const maxHalfH = Math.round(resY / 2 - marginY - 10);
      const safeHalfH = Math.min(halfH, maxHalfH > 0 ? maxHalfH : 20);
      
      const minX = safeHalfW + marginX;
      const maxX = resX - (safeHalfW + marginX);
      const minY = safeHalfH + marginY;
      const maxY = resY - (safeHalfH + marginY);
      
      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: Math.round((minY + maxY) / 2) }, // Mitad izquierda
        { x: maxX, y: minY },
        { x: minX, y: maxY },
        { x: maxX, y: Math.round((minY + maxY) / 2) }  // Mitad derecha
      ];
      
      let currentIdx = 0;
      for (let step = 0; step < numSteps; step++) {
        const tStart = step * intervalMs;
        const tEnd = Math.min((step + 1) * intervalMs, durMs);
        if (tStart >= durMs) break;
        
        const p1 = corners[currentIdx % corners.length];
        const p2 = corners[(currentIdx + 1) % corners.length];
        currentIdx++;
        
        const startStr = formatTimeASS(tStart / 1000);
        const endStr = formatTimeASS(tEnd / 1000);
        
        // Forzamos \an5 (Alineación Centro Centro) para que el movimiento \move apunte al centro geométrico del texto
        let effectTags = `\\an5\\move(${p1.x},${p1.y},${p2.x},${p2.y})`;
        if (watermarkAnimation === 'bounce-wobble') {
          const startAngle = step % 2 === 0 ? -8 : 8;
          const endAngle = step % 2 === 0 ? 8 : -8;
          effectTags += `\\frz${startAngle}\\t(0,${tEnd - tStart},\\frz${endAngle})`; // Balanceo dinámico durante el trayecto
        }
        
        assContent += `Dialogue: 0,${startStr},${endStr},Watermark,,0,0,0,,{${effectTags}}${watermarkText}\n`;
      }
    } 
    else if (watermarkAnimation === 'wobble') {
      const align = parseInt(watermarkAlignment || 9);
      const offX = parseInt(watermarkOffsetX !== undefined ? watermarkOffsetX : 20);
      const offY = parseInt(watermarkOffsetY !== undefined ? watermarkOffsetY : 20);
      
      let mL = 10, mR = 10, mV = 10;
      if (align === 1 || align === 4 || align === 7) mL = offX;
      if (align === 3 || align === 6 || align === 9) mR = offX;
      mV = offY;
      
      const durMs = Math.round(endOffsetTime * 1000);
      const intervalMs = Math.round((watermarkSpeed !== undefined ? parseFloat(watermarkSpeed) : 2.0) * 1000);
      const numSteps = Math.ceil(durMs / intervalMs);
      
      for (let step = 0; step < numSteps; step++) {
        const tStart = step * intervalMs;
        const tEnd = Math.min((step + 1) * intervalMs, durMs);
        if (tStart >= durMs) break;
        
        const startStr = formatTimeASS(tStart / 1000);
        const endStr = formatTimeASS(tEnd / 1000);
        
        const startAngle = step % 2 === 0 ? 6 : -6;
        const endAngle = step % 2 === 0 ? -6 : 6;
        const effectTags = `\\frz${startAngle}\\t(0,${tEnd - tStart},\\frz${endAngle})`;
        
        assContent += `Dialogue: 0,${startStr},${endStr},Watermark,,${mL},${mR},${mV},,{${effectTags}}${watermarkText}\n`;
      }
    }
  }

  // Capas de texto del mini editor de overlays (ej. "HISTORIA COMPLETA" arriba con bamboleo)
  const lastWordEnd = timestamps.length > 0 ? timestamps[timestamps.length - 1].end + startOffset : 60;
  assContent += buildTextLayerEvents(template.overlays, { resX, resY, videoEnd: lastWordEnd + 1 });

  try {
    fs.writeFileSync(outputPath, assContent, 'utf8');
    console.log(`Subtítulos ASS generados exitosamente en: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error escribiendo subtítulos ASS:', error);
    throw error;
  }
}

module.exports = {
  generateAssSubtitles
};

const fs = require('fs');
const path = require('path');

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
`;

  // Estilo dedicado de Borde Emergente II (Caja de color morado plano estilo Capcut sin contorno blanco)
  if (animation === 'borde-emergente-2') {
    const boxBgColor = '&H008E136C&'; // Morado Capcut en BGR (#6C138E)
    // Para BorderStyle 3 (caja sólida), el PrimaryColour es el texto y el OutlineColour es el fondo de la caja
    assContent += `Style: BordeEmergente,${font},${activeFontSize},&H00FFFFFF&,&H000000FF&,${boxBgColor},&H00000000&,-1,0,0,0,100,100,${subtitleLetterSpacing},0,3,4.0,0,5,60,60,650,1\n`;
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

    let dialogueIdx = 0;
    phrases.forEach((phrase) => {
      phrase.forEach((activeWt, wIdx) => {
        const wordStart = formatTimeASS(activeWt.start + startOffset);
        // Determinar fin de diálogo: si no es la última palabra del bloque, termina exactamente al inicio de la siguiente
        const endVal = (wIdx < phrase.length - 1) ? phrase[wIdx + 1].start : activeWt.end;
        const wordEnd = formatTimeASS(endVal + startOffset);

        // Capa 1: Capa Pasiva (Default) - Todas las letras en blanco/pasivo, la palabra activa es transparente
        const passiveTextParts = phrase.map((wt) => {
          if (wt === activeWt) {
            return `{\\alpha&HFF&}${wt.word.toUpperCase()}{\\alpha&H00&}`;
          } else {
            return wt.word.toUpperCase();
          }
        });
        const passiveDialogueText = `{\\pos(${X},${Y})}${passiveTextParts.join(' ')}`;

        // Capa 2: Capa Activa (BordeEmergente) - Todas las letras transparentes, la palabra activa es opaca (sin zoom/escala)
        const activeTextParts = phrase.map((wt) => {
          if (wt === activeWt) {
            return `{\\alpha&H00&}${wt.word.toUpperCase()}{\\alpha&HFF&}`;
          } else {
            return wt.word.toUpperCase();
          }
        });
        const activeDialogueText = `{\\pos(${X},${Y})}{\\alpha&HFF&}${activeTextParts.join(' ')}`;

        // Escribimos ambas capas en el mismo intervalo de tiempo
        const layerPassive = dialogueIdx * 2;
        const layerActive = dialogueIdx * 2 + 1;
        assContent += `Dialogue: ${layerPassive},${wordStart},${wordEnd},Default,,0,0,0,,${passiveDialogueText}\n`;
        assContent += `Dialogue: ${layerActive},${wordStart},${wordEnd},BordeEmergente,,0,0,0,,${activeDialogueText}\n`;
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

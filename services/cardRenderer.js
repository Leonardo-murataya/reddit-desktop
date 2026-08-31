const { createCanvas, loadImage, Path2D, GlobalFonts } = require('@napi-rs/canvas');
const { execFileSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

// Registrar fuentes locales si existen
const localFontsDir = path.join(__dirname, '..', 'fonts');
if (fs.existsSync(localFontsDir)) {
  const bangersPath = path.join(localFontsDir, 'Bangers-Regular.ttf');
  if (fs.existsSync(bangersPath)) {
    try {
      GlobalFonts.registerFromPath(bangersPath, 'Bangers');
    } catch (e) {}
  }
}

// Iconos SVG pre-vectorizados en Path2D para dibujo ultra-rápido
const ICONS = {
  // Insignia de verificado estilo Reddit / Postfully
  verified: new Path2D('M12.5589 0.726691C12.9733 0.847424 13.3429 1.1642 14.082 1.79776L14.8782 2.48016C15.2109 2.76534 15.3772 2.90792 15.5649 3.00949C15.7314 3.09957 15.9098 3.16558 16.0948 3.20551C16.3034 3.25054 16.5225 3.25054 16.9607 3.25054L17.5495 3.25054C18.6696 3.25054 19.2297 3.25054 19.6575 3.46852C20.0338 3.66027 20.3398 3.96623 20.5315 4.34255C20.7495 4.77038 20.7495 5.33043 20.7495 6.45053L20.7495 7.03934C20.7495 7.47754 20.7495 7.69664 20.7945 7.90523C20.8345 8.09025 20.9005 8.26866 20.9906 8.43513C21.0921 8.62281 21.2347 8.78916 21.5199 9.12187L22.2023 9.918C22.8359 10.6572 23.1526 11.0267 23.2734 11.4412C23.3798 11.8065 23.3798 12.1946 23.2734 12.5599C23.1526 12.9743 22.8359 13.3439 22.2023 14.0831L21.5199 14.8792C21.2347 15.2119 21.0921 15.3783 20.9906 15.5659C20.9005 15.7324 20.8345 15.9108 20.7945 16.0958C20.7495 16.3044 20.7495 16.5235 20.7495 16.9617L20.7495 17.5505C20.7495 18.6706 20.7495 19.2307 20.5315 19.6585C20.3398 20.0348 20.0338 20.3408 19.6575 20.5325C19.2297 20.7505 18.6696 20.7505 17.5495 20.7505L16.9607 20.7505C16.5225 20.7505 16.3034 20.7505 16.0948 20.7956C15.9098 20.8355 15.7314 20.9015 15.5649 20.9916C15.3772 21.0931 15.2109 21.2357 14.8782 21.5209L14.8782 21.5209L14.082 22.2033L14.082 22.2033C13.3429 22.8369 12.9733 23.1537 12.5589 23.2744C12.1936 23.3808 11.8055 23.3808 11.4402 23.2744C11.0257 23.1536 10.6561 22.8369 9.917 22.2033L9.91698 22.2033L9.12085 21.5209C8.78814 21.2357 8.62179 21.0931 8.43412 20.9916C8.26765 20.9015 8.08923 20.8355 7.90421 20.7956C7.69562 20.7505 7.47652 20.7505 7.03832 20.7505L6.4153 20.7505L6.41527 20.7505C5.29519 20.7505 4.73514 20.7505 4.30732 20.5325C3.931 20.3408 3.62503 20.0348 3.43329 19.6585C3.2153 19.2307 3.2153 18.6706 3.2153 17.5505L3.2153 16.949C3.2153 16.5146 3.2153 16.2973 3.17099 16.0903C3.13169 15.9067 3.06672 15.7296 2.97801 15.5641C2.878 15.3775 2.73756 15.2118 2.45668 14.8803L1.76945 14.0693C1.14668 13.3343 0.835291 12.9669 0.716483 12.5555C0.611756 12.1929 0.611756 11.8081 0.716483 11.4455C0.835291 11.0342 1.14668 10.6667 1.76945 9.9318L2.45668 9.12078L2.45668 9.12077C2.73756 8.78929 2.878 8.62356 2.97801 8.437C3.06672 8.27151 3.13169 8.09435 3.17099 7.91075C3.2153 7.70376 3.2153 7.48652 3.2153 7.05204L3.2153 6.45053C3.2153 5.33043 3.2153 4.77038 3.43329 4.34255C3.62503 3.96623 3.931 3.66027 4.30732 3.46852C4.73514 3.25054 5.2952 3.25054 6.4153 3.25054L7.03832 3.25054C7.47652 3.25054 7.69562 3.25054 7.90421 3.20551C8.08923 3.16557 8.26765 3.09957 8.43412 3.00949C8.62179 2.90792 8.78814 2.76534 9.12084 2.48016L9.12085 2.48016L9.91699 1.79775C10.6561 1.1642 11.0257 0.847424 11.4402 0.726691C11.8055 0.620281 12.1936 0.620281 12.5589 0.726691ZM16.5306 9.53033C16.8235 9.23744 16.8235 8.76257 16.5306 8.46967C16.2377 8.17678 15.7628 8.17678 15.4699 8.46967L11.0002 12.9393L9.53058 11.4697C9.23768 11.1768 8.76281 11.1768 8.46992 11.4697C8.17702 11.7626 8.17702 12.2374 8.46992 12.5303L10.4699 14.5303C10.6106 14.671 10.8013 14.75 11.0002 14.75C11.1992 14.75 11.3899 14.671 11.5306 14.5303L16.5306 9.53033Z'),
  // Corazón / Votos estilo Postfully
  heart: new Path2D('M12 21C13 21 22 16.0003 22 9.00046C22 5.5006 19 3.04408 16 3.00068C14.5 2.97897 13 3.50068 12 5.00062C11 3.50068 9.47405 3.00068 8 3.00068C5 3.00068 2 5.5006 2 9.00046C2 16.0003 11 21 12 21Z'),
  // Burbuja de comentarios
  comment: new Path2D('M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.499 2.33015 14.921 2.9214 16.1973C3.38829 17.2052 3.83022 18.0644 3.50454 19.1977C3.34789 19.7429 2.95529 20.2798 2.90866 20.8475C2.85534 21.4967 3.42708 22.0228 4.06965 21.9157C5.3779 21.6977 6.0076 20.6574 7.52552 21.0144C7.69003 21.0531 8.11879 21.2065 8.97627 21.5132C9.88354 21.8377 10.8606 22 12 22Z'),
  // Compartir
  share: new Path2D('M8 10H7.5V10C6.10444 10 5.40666 10 4.83886 10.1722C3.56046 10.56 2.56004 11.5605 2.17224 12.8389C2 13.4067 2 14.1044 2 15.5V16C2 17.8638 2 18.7956 2.30448 19.5307C2.71046 20.5108 3.48915 21.2895 4.46927 21.6955C5.20435 22 6.13623 22 8 22L16 22C17.8638 22 18.7956 22 19.5307 21.6955C20.5108 21.2895 21.2895 20.5108 21.6955 19.5307C22 18.7956 22 17.8638 22 16V15.5C22 14.1044 22 13.4067 21.8278 12.8389C21.44 11.5605 20.4395 10.56 19.1611 10.1722C18.5933 10 17.8956 10 16.5 10V10H16M12 15V2M12 2L8 6M12 2L16 6')
};

/**
 * Obtiene un frame estático visible no-blanco de un archivo GIF animado para la tarjeta fija.
 */
function getStaticAwardFrame(gifPath, awardFile) {
  const cacheDir = path.join(__dirname, '..', 'temp', 'assets', 'award_frames');
  if (!fs.existsSync(cacheDir)) {
    try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) {}
  }
  const cleanName = awardFile.replace(/[\\/:*?"<>|]/g, '_').replace(/\.gif$/i, '.png');
  const cachedPng = path.join(cacheDir, cleanName);
  if (fs.existsSync(cachedPng)) return cachedPng;

  try {
    execFileSync(ffmpegPath, ['-y', '-ss', '0.15', '-i', gifPath, '-vframes', '1', cachedPng], { stdio: 'ignore' });
    if (fs.existsSync(cachedPng)) return cachedPng;
  } catch (e) {}

  return gifPath;
}

/**
 * Divide un texto en líneas para que quepa dentro de un ancho máximo.
 */
function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const paragraphs = text.split('\n');
  const lines = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + ' ' + word;
      const width = ctx.measureText(testLine).width;
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Renderiza la tarjeta de Reddit como una imagen PNG nítida (o WebM animado si se elige modo animado).
 * @param {object} cardData - Datos del card (title, username, subreddit, avatar, upvotes, comments, theme, cardType, etc.)
 * @param {string} outputPath - Ruta de salida base del archivo PNG
 * @returns {Promise<string>} Ruta final del archivo generado (PNG o WebM)
 */
async function renderCard(cardData, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const {
    title = '',
    username = 'reddit_user',
    subreddit = 'r/AskReddit',
    avatar,
    upvotes = '1.5k',
    comments = '250',
    theme = 'dark',
    cardType = 'static'
  } = cardData;

  const scale = 2.2;
  const isDark = theme === 'dark';
  const isAnimatedMode = cardType === 'animated';

  // Configuración de colores
  const colors = {
    bg: isDark ? '#1c1c1e' : '#ffffff',
    text: isDark ? '#e5e5e7' : '#11151a',
    title: isDark ? '#ffffff' : '#11151a',
    meta: isDark ? '#94a3b8' : '#5c6c74',
    border: isDark ? '#2c2c2e' : '#edeff1',
    verified: '#38bdf8'
  };

  const cardWidth = Math.round((cardData.cardWidth !== undefined ? cardData.cardWidth : 260) * scale);
  const cardRadius = Math.round((cardData.cardBorderRadius !== undefined ? cardData.cardBorderRadius : 11) * scale);
  const cardPadding = Math.round((cardData.cardPadding !== undefined ? cardData.cardPadding : 12) * scale);
  const cardGap = Math.round((cardData.cardGap !== undefined ? cardData.cardGap : 7) * scale);

  const cardShowVerified = cardData.cardShowVerified !== undefined ? cardData.cardShowVerified : true;
  const cardShowAwards = cardData.cardShowAwards !== undefined ? cardData.cardShowAwards : true;

  // 1. Cargar Avatar
  let avatarImg = null;
  const defaultAvatarPath = path.join(__dirname, '..', 'frontend', 'public', 'reddit-avatar.png');
  let avatarLoaded = false;

  if (avatar && avatar.startsWith('/avatars/')) {
    const filename = path.basename(avatar);
    const localAvatar = path.join(__dirname, '..', 'temp', 'avatars', filename);
    if (fs.existsSync(localAvatar)) {
      try {
        avatarImg = await loadImage(localAvatar);
        avatarLoaded = true;
      } catch (e) {}
    }
  } else if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'))) {
    try {
      avatarImg = await loadImage(avatar);
      avatarLoaded = true;
    } catch (e) {}
  } else if (avatar && fs.existsSync(avatar)) {
    try {
      avatarImg = await loadImage(avatar);
      avatarLoaded = true;
    } catch (e) {}
  }

  if (!avatarLoaded && fs.existsSync(defaultAvatarPath)) {
    try {
      avatarImg = await loadImage(defaultAvatarPath);
      avatarLoaded = true;
    } catch (e) {}
  }

  // 2. Cargar Medallas / Awards
  const awardList = [];
  const cardSelectedAwards = cardData.cardSelectedAwards || [];
  const awardsBaseDir = path.join(__dirname, '..', 'frontend', 'public', 'assets', 'awards');
  let awardsStripImg = null;

  if (cardShowAwards) {
    if (Array.isArray(cardSelectedAwards) && cardSelectedAwards.length > 0) {
      for (const item of cardSelectedAwards) {
        if (!item || !item.file) continue;
        const awardPath = path.join(awardsBaseDir, item.file);
        if (fs.existsSync(awardPath)) {
          const isGif = item.file.toLowerCase().endsWith('.gif');
          let staticFramePath = awardPath;
          if (isGif) {
            staticFramePath = getStaticAwardFrame(awardPath, item.file);
          }

          try {
            const img = await loadImage(staticFramePath);
            awardList.push({
              file: item.file,
              rawPath: awardPath,
              isGif,
              img
            });
          } catch (e) {}
        }
      }
    } else {
      const defaultAwardsPath = path.join(__dirname, '..', 'frontend', 'public', 'reddit-awards.png');
      const altAwardsPath = path.join(__dirname, '..', 'temp', 'assets', 'reddit-awards.png');
      const finalAwardsPath = fs.existsSync(defaultAwardsPath) ? defaultAwardsPath : (fs.existsSync(altAwardsPath) ? altAwardsPath : null);
      if (finalAwardsPath) {
        try {
          awardsStripImg = await loadImage(finalAwardsPath);
        } catch (e) {}
      }
    }
  }

  // 3. Medir contenido y calcular altura dinámica
  const measureCanvas = createCanvas(100, 100);
  const measureCtx = measureCanvas.getContext('2d');

  const titleFontSize = Math.round(16 * scale);
  const titleLineHeight = Math.round(20 * scale);
  const maxTextWidth = cardWidth - (cardPadding * 2);

  measureCtx.font = `bold ${titleFontSize}px "Segoe UI", Inter, -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
  const titleLines = wrapText(measureCtx, title, maxTextWidth);
  const titleBlockHeight = Math.max(titleLineHeight, titleLines.length * titleLineHeight);

  const avatarSize = Math.round(36 * scale);
  const headerTextHeight = Math.round(17 * scale + 2 * scale + 14 * scale);
  const headerHeight = Math.max(avatarSize, headerTextHeight);

  let awardsHeight = 0;
  if (awardList.length > 0) {
    awardsHeight = Math.round(18 * scale + 4 * scale);
  } else if (awardsStripImg) {
    awardsHeight = Math.round(14 * scale);
  }

  const footerHeight = Math.round(18 * scale);

  const innerContentHeight = 
    headerHeight +
    (awardsHeight > 0 ? (cardGap * 0.7 + awardsHeight) : 0) +
    cardGap * 1.4 +
    titleBlockHeight +
    cardGap * 1.5 +
    footerHeight;

  const totalCardHeight = cardPadding * 2 + innerContentHeight;

  // 4. Crear Canvas Principal con margen para sombra suave
  const shadowMargin = Math.round(25 * scale);
  const canvasWidth = cardWidth + (shadowMargin * 2);
  const canvasHeight = totalCardHeight + (shadowMargin * 2);

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  const cardX = shadowMargin;
  const cardY = shadowMargin;

  // 5. Dibujar Sombra y Tarjeta
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = Math.round(18 * scale);
  ctx.shadowOffsetY = Math.round(6 * scale);

  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, totalCardHeight, cardRadius);
  ctx.fill();
  ctx.restore();

  // Borde exterior
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, totalCardHeight, cardRadius);
  ctx.stroke();

  // 6. Dibujar Header (Avatar + Subreddit + Verificado + Autor)
  let currentY = cardY + cardPadding;
  const headerX = cardX + cardPadding;

  // Avatar circular
  if (avatarImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(headerX + avatarSize / 2, currentY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, headerX, currentY, avatarSize, avatarSize);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.arc(headerX + avatarSize / 2, currentY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(16 * scale)}px "Segoe UI", Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('r/', headerX + avatarSize / 2, currentY + avatarSize / 2);
    ctx.restore();
  }

  // Textos de Header
  const metaX = headerX + avatarSize + Math.round(7 * scale);
  const subredditFontSize = Math.round(14 * scale);
  const authorFontSize = Math.round(11 * scale);

  ctx.fillStyle = colors.title;
  ctx.font = `bold ${subredditFontSize}px "Segoe UI", Inter, -apple-system, Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(subreddit, metaX, currentY + Math.round(2 * scale));

  const subWidth = ctx.measureText(subreddit).width;

  // Badge de verificado
  if (cardShowVerified) {
    ctx.save();
    const badgeSize = Math.round(12 * scale);
    const badgeX = metaX + subWidth + Math.round(4 * scale);
    const badgeY = currentY + Math.round(3 * scale);
    ctx.translate(badgeX, badgeY);
    ctx.scale(badgeSize / 24, badgeSize / 24);
    ctx.fillStyle = colors.verified;
    ctx.fill(ICONS.verified);
    ctx.restore();
  }

  // Nombre de usuario
  ctx.fillStyle = colors.meta;
  ctx.font = `500 ${authorFontSize}px "Segoe UI", Inter, -apple-system, Arial, sans-serif`;
  ctx.fillText(`u/${username}`, metaX, currentY + Math.round(20 * scale));

  currentY += headerHeight;

  // 7. Medir e identificar posiciones de las Medallas / Awards
  const animatedOverlays = [];
  if (awardList.length > 0) {
    currentY += Math.round(cardGap * 0.7);
    const awardSize = Math.round(18 * scale);
    const awardGap = Math.round(5 * scale);
    let awardX = headerX;

    for (const award of awardList) {
      if (awardX + awardSize > cardX + cardWidth - cardPadding) break;

      if (isAnimatedMode && award.isGif) {
        // En modo animado, guardamos la coordenada exacta para superponer el GIF con FFmpeg
        animatedOverlays.push({
          path: award.rawPath,
          x: awardX,
          y: currentY,
          size: awardSize
        });
      } else {
        // En modo estático (o premios PNG), dibujamos el frame nítido directamente
        ctx.drawImage(award.img, awardX, currentY, awardSize, awardSize);
      }

      awardX += awardSize + awardGap;
    }
    currentY += awardSize;
  } else if (awardsStripImg) {
    currentY += Math.round(cardGap * 0.7);
    const stripHeight = Math.round(11.5 * scale);
    const stripWidth = Math.round((awardsStripImg.width / awardsStripImg.height) * stripHeight);
    ctx.drawImage(awardsStripImg, headerX, currentY, stripWidth, stripHeight);
    currentY += stripHeight;
  }

  // 8. Dibujar Título de la Historia
  currentY += Math.round(cardGap * 1.4);
  ctx.fillStyle = colors.title;
  ctx.font = `bold ${titleFontSize}px "Segoe UI", Inter, -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  for (let i = 0; i < titleLines.length; i++) {
    ctx.fillText(titleLines[i], headerX, currentY + (i * titleLineHeight));
  }

  currentY += titleBlockHeight;

  // 9. Dibujar Footer (Votos, Comentarios, Compartir)
  currentY += Math.round(cardGap * 1.5);
  const footerY = cardY + totalCardHeight - cardPadding - footerHeight;
  const iconSize = Math.round(16 * scale);
  const footerFontSize = Math.round(12 * scale);

  ctx.font = `600 ${footerFontSize}px "Segoe UI", Inter, -apple-system, Arial, sans-serif`;
  ctx.fillStyle = colors.meta;
  ctx.strokeStyle = colors.meta;
  ctx.lineWidth = Math.max(1.5, Math.round(2 * scale));

  let footerX = headerX;

  // Icono de Votos / Corazón
  ctx.save();
  ctx.translate(footerX, footerY);
  ctx.scale(iconSize / 24, iconSize / 24);
  ctx.stroke(ICONS.heart);
  ctx.restore();

  footerX += iconSize + Math.round(4 * scale);
  ctx.textBaseline = 'middle';
  ctx.fillText(String(upvotes), footerX, footerY + iconSize / 2);
  footerX += ctx.measureText(String(upvotes)).width + Math.round(12 * scale);

  // Icono de Comentarios
  ctx.save();
  ctx.translate(footerX, footerY);
  ctx.scale(iconSize / 24, iconSize / 24);
  ctx.stroke(ICONS.comment);
  ctx.restore();

  footerX += iconSize + Math.round(4 * scale);
  ctx.fillText(String(comments), footerX, footerY + iconSize / 2);

  // Icono de Compartir a la derecha
  const shareText = 'Share';
  const shareTextWidth = ctx.measureText(shareText).width;
  const shareRightX = cardX + cardWidth - cardPadding;
  const shareStartX = shareRightX - shareTextWidth - iconSize - Math.round(4 * scale);

  ctx.save();
  ctx.translate(shareStartX, footerY);
  ctx.scale(iconSize / 24, iconSize / 24);
  ctx.stroke(ICONS.share);
  ctx.restore();

  ctx.fillText(shareText, shareStartX + iconSize + Math.round(4 * scale), footerY + iconSize / 2);

  // 10. Guardar la imagen base a PNG
  const finalCanvas = createCanvas(canvasWidth, canvasHeight);
  const finalCtx = finalCanvas.getContext('2d');
  finalCtx.drawImage(canvas, 0, 0);

  const pngBuffer = finalCanvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, pngBuffer);

  // 11. Si está en MODO ANIMADO y hay medallas GIF seleccionadas, generar el video transparente (.mov con canal alfa)
  if (isAnimatedMode && animatedOverlays.length > 0) {
    const movPath = outputPath.replace(/\.png$/i, '.mov');
    try {
      const inputs = ['-y', '-loop', '1', '-t', '3', '-i', outputPath];
      let filter = '[0:v]format=rgba[v0];';
      let lastV = 'v0';

      animatedOverlays.forEach((ov, idx) => {
        const inIdx = idx + 1;
        inputs.push('-stream_loop', '-1', '-t', '3', '-i', ov.path);
        filter += `[${inIdx}:v]scale=${ov.size}:${ov.size},format=rgba[g${inIdx}];`;
        const nextV = (idx === animatedOverlays.length - 1) ? 'out_raw' : `v${inIdx}`;
        filter += `[${lastV}][g${inIdx}]overlay=${ov.x}:${ov.y}:format=rgb:shortest=1[${nextV}];`;
        lastV = nextV;
      });

      filter += `[out_raw]format=rgba[out]`;

      const ffmpegArgs = [
        ...inputs,
        '-filter_complex', filter,
        '-map', '[out]',
        '-c:v', 'qtrle',
        movPath
      ];

      execFileSync(ffmpegPath, ffmpegArgs, { stdio: 'ignore' });
      if (fs.existsSync(movPath)) {
        console.log(`[NativeCanvas] Tarjeta de Reddit ANIMADA transparente generada en ${canvasWidth}x${canvasHeight} a: ${movPath}`);
        return movPath;
      }
    } catch (animErr) {
      console.error('[NativeCanvas] Fallback a tarjeta estática:', animErr.message);
    }
  }

  console.log(`[NativeCanvas] Tarjeta de Reddit renderizada en ${canvasWidth}x${canvasHeight} a: ${outputPath}`);
  return outputPath;
}

module.exports = {
  renderCard
};


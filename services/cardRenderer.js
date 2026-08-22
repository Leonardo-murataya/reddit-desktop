const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

let sharedBrowser = null;

/**
 * Renderiza la tarjeta de Reddit (Title Card) como una imagen PNG transparente.
 * @param {object} cardData - Datos del card (title, username, subreddit, avatar, upvotes, comments, theme)
 * @param {string} outputPath - Ruta de la imagen PNG de salida
 * @returns {Promise<string>} - Retorna la ruta de salida
 */
async function renderCard(cardData, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const {
    title,
    username = 'reddit_user',
    subreddit = 'r/AskReddit',
    avatar,
    upvotes = '1.5k',
    comments = '250',
    theme = 'dark'
  } = cardData;

  // Avatar por defecto si no se provee uno
  const defaultAvatar = 'https://www.redditstatic.com/avatars/avatar_default_02_FF4500.png';
  let activeAvatar = avatar || defaultAvatar;

  // Si es un avatar guardado localmente, lo codificamos en Base64 en memoria para Puppeteer
  // Esto evita restricciones de seguridad de Chromium sobre el protocolo file:/// al usar setContent
  if (avatar && avatar.startsWith('/avatars/')) {
    const filename = path.basename(avatar);
    const absolutePath = path.join(__dirname, '..', 'temp', 'avatars', filename);
    if (fs.existsSync(absolutePath)) {
      try {
        const fileBuffer = fs.readFileSync(absolutePath);
        const base64Data = fileBuffer.toString('base64');
        const ext = path.extname(filename).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.webp') mimeType = 'image/webp';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.svg') mimeType = 'image/svg+xml';
        else if (ext === '.bmp') mimeType = 'image/bmp';
        
        activeAvatar = `data:${mimeType};base64,${base64Data}`;
        console.log(`[cardRenderer] Convertido avatar local a Data URI Base64 para Puppeteer: ${filename}`);
      } catch (err) {
        console.error(`[cardRenderer] Error codificando avatar local a Base64:`, err.message);
      }
    }
  }

  // Procesar medallas seleccionadas (estáticas y GIFs animados)
  let awardsHtml = '';
  const cardSelectedAwards = cardData.cardSelectedAwards || [];
  const awardsBaseDir = path.join(__dirname, '..', 'frontend', 'public', 'assets', 'awards');

  if (Array.isArray(cardSelectedAwards) && cardSelectedAwards.length > 0) {
    awardsHtml = cardSelectedAwards.map(item => {
      if (!item || !item.file) return '';
      const awardFilePath = path.join(awardsBaseDir, item.file);
      if (fs.existsSync(awardFilePath)) {
        try {
          const buf = fs.readFileSync(awardFilePath);
          const ext = path.extname(item.file).toLowerCase();
          const mime = ext === '.gif' ? 'image/gif' : 'image/png';
          const b64 = `data:${mime};base64,${buf.toString('base64')}`;
          return `<img src="${b64}" class="award-icon" alt="${item.name || 'award'}" />`;
        } catch (e) {
          return '';
        }
      }
      return '';
    }).join('');
  } else {
    // Fallback a tira de medallas por defecto si no hay medallas específicas seleccionadas
    const defaultAwardsPath = path.join(__dirname, '..', 'frontend', 'public', 'reddit-awards.png');
    const altAwardsPath = path.join(__dirname, '..', 'temp', 'assets', 'reddit-awards.png');
    const finalAwardsPath = fs.existsSync(defaultAwardsPath) ? defaultAwardsPath : (fs.existsSync(altAwardsPath) ? altAwardsPath : null);

    if (finalAwardsPath) {
      try {
        const awardsBuffer = fs.readFileSync(finalAwardsPath);
        const b64 = `data:image/png;base64,${awardsBuffer.toString('base64')}`;
        awardsHtml = `<img src="${b64}" class="awards-strip" alt="awards" />`;
      } catch (err) {
        console.error(`[cardRenderer] Error cargando medallas por defecto:`, err.message);
      }
    }
  }

  // Esquema de colores según el tema
  const bg = theme === 'dark' ? '#1c1c1e' : '#ffffff';
  const textColor = theme === 'dark' ? '#e5e5e7' : '#11151a';
  const titleColor = theme === 'dark' ? '#ffffff' : '#11151a';
  const metaColor = theme === 'dark' ? '#94a3b8' : '#5c6c74';
  const borderColor = theme === 'dark' ? '#2c2c2e' : '#edeff1';

  // Nuevos parámetros opcionales de Postfully V2
  const cardShowVerified = cardData.cardShowVerified !== undefined ? cardData.cardShowVerified : true;
  const cardShowAwards = cardData.cardShowAwards !== undefined ? cardData.cardShowAwards : true;
  const cardWidth = cardData.cardWidth !== undefined ? cardData.cardWidth : 260;
  const cardBorderRadius = cardData.cardBorderRadius !== undefined ? cardData.cardBorderRadius : 11;
  const cardPadding = cardData.cardPadding !== undefined ? cardData.cardPadding : 12;
  const cardGap = cardData.cardGap !== undefined ? cardData.cardGap : 7;

  // Plantilla HTML con estilos calculados mediante variables y calc()
  // Usamos un factor de escala base de 2.2x en Puppeteer para máxima nitidez (HD)
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --scale: 2.2;
      --card-width: ${cardWidth}px;
      --card-radius: ${cardBorderRadius}px;
      --card-padding: ${cardPadding}px;
      --card-gap: ${cardGap}px;
      --bg-color: ${bg};
      --text-color: ${textColor};
      --title-color: ${titleColor};
      --meta-color: ${metaColor};
      --border-color: ${borderColor};
    }
    body {
      margin: 0;
      padding: calc(40px * var(--scale));
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: transparent;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #reddit-card {
      background-color: var(--bg-color);
      color: var(--text-color);
      width: calc(var(--card-width) * var(--scale));
      border-radius: calc(var(--card-radius) * var(--scale));
      padding: calc(var(--card-padding) * var(--scale));
      gap: calc(var(--card-gap) * var(--scale));
      border: calc(1px * var(--scale)) solid var(--border-color);
      box-shadow: 0 calc(8px * var(--scale)) calc(30px * var(--scale)) rgba(0, 0, 0, 0.35);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-feature-settings: normal;
    }
    .header {
      display: flex;
      align-items: start;
      gap: calc(7px * var(--scale));
    }
    .avatar-container {
      position: relative;
      width: calc(36px * var(--scale));
      height: calc(36px * var(--scale));
      flex-shrink: 0;
      overflow: hidden;
      border-radius: 50%;
    }
    .avatar {
      position: absolute;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .meta-container {
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: calc(2px * var(--scale));
    }
    .subreddit-line {
      display: flex;
      align-items: center;
      gap: calc(4px * var(--scale));
      font-size: calc(14px * var(--scale));
      line-height: calc(17px * var(--scale));
      font-weight: 700;
      color: var(--title-color);
    }
    .verified-badge {
      margin-bottom: calc(1px * var(--scale));
      display: inline-block;
      width: calc(12px * var(--scale));
      height: calc(12px * var(--scale));
      color: #38bdf8;
    }
    .author-line {
      font-size: calc(11px * var(--scale));
      line-height: calc(14px * var(--scale));
      color: var(--meta-color);
      font-weight: 500;
    }
    .awards-row {
      display: flex;
      align-items: center;
      gap: calc(5px * var(--scale));
      margin-top: calc(3px * var(--scale));
      margin-bottom: calc(2px * var(--scale));
      flex-wrap: wrap;
    }
    .award-icon {
      width: calc(18px * var(--scale));
      height: calc(18px * var(--scale));
      object-fit: contain;
    }
    .awards-strip {
      height: calc(11.5px * var(--scale));
      width: auto;
      object-fit: contain;
      margin-top: calc(2px * var(--scale));
      display: block;
    }
    .content-block {
      display: flex;
      flex-direction: column;
      gap: calc(var(--card-gap) * 1.5 * var(--scale));
    }
    .title {
      font-size: calc(16px * var(--scale));
      line-height: calc(20px * var(--scale));
      font-weight: 700;
      color: var(--title-color);
      text-align: left;
      margin: 0;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: calc(8px * var(--scale));
      align-items: center;
      width: 100%;
    }
    .left-footer-group {
      display: flex;
      align-items: center;
      gap: calc(8px * var(--scale));
    }
    .footer-item {
      display: flex;
      align-items: center;
      gap: calc(4px * var(--scale));
      color: var(--meta-color);
      font-size: calc(12px * var(--scale));
      font-weight: 600;
    }
    .footer-icon {
      width: calc(16px * var(--scale));
      height: calc(16px * var(--scale));
      stroke: currentColor;
      stroke-width: calc(2px * var(--scale));
    }
  </style>
</head>
<body>
  <div id="reddit-card">
    <div class="header">
      <div class="avatar-container">
        <img class="avatar" src="${activeAvatar}" alt="avatar" />
      </div>
      <div class="meta-container">
        <div class="subreddit-line">
          <span>${subreddit}</span>
          ${cardShowVerified ? `
          <svg class="verified-badge" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12.5589 0.726691C12.9733 0.847424 13.3429 1.1642 14.082 1.79776L14.8782 2.48016L14.8782 2.48016C15.2109 2.76534 15.3772 2.90792 15.5649 3.00949C15.7314 3.09957 15.9098 3.16558 16.0948 3.20551C16.3034 3.25054 16.5225 3.25054 16.9607 3.25054L17.5495 3.25054C18.6696 3.25054 19.2297 3.25054 19.6575 3.46852C20.0338 3.66027 20.3398 3.96623 20.5315 4.34255C20.7495 4.77038 20.7495 5.33043 20.7495 6.45053L20.7495 7.03934C20.7495 7.47754 20.7495 7.69664 20.7945 7.90523C20.8345 8.09025 20.9005 8.26866 20.9906 8.43513C21.0921 8.62281 21.2347 8.78916 21.5199 9.12187L22.2023 9.918C22.8359 10.6572 23.1526 11.0267 23.2734 11.4412C23.3798 11.8065 23.3798 12.1946 23.2734 12.5599C23.1526 12.9743 22.8359 13.3439 22.2023 14.0831L21.5199 14.8792L21.5199 14.8792C21.2347 15.2119 21.0921 15.3783 20.9906 15.5659C20.9005 15.7324 20.8345 15.9108 20.7945 16.0958C20.7495 16.3044 20.7495 16.5235 20.7495 16.9617L20.7495 17.5505C20.7495 18.6706 20.7495 19.2307 20.5315 19.6585C20.3398 20.0348 20.0338 20.3408 19.6575 20.5325C19.2297 20.7505 18.6696 20.7505 17.5495 20.7505L16.9607 20.7505C16.5225 20.7505 16.3034 20.7505 16.0948 20.7956C15.9098 20.8355 15.7314 20.9015 15.5649 20.9916C15.3772 21.0931 15.2109 21.2357 14.8782 21.5209L14.8782 21.5209L14.082 22.2033L14.082 22.2033C13.3429 22.8369 12.9733 23.1537 12.5589 23.2744C12.1936 23.3808 11.8055 23.3808 11.4402 23.2744C11.0257 23.1536 10.6561 22.8369 9.917 22.2033L9.91698 22.2033L9.12085 21.5209C8.78814 21.2357 8.62179 21.0931 8.43412 20.9916C8.26765 20.9015 8.08923 20.8355 7.90421 20.7956C7.69562 20.7505 7.47652 20.7505 7.03832 20.7505L6.4153 20.7505L6.41527 20.7505C5.29519 20.7505 4.73514 20.7505 4.30732 20.5325C3.931 20.3408 3.62503 20.0348 3.43329 19.6585C3.2153 19.2307 3.2153 18.6706 3.2153 17.5505L3.2153 16.949C3.2153 16.5146 3.2153 16.2973 3.17099 16.0903C3.13169 15.9067 3.06672 15.7296 2.97801 15.5641C2.878 15.3775 2.73756 15.2118 2.45668 14.8803L1.76945 14.0693C1.14668 13.3343 0.835291 12.9669 0.716483 12.5555C0.611756 12.1929 0.611756 11.8081 0.716483 11.4455C0.835291 11.0342 1.14668 10.6667 1.76945 9.9318L2.45668 9.12078L2.45668 9.12077C2.73756 8.78929 2.878 8.62356 2.97801 8.437C3.06672 8.27151 3.13169 8.09435 3.17099 7.91075C3.2153 7.70376 3.2153 7.48652 3.2153 7.05204L3.2153 6.45053C3.2153 5.33043 3.2153 4.77038 3.43329 4.34255C3.62503 3.96623 3.931 3.66027 4.30732 3.46852C4.73514 3.25054 5.2952 3.25054 6.4153 3.25054L7.03832 3.25054C7.47652 3.25054 7.69562 3.25054 7.90421 3.20551C8.08923 3.16557 8.26765 3.09957 8.43412 3.00949C8.62179 2.90792 8.78814 2.76534 9.12084 2.48016L9.12085 2.48016L9.91699 1.79775C10.6561 1.1642 11.0257 0.847424 11.4402 0.726691C11.8055 0.620281 12.1936 0.620281 12.5589 0.726691ZM16.5306 9.53033C16.8235 9.23744 16.8235 8.76257 16.5306 8.46967C16.2377 8.17678 15.7628 8.17678 15.4699 8.46967L11.0002 12.9393L9.53058 11.4697C9.23768 11.1768 8.76281 11.1768 8.46992 11.4697C8.17702 11.7626 8.17702 12.2374 8.46992 12.5303L10.4699 14.5303C10.6106 14.671 10.8013 14.75 11.0002 14.75C11.1992 14.75 11.3899 14.671 11.5306 14.5303L16.5306 9.53033Z" fill="currentColor"></path>
          </svg>
          ` : ''}
        </div>
        <div class="author-line">
          u/${username}
        </div>
      </div>
    </div>

    ${cardShowAwards && awardsHtml ? (
      awardsHtml.includes('awards-strip')
        ? awardsHtml
        : `<div class="awards-row" style="margin-top: calc(2px * var(--scale)); margin-bottom: calc(1px * var(--scale));">${awardsHtml}</div>`
    ) : ''}
    
    <div class="content-block">
      <h1 class="title">${title}</h1>
    </div>
    
    <div class="footer">
      <div class="left-footer-group">
        <!-- Votos (Estilo Corazón de Postfully) -->
        <div class="footer-item">
          <svg class="footer-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21C13 21 22 16.0003 22 9.00046C22 5.5006 19 3.04408 16 3.00068C14.5 2.97897 13 3.50068 12 5.00062C11 3.50068 9.47405 3.00068 8 3.00068C5 3.00068 2 5.5006 2 9.00046C2 16.0003 11 21 12 21Z" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
          <span>${upvotes}</span>
        </div>
        
        <!-- Comentarios -->
        <div class="footer-item">
          <svg class="footer-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.499 2.33015 14.921 2.9214 16.1973C3.38829 17.2052 3.83022 18.0644 3.50454 19.1977C3.34789 19.7429 2.95529 20.2798 2.90866 20.8475C2.85534 21.4967 3.42708 22.0228 4.06965 21.9157C5.3779 21.6977 6.0076 20.6574 7.52552 21.0144C7.69003 21.0531 8.11879 21.2065 8.97627 21.5132C9.88354 21.8377 10.8606 22 12 22Z" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
          <span>${comments}</span>
        </div>
      </div>
      
      <!-- Compartir -->
      <div class="footer-item">
        <svg class="footer-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 10H7.5V10C6.10444 10 5.40666 10 4.83886 10.1722C3.56046 10.56 2.56004 11.5605 2.17224 12.8389C2 13.4067 2 14.1044 2 15.5V16C2 17.8638 2 18.7956 2.30448 19.5307C2.71046 20.5108 3.48915 21.2895 4.46927 21.6955C5.20435 22 6.13623 22 8 22L16 22C17.8638 22 18.7956 22 19.5307 21.6955C20.5108 21.2895 21.2895 20.5108 21.6955 19.5307C22 18.7956 22 17.8638 22 16V15.5C22 14.1044 22 13.4067 21.8278 12.8389C21.44 11.5605 20.4395 10.56 19.1611 10.1722C18.5933 10 17.8956 10 16.5 10V10H16M12 15V2M12 2L8 6M12 2L16 6" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        <span>Share</span>
      </div>
    </div>
  </div>
</body>
</html>
  `;


  let page;
  try {
    console.log(`Renderizando card de Reddit a PNG: "${title.substring(0, 30)}..."`);
    
    // Inicializar navegador compartido si no existe
    if (!sharedBrowser) {
      sharedBrowser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    try {
      page = await sharedBrowser.newPage();
    } catch (pageErr) {
      // Reintentar si el proceso de Chromium se colgó
      console.warn('[cardRenderer] Proceso de Puppeteer colapsado, reiniciando navegador:', pageErr.message);
      try {
        await sharedBrowser.close().catch(() => {});
      } catch (e) {}
      sharedBrowser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      page = await sharedBrowser.newPage();
    }

    // Indicamos que el fondo del viewport debe ser transparente
    await page.setViewport({ width: 800, height: 800, deviceScaleFactor: 2 }); // Scale factor para mayor nitidez (HD)
    await page.setContent(htmlContent);

    // Esperar a que cargue la fuente de Google
    await page.evaluateHandle('document.fonts.ready');

    // Seleccionamos el contenedor exacto del card
    const cardElement = await page.$('#reddit-card');
    if (!cardElement) {
      throw new Error('No se pudo encontrar el elemento #reddit-card en el HTML renderizado.');
    }

    // Tomamos captura únicamente de la caja del card (recortado automático) con fondo transparente
    await cardElement.screenshot({
      path: outputPath,
      omitBackground: true
    });

    console.log(`Tarjeta de Reddit guardada exitosamente en: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error rendering Title Card with Puppeteer:', error);
    throw error;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

module.exports = {
  renderCard
};

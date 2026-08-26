const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

// Guard de verificación de archivos (por si se ejecuta desde WhatsApp o ZIP no extraído)
const requiredFiles = [
  path.join(__dirname, 'services', 'db.js'),
  path.join(__dirname, 'frontend', 'src', 'main.jsx')
];

for (const reqFile of requiredFiles) {
  if (!fs.existsSync(reqFile)) {
    console.error('\n=======================================================================');
    console.error(' ⚠️ ERROR CRÍTICO: ARCHIVOS DEL PROGRAMA INCOMPLETOS O NO EXTRAÍDOS');
    console.error('=======================================================================');
    console.error(' Estás ejecutando el programa desde el archivo comprimido (ZIP) o desde');
    console.error(' la carpeta temporal de descargas de WhatsApp Desktop.\n');
    console.error(' SOLUCIÓN FÁCIL:');
    console.error(' 1. Cierra esta ventana.');
    console.error(' 2. Haz clic derecho sobre el archivo ZIP que recibiste.');
    console.error(' 3. Selecciona "Extraer todo..." y guárdalo en tu Escritorio.');
    console.error(' 4. Abre la carpeta descomprimida en tu Escritorio e inicia el programa.');
    console.error('=======================================================================\n');
    process.exit(1);
  }
}

// Importar servicios locales
const db = require('./services/db');
const gpu = require('./services/gpuDetector');
const gemini = require('./services/gemini');
const tts = require('./services/tts');
const cardRenderer = require('./services/cardRenderer');
const subtitles = require('./services/subtitles');
const timeline = require('./services/timeline');
const ffmpeg = require('./services/ffmpeg');
const dialogs = require('./services/dialogs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Carpetas de almacenamiento temporal
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
const PREVIEWS_DIR = path.join(TEMP_DIR, 'previews');
if (!fs.existsSync(PREVIEWS_DIR)) {
  fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
}
const AVATARS_DIR = path.join(TEMP_DIR, 'avatars');
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

/**
 * Asigna de forma determinista una configuración de voz (voz, pitch, rate) a cada rol único
 * de la lista de diálogos, usando el pool de voces secundarias y alternando tonos.
 */
function assignVoicesToRoles(dialogues, template, mainGender) {
  const narratorVoice = mainGender === 'male' ? template.maleVoice : template.femaleVoice;
  
  const femalePool = [
    template.multiVoiceSecondaryFemale1 || 'es-MX-DaliaNeural',
    template.multiVoiceSecondaryFemale2 || 'es-MX-DaliaNeural'
  ];
  const malePool = [
    template.multiVoiceSecondaryMale1 || 'es-MX-JorgeNeural',
    template.multiVoiceSecondaryMale2 || 'es-MX-JorgeNeural'
  ];
  
  const roleMap = {
    'narrator': {
      voice: narratorVoice,
      pitch: '0Hz',
      rate: template.voiceRate || '+0%'
    }
  };
  
  let femaleIndex = 0;
  let maleIndex = 0;
  
  dialogues.forEach(d => {
    if (!d.role) return;
    const roleLower = d.role.toLowerCase();
    if (roleLower === 'narrator') return;
    
    if (!roleMap[roleLower]) {
      const charGender = d.gender || 'female';
      if (charGender === 'female') {
        const voice = femalePool[femaleIndex % femalePool.length];
        const pitch = femaleIndex >= femalePool.length ? (femaleIndex % 2 === 0 ? '+3Hz' : '-3Hz') : '0Hz';
        roleMap[roleLower] = {
          voice,
          pitch,
          rate: template.voiceRate || '+0%'
        };
        femaleIndex++;
      } else {
        const voice = malePool[maleIndex % malePool.length];
        const pitch = maleIndex >= malePool.length ? (maleIndex % 2 === 0 ? '+3Hz' : '-3Hz') : '0Hz';
        roleMap[roleLower] = {
          voice,
          pitch,
          rate: template.voiceRate || '+0%'
        };
        maleIndex++;
      }
    }
  });
  
  return roleMap;
}

// Servir carpetas estáticas
app.use('/previews', express.static(PREVIEWS_DIR));
app.use('/avatars', express.static(AVATARS_DIR));

// Estado de la cola de trabajos en memoria
let activeJob = null;
let jobLogs = [];
const sseClients = new Set();
let cancelRequested = false;
let pauseRequested = false;
let isPaused = false;
let failedItems = [];
let batchStartTime = null;

function getEtaSeconds(job) {
  if (!batchStartTime) return null;
  const elapsedMs = Date.now() - batchStartTime;
  const finishedCount = job.currentVideoIndex - 1;
  const progressRatio = (job.progress || 0) / 100;
  const estimatedCompletedVideos = finishedCount + progressRatio;
  
  if (estimatedCompletedVideos < 0.05) {
    return 90 * job.totalCount; // 90 segundos por video por defecto al inicio
  }
  
  const avgTimePerVideo = elapsedMs / estimatedCompletedVideos;
  const remainingVideos = job.totalCount - estimatedCompletedVideos;
  return Math.max(0, Math.round((avgTimePerVideo * remainingVideos) / 1000));
}

async function sendNotification(messageOrOptions) {
  try {
    const currentDb = db.readDb();
    const settings = currentDb.settings || {};
    
    let tgMessage = '';
    let discordPayload = null;

    if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
      const { status, successCount, totalCount, failedCount, durationStr, profileList, templateList, exportFolder, errorMsg } = messageOrOptions;
      
      // 1. Construir mensaje de texto plano con formato de negritas (Markdown)
      if (status === 'completed') {
        tgMessage = `🎉 *[REDIT-GEN] ¡LOTE COMPLETADO CON ÉXITO!* 🎉\n\n` +
          `🟢 *Estado:* Completado exitosamente\n` +
          `⏱️ *Tiempo Total:* ${durationStr}\n` +
          `📹 *Videos Generados:* ${successCount} de ${totalCount} ✅\n` +
          `👤 *Perfil(es) Usado(s):* ${profileList || 'Por defecto'}\n` +
          `🎨 *Plantilla(s) Usada(s):* ${templateList || 'Por defecto'}\n` +
          `📁 *Carpeta de Salida:* \`${exportFolder || 'N/A'}\`\n\n` +
          `¡Tus videos están listos para ser publicados! 🚀`;
      } else if (status === 'completed_with_errors') {
        tgMessage = `⚠️ *[REDIT-GEN] ¡LOTE FINALIZADO CON DETALLES!* ⚠️\n\n` +
          `🟡 *Estado:* Finalizado con algunos errores\n` +
          `⏱️ *Tiempo Total:* ${durationStr}\n` +
          `📹 *Videos Exitosos:* ${successCount} de ${totalCount} ✅\n` +
          `❌ *Videos Fallados:* ${failedCount} ❌\n` +
          `👤 *Perfil(es) Usado(s):* ${profileList || 'Por defecto'}\n` +
          `🎨 *Plantilla(s) Usada(s):* ${templateList || 'Por defecto'}\n` +
          `📁 *Carpeta de Salida:* \`${exportFolder || 'N/A'}\`\n\n` +
          `🔄 Los videos fallidos se pueden reintentar desde el Dashboard con un solo clic.`;
      } else if (status === 'cancelled') {
        tgMessage = `🛑 *[REDIT-GEN] GENERACIÓN DETENIDA* 🛑\n\n` +
          `• *Estado:* Cancelado por el usuario\n` +
          `• *Videos procesados:* ${successCount || 0} de ${totalCount || 0}\n` +
          `• *Tiempo transcurrido:* ${durationStr || '0s'} ⏱️`;
      } else if (status === 'video_completed') {
        tgMessage = `📹 *[REDIT-GEN] ¡VIDEO GENERADO! (${messageOrOptions.index}/${messageOrOptions.totalCount})* 📹\n\n` +
          `🎬 *Título:* *${messageOrOptions.title}*\n` +
          `⏱️ *Duración del video:* ${durationStr || 'N/A'}\n` +
          `📁 *Archivo:* \`${messageOrOptions.filePath || 'N/A'}\`\n\n` +
          `¡Listo para publicar! 🚀`;
      } else {
        tgMessage = `💥 *[REDIT-GEN] ERROR CRÍTICO EN EL LOTE* 💥\n\n` +
          `• *Estado:* Fallido\n` +
          `• *Error:* ${errorMsg || 'Error desconocido'}\n` +
          `• *Tiempo transcurrido:* ${durationStr || '0s'} ⏱️`;
      }

      // 2. Construir payload elegante de Discord con Rich Embeds
      const embedColor = status === 'completed' ? 3066993 // Verde
        : status === 'completed_with_errors' ? 15105570 // Naranja/Amarillo
        : status === 'cancelled' ? 10070709 // Gris
        : status === 'video_completed' ? 3447003 // Azul (para videos individuales)
        : 15158332; // Rojo

      const embedTitle = status === 'completed' ? '🎉 ¡LOTE COMPLETADO CON ÉXITO!'
        : status === 'completed_with_errors' ? '⚠️ LOTE FINALIZADO CON DETALLES'
        : status === 'cancelled' ? '🛑 GENERACIÓN DETENIDA'
        : status === 'video_completed' ? `📹 ¡VIDEO GENERADO! (${messageOrOptions.index}/${messageOrOptions.totalCount})`
        : '💥 ERROR CRÍTICO EN EL LOTE';

      const embedDesc = status === 'completed' ? 'El generador de videos ha finalizado la cola de renderizado sin fallas.'
        : status === 'completed_with_errors' ? 'La cola de renderizado ha terminado, pero se registraron algunos errores.'
        : status === 'cancelled' ? 'El renderizado fue cancelado manualmente por el usuario.'
        : status === 'video_completed' ? 'Se ha terminado de compilar exitosamente un video.'
        : 'El renderizado se interrumpió debido a un error inesperado.';

      const fields = [];
      if (status === 'completed' || status === 'completed_with_errors') {
        fields.push({ name: '⏱️ Tiempo Total', value: durationStr || 'N/A', inline: true });
        if (status === 'completed') {
          fields.push({ name: '📹 Videos Generados', value: `${successCount} de ${totalCount} ✅`, inline: true });
        } else {
          fields.push({ name: '📹 Videos Exitosos', value: `${successCount} de ${totalCount} ✅`, inline: true });
          fields.push({ name: '❌ Videos Fallados', value: `${failedCount} ❌`, inline: true });
        }
        fields.push({ name: '👤 Perfil de API', value: profileList || 'Por defecto', inline: true });
        fields.push({ name: '🎨 Plantilla(s)', value: templateList || 'Por defecto', inline: true });
        fields.push({ name: '📁 Carpeta de Salida', value: exportFolder ? `\`${exportFolder}\`` : 'N/A', inline: false });
      } else if (status === 'video_completed') {
        fields.push({ name: '🎬 Título', value: messageOrOptions.title || 'N/A', inline: false });
        fields.push({ name: '⏱️ Duración del Video', value: durationStr || 'N/A', inline: true });
        fields.push({ name: '📁 Archivo de Salida', value: messageOrOptions.filePath ? `\`${messageOrOptions.filePath}\`` : 'N/A', inline: false });
      } else {
        fields.push({ name: '⏱️ Tiempo Transcurrido', value: durationStr || 'N/A', inline: true });
        fields.push({ name: '📹 Videos Procesados', value: `${successCount || 0} de ${totalCount || 0}`, inline: true });
        if (errorMsg) {
          fields.push({ name: '❌ Mensaje de Error', value: `\`\`\`${errorMsg}\`\`\``, inline: false });
        }
      }

      discordPayload = {
        embeds: [
          {
            title: embedTitle,
            description: embedDesc,
            color: embedColor,
            fields: fields,
            footer: {
              text: 'REDIT-GEN • Sistema de Notificaciones'
            },
            timestamp: new Date().toISOString()
          }
        ]
      };
    } else {
      // Mensaje de texto simple (retrocompatibilidad)
      const text = String(messageOrOptions);
      tgMessage = text;
      discordPayload = { content: text };
    }

    // Enviar a Discord
    if (settings.discordEnabled && settings.discordWebhookUrl) {
      const webhookUrl = settings.discordWebhookUrl.trim();
      if (webhookUrl) {
        try {
          new URL(webhookUrl);
          await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'REDIT-GEN/1.0'
            },
            body: JSON.stringify(discordPayload),
            signal: AbortSignal.timeout(6000)
          });
        } catch (dErr) {
          console.error('[Notification] Discord Error:', dErr.message);
        }
      }
    }

    // Enviar a WhatsApp (CallMeBot)
    if (settings.whatsappEnabled && settings.whatsappPhone && settings.whatsappApiKey) {
      const phone = settings.whatsappPhone.trim();
      const apiKey = settings.whatsappApiKey.trim();
      if (phone && apiKey) {
        try {
          const normalizedPhone = phone.replace(/[+\s]/g, '');
          const waMessage = tgMessage;
          const urlStr = `https://api.callmebot.com/whatsapp.php?phone=${normalizedPhone}&text=${encodeURIComponent(waMessage)}&apikey=${apiKey}`;
          await fetch(urlStr, {
            method: 'GET',
            signal: AbortSignal.timeout(6000)
          });
        } catch (wErr) {
          console.error('[Notification] WhatsApp Error:', wErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[Notification] General Error:', err.message);
  }
}

// Helper para emitir eventos de progreso a los clientes SSE
function broadcastProgress(data) {
  if (activeJob && batchStartTime) {
    activeJob.elapsedSeconds = Math.round((Date.now() - batchStartTime) / 1000);
    activeJob.etaSeconds = getEtaSeconds(activeJob);
    activeJob.failedCount = failedItems.length;
    activeJob.pauseRequested = pauseRequested;
    activeJob.isPaused = isPaused;
  }
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => client.write(payload));
  // Guardar log
  if (data.log) {
    jobLogs.push(`[${new Date().toLocaleTimeString()}] ${data.log}`);
  }
}

// ----------------------------------------------------
// RUTAS API REST
// ----------------------------------------------------

// 1. Detección de Gráfica (GPU)
app.get('/api/detect-hardware', (req, res) => {
  try {
    const hw = gpu.detectHardware();
    const currentDb = db.readDb();
    
    // Obtener motor de renderizado de la query si se proporciona (para previsualizaciones en vivo en el frontend)
    let renderEngine = req.query.renderEngine;
    
    if (!renderEngine) {
      // Si no hay query, determinar según el perfil (opcional) o el ajuste global
      const profileId = req.query.profileId;
      const profile = profileId && profileId !== 'global'
        ? currentDb.profiles?.find(p => p.id === profileId)
        : null;
      renderEngine = (profile && profile.renderEngine && profile.renderEngine !== 'global')
        ? profile.renderEngine
        : (currentDb.settings?.renderEngine || 'auto');
    }
    
    // Si es "global", resolver al valor global real
    if (renderEngine === 'global') {
      renderEngine = currentDb.settings?.renderEngine || 'auto';
    }
    
    if (renderEngine && renderEngine !== 'auto') {
      hw.codec = renderEngine;
      if (renderEngine.startsWith('gpu:')) {
        const gpuName = renderEngine.substring(4);
        const mapped = gpu.getCodecForGpuName(gpuName);
        hw.codec = mapped.codec;
        hw.hwaccel = mapped.hwaccel;
        hw.description = `GPU Bloqueada: ${mapped.description}`;
      } else if (renderEngine === 'h264_nvenc') {
        hw.hwaccel = 'cuda';
        hw.description = 'Renderizador manual forzado: NVIDIA NVENC (Acelerado por GPU NVIDIA)';
      } else if (renderEngine === 'h264_amf') {
        hw.hwaccel = 'd3d11va';
        hw.description = 'Renderizador manual forzado: AMD AMF (Acelerado por GPU AMD/Radeon)';
      } else if (renderEngine === 'h264_qsv') {
        hw.hwaccel = 'qsv';
        hw.description = 'Renderizador manual forzado: Intel QuickSync (Acelerado por GPU integrada de Intel)';
      } else if (renderEngine === 'libx264') {
        hw.hwaccel = '';
        hw.description = 'Renderizador manual forzado: CPU Standard (libx264 - Sin aceleración GPU)';
      }
    }
    res.json(hw);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Configuración y Ajustes generales
app.get('/api/settings', (req, res) => {
  const currentDb = db.readDb();
  res.json(currentDb.settings);
});

app.post('/api/settings', (req, res) => {
  try {
    const currentDb = db.readDb();
    currentDb.settings = { ...currentDb.settings, ...req.body };
    db.writeDb(currentDb);
    res.json({ success: true, settings: currentDb.settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para probar integraciones de notificación
// Endpoint para probar integraciones de notificación
app.post('/api/notifications/test', async (req, res) => {
  try {
    const { discordEnabled, discordWebhookUrl, whatsappEnabled, whatsappPhone, whatsappApiKey } = req.body;
    
    if (!discordEnabled && !whatsappEnabled) {
      return res.status(400).json({ error: 'Configura y activa al menos un canal (Discord o WhatsApp) para probar.' });
    }
    
    const message = '🔔 [REDIT-GEN] ¡Prueba de integración exitosa! Tus notificaciones están correctamente vinculadas.';
    const promises = [];
    
    if (discordEnabled && discordWebhookUrl) {
      const webhookUrl = discordWebhookUrl.trim();
      if (webhookUrl) {
        promises.push((async () => {
          try {
            new URL(webhookUrl);
            const response = await fetch(webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'REDIT-GEN/1.0'
              },
              body: JSON.stringify({
                embeds: [
                  {
                    title: '🔔 [REDIT-GEN] ¡Prueba de Integración!',
                    description: 'Tus notificaciones de Discord están configuradas correctamente.',
                    color: 3066993, // Verde
                    timestamp: new Date().toISOString()
                  }
                ]
              }),
              signal: AbortSignal.timeout(6000)
            });
            if (response.ok) {
              return { service: 'Discord', success: true };
            } else {
              let errDetail = response.status;
              try {
                const parsed = await response.json();
                errDetail = parsed.message || errDetail;
              } catch(e) {}
              throw new Error(`Discord: ${errDetail}`);
            }
          } catch (dErr) {
            throw new Error(`Discord: ${dErr.message}`);
          }
        })());
      }
    }

    if (whatsappEnabled && whatsappPhone && whatsappApiKey) {
      const phone = whatsappPhone.trim();
      const apiKey = whatsappApiKey.trim();
      if (phone && apiKey) {
        promises.push((async () => {
          try {
            const normalizedPhone = phone.replace(/[+\s]/g, '');
            const urlStr = `https://api.callmebot.com/whatsapp.php?phone=${normalizedPhone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
            const response = await fetch(urlStr, {
              method: 'GET',
              signal: AbortSignal.timeout(6000)
            });
            if (response.ok) {
              return { service: 'WhatsApp', success: true };
            } else {
              throw new Error(`WhatsApp: Error del servidor (${response.status})`);
            }
          } catch (wErr) {
            throw new Error(`WhatsApp: ${wErr.message}`);
          }
        })());
      }
    }
    
    if (promises.length === 0) {
      return res.status(400).json({ error: 'Configura campos válidos de Discord o WhatsApp para probar.' });
    }
    
    const results = await Promise.all(promises);
    res.json({ success: true, message: 'Notificación de prueba enviada con éxito.', results });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Endpoint para verificar actualizaciones de GitHub (Soporta repos públicos y privados con Token de solo lectura)
const handleCheckUpdates = async (req, res) => {
  try {
    const currentDb = db.readDb();
    const settings = currentDb.settings || {};
    
    // Obtener repositorio y token (por defecto el repositorio oficial interno)
    const repo = (req.body?.githubRepo || settings.githubRepo || 'Leonardo-murataya/reddit-desktop').trim();
    const token = (req.body?.githubToken !== undefined && req.body.githubToken !== '' 
      ? req.body.githubToken 
      : (settings.githubToken || process.env.GITHUB_TOKEN || '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')).trim();
    const currentVersion = require('./package.json').version || '1.0.0';

    if (!repo) {
      return res.json({
        hasUpdate: false,
        currentVersion,
        error: 'No se ha configurado el repositorio de GitHub (ej: usuario/repositorio).'
      });
    }

    const headers = {
      'User-Agent': 'Reddit-Video-Generator-Desktop',
      'Accept': 'application/vnd.github+json'
    };

    // Si se proporciona Token (para repos privados con permiso de solo lectura)
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const fetchRes = await fetch(url, { headers });

    if (!fetchRes.ok) {
      if (fetchRes.status === 404) {
        // Fallback a consultar tags de Git directamente si no hay Release formal creada en la web
        const tagsRes = await fetch(`https://api.github.com/repos/${repo}/tags`, { headers });
        if (tagsRes.ok) {
          const tags = await tagsRes.json();
          if (tags && tags.length > 0) {
            const latestTag = tags[0].name.replace(/^v/, '');
            const hasUpdate = compareVersions(latestTag, currentVersion) > 0;
            return res.json({
              hasUpdate,
              currentVersion,
              latestVersion: latestTag,
              releaseTitle: `Reddit Video Generator v${latestTag}`,
              releaseNotes: 'Nueva versión disponible en el repositorio de GitHub.',
              publishedAt: new Date().toISOString(),
              releaseUrl: `https://github.com/${repo}/releases/tag/v${latestTag}`,
              assets: []
            });
          }
        }
        return res.json({
          hasUpdate: false,
          currentVersion,
          message: 'No se encontraron lanzamientos publicados en el repositorio.'
        });
      }
      if (fetchRes.status === 401 || fetchRes.status === 403) {
        return res.json({
          hasUpdate: false,
          currentVersion,
          error: 'Acceso no autorizado a GitHub. Si tu repositorio es privado, ingresa un Token de GitHub con permiso de lectura (Contents: Read).'
        });
      }
      return res.json({
        hasUpdate: false,
        currentVersion,
        error: `Error al conectar con GitHub (Código HTTP: ${fetchRes.status})`
      });
    }

    const release = await fetchRes.json();
    const latestVersion = (release.tag_name || '').replace(/^v/, '');
    
    // Comparación de versiones semánticas (semver)
    function compareVersions(v1, v2) {
      const p1 = v1.split('.').map(n => parseInt(n, 10) || 0);
      const p2 = v2.split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const num1 = p1[i] || 0;
        const num2 = p2[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
      }
      return 0;
    }

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    res.json({
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseTitle: release.name || release.tag_name,
      releaseNotes: release.body || 'Sin notas de versión disponibles.',
      publishedAt: release.published_at,
      releaseUrl: release.html_url,
      githubToken: token,
      assets: (release.assets || []).map(a => ({
        id: a.id,
        name: a.name,
        size: a.size,
        apiUrl: a.url,
        downloadUrl: a.browser_download_url
      }))
    });
  } catch (error) {
    console.error('Error al verificar actualizaciones:', error.message);
    res.status(500).json({ error: error.message, currentVersion: require('./package.json').version });
  }
};

app.post('/api/updater/check', handleCheckUpdates);
app.get('/api/updates/check', handleCheckUpdates);
app.post('/api/updates/check', handleCheckUpdates);


// 3. Perfiles de API de IA
app.get('/api/profiles', (req, res) => {
  const currentDb = db.readDb();
  res.json(currentDb.profiles || []);
});

app.post('/api/profiles', (req, res) => {
  try {
    const currentDb = db.readDb();
    if (!currentDb.profiles) currentDb.profiles = [];
    const newProfile = req.body;
    let savedProfile;
    
    if (!newProfile.id) {
      newProfile.id = uuidv4();
      currentDb.profiles.push(newProfile);
      savedProfile = newProfile;
    } else {
      const idx = currentDb.profiles.findIndex(p => p.id === newProfile.id);
      if (idx !== -1) {
        currentDb.profiles[idx] = { ...currentDb.profiles[idx], ...newProfile };
        savedProfile = currentDb.profiles[idx];
      } else {
        currentDb.profiles.push(newProfile);
        savedProfile = newProfile;
      }
    }
    
    db.writeDb(currentDb);
    res.json({ success: true, profile: savedProfile, profiles: currentDb.profiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/profiles/:id', (req, res) => {
  try {
    const currentDb = db.readDb();
    currentDb.profiles = (currentDb.profiles || []).filter(p => p.id !== req.params.id);
    db.writeDb(currentDb);
    res.json({ success: true, profiles: currentDb.profiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/profiles/import', (req, res) => {
  try {
    const currentDb = db.readDb();
    const importedProfiles = req.body;
    
    if (!Array.isArray(importedProfiles)) {
      return res.status(400).json({ error: 'El archivo de importación debe contener una lista de perfiles (array).' });
    }
    
    importedProfiles.forEach(imported => {
      if (!imported.name) return;
      
      if (!imported.id) {
        imported.id = uuidv4();
      }
      
      const idx = currentDb.profiles.findIndex(p => p.id === imported.id);
      if (idx !== -1) {
        currentDb.profiles[idx] = { ...currentDb.profiles[idx], ...imported };
      } else {
        currentDb.profiles.push(imported);
      }
    });
    
    db.writeDb(currentDb);
    res.json({ success: true, profiles: currentDb.profiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Gestión de Fuentes Tipográficas Personalizadas (Fonts)
const fontsDir = path.join(__dirname, 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

function getAvailableFonts() {
  const defaultFonts = [
    { value: 'Arial Bold', label: 'Arial Bold (Altamente visible, estándar)' },
    { value: 'Bangers', label: 'Bangers (Estilo Cómic / Viral)' },
    { value: 'Impact', label: 'Impact (Estilo memes, grueso)' },
    { value: 'Montserrat', label: 'Montserrat (Moderno, elegante)' },
    { value: 'Trebuchet MS', label: 'Trebuchet MS (Redondeado)' }
  ];

  if (!fs.existsSync(fontsDir)) return defaultFonts;

  const fontFiles = fs.readdirSync(fontsDir);
  const customFonts = [];

  fontFiles.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
      const baseName = path.basename(file, ext).replace(/-Regular|-Bold|-Italic/gi, '').trim();
      if (!defaultFonts.some(f => f.value.toLowerCase() === baseName.toLowerCase())) {
        customFonts.push({
          value: baseName,
          label: `${baseName} (Personalizada .${ext.replace('.', '')})`,
          isCustom: true,
          file: file
        });
      }
    }
  });

  return [...defaultFonts, ...customFonts];
}

app.get('/api/fonts', (req, res) => {
  try {
    const fonts = getAvailableFonts();
    res.json(fonts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fonts/upload', (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ error: 'Se requiere el nombre y los datos del archivo de fuente.' });
    }

    const cleanName = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(cleanName).toLowerCase();
    if (!['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
      return res.status(400).json({ error: 'Solo se permiten archivos de fuente .ttf, .otf, .woff o .woff2' });
    }

    const targetPath = path.join(fontsDir, cleanName);
    const base64Data = data.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    fs.writeFileSync(targetPath, buffer);
    console.log(`[Fonts] Nueva fuente guardada en: ${targetPath}`);

    const updatedFonts = getAvailableFonts();
    const uploadedFontName = path.basename(cleanName, ext).replace(/-Regular|-Bold|-Italic/gi, '').trim();

    res.json({
      success: true,
      fontName: uploadedFontName,
      fonts: updatedFonts
    });
  } catch (error) {
    console.error(`[Fonts] Error guardando fuente:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 4. Plantillas de Estilo (Templates)
app.get('/api/templates', (req, res) => {
  const currentDb = db.readDb();
  res.json(currentDb.templates || []);
});

app.post('/api/templates', (req, res) => {
  try {
    const currentDb = db.readDb();
    if (!currentDb.templates) currentDb.templates = [];
    const newTemplate = req.body;
    let savedTemplate;
    
    if (!newTemplate.id) {
      newTemplate.id = uuidv4();
      currentDb.templates.push(newTemplate);
      savedTemplate = newTemplate;
    } else {
      const idx = currentDb.templates.findIndex(t => t.id === newTemplate.id);
      if (idx !== -1) {
        currentDb.templates[idx] = newTemplate;
        savedTemplate = newTemplate;
      } else {
        currentDb.templates.push(newTemplate);
        savedTemplate = newTemplate;
      }
    }
    
    db.writeDb(currentDb);
    res.json({ success: true, template: savedTemplate, templates: currentDb.templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/templates/:id', (req, res) => {
  try {
    const currentDb = db.readDb();
    currentDb.templates = (currentDb.templates || []).filter(t => t.id !== req.params.id);
    db.writeDb(currentDb);
    res.json({ success: true, templates: currentDb.templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/templates/import', (req, res) => {
  try {
    const currentDb = db.readDb();
    const { template, profile } = req.body;
    
    if (!template) {
      return res.status(400).json({ error: 'Falta la plantilla de video en el paquete.' });
    }
    
    let finalProfileId = null;
    if (profile) {
      // Clean API key (blank out if not present, to match client clean, but keep safety)
      const cleanProfile = { ...profile, apiKey: profile.apiKey || '' };
      
      const newProfId = uuidv4();
      cleanProfile.id = newProfId;
      cleanProfile.name = `${cleanProfile.name || 'Perfil'} (Importado)`;
      if (!currentDb.profiles) currentDb.profiles = [];
      currentDb.profiles.push(cleanProfile);
      finalProfileId = newProfId;
    }
    
    const newTempId = uuidv4();
    const newTemplate = {
      ...template,
      id: newTempId,
      name: `${template.name || 'Plantilla'} (Importada)`,
      profileId: finalProfileId || template.profileId || null
    };
    
    if (!currentDb.templates) currentDb.templates = [];
    currentDb.templates.push(newTemplate);
    db.writeDb(currentDb);
    
    res.json({
      success: true,
      newTemplateId: newTempId,
      newProfileId: finalProfileId,
      template: newTemplate,
      templates: currentDb.templates,
      profiles: currentDb.profiles
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Escaneo de Videos de Fondo Locales
const handleBackgroundScan = (req, res) => {
  try {
    const currentDb = db.readDb();
    const bgFolder = req.query.folder || req.body?.folder || currentDb.settings.backgroundFolder || currentDb.timeline.backgroundFolder || '';
    const profileId = req.query.profileId || req.body?.profileId || 'global';
    
    const profile = profileId !== 'global' ? currentDb.profiles?.find(p => p.id === profileId) : null;
    const playhead = profile ? (profile.timeline || { currentVideoIndex: 0, currentOffset: 0, backgroundVideos: [] }) : (currentDb.timeline || { currentVideoIndex: 0, currentOffset: 0, backgroundVideos: [] });

    if (!bgFolder || !fs.existsSync(bgFolder)) {
      return res.json({ count: 0, totalDuration: 0, duration: 0, files: [], playhead });
    }
    
    const videos = timeline.scanBackgroundVideos(bgFolder);
    let totalDur = 0;
    
    const fileInfos = videos.map(videoPath => {
      const dur = timeline.getVideoDuration(videoPath);
      totalDur += dur;
      return {
        name: path.basename(videoPath),
        path: videoPath,
        duration: Math.round(dur)
      };
    });
    
    res.json({
      count: fileInfos.length,
      totalDuration: Math.round(totalDur),
      duration: Math.round(totalDur),
      files: fileInfos,
      playhead: playhead
    });
  } catch (error) {
    res.status(500).json({ error: error.message, count: 0, totalDuration: 0, files: [], playhead: {} });
  }
};

app.get('/api/background-videos', handleBackgroundScan);
app.post('/api/background-videos', handleBackgroundScan);
app.get('/api/background/status', handleBackgroundScan);
app.post('/api/background/status', handleBackgroundScan);

// 5b. Diálogos Nativos de Windows vía PowerShell
app.get('/api/dialog/folder', (req, res) => {
  try {
    const selectedPath = dialogs.selectLocalFolder();
    res.json({ path: selectedPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dialog/files', (req, res) => {
  try {
    const selectedFiles = dialogs.selectLocalFiles();
    res.json({ files: selectedFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dialog/avatar', (req, res) => {
  try {
    const imgData = dialogs.selectLocalImage();
    res.json(imgData || { path: '', base64: '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dialog/watermark-image', (req, res) => {
  try {
    const imgData = dialogs.selectLocalImage();
    res.json(imgData || { path: '', base64: '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dialog/music', (req, res) => {
  try {
    const selectedFile = dialogs.selectLocalAudio();
    res.json({ path: selectedFile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/utils/file-exists', (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) {
      return res.json({ exists: false });
    }
    const exists = fs.existsSync(filePath);
    res.json({ exists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5c. Generación de preview TTS (Se autodestruye en 1 minuto)
app.post('/api/tts/preview', async (req, res) => {
  const { text, voice, rate } = req.body;
  if (!text || !voice) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: text o voice.' });
  }

  try {
    const filename = `preview_${uuidv4().substring(0, 8)}.mp3`;
    const outputPath = path.join(TEMP_DIR, 'previews', filename);
    
    // Generar el audio usando edge-tts
    await tts.generateSpeechAndTimestamps(text, voice, outputPath, { rate: rate || '+0%' });

    // Devolver URL de acceso
    const audioUrl = `/previews/${filename}`;
    res.json({ success: true, audioUrl });

    // Programar la autodestrucción en 1 minuto (60000 ms)
    setTimeout(() => {
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
          console.log(`Audio de prueba temporal eliminado correctamente: ${filename}`);
        }
      } catch (err) {
        console.warn(`No se pudo eliminar el audio de prueba temporal ${filename}:`, err.message);
      }
    }, 60000);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Canal SSE para progreso en vivo
app.get('/api/jobs/progress', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  sseClients.add(res);
  console.log(`Cliente SSE conectado. Total: ${sseClients.size}`);

  // Enviar estado actual del trabajo al conectarse
  res.write(`data: ${JSON.stringify({ type: 'init', activeJob, logs: jobLogs })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
    console.log(`Cliente SSE desconectado. Total: ${sseClients.size}`);
  });
});

// 7. Endpoint principal para disparar la generación
app.post('/api/generate', async (req, res) => {
  const { prompt, count = 1, profileId, templateId, backgroundFolder, batch, seeds } = req.body;

  if (activeJob) {
    return res.status(400).json({ error: 'Ya hay un proceso de renderizado en curso. Por favor espera a que finalice.' });
  }

  const currentDb = db.readDb();

  if (!currentDb.templates || currentDb.templates.length === 0) {
    return res.status(400).json({ error: 'No hay plantillas de video guardadas. Crea al menos una plantilla en el Diseñador de Plantillas.' });
  }

  // Normalizar lote: soporta formato seeds[], batch[] o unitario
  let normalizedBatch = [];
  if (seeds && Array.isArray(seeds) && seeds.length > 0) {
    normalizedBatch = seeds.map(s => {
      const targetTmpl = currentDb.templates.find(t => t.id === s.templateId) || 
                         currentDb.templates.find(t => t.id === templateId) || 
                         currentDb.templates.find(t => t.id === currentDb.settings.defaultTemplateId) || 
                         currentDb.templates[0];
      const tmplId = targetTmpl ? targetTmpl.id : (s.templateId || templateId);
      const profId = s.profileId || profileId || targetTmpl?.profileId || currentDb.settings.defaultProfileId || currentDb.profiles[0]?.id;
      return {
        templateId: tmplId,
        count: 1,
        prompt: (s.prompt || '').trim(),
        profileId: profId
      };
    });
  } else if (batch && Array.isArray(batch)) {
    normalizedBatch = batch.map(item => {
      const targetTmpl = currentDb.templates.find(t => t.id === item.templateId) || 
                         currentDb.templates.find(t => t.id === templateId) || 
                         currentDb.templates.find(t => t.id === currentDb.settings.defaultTemplateId) || 
                         currentDb.templates[0];
      const tmplId = targetTmpl ? targetTmpl.id : (item.templateId || templateId);
      const profId = item.profileId || profileId || targetTmpl?.profileId || currentDb.settings.defaultProfileId || currentDb.profiles[0]?.id;
      return {
        templateId: tmplId,
        count: parseInt(item.count) || 1,
        prompt: item.prompt,
        profileId: profId
      };
    });
  } else {
    const targetTmpl = currentDb.templates.find(t => t.id === templateId) || 
                       currentDb.templates.find(t => t.id === currentDb.settings.defaultTemplateId) || 
                       currentDb.templates[0];
    const tmplId = targetTmpl ? targetTmpl.id : templateId;
    const profId = profileId || targetTmpl?.profileId || currentDb.settings.defaultProfileId || currentDb.profiles[0]?.id;
    normalizedBatch = [{
      templateId: tmplId,
      count: parseInt(count) || 1,
      prompt: prompt,
      profileId: profId
    }];
  }

  // Validar todos los elementos del lote antes de iniciar para evitar fallos intermedios
  const exportFolderGlobal = currentDb.settings.exportFolder;
  for (const item of normalizedBatch) {
    const template = currentDb.templates.find(t => t.id === item.templateId);
    if (!template) {
      return res.status(400).json({ error: `No se encontró la plantilla de video requerida (ID: ${item.templateId || 'no especificado'}).` });
    }

    const finalProfileId = item.profileId || template.profileId || currentDb.settings.defaultProfileId;
    const profile = currentDb.profiles.find(p => p.id === finalProfileId) || currentDb.profiles[0];
    if (!profile || !profile.apiKey) {
      return res.status(400).json({ error: `La plantilla "${template.name}" requiere un perfil de IA con API Key configurada.` });
    }

    const activeBgFolder = (profile && profile.backgroundFolder && profile.backgroundFolder.trim())
      ? profile.backgroundFolder
      : backgroundFolder;
    if (!activeBgFolder || !fs.existsSync(activeBgFolder)) {
      return res.status(400).json({ error: `La carpeta de videos de fondo para la plantilla "${template.name}" no está configurada o no existe.` });
    }

    const activeExportFolder = (profile && profile.exportFolder && profile.exportFolder.trim())
      ? profile.exportFolder
      : exportFolderGlobal;
    if (!activeExportFolder || !activeExportFolder.trim()) {
      return res.status(400).json({ error: `La carpeta de exportación para la plantilla "${template.name}" no está configurada.` });
    }
  }

  const totalCount = normalizedBatch.reduce((sum, item) => sum + item.count, 0);

  // Inicializar trabajo activo
  activeJob = {
    id: uuidv4(),
    prompt: normalizedBatch.length > 1 ? `Lote de ${normalizedBatch.length} plantillas` : (normalizedBatch[0].prompt || 'Generación rápida'),
    totalCount: totalCount,
    currentVideoIndex: 0,
    status: 'starting',
    progress: 0,
    currentStep: 'Iniciando cola de generación'
  };
  jobLogs = [];

  res.json({ success: true, jobId: activeJob.id });

  // Comenzar ejecución asíncrona de la cola de renderizado en segundo plano
  runGenerationQueue(activeJob, normalizedBatch, backgroundFolder).catch(err => {
    console.error('Error crítico en la cola de renderizado:', err);
    activeJob = null;
    broadcastProgress({ type: 'error', error: err.message, log: `ERROR CRÍTICO: ${err.message}` });
  });
});

// 7b. Endpoint para cancelar el proceso de generación en curso
app.post('/api/jobs/cancel', (req, res) => {
  if (!activeJob) {
    return res.status(400).json({ error: 'No hay ningún trabajo de generación activo en curso.' });
  }

  cancelRequested = true;
  console.log(`[Cancelación] Solicitud de cancelación recibida para el trabajo: ${activeJob.id}`);
  
  // Detener de forma inmediata cualquier proceso de FFmpeg en Windows
  try {
    const { execSync } = require('child_process');
    execSync('taskkill /F /IM ffmpeg.exe', { stdio: 'ignore' });
    console.log('[Cancelación] Comando taskkill FFmpeg enviado de manera exitosa.');
  } catch (err) {
    // Si no hay procesos de FFmpeg activos, taskkill fallará, lo cual se ignora de forma segura
  }

  res.json({ success: true, message: 'Proceso de generación cancelado exitosamente.' });
});

// 7c. Endpoint para pausar la cola de generación activa
app.post('/api/jobs/pause', (req, res) => {
  if (!activeJob) {
    return res.status(400).json({ error: 'No hay ningún trabajo de generación activo para pausar.' });
  }
  pauseRequested = true;
  res.json({ success: true, message: 'Solicitud de pausa enviada. Se pausará al terminar el video actual.' });
});

// 7d. Endpoint para reanudar la cola de generación pausada
app.post('/api/jobs/resume', (req, res) => {
  if (!activeJob) {
    return res.status(400).json({ error: 'No hay ningún trabajo de generación activo para reanudar.' });
  }
  pauseRequested = false;
  res.json({ success: true, message: 'Cola de generación reanudada exitosamente.' });
});

// 7e. Endpoint para obtener la cantidad de videos fallidos en memoria
app.get('/api/jobs/failed-count', (req, res) => {
  res.json({ failedCount: failedItems ? failedItems.length : 0 });
});

// 7f. Endpoint para reintentar únicamente los videos fallidos del lote actual
app.post('/api/jobs/retry-failed', (req, res) => {
  if (activeJob) {
    return res.status(400).json({ error: 'Ya hay un proceso de renderizado en curso.' });
  }
  if (!failedItems || failedItems.length === 0) {
    return res.status(400).json({ error: 'No hay videos fallidos registrados para reintentar.' });
  }

  const currentDb = db.readDb();
  const retryBatch = [...failedItems];
  failedItems = []; // Limpiar fallidos para la nueva ejecución

  // Inicializar trabajo activo
  activeJob = {
    id: uuidv4(),
    prompt: `Reintento de ${retryBatch.length} videos fallidos`,
    totalCount: retryBatch.length,
    currentVideoIndex: 0,
    status: 'starting',
    progress: 0,
    currentStep: 'Reintentando videos fallidos'
  };
  jobLogs = [];

  res.json({ success: true, jobId: activeJob.id });

  // Comenzar ejecución asíncrona de la cola de reintento
  runGenerationQueue(activeJob, retryBatch, currentDb.settings.backgroundFolder).catch(err => {
    console.error('Error crítico en la cola de reintento:', err);
    activeJob = null;
    broadcastProgress({ type: 'error', error: err.message, log: `ERROR CRÍTICO: ${err.message}` });
  });
});

// ----------------------------------------------------
// MOTOR DE LA COLA EN SEGUNDO PLANO
// ----------------------------------------------------
async function runGenerationQueue(job, normalizedBatch, defaultBackgroundFolder) {
  batchStartTime = Date.now();
  pauseRequested = false;
  isPaused = false;
  failedItems = [];

  const currentDb = db.readDb();
  const defaultExportFolder = currentDb.settings.exportFolder || path.join(__dirname, 'temp');
  const batchReportItems = [];
  let bgFolder = defaultBackgroundFolder;
  let exportFolder = defaultExportFolder;
  // La ruta del reporte se resolverá dinámicamente según la configuración de salida.
  
  const usedTemplates = new Set();
  const usedProfiles = new Set();
  try {
    broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `Iniciando generación de lote: ${job.totalCount} videos solicitados.` });

    for (let index = 0; index < job.totalCount; index++) {
      if (cancelRequested) {
        throw new Error('La generación fue cancelada por solicitud del usuario.');
      }

      // Verificar si hay solicitud de pausa activa entre videos
      if (pauseRequested && !cancelRequested) {
        isPaused = true;
        job.status = 'paused';
        job.currentStep = 'Proceso pausado temporalmente';
        broadcastProgress({
          type: 'status',
          status: 'paused',
          activeJob: job,
          log: `Generación pausada antes de iniciar el Video #${index + 1}. El proceso está congelado.`
        });
        
        while (pauseRequested && !cancelRequested) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        isPaused = false;
        if (!cancelRequested) {
          job.status = 'processing';
          job.currentStep = 'Reanudando generación';
          broadcastProgress({
            type: 'status',
            status: 'processing',
            activeJob: job,
            log: 'Generación reanudada. Continuando con la cola.'
          });
        }
      }

      job.currentVideoIndex = index + 1;
      const videoNumStr = `[Video ${job.currentVideoIndex}/${job.totalCount}]`;

      // Encontrar a qué plantilla del lote corresponde el video actual
      let accumulatedCount = 0;
      let currentItem = null;
      for (const item of normalizedBatch) {
        accumulatedCount += item.count;
        if (index < accumulatedCount) {
          currentItem = item;
          break;
        }
      }

      if (!currentItem) {
        throw new Error('Error al determinar la plantilla del lote actual.');
      }

      const template = currentDb.templates.find(t => t.id === currentItem.templateId);
      const finalProfileId = currentItem.profileId || template.profileId || currentDb.settings.defaultProfileId;
      const profile = currentDb.profiles.find(p => p.id === finalProfileId) || currentDb.profiles[0];

      // Guardar el perfil y plantilla activos en el objeto de trabajo para la UI
      job.currentProfileId = finalProfileId;
      job.currentTemplateId = template?.id;

      if (template && template.name) usedTemplates.add(template.name);
      if (profile && profile.name) usedProfiles.add(profile.name);

      bgFolder = (profile && profile.backgroundFolder && profile.backgroundFolder.trim())
        ? profile.backgroundFolder
        : defaultBackgroundFolder;
      exportFolder = (profile && profile.exportFolder && profile.exportFolder.trim())
        ? profile.exportFolder
        : defaultExportFolder;

      if (cancelRequested) throw new Error('La generación fue cancelada por solicitud del usuario.');

      const jobTempDir = path.join(TEMP_DIR, `video_${index}_${uuidv4().substring(0, 8)}`);

      try {
        if (!template) {
          throw new Error(`Plantilla no encontrada para el elemento ${index + 1}.`);
        }
        if (!profile || !profile.apiKey) {
          throw new Error(`El perfil asignado para "${template.name}" no tiene API Key configurada.`);
        }

        job.stage = 'script';
        job.currentStep = 'Generando historia con IA';
        job.progress = 0;

        broadcastProgress({ 
          type: 'status', 
          status: 'processing', 
          activeJob: job, 
          log: `${videoNumStr} [${template.name}] Generando guion usando Gemini API...` 
        });

        // 1. LLAMAR A GEMINI PARA GENERAR LA HISTORIA Y DETECTAR GÉNERO
        const currentPrompt = currentItem.prompt || template.defaultIdea || 'Inventa una historia dramática';

        let effectiveSystemPrompt = profile.systemPrompt;
        if (template.multiVoiceEnabled) {
          const extension = template.multiVoicePromptExtension || '';
          effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n[INSTRUCCIÓN DE DIÁLOGOS MULTI-VOZ ACTIVA]\n${extension}\nLímite máximo de voces/personajes a usar: ${template.multiVoiceMaxVoices || 4}.`;
        }

        const primaryAttempts = profile.primaryAttempts !== undefined ? parseInt(profile.primaryAttempts) : 2;
        const fallbackAttempts = profile.fallbackAttempts !== undefined ? parseInt(profile.fallbackAttempts) : 3;
        const fallbackModels = profile.fallbackModels || profile.fallbackModel || 'gemini-2.5-flash';
        const story = await gemini.generateStory(
          profile.apiKey,
          profile.model,
          currentPrompt,
          effectiveSystemPrompt,
          primaryAttempts,
          fallbackAttempts,
          fallbackModels
        );
        if (cancelRequested) throw new Error('La generación fue cancelada por solicitud del usuario.');

        if (story.dialogues && !story.content) {
          story.content = story.dialogues.map(d => `${d.role}: "${d.text}"`).join('\n');
        }

        broadcastProgress({ 
          type: 'status', 
          status: 'processing', 
          activeJob: job, 
          log: `${videoNumStr} Guion generado con éxito. Título: "${story.title}". Género clasificado: ${story.gender === 'male' ? 'Masculino (Jorge)' : 'Femenino (Dalia)'}` 
        });

        // Crear subcarpeta temporal limpia y única para este video específico
        if (!fs.existsSync(jobTempDir)) {
          fs.mkdirSync(jobTempDir, { recursive: true });
        }

        // Rutas de archivos temporales
        const titleAudioPath = path.join(jobTempDir, 'title.mp3');
        const bodyAudioPath = path.join(jobTempDir, 'body.mp3');
        const cardImagePath = path.join(jobTempDir, 'card.png');
        const assPath = path.join(jobTempDir, 'subtitles.ass');

        // Determinar la voz de Edge TTS según el género
        const activeVoice = story.gender === 'male' ? template.maleVoice : template.femaleVoice;

        // 2. GENERAR AUDIOS CON EDGE TTS
        job.stage = 'audio';
        job.currentStep = 'Sintetizando locución de audio (TTS)';

        // Audio A: Título
        broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Sintetizando audio del TÍTULO...` });
        const titleTimestamps = await tts.generateSpeechAndTimestamps(
          story.title, 
          activeVoice, 
          titleAudioPath, 
          template,
          (prog) => {
            if (prog.status === 'synthesizing') {
              broadcastProgress({
                type: 'status',
                status: 'processing',
                activeJob: job,
                log: `${videoNumStr} [TTS] Sintetizando audio del título (${prog.chunkIndex}/${prog.totalChunks})...`
              });
            }
          }
        );
        const titleDuration = timeline.getVideoDuration(titleAudioPath);

        if (cancelRequested) throw new Error('La generación fue cancelada por solicitud del usuario.');
        
        let bodyTimestamps = [];
        let bodyDuration = 0;

        if (template.multiVoiceEnabled && story.dialogues && story.dialogues.length > 0) {
          job.stage = 'audio';
          job.currentStep = 'Sintetizando diálogos multi-voz';
          broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Iniciando síntesis de diálogos MULTI-VOZ (${story.dialogues.length} frases)...` });

          const roleMap = assignVoicesToRoles(story.dialogues, template, story.gender);
          const dialogueParts = [];
          let accumulatedDuration = 0;

          for (let dIdx = 0; dIdx < story.dialogues.length; dIdx++) {
            if (cancelRequested) throw new Error('La generación fue cancelada por solicitud del usuario.');
            const dial = story.dialogues[dIdx];
            const roleLower = dial.role.toLowerCase();
            const voiceConf = roleMap[roleLower] || roleMap['narrator'];

            const partFilename = `dial_part_${dIdx}_${uuidv4().substring(0, 8)}.mp3`;
            const partAudioPath = path.join(jobTempDir, partFilename);

            const shortVoiceName = voiceConf.voice.split('-').slice(-1)[0];
            broadcastProgress({
              type: 'status',
              status: 'processing',
              activeJob: job,
              log: `${videoNumStr} [TTS] Sintetizando diálogo ${dIdx + 1}/${story.dialogues.length} (personaje: "${dial.role}", voz: ${shortVoiceName})...`
            });

            const partOptions = {
              voiceRate: voiceConf.rate,
              pitch: voiceConf.pitch
            };

            const partTimestamps = await tts.generateSpeechAndTimestamps(
              dial.text, 
              voiceConf.voice, 
              partAudioPath, 
              partOptions,
              (prog) => {
                if (prog.status === 'synthesizing' && prog.totalChunks > 1) {
                  broadcastProgress({
                    type: 'status',
                    status: 'processing',
                    activeJob: job,
                    log: `${videoNumStr} [TTS] Diálogo ${dIdx + 1}: fragmento ${prog.chunkIndex}/${prog.totalChunks}...`
                  });
                }
              }
            );
            const partDuration = timeline.getVideoDuration(partAudioPath);

            const shiftedTimestamps = partTimestamps.map(t => ({
              word: t.word,
              start: Number((t.start + accumulatedDuration).toFixed(3)),
              end: Number((t.end + accumulatedDuration).toFixed(3)),
              duration: t.duration
            }));

            dialogueParts.push(partAudioPath);
            bodyTimestamps.push(...shiftedTimestamps);
            accumulatedDuration += partDuration;
          }

          broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Ensamblando pistas de diálogos...` });
          tts.concatAudioFiles(dialogueParts, bodyAudioPath);
          bodyDuration = accumulatedDuration;
        } else {
          job.stage = 'audio';
          job.currentStep = 'Sintetizando historia de audio (TTS)';
          broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Sintetizando audio de la HISTORIA...` });
          bodyTimestamps = await tts.generateSpeechAndTimestamps(
            story.content || '', 
            activeVoice, 
            bodyAudioPath, 
            template,
            (prog) => {
              if (prog.status === 'synthesizing') {
                broadcastProgress({
                  type: 'status',
                  status: 'processing',
                  activeJob: job,
                  log: `${videoNumStr} [TTS] Sintetizando fragmento ${prog.chunkIndex}/${prog.totalChunks} (${prog.charLength || 0} caracteres)...`
                });
              } else if (prog.status === 'processed') {
                broadcastProgress({
                  type: 'status',
                  status: 'processing',
                  activeJob: job,
                  log: `${videoNumStr} [TTS] Marcas de tiempo procesadas para fragmento ${prog.chunkIndex}/${prog.totalChunks} (Duración: ${prog.duration ? prog.duration.toFixed(1) : 0}s)`
                });
              }
            }
          );
          bodyDuration = timeline.getVideoDuration(bodyAudioPath);
        }

        const totalDuration = titleDuration + bodyDuration;
        broadcastProgress({ 
          type: 'status', 
          status: 'processing', 
          activeJob: job, 
          log: `${videoNumStr} Audios completados. Duración Título: ${titleDuration}s | Duración Cuerpo: ${bodyDuration}s | Total: ${totalDuration.toFixed(1)}s` 
        });

        if (cancelRequested) throw new Error('La generación fue cancelada por solicitud del usuario.');
        // 3. GENERAR EL PNG DE LA TARJETA DE REDDIT
        job.stage = 'subtitles';
        job.currentStep = 'Renderizando tarjeta Reddit y subtítulos';
        broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Renderizando Tarjeta de Reddit con Puppeteer...` });
        const cardData = {
          title: story.title,
          username: template.cardUsername,
          subreddit: template.cardSubreddit,
          avatar: template.cardAvatar,
          upvotes: template.upvotes,
          comments: template.comments,
          theme: template.cardTheme,
          cardShowVerified: template.cardShowVerified !== undefined ? template.cardShowVerified : true,
          cardShowAwards: template.cardShowAwards !== undefined ? template.cardShowAwards : true,
          cardSelectedAwards: template.cardSelectedAwards || [],
          cardWidth: template.cardWidth !== undefined ? template.cardWidth : 260,
          cardBorderRadius: template.cardBorderRadius !== undefined ? template.cardBorderRadius : 11,
          cardPadding: template.cardPadding !== undefined ? template.cardPadding : 12,
          cardGap: template.cardGap !== undefined ? template.cardGap : 7
        };
        await cardRenderer.renderCard(cardData, cardImagePath);
        broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Tarjeta de Reddit renderizada con éxito.` });

        // 4. CALCULAR LOS SEGMENTOS DEL VIDEO DE FONDO (CON CONTINUIDAD AISLADA POR CANAL)
        broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Consultando línea de tiempo de video continuo...` });
        const { segments } = timeline.getBackgroundSegments(totalDuration, bgFolder, profile.id);
        broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Pista de fondo virtual asignada.` });

        const cleanTitle = story.title
          .replace(/[\\/:*?"<>|]/g, '') // Remueve caracteres no permitidos en nombres de archivos de Windows
          .replace(/\s+/g, ' ')         // Normaliza espacios múltiples
          .trim();
        
        // Truncar para evitar el límite de 260 caracteres de ruta en Windows
        const maxTitleLength = 60;
        let truncatedTitle = cleanTitle;
        if (truncatedTitle.length > maxTitleLength) {
          truncatedTitle = truncatedTitle.substring(0, maxTitleLength).trim();
        }
        const safeTitle = truncatedTitle || `video_${uuidv4().substring(0, 8)}`;

        const formatMode = template.exportFormat || '9-16'; // '9-16' | '16-9' | 'both'

        if (formatMode === 'both') {
          // GENERACIÓN EN AMBOS FORMATOS (9:16 y 16:9 sincronizados)
          const assPath916 = path.join(jobTempDir, 'subtitles_9_16.ass');
          const assPath169 = path.join(jobTempDir, 'subtitles_16_9.ass');

          // Generar subtítulos para cada formato por separado (debido a diferencias de tamaño y posiciones)
          broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Generando script de subtítulos ASS para 9:16...` });
          await subtitles.generateAssSubtitles(bodyTimestamps, assPath916, template, titleDuration, false);

          broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Generando script de subtítulos ASS para 16:9...` });
          await subtitles.generateAssSubtitles(bodyTimestamps, assPath169, template, titleDuration, true);

          // Escribir metadatos
          const storyMetaPath = path.join(jobTempDir, 'story_meta.json');
          const storyMetaData = {
            title: story.title,
            content: story.content,
            gender: story.gender,
            activeVoice: activeVoice,
            prompt: currentPrompt,
            templateName: template.name,
            exportFormat: 'both',
            files: {
              titleAudio: titleAudioPath,
              bodyAudio: bodyAudioPath,
              cardImage: cardImagePath,
              subtitlesAss916: assPath916,
              subtitlesAss169: assPath169
            }
          };
          fs.writeFileSync(storyMetaPath, JSON.stringify(storyMetaData, null, 2), 'utf8');

          if (cancelRequested) throw new Error('La generación fue cancelada por solicitud del usuario.');
          // Compilar 9:16
          const finalVideoPath916 = path.join(exportFolder, `video ${job.currentVideoIndex} 9-16 ${safeTitle}.mp4`);
          job.stage = 'render';
          job.currentStep = 'Codificando formato 9:16 con FFmpeg';
          broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Compilando formato 9:16 vertical (Archivo: video ${job.currentVideoIndex} 9-16 ${safeTitle}.mp4)...` });
          let lastLogged916 = -1;
          await ffmpeg.compileVideo({
            backgroundSegments: segments,
            cardImagePath,
            titleAudioPath,
            bodyAudioPath,
            assSubtitlesPath: assPath916,
            titleDuration,
            totalDuration,
            outputPath: finalVideoPath916,
            cardOffsetX: template.cardOffsetX || 0,
            cardOffsetY: template.cardOffsetY || 0,
            cardScale: template.cardScale !== undefined ? template.cardScale : 1.0,
            aspectRatio: '9:16',
            cardEntryAnimation: template.cardEntryAnimation || 'none',
            cardExitAnimation: template.cardExitAnimation || 'none',
            cardEntryDuration: template.cardEntryDuration !== undefined ? template.cardEntryDuration : 0.4,
            cardExitDuration: template.cardExitDuration !== undefined ? template.cardExitDuration : 0.4,
            renderEngine: (profile && profile.renderEngine && profile.renderEngine !== 'global')
              ? profile.renderEngine
              : (currentDb.settings.renderEngine || 'auto'),
            musicEnabled: template.musicEnabled || false,
            musicFile: template.musicFile || '',
            musicVolume: template.musicVolume !== undefined ? template.musicVolume : -20,
            watermarkEnabled: template.watermarkEnabled || false,
            watermarkType: template.watermarkType || 'text',
            watermarkImageFile: template.watermarkImageFile || '',
            watermarkImageScale: template.watermarkImageScale !== undefined ? template.watermarkImageScale : 0.15,
            watermarkImageOpacity: template.watermarkImageOpacity !== undefined ? template.watermarkImageOpacity : 0.5,
            watermarkImageAlignment: template.watermarkImageAlignment !== undefined ? template.watermarkImageAlignment : 9,
            watermarkImageOffsetX: template.watermarkImageOffsetX !== undefined ? template.watermarkImageOffsetX : 20,
            watermarkImageOffsetY: template.watermarkImageOffsetY !== undefined ? template.watermarkImageOffsetY : 20
          }, (percent) => {
            job.progress = Math.round(percent * 0.5);
            const shouldLog = (percent > 0 && percent !== lastLogged916);
            if (shouldLog) {
              lastLogged916 = percent;
            }
            broadcastProgress({ 
              type: 'progress', 
              activeJob: job, 
              percent: job.progress, 
              log: shouldLog ? `${videoNumStr} Progreso de codificación 9:16: ${percent}%` : null 
            });
          });

          // Compilar 16:9
          const finalVideoPath169 = path.join(exportFolder, `video ${job.currentVideoIndex} 16-9 ${safeTitle}.mp4`);
          job.stage = 'render';
          job.currentStep = 'Codificando formato 16:9 con FFmpeg';
          broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Compilando formato 16:9 horizontal (Archivo: video ${job.currentVideoIndex} 16-9 ${safeTitle}.mp4)...` });
          let lastLogged169 = -1;
          await ffmpeg.compileVideo({
            backgroundSegments: segments, // Mismos segmentos de fondo para sincro perfecta!
            cardImagePath,
            titleAudioPath,
            bodyAudioPath,
            assSubtitlesPath: assPath169,
            titleDuration,
            totalDuration,
            outputPath: finalVideoPath169,
            cardOffsetX_16_9: template.cardOffsetX_16_9 !== undefined ? template.cardOffsetX_16_9 : 0,
            cardOffsetY_16_9: template.cardOffsetY_16_9 !== undefined ? template.cardOffsetY_16_9 : 0,
            cardScale_16_9: template.cardScale_16_9 !== undefined ? template.cardScale_16_9 : 1.0,
            aspectRatio: '16:9',
            cardEntryAnimation: template.cardEntryAnimation || 'none',
            cardExitAnimation: template.cardExitAnimation || 'none',
            cardEntryDuration: template.cardEntryDuration !== undefined ? template.cardEntryDuration : 0.4,
            cardExitDuration: template.cardExitDuration !== undefined ? template.cardExitDuration : 0.4,
            renderEngine: (profile && profile.renderEngine && profile.renderEngine !== 'global')
              ? profile.renderEngine
              : (currentDb.settings.renderEngine || 'auto'),
            musicEnabled: template.musicEnabled || false,
            musicFile: template.musicFile || '',
            musicVolume: template.musicVolume !== undefined ? template.musicVolume : -20,
            watermarkEnabled: template.watermarkEnabled || false,
            watermarkType: template.watermarkType || 'text',
            watermarkImageFile: template.watermarkImageFile || '',
            watermarkImageScale: template.watermarkImageScale !== undefined ? template.watermarkImageScale : 0.15,
            watermarkImageOpacity: template.watermarkImageOpacity !== undefined ? template.watermarkImageOpacity : 0.5,
            watermarkImageAlignment: template.watermarkImageAlignment !== undefined ? template.watermarkImageAlignment : 9,
            watermarkImageOffsetX: template.watermarkImageOffsetX !== undefined ? template.watermarkImageOffsetX : 20,
            watermarkImageOffsetY: template.watermarkImageOffsetY !== undefined ? template.watermarkImageOffsetY : 20
          }, (percent) => {
            job.progress = 50 + Math.round(percent * 0.5);
            const shouldLog = (percent > 0 && percent !== lastLogged169);
            if (shouldLog) {
              lastLogged169 = percent;
            }
            broadcastProgress({ 
              type: 'progress', 
              activeJob: job, 
              percent: job.progress, 
              log: shouldLog ? `${videoNumStr} Progreso de codificación 16:9: ${percent}%` : null 
            });
          });

          const generatedFiles = [
            `Formato Vertical (9:16): video ${job.currentVideoIndex} 9-16 ${safeTitle}.mp4`,
            `Formato Horizontal (16:9): video ${job.currentVideoIndex} 16-9 ${safeTitle}.mp4`
          ];
          const finalHashtags = profile.hashtags !== undefined ? profile.hashtags : (currentDb.settings.hashtags || '');
          batchReportItems.push({
            index: job.currentVideoIndex,
            title: story.title,
            files: generatedFiles,
            safeTitle: safeTitle,
            isBoth: true,
            hashtags: finalHashtags
          });

          job.stage = 'done';
          job.currentStep = 'Videos completados y guardados';
          broadcastProgress({ 
            type: 'status', 
            status: 'processing', 
            activeJob: job, 
            log: `${videoNumStr} Videos creados con éxito en ambos formatos. Guardados en: ${exportFolder}` 
          });

        } else {
          // GENERACIÓN EN UN ÚNICO FORMATO (9:16 o 16:9)
          const isLandscape = formatMode === '16-9';
          broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Generando script de subtítulos ASS (Modo: ${isLandscape ? '16:9' : '9:16'})...` });
          await subtitles.generateAssSubtitles(bodyTimestamps, assPath, template, titleDuration, isLandscape);

          // Escribir metadatos
          const storyMetaPath = path.join(jobTempDir, 'story_meta.json');
          const storyMetaData = {
            title: story.title,
            content: story.content,
            gender: story.gender,
            activeVoice: activeVoice,
            prompt: currentPrompt,
            templateName: template.name,
            exportFormat: formatMode,
            files: {
              titleAudio: titleAudioPath,
              bodyAudio: bodyAudioPath,
              cardImage: cardImagePath,
              subtitlesAss: assPath
            }
          };
          fs.writeFileSync(storyMetaPath, JSON.stringify(storyMetaData, null, 2), 'utf8');

          if (cancelRequested) throw new Error('La generación fue cancelada por solicitud del usuario.');
          const videoName = isLandscape ? `video ${job.currentVideoIndex} 16-9 ${safeTitle}` : `video ${job.currentVideoIndex} 9-16 ${safeTitle}`;
          const finalVideoPath = path.join(exportFolder, `${videoName}.mp4`);
          job.stage = 'render';
          job.currentStep = 'Codificando video con FFmpeg';
          broadcastProgress({ type: 'status', status: 'processing', activeJob: job, log: `${videoNumStr} Iniciando codificación FFmpeg (Archivo: ${videoName}.mp4)...` });

          let lastLoggedPercent = -1;
          await ffmpeg.compileVideo({
            backgroundSegments: segments,
            cardImagePath,
            titleAudioPath,
            bodyAudioPath,
            assSubtitlesPath: assPath,
            titleDuration,
            totalDuration,
            outputPath: finalVideoPath,
            cardOffsetX: template.cardOffsetX || 0,
            cardOffsetY: template.cardOffsetY || 0,
            cardScale: template.cardScale !== undefined ? template.cardScale : 1.0,
            cardOffsetX_16_9: template.cardOffsetX_16_9 !== undefined ? template.cardOffsetX_16_9 : 0,
            cardOffsetY_16_9: template.cardOffsetY_16_9 !== undefined ? template.cardOffsetY_16_9 : 0,
            cardScale_16_9: template.cardScale_16_9 !== undefined ? template.cardScale_16_9 : 1.0,
            aspectRatio: isLandscape ? '16:9' : '9:16',
            cardEntryAnimation: template.cardEntryAnimation || 'none',
            cardExitAnimation: template.cardExitAnimation || 'none',
            cardEntryDuration: template.cardEntryDuration !== undefined ? template.cardEntryDuration : 0.4,
            cardExitDuration: template.cardExitDuration !== undefined ? template.cardExitDuration : 0.4,
            renderEngine: (profile && profile.renderEngine && profile.renderEngine !== 'global')
              ? profile.renderEngine
              : (currentDb.settings.renderEngine || 'auto'),
            musicEnabled: template.musicEnabled || false,
            musicFile: template.musicFile || '',
            musicVolume: template.musicVolume !== undefined ? template.musicVolume : -20,
            watermarkEnabled: template.watermarkEnabled || false,
            watermarkType: template.watermarkType || 'text',
            watermarkImageFile: template.watermarkImageFile || '',
            watermarkImageScale: template.watermarkImageScale !== undefined ? template.watermarkImageScale : 0.15,
            watermarkImageOpacity: template.watermarkImageOpacity !== undefined ? template.watermarkImageOpacity : 0.5,
            watermarkImageAlignment: template.watermarkImageAlignment !== undefined ? template.watermarkImageAlignment : 9,
            watermarkImageOffsetX: template.watermarkImageOffsetX !== undefined ? template.watermarkImageOffsetX : 20,
            watermarkImageOffsetY: template.watermarkImageOffsetY !== undefined ? template.watermarkImageOffsetY : 20
          }, (percent) => {
            job.progress = percent;
            const shouldLog = (percent > 0 && percent !== lastLoggedPercent);
            if (shouldLog) {
              lastLoggedPercent = percent;
            }
            broadcastProgress({ 
              type: 'progress', 
              activeJob: job, 
              percent, 
              log: shouldLog ? `${videoNumStr} Progreso de codificación FFmpeg: ${percent}%` : null 
            });
          });

          const generatedFiles = [
            `Formato ${isLandscape ? 'Horizontal (16:9)' : 'Vertical (9:16)'}: ${videoName}.mp4`
          ];
          const finalHashtags = profile.hashtags !== undefined ? profile.hashtags : (currentDb.settings.hashtags || '');
          batchReportItems.push({
            index: job.currentVideoIndex,
            title: story.title,
            files: generatedFiles,
            safeTitle: safeTitle,
            isBoth: false,
            formatSuffix: isLandscape ? '16-9' : '9-16',
            videoPath: finalVideoPath,
            hashtags: finalHashtags
          });

          job.stage = 'done';
          job.currentStep = 'Video completado y guardado';
          broadcastProgress({ 
            type: 'status', 
            status: 'processing', 
            activeJob: job, 
            log: `${videoNumStr} Video compilado con éxito. Guardado en: ${finalVideoPath}` 
          });
        }

        // No se generan archivos TXT individuales por cada video para evitar sobrepoblar la carpeta.
        // Toda la información se consolidará en un único archivo de texto para toda la corrida.
        
        // Escribir siempre el reporte consolidado general (para 1 o más videos)
        if (job.totalCount >= 1) {
          let batchContent = `============================================================\n`;
          batchContent += `REPORTE DE GENERACIÓN DE VIDEOS\n`;
          batchContent += `============================================================\n`;
          batchContent += `ID de Lote: ${job.id}\n`;
          batchContent += `Total de Videos Solicitados: ${job.totalCount}\n`;
          batchContent += `Videos Generados Exitosamente: ${batchReportItems.length}\n\n`;

          for (const reportItem of batchReportItems) {
            batchContent += `------------------------------------------------------------\n`;
            batchContent += `[Video ${reportItem.index}/${job.totalCount}]\n`;
            batchContent += `Título: ${reportItem.title}\n\n`;
            if (reportItem.hashtags) {
              batchContent += `${reportItem.hashtags}\n\n`;
            }
            if (reportItem.isBoth) {
              batchContent += `Archivos de Video Generados:\n- ${reportItem.files[0]}\n- ${reportItem.files[1]}\n`;
            } else {
              batchContent += `Archivo de Video Generado:\n- ${reportItem.files[0]}\n`;
            }
          }
          batchContent += `------------------------------------------------------------\n`;
          
          let activeReportFolder = exportFolder;
          const pReportSame = profile ? profile.reportFolderSameAsVideo : currentDb.settings.reportFolderSameAsVideo;
          const reportSame = pReportSame !== false;
          
          if (!reportSame) {
            const pReportFolder = profile ? profile.reportFolder : currentDb.settings.reportFolder;
            if (pReportFolder && pReportFolder.trim()) {
              activeReportFolder = pReportFolder.trim();
            }
          }
          
          const batchReportPath = path.join(activeReportFolder, `reporte_lote_${job.id.substring(0, 8)}.txt`);

          try {
            const reportDir = path.dirname(batchReportPath);
            if (!fs.existsSync(reportDir)) {
              fs.mkdirSync(reportDir, { recursive: true });
            }
            fs.writeFileSync(batchReportPath, batchContent, 'utf8');
            broadcastProgress({ 
              type: 'status', 
              status: 'processing', 
              activeJob: job, 
              log: `${videoNumStr} Reporte consolidado unificado de texto creado en: ${batchReportPath}` 
            });
          } catch (txtErr) {
            console.error('Error al escribir el archivo de reporte consolidado:', txtErr);
            broadcastProgress({
              type: 'status',
              status: 'processing',
              activeJob: job,
              log: `[ADVERTENCIA] ${videoNumStr} No se pudo guardar el reporte de texto (.txt): ${txtErr.message}`
            });
          }
        }

        // Enviar notificación individual de video completado
        const lastReportItem = batchReportItems[batchReportItems.length - 1];
        if (lastReportItem) {
          const videoDurationMin = Math.floor(totalDuration / 60);
          const videoDurationSec = Math.floor(totalDuration % 60);
          const videoDurationStr = `${videoDurationMin}m ${videoDurationSec}s`;
          
          let fileListStr = '';
          if (lastReportItem.isBoth) {
            fileListStr = `${lastReportItem.files[0]}\n- ${lastReportItem.files[1]}`;
          } else {
            fileListStr = lastReportItem.files[0];
          }

          sendNotification({
            status: 'video_completed',
            index: job.currentVideoIndex,
            totalCount: job.totalCount,
            title: story.title,
            durationStr: videoDurationStr,
            filePath: fileListStr
          }).catch(nErr => console.error('Error al enviar notificación individual:', nErr));
        }

      } catch (err) {
        if (cancelRequested || (err.message && err.message.includes('cancelada por solicitud'))) {
          throw err;
        }

        console.error(`[Fila ${index + 1}] Error procesando video:`, err);
        broadcastProgress({
          type: 'status',
          status: 'processing',
          activeJob: job,
          log: `[FALLO OMITIDO] ${videoNumStr} No se pudo generar este video (${err.message}). Continuando automáticamente con el siguiente video de la cola...`
        });

        failedItems.push({
          templateId: currentItem.templateId,
          profileId: currentItem.profileId,
          count: 1,
          prompt: currentItem.prompt,
          error: err.message
        });

        job.failedCount = failedItems.length;
        job.failedItems = failedItems;
      } finally {
        // Limpieza de subcarpeta temporal garantizada tanto en éxito como en fallo
        try {
          if (fs.existsSync(jobTempDir)) {
            fs.rmSync(jobTempDir, { recursive: true, force: true });
            console.log(`[Limpieza] Subcarpeta temporal eliminada con éxito: ${jobTempDir}`);
          }
        } catch (rmErr) {
          console.warn('No se pudo borrar subcarpeta temporal:', rmErr.message);
        }
      }
    }

    // Cola finalizada con éxito
    job.failedCount = failedItems.length;
    job.failedItems = failedItems;

    const durationMs = Date.now() - batchStartTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const durationStr = `${minutes}m ${seconds}s`;
    const profileList = Array.from(usedProfiles).join(', ') || 'Global';
    const templateList = Array.from(usedTemplates).join(', ') || 'N/A';

    if (failedItems.length > 0) {
      job.status = 'completed_with_errors';
      job.progress = 100;
      job.currentStep = `Generación finalizada con ${failedItems.length} errores`;
      broadcastProgress({
        type: 'status',
        status: 'completed_with_errors',
        activeJob: job,
        log: `Lote finalizado con ${failedItems.length} videos fallidos. Puedes reintentarlos desde el Dashboard.`
      });

      const successCount = job.totalCount - failedItems.length;
      const failedCount = failedItems.length;
      sendNotification({
        status: 'completed_with_errors',
        successCount,
        totalCount: job.totalCount,
        failedCount,
        durationStr,
        profileList,
        templateList,
        exportFolder
      });
    } else {
      job.status = 'completed';
      job.progress = 100;
      job.currentStep = 'Generación completada';
      broadcastProgress({
        type: 'status',
        status: 'completed',
        activeJob: job,
        log: 'Lote completado con éxito. Todos los videos listos en tu carpeta de exportación.'
      });

      const successCount = job.totalCount;
      sendNotification({
        status: 'completed',
        successCount,
        totalCount: job.totalCount,
        durationStr,
        profileList,
        templateList,
        exportFolder
      });
    }
    activeJob = null;
    cancelRequested = false;
  } catch (error) {
    console.error('Error procesando video en cola:', error);
    
    const durationMs = Date.now() - batchStartTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const durationStr = `${minutes}m ${seconds}s`;

    if (cancelRequested) {
      job.status = 'cancelled';
      job.currentStep = 'Cancelado por el usuario';
      broadcastProgress({ 
        type: 'status', 
        status: 'cancelled', 
        activeJob: job, 
        log: 'PROCESO CANCELADO: La generación de videos fue detenida por el usuario.' 
      });

      sendNotification({
        status: 'cancelled',
        successCount: job.currentVideoIndex,
        totalCount: job.totalCount,
        durationStr
      });
    } else {
      job.status = 'failed';
      job.currentStep = 'Error en el proceso';
      broadcastProgress({ 
        type: 'status', 
        status: 'failed', 
        activeJob: job, 
        error: error.message, 
        log: `Error en el proceso: ${error.message}` 
      });

      sendNotification({
        status: 'failed',
        successCount: job.currentVideoIndex,
        totalCount: job.totalCount,
        durationStr,
        errorMsg: error.message
      });
    }
    activeJob = null;
    cancelRequested = false;
  }
}



// Servir archivos estáticos del frontend en producción
const FRONTEND_DIST = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/avatars') || req.path.startsWith('/previews')) {
      return next();
    }
    if (req.method === 'GET') {
      return res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    }
    next();
  });
}

// Iniciar Servidor Express
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Servidor local Reddit Generator corriendo en puerto: ${PORT}`);
  console.log(`====================================================`);
});

// Manejo de apagado limpio
function gracefulShutdown(signal) {
  console.log(`[Server] Recibida señal ${signal}. Cerrando servidor local...`);
  server.close(() => {
    console.log('[Server] Servidor cerrado correctamente.');
    process.exit(0);
  });
  // Forzar salida tras 3 segundos si quedan sockets abiertos
  setTimeout(() => {
    process.exit(0);
  }, 3000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));


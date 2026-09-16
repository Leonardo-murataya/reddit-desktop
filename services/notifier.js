const db = require('./db');

/**
 * Envía una notificación formateada a Discord y/o WhatsApp según la configuración activa.
 * @param {object|string} messageOrOptions - Datos estructurados del evento o mensaje de texto plano
 */
async function sendNotification(messageOrOptions) {
  try {
    const currentDb = db.readDb();
    const settings = currentDb.settings || {};

    let tgMessage = '';
    let discordPayload = null;

    if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
      const { status, successCount, totalCount, failedCount, durationStr, profileList, templateList, exportFolder, errorMsg } = messageOrOptions;

      // 1. Construir mensaje de texto plano con formato Markdown
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
        : status === 'video_completed' ? 3447003 // Azul
        : 15158332; // Rojo

      const embedTitle = status === 'completed' ? '🎉 ¡LOTE COMPLETADO CON ÉXITO!'
        : status === 'completed_with_errors' ? '⚠️ LOTE FINALIZADO CON DETALLES'
        : status === 'cancelled' ? '🛑 GENERACIÓN DETENIDA'
        : status === 'video_completed' ? `📹 ¡VIDEO GENERADO! (${messageOrOptions.index || 1}/${messageOrOptions.totalCount || 1})`
        : '💥 ERROR CRÍTICO EN EL LOTE';

      const embedDesc = status === 'completed' ? 'El generador de videos ha finalizado la cola de renderizado sin fallas.'
        : status === 'completed_with_errors' ? 'La cola de renderizado ha terminado, pero se registraron algunos errores.'
        : status === 'cancelled' ? 'El renderizado fue cancelado manualmente por el usuario.'
        : status === 'video_completed' ? 'Se ha terminado de compilar exitosamente un video.'
        : 'El renderizado se interrumpió debido a un error inesperado.';

      const rawFields = [];
      if (status === 'completed' || status === 'completed_with_errors') {
        rawFields.push({ name: '⏱️ Tiempo Total', value: durationStr || 'N/A', inline: true });
        if (status === 'completed') {
          rawFields.push({ name: '📹 Videos Generados', value: `${successCount || 0} de ${totalCount || 0} ✅`, inline: true });
        } else {
          rawFields.push({ name: '📹 Videos Exitosos', value: `${successCount || 0} de ${totalCount || 0} ✅`, inline: true });
          rawFields.push({ name: '❌ Videos Fallados', value: `${failedCount || 0} ❌`, inline: true });
        }
        rawFields.push({ name: '👤 Perfil de API', value: profileList || 'Por defecto', inline: true });
        rawFields.push({ name: '🎨 Plantilla(s)', value: templateList || 'Por defecto', inline: true });
        if (exportFolder) {
          rawFields.push({ name: '📁 Carpeta de Salida', value: `\`${exportFolder}\``, inline: false });
        }
      } else if (status === 'video_completed') {
        rawFields.push({ name: '🎬 Título', value: messageOrOptions.title || 'Video Generado', inline: false });
        rawFields.push({ name: '⏱️ Duración del Video', value: durationStr || 'N/A', inline: true });
        if (messageOrOptions.filePath) {
          rawFields.push({ name: '📁 Archivo de Salida', value: `\`${messageOrOptions.filePath}\``, inline: false });
        }
      } else {
        rawFields.push({ name: '⏱️ Tiempo Transcurrido', value: durationStr || 'N/A', inline: true });
        rawFields.push({ name: '📹 Videos Procesados', value: `${successCount || 0} de ${totalCount || 0}`, inline: true });
        if (errorMsg) {
          const cleanErr = String(errorMsg).substring(0, 950);
          rawFields.push({ name: '❌ Mensaje de Error', value: `\`\`\`${cleanErr}\`\`\``, inline: false });
        }
      }

      const safeFields = rawFields
        .filter(f => f && f.name && String(f.name).trim() && f.value && String(f.value).trim())
        .map(f => ({
          name: String(f.name).substring(0, 250),
          value: String(f.value).substring(0, 1000),
          inline: Boolean(f.inline)
        }));

      discordPayload = {
        embeds: [
          {
            title: embedTitle,
            description: embedDesc,
            color: embedColor,
            fields: safeFields,
            footer: {
              text: 'REDIT-GEN • Sistema de Notificaciones'
            },
            timestamp: new Date().toISOString()
          }
        ]
      };
    } else {
      const text = String(messageOrOptions);
      tgMessage = text;
      discordPayload = { content: text };
    }

    // Enviar a Discord
    if (settings.discordEnabled && settings.discordWebhookUrl) {
      const webhookUrl = settings.discordWebhookUrl.trim();
      if (webhookUrl && (webhookUrl.startsWith('http://') || webhookUrl.startsWith('https://'))) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(discordPayload),
            signal: AbortSignal.timeout(10000)
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

/**
 * Prueba la configuración de notificaciones enviando un mensaje de prueba.
 */
async function testNotifications({ discordEnabled, discordWebhookUrl, whatsappEnabled, whatsappPhone, whatsappApiKey }) {
  if (!discordEnabled && !whatsappEnabled) {
    throw new Error('Configura y activa al menos un canal (Discord o WhatsApp) para probar.');
  }

  const message = '🔔 [REDIT-GEN] ¡Prueba de integración exitosa! Tus notificaciones están correctamente vinculadas.';
  const promises = [];

  if (discordEnabled && discordWebhookUrl) {
    const webhookUrl = discordWebhookUrl.trim();
    if (webhookUrl) {
      promises.push((async () => {
        if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
          throw new Error('La URL del Webhook debe comenzar con https://');
        }
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [
              {
                title: '🔔 [REDIT-GEN] ¡Prueba de Integración!',
                description: 'Tus notificaciones de Discord están configuradas correctamente.',
                color: 3066993,
                footer: { text: 'REDIT-GEN • Notificaciones' },
                timestamp: new Date().toISOString()
              }
            ]
          }),
          signal: AbortSignal.timeout(10000)
        });
        if (response.ok) {
          return { service: 'Discord', success: true };
        } else {
          let errDetail = `Error ${response.status}`;
          if (response.status === 404) errDetail = 'Webhook no encontrado (404). Verifica si fue eliminado en Discord.';
          else if (response.status === 401) errDetail = 'Token del Webhook no autorizado (401).';
          else if (response.status === 400) errDetail = 'Formato de datos no admitido (400).';
          else if (response.status === 429) errDetail = 'Límite de envíos excedido en Discord (429 Rate Limit).';
          throw new Error(`Discord: ${errDetail}`);
        }
      })());
    }
  }

  if (whatsappEnabled && whatsappPhone && whatsappApiKey) {
    const phone = whatsappPhone.trim();
    const apiKey = whatsappApiKey.trim();
    if (phone && apiKey) {
      promises.push((async () => {
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
      })());
    }
  }

  if (promises.length === 0) {
    throw new Error('Configura campos válidos de Discord o WhatsApp para probar.');
  }

  return await Promise.all(promises);
}

module.exports = {
  sendNotification,
  testNotifications
};

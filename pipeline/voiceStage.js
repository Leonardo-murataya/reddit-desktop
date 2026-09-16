const path = require('path');
const { v4: uuidv4 } = require('uuid');
const tts = require('../services/tts');
const timeline = require('../services/timeline');

/**
 * Asigna de forma determinista una configuración de voz (voz, pitch, rate) a cada rol único.
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

/**
 * Etapa 2 del Pipeline: Síntesis de voz neuronal y timestamps (Edge-TTS)
 */
async function executeVoiceStage({ story, template, jobTempDir, videoNumStr, broadcastProgress, job, isCancelRequested }) {
  job.stage = 'audio';
  job.currentStep = 'Sintetizando locución de audio (TTS)';

  const titleAudioPath = path.join(jobTempDir, 'title.mp3');
  const bodyAudioPath = path.join(jobTempDir, 'body.mp3');

  const activeVoice = story.gender === 'male' ? template.maleVoice : template.femaleVoice;

  // 1. Audio del Título
  broadcastProgress({
    type: 'status',
    status: 'processing',
    activeJob: job,
    log: `${videoNumStr} Sintetizando audio del TÍTULO...`
  });

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

  if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');

  let bodyTimestamps = [];
  let bodyDuration = 0;

  // 2. Audio del Cuerpo (Multi-voz o Narrador único)
  if (template.multiVoiceEnabled && story.dialogues && story.dialogues.length > 0) {
    job.currentStep = 'Sintetizando diálogos multi-voz';
    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `${videoNumStr} Iniciando síntesis de diálogos MULTI-VOZ (${story.dialogues.length} frases)...`
    });

    const roleMap = assignVoicesToRoles(story.dialogues, template, story.gender);
    const dialogueParts = [];
    let accumulatedDuration = 0;

    for (let dIdx = 0; dIdx < story.dialogues.length; dIdx++) {
      if (isCancelRequested()) throw new Error('La generación fue cancelada por solicitud del usuario.');
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

    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `${videoNumStr} Ensamblando pistas de diálogos...`
    });
    tts.concatAudioFiles(dialogueParts, bodyAudioPath);
    bodyDuration = accumulatedDuration;
  } else {
    job.currentStep = 'Sintetizando historia de audio (TTS)';
    broadcastProgress({
      type: 'status',
      status: 'processing',
      activeJob: job,
      log: `${videoNumStr} Sintetizando audio de la HISTORIA...`
    });

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

  return {
    titleAudioPath,
    bodyAudioPath,
    titleTimestamps,
    bodyTimestamps,
    titleDuration,
    bodyDuration,
    totalDuration,
    activeVoice
  };
}

module.exports = {
  assignVoicesToRoles,
  executeVoiceStage
};

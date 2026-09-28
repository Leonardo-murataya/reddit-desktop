const { execSync, spawnSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

let cachedHardware = null;
let cachedEncoderProbe = null;

/**
 * Sondea activamente el ejecutable de FFmpeg para comprobar qué codificadores
 * por hardware funcionan realmente en el hardware y controladores del sistema (Estilo Drift Exporter).
 * @returns {Array<{id: string, name: string, type: 'gpu'|'cpu', vendor: string, functional: boolean}>}
 */
function probeHardwareEncoders() {
  if (cachedEncoderProbe) {
    return cachedEncoderProbe;
  }

  const encodersToTest = [
    { id: 'h264_nvenc', name: 'H.264 (NVIDIA NVENC)', type: 'gpu', vendor: 'NVIDIA' },
    { id: 'hevc_nvenc', name: 'HEVC / H.265 (NVIDIA NVENC)', type: 'gpu', vendor: 'NVIDIA' },
    { id: 'h264_amf', name: 'H.264 (AMD AMF)', type: 'gpu', vendor: 'AMD' },
    { id: 'hevc_amf', name: 'HEVC / H.265 (AMD AMF)', type: 'gpu', vendor: 'AMD' },
    { id: 'h264_qsv', name: 'H.264 (Intel QuickSync)', type: 'gpu', vendor: 'Intel' },
    { id: 'hevc_qsv', name: 'HEVC / H.265 (Intel QuickSync)', type: 'gpu', vendor: 'Intel' },
    { id: 'libx264', name: 'H.264 CPU (libx264)', type: 'cpu', vendor: 'Software' },
    { id: 'libx265', name: 'HEVC / H.265 CPU (libx265)', type: 'cpu', vendor: 'Software' }
  ];

  const results = [];

  for (const item of encodersToTest) {
    try {
      // 1 frame test con resolución mínima 256x256 que satisface todas las GPUs modernas
      const probe = spawnSync(
        ffmpegPath,
        ['-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.04', '-c:v', item.id, '-f', 'null', '-'],
        { encoding: 'utf8', timeout: 2500 }
      );
      const isOk = probe.status === 0;
      results.push({ ...item, functional: isOk });
    } catch (e) {
      results.push({ ...item, functional: false });
    }
  }

  cachedEncoderProbe = results;
  return results;
}

/**
 * Autodetecta todas las tarjetas gráficas y procesadores instalados en Windows y determina el códec de aceleración para FFmpeg.
 * @returns {{gpuName: string, cpuName: string, codec: string, hwaccel: string, description: string, allGpus: Array<string>, supportedEncoders: Array<object>, hevcAvailable: boolean}}
 */
function detectHardware() {
  if (cachedHardware) {
    return { ...cachedHardware, allGpus: [...cachedHardware.allGpus] };
  }

  const result = {
    gpuName: 'Desconocido / Genérico',
    cpuName: 'Procesador Genérico',
    codec: 'libx264', // CPU Fallback por defecto
    hwaccel: '',
    description: 'Renderizado por Software (CPU) - Seguro pero más lento.',
    allGpus: [],
    supportedEncoders: [],
    hevcAvailable: false
  };

  // Solo corremos comandos de Windows si estamos en Windows
  if (process.platform !== 'win32') {
    result.description = 'Plataforma no Windows. Usando codificador CPU estándar (libx264).';
    result.allGpus = ['CPU Standard Node'];
    result.supportedEncoders = [{ id: 'libx264', name: 'libx264 (CPU)', functional: true }];
    cachedHardware = result;
    return result;
  }

  // 1. Detectar CPU
  try {
    const cpuCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance -ClassName Win32_Processor | Select-Object -ExpandProperty Name"`;
    const rawCpuInfo = execSync(cpuCmd, { encoding: 'utf8', timeout: 4000 }).trim();
    if (rawCpuInfo) {
      result.cpuName = rawCpuInfo;
    }
  } catch (cpuError) {
    console.error('Error al detectar procesador:', cpuError.message);
  }

  // 2. Detectar GPU mediante WMI
  try {
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance -ClassName Win32_VideoController | Select-Object -ExpandProperty Name"`;
    const rawGpuInfo = execSync(psCmd, { encoding: 'utf8', timeout: 4000 });
    const lines = rawGpuInfo.split('\n')
      .map(line => line.trim())
      .filter(line => line && line.toLowerCase() !== 'name');

    if (lines.length > 0) {
      result.allGpus = lines; // Guardar todas las GPUs encontradas en el sistema

      // Buscar si existe alguna GPU dedicada prioritaria (Nvidia o AMD) en la lista
      let selectedGpu = lines[0];
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes('nvidia') || lower.includes('geforce') || lower.includes('rtx') || lower.includes('amd') || lower.includes('radeon')) {
          selectedGpu = line;
          break;
        }
      }
      result.gpuName = selectedGpu;
    }
  } catch (error) {
    console.error('Error al detectar hardware gráfico mediante powershell:', error.message);
    try {
      const rawGpuInfo = execSync('wmic path win32_VideoController get name', { encoding: 'utf8' });
      const lines = rawGpuInfo.split('\n')
        .map(line => line.trim())
        .filter(line => line && line.toLowerCase() !== 'name');

      if (lines.length > 0) {
        result.allGpus = lines;
        result.gpuName = lines[0];
      }
    } catch (fallbackError) {
      result.allGpus = ['CPU Fallback (wmic failed)'];
    }
  }

  // 3. Sondeo activo de compatibilidad real con FFmpeg (Inspirado en Drift HwAccel)
  const probeResults = probeHardwareEncoders();
  result.supportedEncoders = probeResults;

  const nvencOk = probeResults.some(e => e.id === 'h264_nvenc' && e.functional);
  const hevcNvencOk = probeResults.some(e => e.id === 'hevc_nvenc' && e.functional);
  const amfOk = probeResults.some(e => e.id === 'h264_amf' && e.functional);
  const qsvOk = probeResults.some(e => e.id === 'h264_qsv' && e.functional);

  result.hevcAvailable = hevcNvencOk || probeResults.some(e => (e.id === 'hevc_amf' || e.id === 'hevc_qsv') && e.functional);

  if (nvencOk) {
    result.codec = 'h264_nvenc';
    result.hwaccel = 'cuda';
    result.description = `Aceleración por Hardware NVIDIA CUDA (${result.gpuName}) verificada y activa. ¡Máxima velocidad!`;
  } else if (amfOk) {
    result.codec = 'h264_amf';
    result.hwaccel = 'd3d11va';
    result.description = `Aceleración por Hardware AMD AMF (${result.gpuName}) verificada y activa. Alta velocidad.`;
  } else if (qsvOk) {
    result.codec = 'h264_qsv';
    result.hwaccel = 'qsv';
    result.description = `Aceleración por Hardware Intel QuickSync (${result.gpuName}) verificada y activa.`;
  } else {
    result.codec = 'libx264';
    result.hwaccel = '';
    result.description = `Renderizado por Software CPU (libx264). Estable y compatible con todos los sistemas.`;
  }

  // Enriquecer descripción con CPU
  if (result.cpuName && result.cpuName !== 'Procesador Genérico') {
    result.description = `[CPU: ${result.cpuName}] | ` + result.description;
  }

  cachedHardware = result;
  return result;
}

/**
 * Mapea un nombre de GPU o códec específico a su configuración de hardware correspondiente.
 * @param {string} gpuNameOrCodec - Nombre del controlador de video o identificador de códec
 * @returns {{codec: string, hwaccel: string, description: string}}
 */
function getCodecForGpuName(gpuNameOrCodec) {
  const result = {
    codec: 'libx264',
    hwaccel: '',
    description: `Renderizado por Software (CPU) - Fallback para: ${gpuNameOrCodec}`
  };

  if (!gpuNameOrCodec) return result;

  const lower = gpuNameOrCodec.toLowerCase();

  if (lower === 'h264_nvenc' || lower === 'hevc_nvenc' || lower.includes('nvidia') || lower.includes('geforce') || lower.includes('rtx')) {
    result.codec = lower === 'hevc_nvenc' ? 'hevc_nvenc' : 'h264_nvenc';
    result.hwaccel = 'cuda';
    result.description = `NVIDIA NVENC (${gpuNameOrCodec}) acelerado por hardware CUDA.`;
  } else if (lower === 'h264_amf' || lower === 'hevc_amf' || lower.includes('amd') || lower.includes('radeon')) {
    result.codec = lower === 'hevc_amf' ? 'hevc_amf' : 'h264_amf';
    result.hwaccel = 'd3d11va';
    result.description = `AMD AMF (${gpuNameOrCodec}) acelerado por hardware D3D11VA.`;
  } else if (lower === 'h264_qsv' || lower === 'hevc_qsv' || lower.includes('intel') || lower.includes('iris') || lower.includes('uhd')) {
    result.codec = lower === 'hevc_qsv' ? 'hevc_qsv' : 'h264_qsv';
    result.hwaccel = 'qsv';
    result.description = `Intel QuickSync (${gpuNameOrCodec}) acelerado por hardware QSV.`;
  } else {
    result.codec = lower === 'libx265' ? 'libx265' : 'libx264';
    result.hwaccel = '';
    result.description = `Renderizado por CPU (${gpuNameOrCodec}).`;
  }

  return result;
}

module.exports = {
  detectHardware,
  getCodecForGpuName,
  probeHardwareEncoders
};

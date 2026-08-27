const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const NATIVE_EXE = path.join(__dirname, 'native_dialogs.exe');

/**
 * Ejecuta el helper nativo ultrarrápido sin consola ni PowerShell si está compilado.
 * @param {string} mode 
 * @param {Array<string>} args 
 * @returns {string|null}
 */
function runNativeDialog(mode, args = []) {
  if (process.platform !== 'win32' || !fs.existsSync(NATIVE_EXE)) {
    return null;
  }
  try {
    const output = execFileSync(NATIVE_EXE, [mode, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 120000 // 2 minutos máximo de espera de usuario
    }).trim();
    return output;
  } catch (error) {
    if (error.status === 0 || error.code === 'ETIMEDOUT') {
      return '';
    }
    console.warn(`[Dialogs] Fallback nativo: ${error.message}`);
    return null;
  }
}

/**
 * Fallback: Crea, ejecuta y limpia un script temporal de PowerShell completamente oculto.
 * @param {string} scriptContent 
 * @returns {string} Resultado de la consola
 */
function runPowerShellScript(scriptContent) {
  const tempScriptPath = path.join(TEMP_DIR, `dialog_${uuidv4().substring(0, 8)}.ps1`);
  try {
    const prefixedContent = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\r\n` + scriptContent;
    fs.writeFileSync(tempScriptPath, '\ufeff' + prefixedContent, 'utf8');
    
    // Forzamos modo oculto y STA para evitar parpadeos de consola
    const cmd = `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -STA -File "${tempScriptPath}"`;
    const output = execSync(cmd, { 
      encoding: 'utf8', 
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 120000
    }).trim();
    return output;
  } catch (error) {
    if (error.code !== 'ETIMEDOUT') {
      console.error('Error al ejecutar script de PowerShell:', error.message);
    }
    return '';
  } finally {
    try {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    } catch (cleanError) {
      // Ignorar limpieza
    }
  }
}

/**
 * Lanza un diálogo moderno de Windows para seleccionar una carpeta.
 * @param {string} [title] 
 * @param {string} [initialPath]
 * @returns {string} Ruta absoluta de la carpeta seleccionada o cadena vacía.
 */
function selectLocalFolder(title = 'Selecciona una carpeta', initialPath = '') {
  if (process.platform !== 'win32') return '';

  const nativeRes = runNativeDialog('folder', [title, initialPath]);
  if (nativeRes !== null) {
    return nativeRes;
  }

  // Fallback con PowerShell
  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $f = New-Object System.Windows.Forms.FolderBrowserDialog
    $f.ShowNewFolderButton = $true
    $f.Description = "${title.replace(/"/g, '`"')}"
    if ("${initialPath.replace(/\\/g, '\\\\')}" -ne "" -and (Test-Path "${initialPath.replace(/\\/g, '\\\\')}")) {
      $f.SelectedPath = "${initialPath.replace(/\\/g, '\\\\')}"
    }
    $result = $f.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
      Write-Output $f.SelectedPath
    }
  `;

  return runPowerShellScript(psScript);
}

/**
 * Lanza un diálogo moderno de Windows para seleccionar múltiples archivos de video.
 * @param {string} [title]
 * @param {string} [initialPath]
 * @returns {Array<string>} Lista de rutas absolutas de archivos seleccionados.
 */
function selectLocalFiles(title = 'Selecciona tus videos de fondo', initialPath = '') {
  if (process.platform !== 'win32') return [];

  const nativeRes = runNativeDialog('videos', [title, initialPath]);
  if (nativeRes !== null) {
    if (!nativeRes) return [];
    return nativeRes.split(';').map(p => p.trim()).filter(Boolean);
  }

  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $f = New-Object System.Windows.Forms.OpenFileDialog
    $f.Filter = 'Archivos de Video (*.mp4;*.mkv;*.mov;*.avi;*.webm)|*.mp4;*.mkv;*.mov;*.avi;*.webm|Todos los archivos (*.*)|*.*'
    $f.Multiselect = $true
    $f.AutoUpgradeEnabled = $true
    $f.Title = "${title.replace(/"/g, '`"')}"
    if ("${initialPath.replace(/\\/g, '\\\\')}" -ne "" -and (Test-Path "${initialPath.replace(/\\/g, '\\\\')}")) {
      $f.InitialDirectory = "${initialPath.replace(/\\/g, '\\\\')}"
    }
    $result = $f.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
      Write-Output ($f.FileNames -join ';')
    }
  `;

  const output = runPowerShellScript(psScript);
  if (!output) return [];
  return output.split(';').map(p => p.trim()).filter(Boolean);
}

/**
 * Lanza un diálogo para guardar archivo (ej. Guardar Plantilla de Video).
 * @param {string} defaultFileName
 * @param {string} title
 * @returns {string} Ruta absoluta del archivo a guardar o cadena vacía.
 */
function selectSaveLocation(defaultFileName = 'plantilla_template.json', title = 'Guardar Plantilla de Video') {
  if (process.platform !== 'win32') return '';

  const nativeRes = runNativeDialog('save-template', [title, defaultFileName]);
  if (nativeRes !== null) {
    return nativeRes;
  }

  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $f = New-Object System.Windows.Forms.SaveFileDialog
    $f.Filter = 'Plantilla de Video JSON (*.json)|*.json|Todos los archivos (*.*)|*.*'
    $f.DefaultExt = 'json'
    $f.AddExtension = $true
    $f.FileName = "${defaultFileName.replace(/"/g, '`"')}"
    $f.Title = "${title.replace(/"/g, '`"')}"
    $f.AutoUpgradeEnabled = $true
    $result = $f.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
      Write-Output $f.FileName
    }
  `;

  return runPowerShellScript(psScript);
}

/**
 * Lanza un diálogo para seleccionar una imagen de avatar / marca de agua.
 * @returns {{path: string, base64: string}|null}
 */
function selectLocalImage(title = 'Selecciona una imagen') {
  if (process.platform !== 'win32') return null;

  let imagePath = runNativeDialog('image', [title]);
  if (imagePath === null) {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.Application]::EnableVisualStyles()
      $f = New-Object System.Windows.Forms.OpenFileDialog
      $f.Filter = 'Imágenes (*.png;*.jpg;*.jpeg;*.webp;*.gif;*.bmp;*.svg)|*.png;*.jpg;*.jpeg;*.webp;*.gif;*.bmp;*.svg|Todos los archivos (*.*)|*.*'
      $f.Multiselect = $false
      $f.AutoUpgradeEnabled = $true
      $f.Title = "${title.replace(/"/g, '`"')}"
      $result = $f.ShowDialog()
      if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $f.FileName
      }
    `;
    imagePath = runPowerShellScript(psScript);
  }

  if (!imagePath || !fs.existsSync(imagePath)) return null;

  try {
    const ext = path.extname(imagePath).toLowerCase();
    const filename = `avatar_${uuidv4().substring(0, 8)}${ext}`;
    const targetDir = path.join(__dirname, '..', 'temp', 'avatars');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = path.join(targetDir, filename);
    
    // Copiar la imagen seleccionada de forma nativa a la carpeta estática
    fs.copyFileSync(imagePath, targetPath);
    console.log(`[Avatar] Foto copiada con éxito a la carpeta del servidor: ${targetPath}`);
    
    const webUrl = `/avatars/${filename}`;
    
    return {
      path: targetPath,
      base64: webUrl
    };
  } catch (error) {
    console.error('Error al procesar la imagen seleccionada:', error);
    return null;
  }
}

/**
 * Lanza un diálogo para seleccionar un archivo de audio (música de fondo).
 * @returns {string}
 */
function selectLocalAudio(title = 'Selecciona tu música de fondo') {
  if (process.platform !== 'win32') return '';

  const nativeRes = runNativeDialog('audio', [title]);
  if (nativeRes !== null) {
    return nativeRes;
  }

  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $f = New-Object System.Windows.Forms.OpenFileDialog
    $f.Filter = 'Archivos de Audio (*.mp3;*.wav;*.m4a;*.ogg;*.aac)|*.mp3;*.wav;*.m4a;*.ogg;*.aac|Todos los archivos (*.*)|*.*'
    $f.Multiselect = $false
    $f.AutoUpgradeEnabled = $true
    $f.Title = "${title.replace(/"/g, '`"')}"
    $result = $f.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
      Write-Output $f.FileName
    }
  `;

  return runPowerShellScript(psScript);
}

module.exports = {
  selectLocalFolder,
  selectLocalFiles,
  selectSaveLocation,
  selectLocalImage,
  selectLocalAudio
};

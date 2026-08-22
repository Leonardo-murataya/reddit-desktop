const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Crea, ejecuta y limpia un script temporal de PowerShell.
 * Esto evita el stripping de variables '$' en CMD/subprocesos de Node.
 * @param {string} scriptContent 
 * @returns {string} Resultado de la consola
 */
function runPowerShellScript(scriptContent) {
  const tempScriptPath = path.join(TEMP_DIR, `dialog_${uuidv4().substring(0, 8)}.ps1`);
  try {
    const prefixedContent = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\r\n` + scriptContent;
    fs.writeFileSync(tempScriptPath, '\ufeff' + prefixedContent, 'utf8');
    
    // Forzamos el flag -STA que es mandatorio para componentes GUI de Windows
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -STA -File "${tempScriptPath}"`;
    const output = execSync(cmd, { encoding: 'utf8' }).trim();
    return output;
  } catch (error) {
    console.error('Error al ejecutar script de PowerShell:', error);
    return '';
  } finally {
    try {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    } catch (cleanError) {
      console.warn('No se pudo limpiar el script temporal de PowerShell:', cleanError.message);
    }
  }
}

/**
 * Lanza un diálogo nativo de Windows para seleccionar una carpeta usando FolderBrowserDialog moderno.
 * @returns {string} Ruta absoluta de la carpeta seleccionada o cadena vacía.
 */
function selectLocalFolder() {
  if (process.platform !== 'win32') return '';

  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    $owner = New-Object System.Windows.Forms.Form
    $owner.TopMost = $true
    $owner.StartPosition = 'CenterScreen'
    $owner.Size = New-Object System.Drawing.Size(1, 1)
    $owner.Show()
    $owner.Activate()
    $f = New-Object System.Windows.Forms.FolderBrowserDialog
    $f.Description = 'Selecciona la carpeta de destino'
    $f.ShowNewFolderButton = $true
    $result = $f.ShowDialog($owner)
    $owner.Dispose()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
      $f.SelectedPath
    }
  `;

  return runPowerShellScript(psScript);
}

/**
 * Lanza un diálogo nativo de Windows para seleccionar múltiples archivos de video forzando el modo -STA.
 * @returns {Array<string>} Lista de rutas absolutas de archivos seleccionados.
 */
function selectLocalFiles() {
  if (process.platform !== 'win32') return [];

  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    $owner = New-Object System.Windows.Forms.Form
    $owner.TopMost = $true
    $owner.StartPosition = 'CenterScreen'
    $owner.Size = New-Object System.Drawing.Size(1, 1)
    $owner.Show()
    $owner.Activate()
    $f = New-Object System.Windows.Forms.OpenFileDialog
    $f.Filter = 'Archivos de Video (*.mp4;*.mkv;*.mov;*.avi)|*.mp4;*.mkv;*.mov;*.avi'
    $f.Multiselect = $true
    $f.Title = 'Selecciona tus videos de fondo'
    $result = $f.ShowDialog($owner)
    $owner.Dispose()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
      $f.FileNames -join ';'
    }
  `;

  const output = runPowerShellScript(psScript);
  if (!output) return [];
  return output.split(';').map(p => p.trim());
}

/**
 * Lanza un diálogo nativo de Windows para seleccionar una imagen de avatar forzando el modo -STA.
 * @returns {{path: string, base64: string}} Ruta y contenido en base64 de la imagen.
 */
function selectLocalImage() {
  if (process.platform !== 'win32') return null;

  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    $owner = New-Object System.Windows.Forms.Form
    $owner.TopMost = $true
    $owner.StartPosition = 'CenterScreen'
    $owner.Size = New-Object System.Drawing.Size(1, 1)
    $owner.Show()
    $owner.Activate()
    $f = New-Object System.Windows.Forms.OpenFileDialog
    $f.Filter = 'Imágenes (*.png;*.jpg;*.jpeg;*.webp;*.gif;*.bmp;*.svg)|*.png;*.jpg;*.jpeg;*.webp;*.gif;*.bmp;*.svg|Todos los archivos (*.*)|*.*'
    $f.Multiselect = $false
    $f.Title = 'Selecciona la foto de perfil'
    $result = $f.ShowDialog($owner)
    $owner.Dispose()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
      $f.FileName
    }
  `;

  const imagePath = runPowerShellScript(psScript);
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
      base64: webUrl // Retorna la URL local estática súper ligera
    };
  } catch (error) {
    console.error('Error al procesar la imagen seleccionada:', error);
    return null;
  }
}

/**
 * Lanza un diálogo nativo de Windows para seleccionar un archivo de audio (música de fondo) forzando el modo -STA.
 * @returns {string} Ruta absoluta del archivo seleccionado o cadena vacía.
 */
function selectLocalAudio() {
  if (process.platform !== 'win32') return '';

  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    $owner = New-Object System.Windows.Forms.Form
    $owner.TopMost = $true
    $owner.StartPosition = 'CenterScreen'
    $owner.Size = New-Object System.Drawing.Size(1, 1)
    $owner.Show()
    $owner.Activate()
    $f = New-Object System.Windows.Forms.OpenFileDialog
    $f.Filter = 'Archivos de Audio (*.mp3;*.wav;*.m4a;*.ogg;*.aac)|*.mp3;*.wav;*.m4a;*.ogg;*.aac|Todos los archivos (*.*)|*.*'
    $f.Multiselect = $false
    $f.Title = 'Selecciona tu música de fondo'
    $result = $f.ShowDialog($owner)
    $owner.Dispose()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
      $f.FileName
    }
  `;

  return runPowerShellScript(psScript);
}

module.exports = {
  selectLocalFolder,
  selectLocalFiles,
  selectLocalImage,
  selectLocalAudio
};

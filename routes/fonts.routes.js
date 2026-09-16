const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const fontsDir = path.join(__dirname, '..', 'fonts');
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

// Obtener catálogo de fuentes
router.get('/', (req, res) => {
  try {
    const fonts = getAvailableFonts();
    res.json(fonts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subir fuente personalizada
router.post('/upload', (req, res) => {
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

module.exports = router;

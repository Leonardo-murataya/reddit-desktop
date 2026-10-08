const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');
const gemini = require('../services/gemini');

// Autodescubrimiento de modelos disponibles para la(s) API Key(s) provistas
router.post('/available-models', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || (typeof apiKey === 'string' && !apiKey.trim())) {
      return res.status(400).json({ error: 'Debes proporcionar al menos una API Key para consultar los modelos disponibles.' });
    }
    const models = await gemini.listAvailableModels(apiKey);
    res.json({ success: true, models });
  } catch (error) {
    console.error('[ProfilesRoutes] Error consultando modelos disponibles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar perfiles
router.get('/', (req, res) => {
  const currentDb = db.readDb();
  res.json(currentDb.profiles || []);
});

// Crear o actualizar perfil
router.post('/', (req, res) => {
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

    const ok = db.writeDb(currentDb);
    if (!ok) {
      return res.status(500).json({ error: 'Error al persistir el perfil en la base de datos local.' });
    }
    res.json({ success: true, profile: savedProfile, profiles: currentDb.profiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar perfil
router.delete('/:id', (req, res) => {
  try {
    const currentDb = db.readDb();
    currentDb.profiles = (currentDb.profiles || []).filter(p => p.id !== req.params.id);
    const ok = db.writeDb(currentDb);
    if (!ok) {
      return res.status(500).json({ error: 'Error al eliminar el perfil en la base de datos local.' });
    }
    res.json({ success: true, profiles: currentDb.profiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Importar perfiles
router.post('/import', (req, res) => {
  try {
    const currentDb = db.readDb();
    const importedProfiles = req.body;

    if (!Array.isArray(importedProfiles)) {
      return res.status(400).json({ error: 'El archivo de importación debe contener una lista de perfiles (array).' });
    }

    importedProfiles.forEach(imported => {
      if (!imported.name) return;
      if (!imported.id) imported.id = uuidv4();

      const idx = currentDb.profiles.findIndex(p => p.id === imported.id);
      if (idx !== -1) {
        currentDb.profiles[idx] = { ...currentDb.profiles[idx], ...imported };
      } else {
        currentDb.profiles.push(imported);
      }
    });

    const ok = db.writeDb(currentDb);
    if (!ok) {
      return res.status(500).json({ error: 'Error al importar los perfiles en la base de datos local.' });
    }
    res.json({ success: true, profiles: currentDb.profiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

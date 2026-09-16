const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');

// Listar plantillas
router.get('/', (req, res) => {
  const currentDb = db.readDb();
  res.json(currentDb.templates || []);
});

// Crear o actualizar plantilla
router.post('/', (req, res) => {
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

// Eliminar plantilla
router.delete('/:id', (req, res) => {
  try {
    const currentDb = db.readDb();
    currentDb.templates = (currentDb.templates || []).filter(t => t.id !== req.params.id);
    db.writeDb(currentDb);
    res.json({ success: true, templates: currentDb.templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Importar plantilla y perfil asociado
router.post('/import', (req, res) => {
  try {
    const currentDb = db.readDb();
    const { template, profile } = req.body;

    if (!template) {
      return res.status(400).json({ error: 'Falta la plantilla de video en el paquete.' });
    }

    let finalProfileId = null;
    if (profile) {
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

module.exports = router;

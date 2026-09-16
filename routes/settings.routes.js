const express = require('express');
const router = express.Router();
const db = require('../services/db');
const gpu = require('../services/gpuDetector');
const notifier = require('../services/notifier');

// Detectar hardware
router.get('/detect-hardware', (req, res) => {
  try {
    const hw = gpu.detectHardware();
    res.json(hw);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener ajustes
router.get('/settings', (req, res) => {
  try {
    const currentDb = db.readDb();
    res.json(currentDb.settings || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar ajustes
router.post('/settings', (req, res) => {
  try {
    const currentDb = db.readDb();
    currentDb.settings = { ...currentDb.settings, ...req.body };
    const success = db.writeDb(currentDb);
    if (!success) {
      return res.status(500).json({ error: 'Error al persistir los ajustes en db.json' });
    }
    res.json({ success: true, settings: currentDb.settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Probar notificaciones
router.post('/notifications/test', async (req, res) => {
  try {
    const results = await notifier.testNotifications(req.body);
    res.json({ success: true, message: 'Notificación de prueba enviada con éxito.', results });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

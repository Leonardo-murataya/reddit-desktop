const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const db = require('../services/db');
const { getStorageDir } = require('../pipeline/pipelineManager');

const currentPkg = require('../package.json');
const currentVersion = currentPkg.version || '1.0.0';

// Función semver robusta
function compareVersions(v1, v2) {
  const p1 = (v1 || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// Handler para verificar actualizaciones
const handleCheckUpdates = async (req, res) => {
  try {
    const currentDb = db.readDb();
    const settings = currentDb.settings || {};

    const repo = (req.body?.githubRepo || settings.githubRepo || 'Leonardo-murataya/reddit-desktop').trim();
    // Seguridad: Token cargado únicamente desde configuración o entorno, sin secreto embebido en código
    const token = (req.body?.githubToken !== undefined && req.body.githubToken !== ''
      ? req.body.githubToken
      : (settings.githubToken || process.env.GITHUB_TOKEN || '')).trim();

    if (!repo) {
      return res.json({
        hasUpdate: false,
        currentVersion,
        error: 'No se ha configurado el repositorio de GitHub.'
      });
    }

    const headers = {
      'User-Agent': 'Reddit-Video-Generator-Desktop',
      'Accept': 'application/vnd.github+json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const [releasesRes, tagsRes] = await Promise.allSettled([
      fetch(`https://api.github.com/repos/${repo}/releases`, { headers }),
      fetch(`https://api.github.com/repos/${repo}/tags`, { headers })
    ]);

    const releases = releasesRes.status === 'fulfilled' && releasesRes.value.ok ? await releasesRes.value.json() : [];
    const tags = tagsRes.status === 'fulfilled' && tagsRes.value.ok ? await tagsRes.value.json() : [];

    const sortedReleases = Array.isArray(releases) ? releases.sort((a, b) => compareVersions(b.tag_name, a.tag_name)) : [];
    const sortedTags = Array.isArray(tags) ? tags.sort((a, b) => compareVersions(b.name, a.name)) : [];

    const topRelease = sortedReleases[0];
    const topTag = sortedTags[0]?.name?.replace(/^v/, '');

    let latestVersion = currentVersion;
    let matchingRelease = topRelease;

    if (topTag && compareVersions(topTag, latestVersion) > 0) {
      latestVersion = topTag;
      const relForTag = sortedReleases.find(r => (r.tag_name || '').replace(/^v/, '') === topTag);
      if (relForTag) {
        matchingRelease = relForTag;
      }
    } else if (topRelease) {
      const relTag = (topRelease.tag_name || '').replace(/^v/, '');
      if (compareVersions(relTag, latestVersion) > 0) {
        latestVersion = relTag;
      }
    }

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    res.json({
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseTitle: matchingRelease?.name || `Reddit Video Generator v${latestVersion}`,
      releaseNotes: matchingRelease?.body || 'Nueva versión disponible con mejoras de rendimiento, arquitectura y correcciones.',
      publishedAt: matchingRelease?.published_at || new Date().toISOString(),
      releaseUrl: matchingRelease?.html_url || `https://github.com/${repo}/releases/tag/v${latestVersion}`,
      githubToken: token ? 'Configurado' : '',
      assets: (matchingRelease?.assets || []).map(a => ({
        id: a.id,
        name: a.name,
        size: a.size,
        apiUrl: a.url,
        downloadUrl: a.browser_download_url
      }))
    });
  } catch (error) {
    console.error('Error al verificar actualizaciones:', error.message);
    res.status(500).json({ error: error.message, currentVersion });
  }
};

router.post('/check', handleCheckUpdates);
router.get('/check', handleCheckUpdates);

// Descargar asset de release
router.get('/download-asset', async (req, res) => {
  try {
    const { assetId, filename } = req.query;
    const settings = db.readDb().settings || {};
    const repo = settings.githubRepo || 'Leonardo-murataya/reddit-desktop';
    const token = (settings.githubToken || process.env.GITHUB_TOKEN || '').trim();

    if (!assetId) {
      return res.status(400).json({ error: 'assetId es requerido' });
    }

    const assetUrl = `https://api.github.com/repos/${repo}/releases/assets/${assetId}`;
    const headers = {
      'Accept': 'application/octet-stream',
      'User-Agent': 'Reddit-Desktop-Updater'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const ghRes = await fetch(assetUrl, {
      headers,
      redirect: 'follow'
    });

    if (!ghRes.ok) {
      return res.status(ghRes.status).json({ error: `Error ${ghRes.status} al descargar de GitHub` });
    }

    const safeFilename = path.basename(filename || 'Reddit_Video_Generator_Setup.exe');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const cl = ghRes.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);

    const { Readable } = require('stream');
    Readable.fromWeb(ghRes.body).pipe(res);
  } catch (error) {
    console.error('Error al descargar asset:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Omitir versión específica
router.post('/skip-version', (req, res) => {
  try {
    const { version } = req.body;
    if (!version) return res.status(400).json({ error: 'Versión requerida' });
    const currentDb = db.readDb();
    currentDb.settings = currentDb.settings || {};
    currentDb.settings.skippedVersion = version;
    db.writeDb(currentDb);
    res.json({ success: true, skippedVersion: version });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Descargar y lanzar instalador de forma segura
router.post('/launch-installer', async (req, res) => {
  try {
    const { assetId, filename, downloadUrl } = req.body;
    const settings = db.readDb().settings || {};
    const repo = settings.githubRepo || 'Leonardo-murataya/reddit-desktop';
    const token = (settings.githubToken || process.env.GITHUB_TOKEN || '').trim();

    const tempDir = getStorageDir('temp');
    const updatesDir = path.join(tempDir, 'updates');
    if (!fs.existsSync(updatesDir)) {
      fs.mkdirSync(updatesDir, { recursive: true });
    }

    // Sanitización estricta contra Path Traversal
    const rawName = filename || 'Reddit_Video_Generator_Setup.exe';
    const safeFilename = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const localFilePath = path.join(updatesDir, safeFilename);

    let downloaded = false;

    if (assetId || downloadUrl) {
      try {
        let targetUrl = downloadUrl;
        const headers = { 'User-Agent': 'Reddit-Desktop-Updater' };

        if (assetId) {
          targetUrl = `https://api.github.com/repos/${repo}/releases/assets/${assetId}`;
          if (token) headers['Authorization'] = `Bearer ${token}`;
          headers['Accept'] = 'application/octet-stream';
        }

        console.log(`[Updater] Descargando actualización: ${targetUrl}`);
        const ghRes = await fetch(targetUrl, { headers, redirect: 'follow' });
        if (ghRes.ok) {
          const { pipeline } = require('stream/promises');
          const { Readable } = require('stream');
          const fileStream = fs.createWriteStream(localFilePath);
          await pipeline(Readable.fromWeb(ghRes.body), fileStream);
          downloaded = true;
          console.log(`[Updater] Descarga completada en: ${localFilePath}`);
        } else {
          console.warn(`[Updater] Servidor respondió con código ${ghRes.status}`);
        }
      } catch (dlErr) {
        console.warn(`[Updater] Error en descarga:`, dlErr.message);
      }
    }

    // Fallback de prueba local si no se pudo descargar
    if (!downloaded) {
      const localCandidates = [
        path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'nsis', 'Reddit Video Generator_1.0.1_x64-setup.exe'),
        path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'nsis', 'Reddit Video Generator_1.0.0_x64-setup.exe'),
        path.join(__dirname, '..', 'dist_installers', 'Reddit Video Generator_1.0.1_x64-setup.exe'),
        path.join(__dirname, '..', 'dist_installers', 'Reddit Video Generator_1.0.0_x64-setup.exe')
      ];

      for (const cand of localCandidates) {
        if (fs.existsSync(cand)) {
          fs.copyFileSync(cand, localFilePath);
          downloaded = true;
          console.log(`[Updater] Usando instalador local: ${cand}`);
          break;
        }
      }
    }

    if (!downloaded || !fs.existsSync(localFilePath)) {
      return res.status(404).json({
        error: 'No se encontró el archivo instalador en GitHub ni localmente.'
      });
    }

    if (process.platform === 'win32' && localFilePath.endsWith('.exe')) {
      res.json({ success: true, executed: true, localFilePath });

      setTimeout(() => {
        try {
          console.log(`[Updater] Lanzando instalador: ${localFilePath}`);
          const launcher = spawn('cmd.exe', [
            '/c',
            'timeout /t 1 /nobreak >nul &',
            'start',
            '""',
            `"${localFilePath}"`,
            '/UPDATE'
          ], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
            shell: true
          });
          launcher.unref();

          setTimeout(() => {
            console.log('[Updater] Cerrando proceso de servidor para permitir la actualización...');
            process.exit(0);
          }, 400);
        } catch (spawnErr) {
          console.error('[Updater] Error al lanzar comando:', spawnErr);
        }
      }, 1000);

      return;
    }

    res.json({ success: true, downloaded: true, path: localFilePath });
  } catch (error) {
    console.error('[Updater] Error general:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

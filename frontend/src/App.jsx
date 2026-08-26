import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TemplateEditor from './components/TemplateEditor';
import ProfilesEditor from './components/ProfilesEditor';
import SettingsPanel from './components/SettingsPanel';
import PresetsHub from './components/PresetsHub';
import IntegrationsPanel from './components/IntegrationsPanel';
import UpdateModal from './components/UpdateModal';
import FloatingProgressDock from './components/FloatingProgressDock';
import { Cpu, Film, Sparkles, RefreshCw, Zap, Bell, CheckCircle2 } from 'lucide-react';
import { useUIModal } from './context/UIModalContext';

export default function App() {
  const { showConfirm, showToast } = useUIModal();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Estados cargados desde el servidor
  const [profiles, setProfiles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [settings, setSettings] = useState({});
  const [gpuInfo, setGpuInfo] = useState(null);
  const [backgroundStatus, setBackgroundStatus] = useState({ count: 0, duration: 0, files: [], playhead: {} });
  const [expressLaunchError, setExpressLaunchError] = useState('');
  const [settingsProfileId, setSettingsProfileId] = useState('global');

  // Estado de Actualizaciones
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Estado global del job activo (SSE al nivel de App para no perder eventos al cambiar de tab)
  const [activeJob, setActiveJob] = useState(null);
  const [jobLogs, setJobLogs] = useState([]);
  const [jobError, setJobError] = useState('');
  const [jobSuccess, setJobSuccess] = useState('');

  // Conectar SSE globalmente al montar App (persiste entre tabs)
  useEffect(() => {
    const eventSource = new EventSource('/api/jobs/progress');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'init') {
        setActiveJob(data.activeJob);
        if (data.logs && data.logs.length > 0) setJobLogs(data.logs);
      } else if (data.type === 'status') {
        setActiveJob(data.activeJob);
        if (data.status === 'completed') {
          setJobSuccess('Generación de videos completada con éxito.');
          refreshBackgroundVideos();
          setActiveJob(null);
        } else if (data.status === 'completed_with_errors') {
          setJobError(`Lote finalizado con ${data.activeJob?.failedCount || 1} errores. Puedes reintentarlos.`);
          refreshBackgroundVideos();
          setActiveJob(null);
        } else if (data.status === 'failed') {
          setJobError(data.error || 'Ocurrió un error en el procesamiento.');
          setActiveJob(null);
        } else if (data.status === 'cancelled') {
          setJobError('Generación de videos cancelada por el usuario.');
          setActiveJob(null);
        }
      } else if (data.type === 'progress') {
        setActiveJob(data.activeJob);
      } else if (data.type === 'error') {
        setJobError(data.error || 'Error crítico en la generación.');
        setActiveJob(null);
      }

      if (data.log) {
        setJobLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${data.log}`]);
      }
    };

    eventSource.onerror = () => {
      // Se reconecta automáticamente
    };

    return () => eventSource.close();
  }, []);

  // Cargar datos al montar la aplicación
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Obtener Detección de Hardware
      const gpuRes = await fetch('/api/detect-hardware');
      const gpuData = await gpuRes.json();
      setGpuInfo(gpuData);

      // 2. Obtener Ajustes
      const settingsRes = await fetch('/api/settings');
      const settingsData = await settingsRes.json();
      setSettings(settingsData);

      // 3. Obtener Perfiles
      const profilesRes = await fetch('/api/profiles');
      const profilesData = await profilesRes.json();
      setProfiles(profilesData);

      // 4. Obtener Plantillas
      const templatesRes = await fetch('/api/templates');
      const templatesData = await templatesRes.json();
      setTemplates(templatesData);

      // 5. Refrescar Videos de Fondo
      refreshBackgroundVideos(settingsData.backgroundFolder);

      // 6. Verificar actualización silenciosa de fondo al arrancar si está habilitado
      if (settingsData.autoCheckUpdate !== false) {
        performUpdateCheck(settingsData).then(info => {
          if (info && info.hasUpdate) {
            setUpdateInfo(info);
            setShowUpdateModal(true);
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Error cargando datos iniciales:', err);
    }
  };

  const refreshBackgroundVideos = async (folder, profileId) => {
    try {
      let targetFolder = folder;
      if (!targetFolder && profileId && Array.isArray(profiles) && profiles.length > 0) {
        const prof = profiles.find(p => p.id === profileId);
        if (prof && prof.backgroundFolder) {
          targetFolder = prof.backgroundFolder;
        }
      }
      if (!targetFolder && settings?.backgroundFolder) {
        targetFolder = settings.backgroundFolder;
      }

      const res = await fetch('/api/background/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: targetFolder || '', profileId: profileId || '' })
      });
      const data = await res.json();
      setBackgroundStatus(data || { count: 0, totalDuration: 0, files: [], playhead: {} });
    } catch (err) {
      console.error('Error al consultar videos de fondo:', err);
    }
  };

  const handleSaveSettings = async (newSettings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      const data = await res.json();
      setSettings(data || newSettings);
      refreshBackgroundVideos(data?.backgroundFolder || newSettings.backgroundFolder);
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  };

  const handleSaveProfile = async (profile) => {
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      const data = await res.json();
      
      // Actualizar lista de perfiles con seguridad de array
      if (Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
      } else if (Array.isArray(data)) {
        setProfiles(data);
      } else {
        const listRes = await fetch('/api/profiles');
        const listData = await listRes.json();
        setProfiles(Array.isArray(listData) ? listData : []);
      }

      const savedProf = data.profile || profile;
      if (savedProf?.backgroundFolder) {
        refreshBackgroundVideos(savedProf.backgroundFolder, savedProf.id);
      }
      return savedProf || { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  };

  const handleDeleteProfile = async (id) => {
    try {
      const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
      } else {
        const listRes = await fetch('/api/profiles');
        const listData = await listRes.json();
        setProfiles(Array.isArray(listData) ? listData : []);
      }
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  };

  const handleSaveTemplate = async (template) => {
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });
      const data = await res.json();
      
      if (Array.isArray(data.templates)) {
        setTemplates(data.templates);
      } else if (Array.isArray(data)) {
        setTemplates(data);
      } else {
        const listRes = await fetch('/api/templates');
        const listData = await listRes.json();
        setTemplates(Array.isArray(listData) ? listData : []);
      }
      return data.template || template || { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (Array.isArray(data.templates)) {
        setTemplates(data.templates);
      } else {
        const listRes = await fetch('/api/templates');
        const listData = await listRes.json();
        setTemplates(Array.isArray(listData) ? listData : []);
      }
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  };

  const handleImportTemplatePackage = async (packageOrTemplate, possibleProfile) => {
    try {
      let template = null;
      let profile = null;

      if (packageOrTemplate && packageOrTemplate.template) {
        // Objeto empaquetado de plantilla exportada
        template = packageOrTemplate.template;
        profile = packageOrTemplate.profile || null;
      } else {
        template = packageOrTemplate;
        profile = possibleProfile || null;
      }

      const res = await fetch('/api/templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template, profile })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${res.status} al importar`);
      }

      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.templates)) setTemplates(data.templates);
        if (Array.isArray(data.profiles)) setProfiles(data.profiles);
        return { 
          success: true, 
          newTemplateId: data.newTemplateId, 
          newProfileId: data.newProfileId 
        };
      } else {
        return { success: false, error: data.error || 'Error al procesar la plantilla' };
      }
    } catch (err) {
      console.error('Error importando paquete de plantilla:', err);
      return { success: false, error: err.message };
    }
  };

  const handleLaunchExpress = async (preset) => {
    setExpressLaunchError('');
    try {
      const defaultTemp = templates.find(t => t.id === settings.defaultTemplateId) || templates[0];
      const defaultProf = profiles.find(p => p.id === (defaultTemp?.profileId || settings.defaultProfileId)) || profiles[0];

      let requestBody = {};

      if (preset.type === 'chain') {
        const activeSeeds = [];
        let hasEmpty = false;

        for (const item of preset.chain) {
          const pSeeds = item.seeds || [];
          for (let i = 0; i < item.count; i++) {
            const prompt = (pSeeds[i] || '').trim();
            if (!prompt) hasEmpty = true;
            activeSeeds.push({
              prompt,
              templateId: item.templateId,
              profileId: item.profileId
            });
          }
        }

        if (activeSeeds.length === 0) {
          throw new Error('La cadena de perfiles no tiene videos configurados.');
        }
        if (hasEmpty) {
          throw new Error('Todos los videos de la cadena deben tener un tema antes de lanzar.');
        }

        requestBody = { seeds: activeSeeds };
      } else {
        const count = preset.count || 1;
        const seeds = [];
        for (let i = 0; i < count; i++) {
          const prompt = (preset.prompts && preset.prompts[i]) ? preset.prompts[i].trim() : '';
          if (!prompt) {
            throw new Error(`El video #${i + 1} del preset no tiene un tema o prompt definido.`);
          }
          seeds.push({
            prompt,
            templateId: preset.templateId || defaultTemp?.id || '',
            profileId: preset.profileId || defaultProf?.id || ''
          });
        }
        requestBody = { seeds };
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await res.json();
      if (!res.ok) {
        setExpressLaunchError(data.error || 'Error al iniciar la generación rápida.');
        return;
      }
      
      setJobLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Solicitud de generación rápida enviada al servidor...`]);
      setActiveTab('dashboard');
    } catch (err) {
      console.error(err);
      setExpressLaunchError(err.message || 'Error de conexión con el servidor local.');
    }
  };

  // Controles globales para el Dock Flotante
  const [isGlobalPausing, setIsGlobalPausing] = useState(false);
  const [isGlobalResuming, setIsGlobalResuming] = useState(false);
  const [isGlobalCancelling, setIsGlobalCancelling] = useState(false);

  const handleGlobalPause = async () => {
    setIsGlobalPausing(true);
    try {
      await fetch('/api/jobs/pause', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGlobalPausing(false);
    }
  };

  const handleGlobalResume = async () => {
    setIsGlobalResuming(true);
    try {
      await fetch('/api/jobs/resume', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGlobalResuming(false);
    }
  };

  const handleGlobalCancel = async () => {
    const ok = await showConfirm(
      '¿Estás seguro de que deseas cancelar la generación de videos actual? El render en curso se abortará.',
      'Cancelar Generación',
      { confirmText: 'Cancelar Proceso', cancelText: 'Mantener Generación', type: 'danger' }
    );
    if (!ok) return;

    setIsGlobalCancelling(true);
    try {
      await fetch('/api/jobs/cancel', { method: 'POST' });
      showToast('Generación cancelada.', 'info');
    } catch (err) {
      console.error(err);
    } finally {
      setIsGlobalCancelling(false);
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Panel de Control · Studio';
      case 'presets': return 'Generación Rápida & Lotes';
      case 'templates': return 'Diseñador de Plantillas';
      case 'profiles': return 'Perfiles de IA & Prompts';
      case 'settings': return 'Ajustes de Render & GPU';
      case 'integrations': return 'Integraciones & Actualizaciones';
      default: return 'Reddit Studio Desktop';
    }
  };

  const performUpdateCheck = async (customSettings = null) => {
    const currentVer = '1.0.0';
    
    // 1. Intentar consultar a través del backend local
    try {
      const res = await fetch('/api/updates/check');
      if (res.ok) {
        const info = await res.json();
        if (info && (info.hasUpdate !== undefined || info.currentVersion)) {
          return info;
        }
      }
    } catch (localErr) {
      console.log('Backend local no disponible para updates, consultando GitHub directamente...');
    }

    // 2. Fallback: Consultar directamente la API de GitHub desde el cliente
    try {
      const cfg = customSettings || settings || {};
      const repo = cfg.githubRepo || 'Leonardo-murataya/reddit-desktop';
      const token = cfg.githubToken || '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';
      const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`
      };

      const compareVersions = (v1, v2) => {
        const p1 = (v1 || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
        const p2 = (v2 || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
          const num1 = p1[i] || 0;
          const num2 = p2[i] || 0;
          if (num1 > num2) return 1;
          if (num1 < num2) return -1;
        }
        return 0;
      };

      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
      if (res.ok) {
        const rel = await res.json();
        const latestTag = (rel.tag_name || '').replace(/^v/, '');
        const hasUpdate = compareVersions(latestTag, currentVer) > 0;
        return {
          hasUpdate,
          currentVersion: currentVer,
          latestVersion: latestTag,
          releaseTitle: rel.name || rel.tag_name,
          releaseNotes: rel.body || 'Sin notas de versión disponibles.',
          publishedAt: rel.published_at,
          releaseUrl: rel.html_url,
          githubToken: token,
          assets: (rel.assets || []).map(a => ({
            id: a.id,
            name: a.name,
            size: a.size,
            apiUrl: a.url,
            downloadUrl: a.browser_download_url
          }))
        };
      }

      // Si releases/latest devuelve 404, consultar los tags de Git directamente
      if (res.status === 404) {
        const tagsRes = await fetch(`https://api.github.com/repos/${repo}/tags`, { headers });
        if (tagsRes.ok) {
          const tags = await tagsRes.json();
          if (Array.isArray(tags) && tags.length > 0) {
            const latestTag = tags[0].name.replace(/^v/, '');
            const hasUpdate = compareVersions(latestTag, currentVer) > 0;
            return {
              hasUpdate,
              currentVersion: currentVer,
              latestVersion: latestTag,
              releaseTitle: `Reddit Video Generator v${latestTag}`,
              releaseNotes: 'Nueva versión disponible en el repositorio de GitHub.',
              publishedAt: new Date().toISOString(),
              releaseUrl: `https://github.com/${repo}/releases/tag/v${latestTag}`,
              assets: []
            };
          }
        }
      }
    } catch (ghErr) {
      console.error('Error al conectar con GitHub directamente:', ghErr);
    }

    return {
      hasUpdate: false,
      currentVersion: currentVer,
      error: 'No se pudo conectar con los servidores de GitHub para buscar actualizaciones. Verifica tu conexión a internet.'
    };
  };

  const handleCheckUpdatesManually = async () => {
    setUpdateInfo({ loading: true, currentVersion: '1.0.0' });
    setShowUpdateModal(true);
    const info = await performUpdateCheck();
    setUpdateInfo(info);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#07090e] text-gray-100 select-none">
      
      {/* 1. Header Bar Superior de la Aplicación de Escritorio */}
      <header className="h-12 border-b border-white/5 bg-[#090d16] px-5 flex items-center justify-between shrink-0 z-30 select-none">
        {/* Breadcrumb de Navegación */}
        <div className="flex items-center gap-2.5 text-xs">
          <span className="font-extrabold text-brand-primary flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>REDDIT STUDIO</span>
          </span>
          <span className="text-gray-600 font-black">/</span>
          <span className="font-bold text-gray-300">{getTabTitle()}</span>
        </div>

        {/* Indicadores de Estado Globales */}
        <div className="flex items-center gap-3">
          {/* Botón rápido de Buscar Actualizaciones */}
          <button
            type="button"
            onClick={() => handleCheckUpdatesManually()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-white border border-purple-500/20 text-[11px] font-bold transition-all cursor-pointer active:scale-95"
            title="Comprobar si hay nuevas versiones en GitHub"
          >
            <span>Buscar Actualizaciones</span>
          </button>

          {/* Badge de Job Activo en Header si existe */}
          {activeJob && (
            <div 
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full text-[10.5px] font-black text-emerald-400 cursor-pointer hover:bg-emerald-500/25 transition-all animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Vídeo {activeJob.currentVideoIndex} de {activeJob.totalCount} ({activeJob.progress}%)</span>
            </div>
          )}

          {/* Badge de GPU */}
          <div className="hidden md:flex items-center gap-2 bg-black/40 border border-white/5 px-3 py-1 rounded-full text-[10.5px] font-bold text-gray-300">
            <Cpu className="w-3.5 h-3.5 text-brand-primary" />
            <span className="truncate max-w-[160px]">{gpuInfo?.gpuName || 'GPU Hardware'}</span>
          </div>

          {/* Botón de Integraciones */}
          <button
            type="button"
            onClick={() => setActiveTab('integrations')}
            className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/5 active:scale-95"
            title="Integraciones y Notificaciones"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. Cuerpo Principal (Sidebar + Workspace Scrollable) */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Sidebar */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          gpuInfo={gpuInfo}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onCheckUpdate={handleCheckUpdatesManually}
        />

        {/* Área de Trabajo Principal (Nunca se corta horizontalmente) */}
        <main className="flex-1 h-full overflow-y-auto min-w-0 p-6 custom-scrollbar pb-24">
          {activeTab === 'dashboard' && (
            <Dashboard 
              profiles={profiles} 
              templates={templates} 
              settings={settings}
              backgroundStatus={backgroundStatus}
              refreshBackground={() => refreshBackgroundVideos()}
              activeJob={activeJob}
              logs={jobLogs}
              jobError={jobError}
              jobSuccess={jobSuccess}
              onClearJobError={() => setJobError('')}
              onClearJobSuccess={() => setJobSuccess('')}
              onLogsInit={(initLogs) => setJobLogs(initLogs)}
            />
          )}
          
          {activeTab === 'presets' && (
            <PresetsHub 
              templates={templates} 
              profiles={profiles}
              settings={settings}
              backgroundStatus={backgroundStatus}
              onLaunchExpress={handleLaunchExpress}
              launchError={expressLaunchError}
              onClearLaunchError={() => setExpressLaunchError('')}
            />
          )}
          
          {activeTab === 'templates' && (
            <TemplateEditor 
              templates={templates} 
              profiles={profiles}
              onSave={handleSaveTemplate}
              onDelete={handleDeleteTemplate}
              onImport={handleImportTemplatePackage}
            />
          )}
          
          {activeTab === 'profiles' && (
            <ProfilesEditor 
              profiles={profiles} 
              onSave={handleSaveProfile}
              onDelete={handleDeleteProfile}
            />
          )}
          
          {activeTab === 'settings' && (
            <SettingsPanel 
              settings={settings} 
              gpuInfo={gpuInfo}
              backgroundStatus={backgroundStatus}
              profiles={profiles}
              selectedProfileId={settingsProfileId}
              onProfileIdChange={setSettingsProfileId}
              onSave={handleSaveSettings}
              onSaveProfile={handleSaveProfile}
              refreshBackground={(folder, profileId) => refreshBackgroundVideos(folder, profileId)}
              onGpuUpdate={setGpuInfo}
            />
          )}
          
          {activeTab === 'integrations' && (
            <IntegrationsPanel 
              settings={settings}
              onSave={handleSaveSettings}
              onCheckUpdate={(info) => {
                setUpdateInfo(info);
                setShowUpdateModal(true);
              }}
            />
          )}
        </main>
      </div>

      {/* 3. Floating Progress Dock (Dynamic Island en la parte inferior si estás en otra pestaña) */}
      {activeJob && activeTab !== 'dashboard' && (
        <FloatingProgressDock
          activeJob={activeJob}
          logs={jobLogs}
          onNavigateToDashboard={() => setActiveTab('dashboard')}
          onPause={handleGlobalPause}
          onResume={handleGlobalResume}
          onCancel={handleGlobalCancel}
          isPausing={isGlobalPausing}
          isResuming={isGlobalResuming}
          isCancelling={isGlobalCancelling}
        />
      )}

      {/* 4. Modal Emergente de Actualizaciones (Personalizado para todos los estados) */}
      {showUpdateModal && updateInfo && (
        <UpdateModal
          updateInfo={updateInfo}
          onClose={() => setShowUpdateModal(false)}
        />
      )}
    </div>
  );
}

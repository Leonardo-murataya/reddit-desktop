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

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
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

      // 5. Obtener Biblioteca de Videos
      if (settingsData.backgroundFolder) {
        refreshBackgroundVideos(settingsData.backgroundFolder);
      }

      // 6. Verificar actualizaciones de GitHub al abrir la aplicación
      checkForUpdates(settingsData);
    } catch (error) {
      console.error('Error cargando especificaciones del backend local:', error);
    }
  };

  const checkForUpdates = async (currentSettings) => {
    try {
      const res = await fetch('/api/updater/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepo: currentSettings?.githubRepo,
          githubToken: currentSettings?.githubToken
        })
      });
      const data = await res.json();
      if (data && data.hasUpdate) {
        setUpdateInfo(data);
        setShowUpdateModal(true);
      }
    } catch (err) {
      console.log('Verificación automática de actualizaciones omitida:', err.message);
    }
  };

  const refreshBackgroundVideos = async (folder = '', profileId = 'global') => {
    try {
      const activeFolder = folder || settings.backgroundFolder || '';
      if (!activeFolder) return;
      const res = await fetch(`/api/background-videos?folder=${encodeURIComponent(activeFolder)}&profileId=${profileId}`);
      const data = await res.json();
      setBackgroundStatus(data);
    } catch (err) {
      console.error('Error al actualizar biblioteca de fondos:', err);
    }
  };

  // ----------------------------------------------------
  // MANEJADORES DE ACCIÓN API
  // ----------------------------------------------------

  // Guardar Ajustes
  const handleSaveSettings = async (newSettings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        
        // Recargar la detección de hardware para actualizar el Sidebar en tiempo real
        const gpuRes = await fetch('/api/detect-hardware');
        const gpuData = await gpuRes.json();
        setGpuInfo(gpuData);

        // Escanear carpeta si cambió
        if (newSettings.backgroundFolder) {
          refreshBackgroundVideos(newSettings.backgroundFolder);
        }
      }
    } catch (err) {
      console.error('Error al guardar ajustes:', err);
    }
  };

  // Guardar Perfil de IA
  const handleSaveProfile = async (profile) => {
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      const data = await res.json();
      if (data.success) {
        // Recargar perfiles
        const pRes = await fetch('/api/profiles');
        const pData = await pRes.json();
        setProfiles(pData);
        return data.profile;
      }
    } catch (err) {
      console.error('Error al guardar perfil de IA:', err);
    }
  };

  // Eliminar Perfil de IA
  const handleDeleteProfile = async (id) => {
    try {
      const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        const pRes = await fetch('/api/profiles');
        const pData = await pRes.json();
        setProfiles(pData);
      }
    } catch (err) {
      console.error('Error al eliminar perfil de IA:', err);
    }
  };

  // Importar Paquete de Plantilla (Plantilla + Perfil de IA asociado sin API Key)
  const handleImportTemplatePackage = async (templatePackage) => {
    try {
      const res = await fetch('/api/templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatePackage)
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
        setProfiles(data.profiles);
        return { success: true, newTemplateId: data.newTemplateId };
      } else {
        return { success: false, error: data.error || 'Error al importar el paquete de plantilla.' };
      }
    } catch (err) {
      console.error('Error al importar paquete de plantilla:', err);
      return { success: false, error: err.message };
    }
  };

  // Guardar Plantilla de Video
  const handleSaveTemplate = async (template) => {
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });
      const data = await res.json();
      if (data.success) {
        const tRes = await fetch('/api/templates');
        const tData = await tRes.json();
        setTemplates(tData);
        return data.template; // Retornamos la plantilla guardada (con su nuevo ID)
      }
    } catch (err) {
      console.error('Error al guardar plantilla:', err);
    }
    return null;
  };

  // Eliminar Plantilla de Video
  const handleDeleteTemplate = async (id) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        const tRes = await fetch('/api/templates');
        const tData = await tRes.json();
        setTemplates(tData);
      }
    } catch (err) {
      console.error('Error al eliminar plantilla:', err);
    }
  };

  // Lanzamiento Express unificado desde el Hub de Plantillas
  const handleLaunchExpress = async (launchParams) => {
    setExpressLaunchError('');
    try {
      // Leer ajustes frescos y perfiles frescos del servidor para garantizar que todo esté actualizado
      const [freshSettingsRes, freshProfilesRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/profiles')
      ]);
      const freshSettings = await freshSettingsRes.json();
      const freshProfiles = await freshProfilesRes.json();
      if (freshSettings) setSettings(freshSettings);
      if (freshProfiles) setProfiles(freshProfiles);

      let bgFolder = '';
      let finalProfileId = '';

      if (launchParams.batch) {
        bgFolder = freshSettings.backgroundFolder || settings.backgroundFolder || '';
        if (!bgFolder) {
          const hasBg = launchParams.batch.some(item => {
            const t = templates.find(temp => temp.id === item.templateId);
            const pId = t?.profileId || freshSettings.defaultProfileId;
            const prof = freshProfiles.find(p => p.id === pId);
            return prof && prof.backgroundFolder && prof.backgroundFolder.trim();
          });
          if (hasBg) bgFolder = 'dynamic';
        }
      } else {
        const template = templates.find(t => t.id === launchParams.templateId);
        finalProfileId = launchParams.profileId || template?.profileId || freshSettings.defaultProfileId || settings.defaultProfileId || profiles[0]?.id;
        const profile = freshProfiles.find(p => p.id === finalProfileId);
        bgFolder = (profile && profile.backgroundFolder && profile.backgroundFolder.trim())
          ? profile.backgroundFolder
          : (freshSettings.backgroundFolder || settings.backgroundFolder || '');
      }

      if (!bgFolder) {
        setExpressLaunchError('No hay carpeta de videos de fondo configurada. Ve a Ajustes o al perfil seleccionado y selecciona una carpeta primero.');
        return;
      }

      const requestBody = launchParams.batch 
        ? {
            batch: launchParams.batch,
            backgroundFolder: bgFolder === 'dynamic' ? '' : bgFolder
          }
        : {
            prompt: launchParams.prompt,
            count: launchParams.count,
            profileId: finalProfileId,
            templateId: launchParams.templateId,
            backgroundFolder: bgFolder
          };

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
      
      // Agregar log inmediato de inicio
      setJobLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Solicitud de generación enviada al servidor...`]);
      
      // Solo redirigir al Panel de Control si el job se inició correctamente
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
    if (!confirm('¿Estás seguro de que deseas cancelar la generación de videos actual?')) return;
    setIsGlobalCancelling(true);
    try {
      await fetch('/api/jobs/cancel', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGlobalCancelling(false);
    }
  };

  return (
    <div className="flex bg-bg-dark min-h-screen text-gray-100 relative">
      {/* Sidebar de navegación */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        gpuInfo={gpuInfo}
      />

      {/* Panel de Contenido Principal */}
      <main className="flex-1 p-5 overflow-y-auto w-full min-w-0 pb-24">
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

      {/* Floating Progress Dock en la parte inferior cuando el usuario cambia de pestaña */}
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

      {/* Modal Emergente de Actualizaciones */}
      {showUpdateModal && updateInfo && updateInfo.hasUpdate && (
        <UpdateModal
          updateInfo={updateInfo}
          onClose={() => setShowUpdateModal(false)}
        />
      )}
    </div>
  );
}

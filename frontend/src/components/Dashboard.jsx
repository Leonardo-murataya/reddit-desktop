import React, { useState, useEffect, useRef } from 'react';
import { Play, Loader2, Info, CheckCircle2, AlertTriangle, Terminal, ListOrdered, X, Layers, Link, Clock, Film, Pause } from 'lucide-react';
import ProfileChainModal from './ProfileChainModal';
import GenerationLogsConsole from './GenerationLogsConsole';

const formatTime = (seconds) => {
  if (seconds === undefined || seconds === null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s} min`;
};

export default function Dashboard({ 
  profiles, templates, settings, backgroundStatus, refreshBackground,
  activeJob, logs = [], jobError = '', jobSuccess = '',
  onClearJobError, onClearJobSuccess
}) {
  const [seeds, setSeeds] = useState([]);
  const [count, setCount] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [seedInputMode, setSeedInputMode] = useState('individual'); // 'individual' | 'bulk'
  const [bulkText, setBulkText] = useState('');
  
  // Estado local solo para el formulario de nueva generación manual
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [clearedLogsCount, setClearedLogsCount] = useState(0);

  // Cadena de perfiles: [{ profileId, profileName, templateId, templateName, count }]
  const [profileChain, setProfileChain] = useState(null);
  // Seeds por perfil: { [profileId]: string[] }
  const [chainSeeds, setChainSeeds] = useState({});
  const [chainInputModes, setChainInputModes] = useState({}); // { [profileId]: 'individual' | 'bulk' }
  const [chainBulkTexts, setChainBulkTexts] = useState({}); // { [profileId]: string }
  const [isChainModalOpen, setIsChainModalOpen] = useState(false);

  const [lastFailedCount, setLastFailedCount] = useState(0);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);

  useEffect(() => {
    fetch('/api/jobs/failed-count')
      .then(res => res.json())
      .then(data => {
        if (data.failedCount !== undefined) {
          setLastFailedCount(data.failedCount);
        }
      })
      .catch(err => console.error(err));
  }, [activeJob]);

  const handlePauseGeneration = async () => {
    setIsPausing(true);
    try {
      await fetch('/api/jobs/pause', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsPausing(false);
    }
  };

  const handleResumeGeneration = async () => {
    setIsResuming(true);
    try {
      await fetch('/api/jobs/resume', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsResuming(false);
    }
  };

  const handleRetryFailed = async () => {
    setIsRetryingFailed(true);
    try {
      const res = await fetch('/api/jobs/retry-failed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al reintentar videos fallidos');
      } else {
        setLastFailedCount(0);
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión con el servidor.');
    } finally {
      setIsRetryingFailed(false);
    }
  };

  const handleChainSeedChange = (profileId, idx, value) => {
    setChainSeeds(prev => {
      const next = { ...prev };
      if (!next[profileId]) next[profileId] = [];
      const arr = [...(next[profileId] || [])];
      arr[idx] = value;
      next[profileId] = arr;
      return next;
    });
  };

  const handleChainCountChange = (profileId, newCount) => {
    const n = Math.max(1, Math.min(200, parseInt(newCount) || 1));
    setProfileChain(prev => prev.map(item =>
      item.profileId === profileId ? { ...item, count: n } : item
    ));
    // Ajustar el array de seeds al nuevo tamaño
    setChainSeeds(prev => {
      const next = { ...prev };
      const arr = [...(next[profileId] || [])];
      while (arr.length < n) arr.push('');
      next[profileId] = arr.slice(0, n);
      return next;
    });
  };
  
  const terminalEndRef = useRef(null);

  // Sincronizar tamaño del arreglo de semillas con la cantidad seleccionada
  useEffect(() => {
    setSeeds(prev => {
      const next = [...prev];
      const defaultTemp = templates.find(t => t.id === settings.defaultTemplateId) || templates[0];
      const defaultProf = profiles.find(p => p.id === (defaultTemp?.profileId || settings.defaultProfileId)) || profiles[0];

      if (next.length < count) {
        while (next.length < count) {
          next.push({
            prompt: '',
            templateId: selectedTemplate || defaultTemp?.id || '',
            profileId: selectedProfile || defaultProf?.id || ''
          });
        }
      } else if (next.length > count) {
        next.splice(count);
      }
      return next;
    });
  }, [count, templates, profiles, settings]);

  // Sincronizar primer elemento de semillas si cambia el selector global
  useEffect(() => {
    if (seeds.length > 0) {
      setSeeds(prev => {
        const next = [...prev];
        if (next[0] && (next[0].templateId !== selectedTemplate || next[0].profileId !== selectedProfile)) {
          next[0] = {
            ...next[0],
            templateId: selectedTemplate,
            profileId: selectedProfile
          };
        }
        return next;
      });
    }
  }, [selectedTemplate, selectedProfile]);

  const handleSwitchInputMode = (mode) => {
    if (mode === 'bulk') {
      const text = seeds.map(s => s.prompt || '').filter(Boolean).join('\n');
      setBulkText(text);
    } else {
      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        const defaultTemp = templates.find(t => t.id === settings.defaultTemplateId) || templates[0];
        const defaultProf = profiles.find(p => p.id === (defaultTemp?.profileId || settings.defaultProfileId)) || profiles[0];
        setSeeds(lines.map(line => ({
          prompt: line,
          templateId: selectedTemplate || defaultTemp?.id || '',
          profileId: selectedProfile || defaultProf?.id || ''
        })));
        setCount(lines.length);
      }
    }
    setSeedInputMode(mode);
  };

  const handleCountChange = (newCount) => {
    const n = Math.max(1, Math.min(100, parseInt(newCount) || 1));
    setCount(n);
    
    // Si estamos en modo bulk, sincronizar bulkText con la nueva cantidad de semillas
    if (seedInputMode === 'bulk') {
      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < n) {
        const nextLines = [...lines];
        while (nextLines.length < n) {
          nextLines.push('');
        }
        setBulkText(nextLines.join('\n'));
      } else if (lines.length > n) {
        const nextLines = lines.slice(0, n);
        setBulkText(nextLines.join('\n'));
      }
    }
  };

  const handleBulkSeedsChange = (val) => {
    setBulkText(val);
    const lines = val.split('\n').map(l => l.trim()).filter(Boolean);
    const defaultTemp = templates.find(t => t.id === settings.defaultTemplateId) || templates[0];
    const defaultProf = profiles.find(p => p.id === (defaultTemp?.profileId || settings.defaultProfileId)) || profiles[0];

    if (lines.length > 0) {
      setSeeds(lines.map(line => ({
        prompt: line,
        templateId: selectedTemplate || defaultTemp?.id || '',
        profileId: selectedProfile || defaultProf?.id || ''
      })));
      setCount(lines.length);
    } else {
      setSeeds([{
        prompt: '',
        templateId: selectedTemplate || defaultTemp?.id || '',
        profileId: selectedProfile || defaultProf?.id || ''
      }]);
      setCount(1);
    }
  };

  const handleSwitchChainInputMode = (profileId, mode) => {
    setChainInputModes(prev => ({ ...prev, [profileId]: mode }));
    
    if (mode === 'bulk') {
      const seeds = chainSeeds[profileId] || [];
      setChainBulkTexts(prev => ({ ...prev, [profileId]: seeds.filter(Boolean).join('\n') }));
    } else {
      const text = chainBulkTexts[profileId] || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        setProfileChain(prev => prev.map(item =>
          item.profileId === profileId ? { ...item, count: lines.length } : item
        ));
        setChainSeeds(prev => ({
          ...prev,
          [profileId]: lines
        }));
      }
    }
  };

  const handleChainBulkSeedsChange = (profileId, val) => {
    setChainBulkTexts(prev => ({ ...prev, [profileId]: val }));
    const lines = val.split('\n').map(l => l.trim()).filter(Boolean);
    const n = Math.max(1, lines.length);

    setProfileChain(prev => prev.map(item =>
      item.profileId === profileId ? { ...item, count: n } : item
    ));

    setChainSeeds(prev => ({
      ...prev,
      [profileId]: lines.length > 0 ? lines : ['']
    }));
  };

  const handleSeedChange = (index, value) => {
    setSeeds(prev => {
      const next = [...prev];
      next[index] = { ...next[index], prompt: value };
      return next;
    });
  };

  // Auto-seleccionar perfiles y plantillas por defecto al cargar
  useEffect(() => {
    if (profiles.length > 0 && !selectedProfile) {
      const defaultProf = profiles.find(p => p.id === settings.defaultProfileId) || profiles[0];
      setSelectedProfile(defaultProf.id);
    }
  }, [profiles, settings]);

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      const defaultTemp = templates.find(t => t.id === settings.defaultTemplateId) || templates[0];
      setSelectedTemplate(defaultTemp.id);
    }
  }, [templates, settings]);

  // Sincronizar automáticamente el Perfil de IA cuando cambie la plantilla seleccionada
  useEffect(() => {
    if (selectedTemplate && templates.length > 0) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template && template.profileId) {
        setSelectedProfile(template.profileId);
      }
    }
  }, [selectedTemplate, templates]);

  // Refrescar los videos de fondo de la UI cuando el perfil seleccionado cambie
  useEffect(() => {
    if (selectedProfile && profiles.length > 0) {
      const activeProfile = profiles.find(p => p.id === selectedProfile);
      if (activeProfile) {
        const folder = activeProfile.backgroundFolder || settings.backgroundFolder || '';
        refreshBackground(folder, activeProfile.id);
      }
    }
  }, [selectedProfile, profiles, settings]);

  // Hacer scroll automático al final de la terminal de logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);



  const handleStartGeneration = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    let activeSeeds = [];
    let hasEmpty = false;

    if (profileChain) {
      // Validar y construir seeds de la cadena de perfiles
      profileChain.forEach(item => {
        let seedsArr = [];
        if (chainInputModes[item.profileId] === 'bulk') {
          const text = chainBulkTexts[item.profileId] || '';
          seedsArr = text.split('\n').map(l => l.trim()).filter(Boolean);
        } else {
          seedsArr = chainSeeds[item.profileId] || [];
        }

        const requiredCount = item.count;
        for (let i = 0; i < requiredCount; i++) {
          const promptVal = seedsArr[i]?.trim() || '';
          if (!promptVal) {
            hasEmpty = true;
          }
          activeSeeds.push({
            templateId: item.templateId,
            profileId: item.profileId,
            count: 1,
            prompt: promptVal
          });
        }
      });

      if (hasEmpty) {
        setSubmitError('Por favor especifica los temas para todos los videos en cada perfil de la cadena.');
        setIsSubmitting(false);
        return;
      }
    } else {
      // Tradicional clásico: validar y construir
      if (count === 1) {
        const promptVal = seeds[0]?.prompt?.trim() || '';
        if (!promptVal) {
          setSubmitError('Por favor introduce un prompt de tema para la historia.');
          setIsSubmitting(false);
          return;
        }
        activeSeeds = [{
          prompt: promptVal,
          templateId: selectedTemplate,
          profileId: selectedProfile,
          count: 1
        }];
      } else if (seedInputMode === 'bulk') {
        const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
          setSubmitError('Por favor especifica al menos una idea en el cuadro de texto.');
          setIsSubmitting(false);
          return;
        }
        const defaultTemp = templates.find(t => t.id === settings.defaultTemplateId) || templates[0];
        const defaultProf = profiles.find(p => p.id === (defaultTemp?.profileId || settings.defaultProfileId)) || profiles[0];
        activeSeeds = lines.map(line => ({
          prompt: line,
          templateId: selectedTemplate || defaultTemp?.id || '',
          profileId: selectedProfile || defaultProf?.id || '',
          count: 1
        }));
      } else {
        // Individual con count > 1
        for (let i = 0; i < count; i++) {
          const promptVal = seeds[i]?.prompt?.trim() || '';
          if (!promptVal) {
            hasEmpty = true;
          }
          activeSeeds.push({
            prompt: promptVal,
            templateId: selectedTemplate,
            profileId: selectedProfile,
            count: 1
          });
        }
        if (hasEmpty) {
          setSubmitError('Por favor especifica los temas para todas las historias del lote.');
          setIsSubmitting(false);
          return;
        }
      }
    }

    try {
      let payload;
      if (profileChain) {
        payload = {
          batch: activeSeeds,
          backgroundFolder: settings.backgroundFolder
        };
      } else {
        payload = activeSeeds.length === 1 ? {
          prompt: activeSeeds[0].prompt,
          count: 1,
          profileId: activeSeeds[0].profileId || selectedProfile,
          templateId: activeSeeds[0].templateId || selectedTemplate,
          backgroundFolder: settings.backgroundFolder
        } : {
          batch: activeSeeds,
          backgroundFolder: settings.backgroundFolder
        };
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        setSubmitError(data.error || 'Error al iniciar la cola de renderizado.');
        return;
      }
      
      const defaultTemp = templates.find(t => t.id === settings.defaultTemplateId) || templates[0];
      const defaultProf = profiles.find(p => p.id === (defaultTemp?.profileId || settings.defaultProfileId)) || profiles[0];
      setSeeds([{
        prompt: '',
        templateId: selectedTemplate || defaultTemp?.id || '',
        profileId: selectedProfile || defaultProf?.id || ''
      }]); // Limpiar el input
      setChainSeeds({});
      setProfileChain(null);
      setCount(1);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelGeneration = async () => {
    if (!confirm('¿Estás seguro de que deseas detener la generación de videos en curso? El proceso actual se abortará.')) {
      return;
    }
    setIsCancelling(true);
    try {
      const res = await fetch('/api/jobs/cancel', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert('Error al detener la generación: ' + (data.error || 'Desconocido'));
      }
    } catch (err) {
      console.error('Error al solicitar la detención del proceso:', err);
      alert('Error de conexión con el servidor local.');
    } finally {
      setIsCancelling(false);
    }
  };

  const visibleLogs = logs.slice(clearedLogsCount);
  const totalChainCount = profileChain ? profileChain.reduce((acc, item) => acc + item.count, 0) : count;
  const leftColSpan = profileChain ? 'lg:col-span-3' : 'lg:col-span-2';
  const rightColSpan = profileChain ? 'lg:col-span-2' : 'lg:col-span-3';

  // Calcular offset global para numerar seeds de forma secuencial por perfil
  const getGlobalOffset = (profileId) => {
    if (!profileChain) return 0;
    let offset = 1;
    for (const item of profileChain) {
      if (item.profileId === profileId) return offset;
      offset += item.count;
    }
    return offset;
  };


  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <span>GENERADOR AUTOMÁTICO DE CONTENIDO</span>
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Genera historias de Reddit, conviértelas a voz y edítalas en video vertical continuo con un solo click.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulario de Configuración (Panel izquierdo/principal) */}
        <div className={`${leftColSpan} space-y-6 transition-all duration-300`}>
          <form onSubmit={handleStartGeneration} className="glass-panel rounded-2xl p-6 space-y-6">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark/40 pb-3">
              <ListOrdered className="w-4.5 h-4.5 text-brand-primary" />
              <span>Nueva Cola de Videos</span>
            </h3>

            {/* Paso 1: Cantidad de Videos / Cadena de Perfiles */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider">
                  Paso 1: Cantidad de Videos
                </label>
                <span className={`text-[9px] font-black px-2.5 py-0.5 rounded border ${
                  profileChain
                    ? 'bg-brand-primary/15 text-brand-primary border-brand-primary/30'
                    : 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'
                }`}>
                  {profileChain ? 'Cadena de Perfiles' : 'Fila de Trabajo'}
                </span>
              </div>
              
              {profileChain ? (
                /* BANNER CADENA DE PERFILES ACTIVA */
                <div className="bg-brand-primary/8 border border-brand-primary/25 rounded-2xl p-4 space-y-3.5 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-primary/15 flex items-center justify-center text-brand-primary shrink-0">
                      <Link className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">Cadena Secuencial Activa</span>
                      <span className="text-xs font-black text-white leading-normal">
                        {totalChainCount} videos · {profileChain.length} {profileChain.length === 1 ? 'perfil' : 'perfiles'}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto">
                        {profileChain.map((item, i) => (
                          <React.Fragment key={item.profileId}>
                            <span className="text-[8.5px] font-bold text-brand-primary/80 bg-brand-primary/10 border border-brand-primary/20 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                              {item.profileName} ({item.count})
                            </span>
                            {i < profileChain.length - 1 && <span className="text-gray-600 text-xs shrink-0">→</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsChainModalOpen(true)}
                      disabled={!!activeJob}
                      className="flex-1 bg-black/40 hover:bg-black/60 text-white border border-border-dark hover:border-gray-500 font-bold py-2 rounded-xl text-[10.5px] transition-all cursor-pointer text-center"
                    >
                      ✎ EDITAR CADENA
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileChain(null);
                        setChainSeeds({});
                      }}
                      disabled={!!activeJob}
                      className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold py-2 rounded-xl text-[10.5px] transition-all cursor-pointer text-center"
                    >
                      ✕ MODO SIMPLE
                    </button>
                  </div>
                </div>
              ) : (
                /* CONTROL CLÁSICO SIMPLE */
                <div className="space-y-3">
                  <div className="flex gap-2.5">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={count}
                      onChange={(e) => handleCountChange(e.target.value)}
                      disabled={!!activeJob}
                      className="bg-black/40 border border-border-dark rounded-xl px-3 py-2.5 text-sm text-white font-bold w-20 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 disabled:opacity-50 text-center transition-all"
                    />
                    <div className="flex-grow grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleCountChange(num)}
                          disabled={!!activeJob}
                          className={`py-2.5 rounded-xl font-bold text-xs transition-all duration-150 cursor-pointer segmented-btn ${
                            count === num ? 'active' : ''
                          } disabled:opacity-50`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setIsChainModalOpen(true)}
                    disabled={!!activeJob}
                    className="w-full bg-black/40 hover:bg-black/60 hover:border-brand-primary/40 border border-border-dark text-gray-300 hover:text-white font-extrabold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Link className="w-3.5 h-3.5 text-brand-primary animate-pulse" />
                    <span>CADENA SECUENCIAL POR PERFILES (AUTOMÁTICO)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Paso 2: Prompts e Ideas de Historias */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider">
                  Paso 2: {profileChain ? 'Temas por Perfil (Secuencial)' : count === 1 ? 'Idea de la Historia' : 'Temas e Ideas del Lote'}
                </label>
                {profileChain ? (
                  <span className="text-[9px] bg-brand-primary/15 text-brand-primary font-bold px-2 py-0.5 rounded-full border border-brand-primary/25 uppercase tracking-wide">
                    Cadena ({totalChainCount} Videos)
                  </span>
                ) : count > 1 ? (
                  <div className="flex items-center gap-2">
                    <div className="flex bg-black/45 rounded-lg p-0.5 border border-border-dark shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSwitchInputMode('individual')}
                        className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-md transition-all cursor-pointer ${
                          seedInputMode === 'individual'
                            ? 'bg-brand-primary text-white shadow-sm'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchInputMode('bulk')}
                        className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-md transition-all cursor-pointer ${
                          seedInputMode === 'bulk'
                            ? 'bg-brand-primary text-white shadow-sm'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Pegado Masivo
                      </button>
                    </div>
                    
                    <span className="text-[9px] bg-brand-primary/15 text-brand-primary font-bold px-2 py-0.5 rounded-lg border border-brand-primary/20 uppercase tracking-wide shrink-0">
                      {count} Videos
                    </span>
                  </div>
                ) : null}
              </div>

              {profileChain ? (
                /* MODO CADENA DE PERFILES EN COLUMNAS */
                <div className="flex gap-4 overflow-x-auto pb-3 pt-1 px-0.5 max-w-full custom-scrollbar">
                  {profileChain.map((item) => {
                    const seeds = chainSeeds[item.profileId] || [];
                    const globalOffset = getGlobalOffset(item.profileId);
                    const isActive = activeJob && activeJob.currentProfileId === item.profileId;
                    return (
                      <div 
                        key={item.profileId} 
                        className={`flex-1 min-w-[260px] max-w-[320px] p-4 rounded-2xl flex flex-col space-y-3.5 animate-fadeIn transition-all duration-300 ${
                          isActive 
                            ? 'bg-emerald-500/5 border-2 border-emerald-500/70 shadow-lg shadow-emerald-500/5 scale-[1.01]' 
                            : 'bg-black/25 border border-brand-primary/20'
                        }`}
                      >
                        {/* Cabecera de la columna */}
                        <div className={`border-b pb-2.5 space-y-2 transition-colors duration-300 ${
                          isActive ? 'border-emerald-500/30' : 'border-brand-primary/20'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-black text-white uppercase tracking-wide truncate">{item.profileName}</h4>
                                {isActive && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                                )}
                              </div>
                              <p className={`text-[9px] font-extrabold uppercase mt-0.5 truncate transition-colors duration-300 ${
                                isActive ? 'text-emerald-400' : 'text-brand-primary'
                              }`}>
                                Plantilla: {item.templateName}
                              </p>
                              {isActive && (
                                <span className="text-[8px] bg-emerald-500/15 text-emerald-400 font-black px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase tracking-widest inline-block mt-1 font-mono">
                                  ● PROCESANDO
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <label className="text-[8px] font-black text-gray-500 uppercase">Videos</label>
                              <input
                                type="number"
                                min="1"
                                max="200"
                                value={item.count}
                                onChange={(e) => handleChainCountChange(item.profileId, e.target.value)}
                                disabled={!!activeJob}
                                className="w-16 bg-black/55 border border-border-dark rounded-lg px-2 py-1 text-xs text-white font-bold text-center focus:outline-none focus:border-brand-primary disabled:opacity-50"
                              />
                            </div>
                          </div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded inline-block transition-colors duration-300 ${
                            isActive 
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                              : 'text-brand-primary/70 bg-brand-primary/10 border border-brand-primary/20'
                          }`}>
                            #{globalOffset} → #{globalOffset + item.count - 1} · {item.count} {item.count === 1 ? 'video' : 'videos'}
                          </span>

                          {item.count > 1 && (
                            <div className="flex bg-black/40 rounded-lg p-0.5 border border-border-dark/60 mt-2">
                              <button
                                type="button"
                                onClick={() => handleSwitchChainInputMode(item.profileId, 'individual')}
                                className={`flex-1 text-center py-1 text-[8.5px] font-black uppercase rounded transition-all cursor-pointer ${
                                  chainInputModes[item.profileId] !== 'bulk'
                                    ? 'bg-brand-primary text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                              >
                                Individual
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwitchChainInputMode(item.profileId, 'bulk')}
                                className={`flex-1 text-center py-1 text-[8.5px] font-black uppercase rounded transition-all cursor-pointer ${
                                  chainInputModes[item.profileId] === 'bulk'
                                    ? 'bg-brand-primary text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                              >
                                Masivo
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Textareas para este perfil */}
                        <div className="space-y-3.5 overflow-y-auto max-h-[300px] pr-1.5 custom-scrollbar flex-1 flex flex-col">
                          {(chainInputModes[item.profileId] === 'bulk' && item.count > 1) ? (
                            <div className="flex-1 flex flex-col space-y-2.5 animate-fadeIn">
                              <textarea
                                value={chainBulkTexts[item.profileId] || ''}
                                onChange={(e) => handleChainBulkSeedsChange(item.profileId, e.target.value)}
                                placeholder={`Ej. Pega las ideas para este canal, una por línea:\nTema video #${globalOffset}\nTema video #${globalOffset + 1}...`}
                                rows="6"
                                disabled={!!activeJob}
                                className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-[11px] text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 transition-all duration-200 resize-none disabled:opacity-50 font-mono leading-normal shrink-0"
                              />
                              
                              {/* Visual Preview List for Chain Column */}
                              <div className="flex-grow min-h-[110px] max-h-[140px] overflow-y-auto bg-black/55 border border-border-dark rounded-xl p-2 custom-scrollbar space-y-1.5">
                                {(chainBulkTexts[item.profileId] || '').split('\n').map(l => l.trim()).filter(Boolean).length === 0 ? (
                                  <div className="h-full flex items-center justify-center text-center text-[10px] text-gray-500 italic">
                                    Ninguna idea detectada...
                                  </div>
                                ) : (
                                  (chainBulkTexts[item.profileId] || '').split('\n').map(l => l.trim()).filter(Boolean).map((line, idx) => (
                                    <div 
                                      key={idx} 
                                      className="flex items-center gap-2 bg-black/25 border border-border-dark/30 rounded-lg p-1.5 transition-all duration-200 animate-fadeIn"
                                    >
                                      <span className="w-4.5 h-4.5 rounded-full bg-brand-primary/15 text-brand-primary flex items-center justify-center text-[8.5px] font-black border border-brand-primary/20 shrink-0 select-none">
                                        #{globalOffset + idx}
                                      </span>
                                      <span className="text-[10px] text-gray-300 font-medium truncate flex-1 leading-normal">
                                        {line}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>

                              <div className="text-[8px] bg-black/25 p-2 rounded-lg border border-border-dark/30 text-brand-primary font-black uppercase text-center tracking-wider shrink-0">
                                ✔ {item.count} {item.count === 1 ? 'idea' : 'ideas'}
                              </div>
                            </div>
                          ) : (
                            Array.from({ length: item.count }).map((_, idx) => {
                              const val = seeds[idx] || '';
                              const globalNum = globalOffset + idx;
                              return (
                                <div key={idx} className="space-y-1.5 shrink-0">
                                  <label className="block text-[9.5px] font-bold text-gray-400">
                                    Tema Video #{globalNum}
                                  </label>
                                  <textarea
                                    value={val}
                                    onChange={(e) => handleChainSeedChange(item.profileId, idx, e.target.value)}
                                    placeholder={`Tema para historia #${globalNum}...`}
                                    rows="3"
                                    disabled={!!activeJob}
                                    className="w-full bg-black/45 border border-border-dark rounded-xl p-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-all duration-200 resize-none disabled:opacity-50 font-medium"
                                  />
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* MODO TRADICIONAL CLÁSICO */
                count === 1 ? (
                  <textarea
                    value={seeds[0]?.prompt || ''}
                    onChange={(e) => handleSeedChange(0, e.target.value)}
                    placeholder="Ej. Historias escalofriantes sobre campamentos en bosques abandonados..."
                    rows="4"
                    disabled={!!activeJob}
                    className="w-full bg-black/40 border border-border-dark rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 transition-all duration-200 resize-none disabled:opacity-50 font-medium"
                  />
                ) : seedInputMode === 'bulk' ? (
                  <div className="space-y-3.5 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Column: Input Textarea */}
                      <div className="space-y-1.5">
                        <label className="block text-[9.5px] font-black text-gray-400 uppercase tracking-wider">
                          Pega tus ideas (una por renglón)
                        </label>
                        <textarea
                          value={bulkText}
                          onChange={(e) => handleBulkSeedsChange(e.target.value)}
                          placeholder={`Ej. Escribe o pega tus ideas aquí, una por cada línea:\nIdea de historia o tema del primer video\nIdea de historia o tema del segundo video\nIdea de historia o tema del tercer video...`}
                          rows="8"
                          disabled={!!activeJob}
                          className="w-full bg-black/40 border border-border-dark rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 transition-all duration-200 resize-none disabled:opacity-50 font-mono leading-relaxed"
                        />
                      </div>
                      
                      {/* Right Column: Visual Preview List */}
                      <div className="space-y-1.5 flex flex-col">
                        <label className="block text-[9.5px] font-black text-gray-400 uppercase tracking-wider">
                          Vista Previa de Lote y Videos Asignados
                        </label>
                        <div className="flex-1 min-h-[160px] max-h-[160px] overflow-y-auto bg-black/55 border border-border-dark/80 rounded-xl p-3 custom-scrollbar space-y-2">
                          {bulkText.split('\n').map(l => l.trim()).filter(Boolean).length === 0 ? (
                            <div className="h-full flex items-center justify-center text-center text-xs text-gray-500 italic select-none">
                              Ninguna idea detectada aún. Pega texto para previsualizar.
                            </div>
                          ) : (
                            bulkText.split('\n').map(l => l.trim()).filter(Boolean).map((line, idx) => (
                              <div 
                                key={idx} 
                                className="flex items-center gap-2.5 bg-black/25 border border-border-dark/30 hover:border-brand-primary/20 rounded-lg p-2 transition-all duration-200 animate-fadeIn"
                              >
                                <span className="w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-[9px] font-black border border-brand-primary/20 shrink-0 select-none">
                                  #{idx + 1}
                                </span>
                                <span className="text-[10.5px] text-gray-200 font-medium truncate flex-1 leading-normal">
                                  {line}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] bg-black/20 p-2.5 rounded-lg border border-border-dark/40 px-3">
                      <span className="text-gray-400 font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                        Pega tus ideas en renglones separados. El programa creará un video por cada renglón.
                      </span>
                      <span className="text-brand-primary font-black uppercase tracking-wider">
                        ✔ {count} {count === 1 ? 'idea detectada' : 'ideas detectadas'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-1 border border-border-dark/40 bg-black/10 p-3 rounded-2xl divide-y divide-border-dark/20">
                    {seeds.map((s, idx) => {
                      return (
                        <div key={idx} className={`space-y-2 ${idx > 0 ? 'pt-3.5' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center text-[10px] font-black border border-brand-primary/30">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-black text-gray-300 uppercase tracking-wide">Video #{idx + 1}</span>
                          </div>
                          
                          <textarea
                            value={s.prompt || ''}
                            onChange={(e) => handleSeedChange(idx, e.target.value)}
                            placeholder={`Escribe el tema o idea para el video #${idx + 1}...`}
                            rows="2.5"
                            disabled={!!activeJob}
                            className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 transition-all duration-200 resize-none disabled:opacity-50 font-medium"
                          />
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              <span className="text-[10px] text-gray-500 flex items-start gap-1.5 px-1 leading-normal">
                <Info className="w-3.5 h-3.5 text-brand-primary shrink-0 mt-0.5" />
                <span>La IA analizará el tema, creará la historia y clasificará el género de voz automáticamente.</span>
              </span>
            </div>

            {/* Paso 3: Estilo Global por Defecto — oculto en modo cadena de perfiles */}
            {!profileChain && (
              <div className="bg-black/25 p-4 rounded-2xl border border-border-dark/60 space-y-4">
                <div className="flex justify-between items-center border-b border-border-dark/40 pb-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-wider">
                    Paso 3: Estilo Global por Defecto
                  </label>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                    SISTEMA DE RESPALDO
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Selector de Plantilla */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase">PLANTILLA VISUAL & VOZ</label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      disabled={!!activeJob}
                      className="w-full bg-black/45 border border-border-dark rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 disabled:opacity-50 font-bold cursor-pointer transition-all"
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selector de Perfil de IA */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase">PERFIL IA / MODELO</label>
                    <select
                      value={selectedProfile}
                      onChange={(e) => setSelectedProfile(e.target.value)}
                      disabled={!!activeJob}
                      className="w-full bg-black/45 border border-border-dark rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 disabled:opacity-50 font-bold cursor-pointer transition-all"
                    >
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Alertas del formulario manual */}
            {submitError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3.5 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Alertas del job global (de Express o SSE) */}
            {jobError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3.5 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{jobError}</span>
                {onClearJobError && <button onClick={onClearJobError} className="text-red-400/60 hover:text-red-400 font-bold cursor-pointer ml-1 text-base leading-none">×</button>}
              </div>
            )}

            {jobSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3.5 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="flex-1">{jobSuccess}</span>
                {onClearJobSuccess && <button onClick={onClearJobSuccess} className="text-emerald-400/60 hover:text-emerald-400 font-bold cursor-pointer ml-1 text-base leading-none">×</button>}
              </div>
            )}

            {/* Botón de Ejecutar */}
            <button
              type="submit"
              disabled={isSubmitting || !!activeJob}
              className="w-full bg-brand-primary hover:bg-brand-primary-hover active:scale-[0.98] disabled:bg-gray-800 disabled:text-gray-500 disabled:scale-100 text-white font-extrabold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-primary/20 text-xs"
            >
              {isSubmitting || activeJob ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>RENDERIZANDO EN COLA...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>COMENZAR GENERACIÓN DE VIDEOS</span>
                </>
              )}
            </button>
          </form>

          {/* Estado de Videos de Fondo */}
          <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-brand-primary">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">PISTA DE VIDEO CONTINUA</span>
              <span className="text-sm font-extrabold text-white">
                {backgroundStatus.count} videos detectados
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">PLAYHEAD OFFSET</span>
              <span className="text-sm font-extrabold text-brand-primary">
                Vídeo #{backgroundStatus.playhead?.currentVideoIndex || 0} a las {(backgroundStatus.playhead?.currentOffset || 0).toFixed(0)}s
              </span>
            </div>
          </div>
        </div>

        {/* Consola de Renderizado en tiempo real (Panel derecho) */}
        <div className={`${rightColSpan} flex flex-col space-y-6 transition-all duration-300`}>
          {/* Tarjeta de Progreso Activo Elevada */}
          {activeJob && (
            <div className="glass-panel rounded-3xl p-6 space-y-4 border-l-4 border-l-emerald-500 shadow-xl bg-gradient-to-br from-[#121824] to-[#0c101a]">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">
                      PROCESO DE RENDERIZACIÓN ACTIVO
                    </span>
                  </div>
                  <h4 className="text-xl font-black text-white">
                    Vídeo {activeJob.currentVideoIndex} de {activeJob.totalCount}
                  </h4>
                  {activeJob.currentProfileName && (
                    <span className="text-[10px] font-bold text-gray-400 inline-block bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                      Perfil: <span className="text-white font-black">{activeJob.currentProfileName}</span>
                    </span>
                  )}
                  {activeJob.elapsedSeconds !== undefined && (
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>Transcurrido: <span className="text-white font-mono">{formatTime(activeJob.elapsedSeconds)}</span></span>
                      <span>·</span>
                      <span className="text-brand-primary font-bold">
                        Restante: <span className="font-mono">{activeJob.etaSeconds !== null && activeJob.etaSeconds !== undefined ? formatTime(activeJob.etaSeconds) : 'Calculando...'}</span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right bg-black/40 px-3.5 py-2 rounded-2xl border border-white/5">
                  <span className="text-3xl font-black text-white font-mono">{activeJob.progress}%</span>
                  <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-wider">Avance Lote</span>
                </div>
              </div>

              {/* Barra de progreso fluida */}
              <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden border border-border-dark p-0.5 shadow-inner">
                <div 
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-300 shadow-lg shadow-emerald-500/25 relative overflow-hidden"
                  style={{ width: `${Math.max(2, activeJob.progress || 0)}%` }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[progress-bar-stripes_1s_linear_infinite]" />
                </div>
              </div>

              {/* Paso actual con micro-icono */}
              <div className="flex items-center gap-2.5 text-xs font-bold text-gray-200 bg-black/40 px-4 py-3 rounded-2xl border border-border-dark">
                {activeJob.isPaused ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                )}
                <span className="truncate-1 flex-grow font-medium">
                  {activeJob.isPaused ? 'Cola en pausa temporal' : activeJob.currentStep || 'Renderizando video...'}
                </span>
              </div>

              {/* Controles de Pausa y Cancelación con micro-interacciones */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {activeJob.isPaused ? (
                  <button
                    type="button"
                    onClick={handleResumeGeneration}
                    disabled={isResuming}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25 disabled:opacity-50 active:scale-95"
                  >
                    {isResuming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>REANUDAR GENERACIÓN</span>
                  </button>
                ) : activeJob.pauseRequested ? (
                  <button
                    type="button"
                    disabled
                    className="flex-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black py-3 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 opacity-85"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>PAUSANDO PROCESO...</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseGeneration}
                    disabled={isPausing}
                    className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-black py-3 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {isPausing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                    <span>PAUSAR COLA</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCancelGeneration}
                  disabled={isCancelling}
                  className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-black py-3 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                      <span>DETENIENDO...</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span>CANCELAR COLA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Alerta de Videos Fallidos y Botón de Reintento */}
          {!activeJob && lastFailedCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wide">Lote anterior con errores</h4>
                  <p className="text-[10.5px] text-gray-400 mt-0.5">Se detectaron {lastFailedCount} videos fallidos en la última generación.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={isRetryingFailed}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black px-4 py-2.5 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/25 active:scale-95"
              >
                {isRetryingFailed ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>REINTENTANDO...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>REINTENTAR FALLIDOS</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Consola de Logs Rediseñada */}
          <GenerationLogsConsole
            logs={logs}
            activeJob={activeJob}
            clearedLogsCount={clearedLogsCount}
            onClearLogs={() => setClearedLogsCount(logs.length)}
          />
        </div>
      </div>

      {/* Modal de Cadena Secuencial de Perfiles */}
      <ProfileChainModal
        isOpen={isChainModalOpen}
        onClose={() => setIsChainModalOpen(false)}
        profiles={profiles}
        templates={templates}
        initialChain={profileChain}
        onSave={(chain) => {
          setProfileChain(chain);
          // Inicializar seeds vacíos para perfiles que no los tienen aún
          setChainSeeds(prev => {
            const next = { ...prev };
            chain.forEach(item => {
              if (!next[item.profileId]) next[item.profileId] = [];
              // Ajustar tamaño del array si cambia el count
              while (next[item.profileId].length < item.count) next[item.profileId].push('');
              if (next[item.profileId].length > item.count) next[item.profileId] = next[item.profileId].slice(0, item.count);
            });
            return next;
          });
        }}
      />
    </div>
  );
}


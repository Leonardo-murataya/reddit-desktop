import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Loader2, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  Terminal, 
  ListOrdered, 
  X, 
  Layers, 
  Link, 
  Clock, 
  Film, 
  Pause, 
  Sparkles,
  Zap,
  Sliders,
  ChevronRight,
  HelpCircle,
  ClipboardList,
  FileText
} from 'lucide-react';
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
  
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [clearedLogsCount, setClearedLogsCount] = useState(0);

  // Cadena de perfiles
  const [profileChain, setProfileChain] = useState(null);
  const [chainSeeds, setChainSeeds] = useState({});
  const [chainInputModes, setChainInputModes] = useState({});
  const [chainBulkTexts, setChainBulkTexts] = useState({});
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
    setChainSeeds(prev => {
      const next = { ...prev };
      const arr = [...(next[profileId] || [])];
      while (arr.length < n) arr.push('');
      next[profileId] = arr.slice(0, n);
      return next;
    });
  };

  // Sincronizar tamaño del arreglo de semillas
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

  useEffect(() => {
    if (seeds.length > 0) {
      setSeeds(prev => {
        const next = [...prev];
        if (next[0] && (next[0].templateId !== selectedTemplate || next[0].profileId !== selectedProfile)) {
          next[0] = {
            ...next[0],
            templateId: selectedTemplate || next[0].templateId,
            profileId: selectedProfile || next[0].profileId
          };
          return next;
        }
        return prev;
      });
    }
  }, [selectedTemplate, selectedProfile]);

  const handleCountChange = (val) => {
    const n = Math.max(1, Math.min(100, parseInt(val) || 1));
    setCount(n);
    if (n === 1) {
      setSeedInputMode('individual');
    }
  };

  const handleSwitchInputMode = (newMode) => {
    setSeedInputMode(newMode);
    if (newMode === 'bulk') {
      const existingText = seeds.map(s => s.prompt).filter(Boolean).join('\n');
      setBulkText(existingText);
    } else {
      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        setCount(Math.min(100, Math.max(1, lines.length)));
        setSeeds(lines.map(line => ({
          prompt: line,
          templateId: selectedTemplate,
          profileId: selectedProfile
        })));
      }
    }
  };

  const handleBulkTextChange = (text) => {
    setBulkText(text);
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const validCount = Math.min(100, Math.max(1, lines.length));
    setCount(validCount);
    
    setSeeds(prev => {
      const defaultTemp = templates.find(t => t.id === settings.defaultTemplateId) || templates[0];
      const defaultProf = profiles.find(p => p.id === (defaultTemp?.profileId || settings.defaultProfileId)) || profiles[0];

      return Array.from({ length: validCount }, (_, i) => ({
        prompt: lines[i] || '',
        templateId: prev[i]?.templateId || selectedTemplate || defaultTemp?.id || '',
        profileId: prev[i]?.profileId || selectedProfile || defaultProf?.id || ''
      }));
    });
  };

  const handleSwitchChainInputMode = (profileId, newMode) => {
    setChainInputModes(prev => ({ ...prev, [profileId]: newMode }));
    if (newMode === 'bulk') {
      const existing = (chainSeeds[profileId] || []).filter(Boolean).join('\n');
      setChainBulkTexts(prev => ({ ...prev, [profileId]: existing }));
    } else {
      const lines = (chainBulkTexts[profileId] || '').split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        handleChainCountChange(profileId, lines.length);
        setChainSeeds(prev => ({ ...prev, [profileId]: lines }));
      }
    }
  };

  const handleChainBulkTextChange = (profileId, text) => {
    setChainBulkTexts(prev => ({ ...prev, [profileId]: text }));
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const n = Math.max(1, Math.min(200, lines.length || 1));

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

  useEffect(() => {
    if (selectedTemplate && templates.length > 0) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template && template.profileId) {
        setSelectedProfile(template.profileId);
      }
    }
  }, [selectedTemplate, templates]);

  useEffect(() => {
    if (selectedProfile && profiles.length > 0) {
      const activeProfile = profiles.find(p => p.id === selectedProfile);
      if (activeProfile) {
        const folder = activeProfile.backgroundFolder || settings.backgroundFolder || '';
        refreshBackground(folder, activeProfile.id);
      }
    }
  }, [selectedProfile, profiles, settings]);

  const handleStartGeneration = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    let activeSeeds = [];
    let hasEmpty = false;

    if (profileChain && profileChain.length > 0) {
      for (const item of profileChain) {
        const pSeeds = chainSeeds[item.profileId] || [];
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
    } else {
      activeSeeds = seeds.map(s => ({
        prompt: (s.prompt || '').trim(),
        templateId: s.templateId || selectedTemplate,
        profileId: s.profileId || selectedProfile
      }));
      hasEmpty = activeSeeds.some(s => !s.prompt);
    }

    if (activeSeeds.length === 0) {
      setSubmitError('Debes ingresar al menos una idea o tema para generar.');
      setIsSubmitting(false);
      return;
    }

    if (hasEmpty) {
      setSubmitError('Por favor completa las ideas para todos los videos antes de comenzar.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds: activeSeeds })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar la generación de videos.');
      }

      const defaultTemp = templates.find(t => t.id === settings.defaultTemplateId) || templates[0];
      const defaultProf = profiles.find(p => p.id === (defaultTemp?.profileId || settings.defaultProfileId)) || profiles[0];

      setSeeds([{
        prompt: '',
        templateId: selectedTemplate || defaultTemp?.id || '',
        profileId: selectedProfile || defaultProf?.id || ''
      }]);
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

  const totalChainCount = profileChain ? profileChain.reduce((acc, item) => acc + item.count, 0) : count;

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      
      {/* 1. Header de Studio con Métricas Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span>STUDIO DE PRODUCCIÓN AUTOMATIZADA</span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Crea contenido vertical en lote con voz neuronal, subtítulos sincronizados y aceleración GPU.
          </p>
        </div>

        {/* Badge de Fondo Continuo */}
        <div className="flex items-center gap-2.5 bg-[#0e1320] border border-white/10 rounded-2xl px-3.5 py-2 shrink-0">
          <Film className="w-4 h-4 text-brand-primary" />
          <div className="text-left">
            <span className="text-[9px] font-black text-gray-400 block uppercase tracking-wider">BIBLIOTECA ACTIVA</span>
            <span className="text-xs font-extrabold text-white">
              {backgroundStatus.count} fondos · Vídeo #{backgroundStatus.playhead?.currentVideoIndex || 0}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Cuadrícula Principal (2 Columnas Responsivas con min-w-0 para evitar cortes) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-w-0 w-full">
        
        {/* COLUMNA IZQUIERDA: Formulario & Cola de Trabajo (5 columnas en XL) */}
        <div className="xl:col-span-5 min-w-0 space-y-6 flex flex-col">
          <form onSubmit={handleStartGeneration} className="glass-panel rounded-3xl p-6 space-y-5 border border-white/5 shadow-2xl bg-gradient-to-b from-[#101624] to-[#0a0e18]">
            
            {/* Cabecera del Constructor */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-xs font-black text-gray-200 uppercase tracking-wider flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-brand-primary" />
                <span>Constructor de Videos</span>
              </h3>
              <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-brand-primary/15 text-brand-primary border border-brand-primary/30 uppercase tracking-wide">
                {profileChain ? 'Modo Cadena' : count === 1 ? '1 Video' : `Lote (${count} Videos)`}
              </span>
            </div>

            {/* Paso 1: Cantidad de Videos / Selector Rápido */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-black text-gray-400 uppercase tracking-wider text-[10.5px]">
                  1. Cantidad de Videos
                </label>
                {profileChain && (
                  <span className="text-[9.5px] font-bold text-emerald-400">
                    {profileChain.length} perfiles configurados
                  </span>
                )}
              </div>

              {profileChain ? (
                /* Banner Cadena de Perfiles */
                <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-2xl p-3.5 space-y-3 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-primary/20 text-brand-primary flex items-center justify-center shrink-0">
                      <Link className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9.5px] font-bold text-gray-400 uppercase block">Cadena Secuencial Activa</span>
                      <span className="text-xs font-black text-white truncate block">
                        {totalChainCount} videos · {profileChain.map(p => p.profileName).join(' ➔ ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsChainModalOpen(true)}
                      disabled={!!activeJob}
                      className="flex-1 bg-black/40 hover:bg-black/60 text-white font-bold py-2 rounded-xl text-[10.5px] border border-white/10 cursor-pointer active:scale-95"
                    >
                      ✎ Editar Cadena
                    </button>
                    <button
                      type="button"
                      onClick={() => { setProfileChain(null); setChainSeeds({}); }}
                      disabled={!!activeJob}
                      className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-2 rounded-xl text-[10.5px] border border-red-500/20 cursor-pointer active:scale-95"
                    >
                      Modo Simple
                    </button>
                  </div>
                </div>
              ) : (
                /* Selector Rápido Clásico */
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={count}
                      onChange={(e) => handleCountChange(e.target.value)}
                      disabled={!!activeJob}
                      className="bg-black/50 border border-white/10 rounded-2xl px-3 py-2 text-sm text-white font-bold w-18 text-center focus:border-brand-primary disabled:opacity-50"
                    />
                    <div className="flex-1 grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleCountChange(num)}
                          disabled={!!activeJob}
                          className={`py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            count === num
                              ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/25 border border-brand-primary'
                              : 'bg-black/40 hover:bg-black/60 text-gray-400 hover:text-white border border-white/5'
                          } disabled:opacity-50 active:scale-95`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSwitchInputMode(seedInputMode === 'bulk' ? 'individual' : 'bulk')}
                      disabled={!!activeJob || !!profileChain}
                      className={`w-full py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border ${
                        seedInputMode === 'bulk'
                          ? 'bg-brand-primary text-white border-brand-primary shadow-md shadow-brand-primary/20'
                          : 'bg-white/5 hover:bg-white/10 hover:border-brand-primary/40 text-gray-300 hover:text-white border-white/10'
                      }`}
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>{seedInputMode === 'bulk' ? '✓ Pegado Masivo' : '📋 Pegado Masivo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsChainModalOpen(true)}
                      disabled={!!activeJob}
                      className="w-full bg-white/5 hover:bg-white/10 hover:border-brand-primary/40 border border-white/10 text-gray-300 hover:text-white font-extrabold py-2 rounded-xl text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Link className="w-3.5 h-3.5 text-brand-primary" />
                      <span>Cadena Perfiles</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Paso 2: Ideas & Prompts de Historias */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-black text-gray-400 uppercase tracking-wider text-[10.5px]">
                  2. Idea del Video o Tema
                </label>
                {!profileChain && (
                  <div className="flex bg-black/50 rounded-xl p-0.5 border border-white/10">
                    <button
                      type="button"
                      onClick={() => handleSwitchInputMode('individual')}
                      className={`px-2.5 py-0.5 text-[9.5px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                        seedInputMode === 'individual' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchInputMode('bulk')}
                      className={`px-2.5 py-0.5 text-[9.5px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                        seedInputMode === 'bulk' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Pegado Masivo
                    </button>
                  </div>
                )}
              </div>

              {/* Input Area según Modo */}
              {profileChain ? (
                /* Modo Cadena */
                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                  {profileChain.map((item) => (
                    <div key={item.profileId} className="bg-black/30 p-3 rounded-2xl border border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-black text-white">
                        <span>{item.profileName} ({item.count} videos)</span>
                        <span className="text-[9px] text-brand-primary">{item.templateName}</span>
                      </div>
                      <textarea
                        value={(chainSeeds[item.profileId] || []).join('\n')}
                        onChange={(e) => handleChainBulkTextChange(item.profileId, e.target.value)}
                        placeholder={`Pega las ideas para ${item.profileName} (1 por renglón)...`}
                        rows="3"
                        disabled={!!activeJob}
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-600 focus:border-brand-primary resize-none font-medium"
                      />
                    </div>
                  ))}
                </div>
              ) : seedInputMode === 'bulk' ? (
                /* Modo Masivo */
                <div className="space-y-1.5">
                  <textarea
                    value={bulkText}
                    onChange={(e) => handleBulkTextChange(e.target.value)}
                    placeholder="Pega varios temas o ideas separadas por renglón...&#10;Video 1: Historia de terror en el bosque&#10;Video 2: Anécdota graciosa en una entrevista"
                    rows="5"
                    disabled={!!activeJob}
                    className="w-full bg-black/50 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-gray-600 focus:border-brand-primary resize-none font-medium custom-scrollbar"
                  />
                  <span className="text-[9.5px] text-gray-500 block">
                    ✔ {count} {count === 1 ? 'video configurado' : 'videos configurados por renglones'}
                  </span>
                </div>
              ) : (
                /* Modo Individual */
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                  {seeds.map((s, idx) => (
                    <div key={idx} className="space-y-1">
                      {count > 1 && (
                        <span className="text-[10px] font-black text-brand-primary uppercase">
                          Video #{idx + 1}
                        </span>
                      )}
                      <textarea
                        value={s.prompt || ''}
                        onChange={(e) => handleSeedChange(idx, e.target.value)}
                        placeholder={idx === 0 ? "Ej. Una historia intrigante sobre un descubrimiento secreto en el ático de una casa antigua..." : `Tema para video #${idx + 1}...`}
                        rows={count === 1 ? "3.5" : "2"}
                        disabled={!!activeJob}
                        className="w-full bg-black/50 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-gray-600 focus:border-brand-primary resize-none font-medium custom-scrollbar"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Paso 3: Selección de Plantilla y Perfil */}
            {!profileChain && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                    Plantilla Visual & Voz
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    disabled={!!activeJob}
                    className="w-full bg-black/50 border border-white/10 rounded-2xl px-3 py-2 text-xs text-white font-bold focus:border-brand-primary cursor-pointer disabled:opacity-50"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                    Perfil de IA / Modelo
                  </label>
                  <select
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    disabled={!!activeJob}
                    className="w-full bg-black/50 border border-white/10 rounded-2xl px-3 py-2 text-xs text-white font-bold focus:border-brand-primary cursor-pointer disabled:opacity-50"
                  >
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Alertas de Error / Éxito */}
            {submitError && (
              <div className="bg-red-500/15 border border-red-500/30 text-red-400 rounded-2xl p-3 text-xs flex items-center gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {jobError && (
              <div className="bg-red-500/15 border border-red-500/30 text-red-400 rounded-2xl p-3 text-xs flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{jobError}</span>
                </div>
                {onClearJobError && (
                  <button onClick={onClearJobError} className="text-red-400 hover:text-white font-bold cursor-pointer">✕</button>
                )}
              </div>
            )}

            {jobSuccess && (
              <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-2xl p-3 text-xs flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{jobSuccess}</span>
                </div>
                {onClearJobSuccess && (
                  <button onClick={onClearJobSuccess} className="text-emerald-400 hover:text-white font-bold cursor-pointer">✕</button>
                )}
              </div>
            )}

            {/* Botón Maestro de Lanzamiento */}
            <button
              type="submit"
              disabled={isSubmitting || !!activeJob}
              className="w-full bg-gradient-to-r from-brand-primary to-orange-500 hover:from-orange-600 hover:to-amber-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-xl shadow-brand-primary/25 disabled:opacity-40 disabled:scale-100 active:scale-97"
            >
              {isSubmitting || activeJob ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>PRODUCIENDO COLA EN SEGUNDO PLANO...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>COMENZAR GENERACIÓN DE VIDEOS</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* COLUMNA DERECHA: Consola de Producción & Monitoreo en Vivo (7 columnas en XL) */}
        <div className="xl:col-span-7 min-w-0 space-y-6 flex flex-col">
          
          {/* Tarjeta de Progreso Activo Elevada */}
          {activeJob && (
            <div className="glass-panel rounded-3xl p-5 space-y-4 border-l-4 border-l-emerald-500 shadow-2xl bg-gradient-to-br from-[#121927] to-[#0c111c] animate-fadeIn">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                      RENDERIZACIÓN EN TIEMPO REAL
                    </span>
                  </div>

                  <h4 className="text-xl font-black text-white truncate">
                    Vídeo {activeJob.currentVideoIndex} de {activeJob.totalCount}
                  </h4>

                  {activeJob.currentProfileName && (
                    <span className="text-[9.5px] font-bold text-gray-400 inline-block bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                      Perfil: <span className="text-white font-black">{activeJob.currentProfileName}</span>
                    </span>
                  )}

                  {activeJob.elapsedSeconds !== undefined && (
                    <div className="flex items-center gap-2 text-[10.5px] text-gray-400 mt-1 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>Transcurrido: <span className="text-white font-mono">{formatTime(activeJob.elapsedSeconds)}</span></span>
                      <span>·</span>
                      <span className="text-brand-primary font-bold">
                        Restante: <span className="font-mono">{activeJob.etaSeconds !== null && activeJob.etaSeconds !== undefined ? formatTime(activeJob.etaSeconds) : 'Calculando...'}</span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-right bg-black/50 px-4 py-2 rounded-2xl border border-white/5 shrink-0">
                  <span className="text-3xl font-black text-white font-mono">{activeJob.progress}%</span>
                  <span className="text-[9.5px] text-gray-400 block font-bold uppercase tracking-wider">Avance Lote</span>
                </div>
              </div>

              {/* Barra de progreso fluida */}
              <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden border border-white/5 p-0.5">
                <div 
                  className="bg-gradient-to-r from-brand-primary via-emerald-400 to-teal-300 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${Math.max(2, activeJob.progress || 0)}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>

              {/* Paso actual */}
              <div className="flex items-center gap-2.5 text-xs font-bold text-gray-200 bg-black/40 px-3.5 py-2.5 rounded-2xl border border-white/5">
                {activeJob.isPaused ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                )}
                <span className="truncate flex-1 font-medium">
                  {activeJob.isPaused ? 'Cola en pausa temporal' : activeJob.currentStep || 'Renderizando video...'}
                </span>
              </div>

              {/* Botones de Control */}
              <div className="flex gap-2 pt-1">
                {activeJob.isPaused ? (
                  <button
                    type="button"
                    onClick={handleResumeGeneration}
                    disabled={isResuming}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-95"
                  >
                    {isResuming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>REANUDAR</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseGeneration}
                    disabled={isPausing || activeJob.pauseRequested}
                    className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-black py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    {isPausing || activeJob.pauseRequested ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                    <span>PAUSAR</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCancelGeneration}
                  disabled={isCancelling}
                  className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-black py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer active:scale-95"
                >
                  {isCancelling ? <Loader2 className="w-4 h-4 animate-spin text-red-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  <span>CANCELAR</span>
                </button>
              </div>
            </div>
          )}

          {/* Reintentar Lote Fallido */}
          {!activeJob && lastFailedCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-3xl p-4 flex items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wide">Lote anterior con errores</h4>
                  <p className="text-[10.5px] text-gray-400 mt-0.5">Se detectaron {lastFailedCount} videos fallidos.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={isRetryingFailed}
                className="bg-amber-500 hover:bg-amber-600 text-white font-black px-4 py-2 rounded-2xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/25 active:scale-95 shrink-0"
              >
                {isRetryingFailed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                <span>REINTENTAR</span>
              </button>
            </div>
          )}

          {/* Consola de Logs Rediseñada */}
          <div className="flex-1 min-w-0">
            <GenerationLogsConsole
              logs={logs}
              activeJob={activeJob}
              clearedLogsCount={clearedLogsCount}
              onClearLogs={() => setClearedLogsCount(logs.length)}
            />
          </div>
        </div>

      </div>

      {/* Modal de Cadena Secuencial */}
      <ProfileChainModal
        isOpen={isChainModalOpen}
        onClose={() => setIsChainModalOpen(false)}
        profiles={profiles}
        templates={templates}
        initialChain={profileChain}
        onSave={(chain) => {
          setProfileChain(chain);
          setChainSeeds(prev => {
            const next = { ...prev };
            chain.forEach(item => {
              if (!next[item.profileId]) next[item.profileId] = [];
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

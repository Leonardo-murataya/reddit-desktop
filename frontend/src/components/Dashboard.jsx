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
import { useUIModal } from '../context/UIModalContext';

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
  const { showToast, showAlert, showConfirm } = useUIModal();
  const [seeds, setSeeds] = useState([]);
  const [count, setCount] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [seedInputMode, setSeedInputMode] = useState('individual'); // 'individual' | 'bulk'
  const [bulkText, setBulkText] = useState('');
  
  // Modo de origen de historia: 'ai' (Generación Gemini) o 'custom' (Historia propia directa sin API)
  const [storySource, setStorySource] = useState('ai'); // 'ai' | 'custom'
  const [customTitle, setCustomTitle] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [customBulkText, setCustomBulkText] = useState('');
  const [customInputMode, setCustomInputMode] = useState('individual'); // 'individual' | 'bulk'

  // Parser para lote de historias propias separadas por delimitadores (--- o ===)
  const parseCustomStories = (text, defaultGender = 'auto') => {
    if (!text || !text.trim()) return [];
    const rawBlocks = text.split(/(?:\r?\n){1,}[=-]{3,}(?:\r?\n){1,}/).map(b => b.trim()).filter(Boolean);
    
    return rawBlocks.map((block, idx) => {
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let title = '';
      let content = block;

      if (lines.length > 0) {
        const first = lines[0];
        if (/^(?:t[ií]tulo|title|asunto)\s*[:\-]/i.test(first) || first.startsWith('#')) {
          title = first.replace(/^(?:t[ií]tulo|title|asunto)\s*[:\-]\s*/i, '').replace(/^#+\s*/, '').trim();
          content = lines.slice(1).join('\n').trim();
        } else if (lines.length > 1 && first.length <= 90) {
          title = first;
          content = lines.slice(1).join('\n').trim();
        }
      }

      if (!title && lines[0]) {
        title = lines[0].length > 75 ? lines[0].substring(0, 72) + '...' : lines[0];
      }

      return {
        title: title || `Historia #${idx + 1}`,
        content: content || block,
        gender: defaultGender
      };
    });
  };
  
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [clearedLogsCount, setClearedLogsCount] = useState(0);

  // Cadena de perfiles
  const [profileChain, setProfileChain] = useState(null);
  const [chainSeeds, setChainSeeds] = useState({});
  const [chainInputModes, setChainInputModes] = useState({});
  const [chainBulkTexts, setChainBulkTexts] = useState({});
  const [chainBulkMode, setChainBulkMode] = useState(true);
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
        showAlert(data.error || 'Error al reintentar videos fallidos', 'Error al Reintentar', 'error');
      } else {
        setLastFailedCount(0);
        showToast('Reintentando videos fallidos en cola...', 'info');
      }
    } catch (err) {
      console.error(err);
      showAlert('Error de conexión con el servidor local.', 'Error de Conexión', 'error');
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
    setChainBulkTexts(prev => {
      const existing = (chainSeeds[profileId] || []);
      const arr = [...existing];
      arr[idx] = value;
      return { ...prev, [profileId]: arr.filter(Boolean).join('\n') };
    });
  };

  const handleToggleChainBulkMode = () => {
    setChainBulkMode(prev => {
      const nextMode = !prev;
      if (!nextMode && profileChain) {
        // Al desactivar pegado masivo (ir a inputs individuales), asegurarse de tener entradas completas
        setChainSeeds(currentSeeds => {
          const updated = { ...currentSeeds };
          profileChain.forEach(item => {
            const rawText = chainBulkTexts[item.profileId] !== undefined
              ? chainBulkTexts[item.profileId]
              : (updated[item.profileId] || []).join('\n');
            const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
            const padded = [...lines];
            while (padded.length < item.count) padded.push('');
            updated[item.profileId] = padded.slice(0, item.count);
          });
          return updated;
        });
      } else if (nextMode && profileChain) {
        // Al activar pegado masivo, sincronizar texto a partir de los inputs individuales
        setChainBulkTexts(currentTexts => {
          const updated = { ...currentTexts };
          profileChain.forEach(item => {
            const seedsArr = chainSeeds[item.profileId] || [];
            updated[item.profileId] = seedsArr.filter(Boolean).join('\n');
          });
          return updated;
        });
      }
      return nextMode;
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
  }, [count, templates, profiles, settings, selectedTemplate, selectedProfile]);

  useEffect(() => {
    if (selectedTemplate && seeds.length > 0) {
      setSeeds(prev => prev.map(s => ({
        ...s,
        templateId: selectedTemplate,
        profileId: selectedProfile || s.profileId
      })));
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
      const defaultProf = profiles.find(p => p.id === settings?.defaultProfileId) || profiles[0];
      if (defaultProf) setSelectedProfile(defaultProf.id);
    }
  }, [profiles, settings, selectedProfile]);

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      const defaultTemp = templates.find(t => t.id === settings?.defaultTemplateId) || templates[0];
      if (defaultTemp) setSelectedTemplate(defaultTemp.id);
    }
  }, [templates, settings, selectedTemplate]);

  useEffect(() => {
    if (templates.length > 0 && seeds.length === 0) {
      const defaultTemp = templates.find(t => t.id === selectedTemplate) || templates.find(t => t.id === settings?.defaultTemplateId) || templates[0];
      const defaultProf = profiles.find(p => p.id === (defaultTemp?.profileId || selectedProfile || settings?.defaultProfileId)) || profiles[0];
      setSeeds([{
        prompt: '',
        templateId: defaultTemp?.id || '',
        profileId: defaultProf?.id || ''
      }]);
    }
  }, [templates, profiles, selectedTemplate, selectedProfile, seeds.length, settings]);

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
        const folder = activeProfile.backgroundFolder || settings?.backgroundFolder || '';
        refreshBackground(folder, activeProfile.id);
      }
    }
  }, [selectedProfile, profiles, settings]);

  const handleSelectTemplate = (newTemplateId) => {
    setSelectedTemplate(newTemplateId);
    setSeeds(prev => prev.map(s => ({
      ...s,
      templateId: newTemplateId
    })));
    const tmpl = templates.find(t => t.id === newTemplateId);
    if (tmpl && tmpl.profileId) {
      setSelectedProfile(tmpl.profileId);
      setSeeds(prev => prev.map(s => ({
        ...s,
        profileId: tmpl.profileId
      })));
    }
  };

  const handleSelectProfile = (newProfileId) => {
    setSelectedProfile(newProfileId);
    setSeeds(prev => prev.map(s => ({
      ...s,
      profileId: newProfileId
    })));
  };

  const handleStartGeneration = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    const defaultTemp = templates.find(t => t.id === selectedTemplate) || templates.find(t => t.id === settings?.defaultTemplateId) || templates[0];
    const defaultProf = profiles.find(p => p.id === (selectedProfile || defaultTemp?.profileId || settings?.defaultProfileId)) || profiles[0];

    let activeSeeds = [];
    let hasEmpty = false;

    if (storySource === 'custom') {
      if (customInputMode === 'bulk') {
        const parsed = parseCustomStories(customBulkText, 'auto');
        if (parsed.length === 0) {
          setSubmitError('Por favor pega al menos una historia completa (puedes separar varias con ---).');
          setIsSubmitting(false);
          return;
        }
        activeSeeds = parsed.map(story => ({
          prompt: story.title,
          templateId: selectedTemplate || defaultTemp?.id,
          profileId: selectedProfile || defaultProf?.id,
          customStory: story
        }));
      } else {
        const content = customContent.trim();
        if (!content) {
          setSubmitError('Por favor pega el texto de la historia a narrar.');
          setIsSubmitting(false);
          return;
        }
        let title = customTitle.trim();
        let bodyContent = content;
        if (!title) {
          const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length > 0) {
            let first = lines[0];
            if (/^(?:t[ií]tulo|title|asunto)\s*[:\-]/i.test(first) || first.startsWith('#')) {
              title = first.replace(/^(?:t[ií]tulo|title|asunto)\s*[:\-]\s*/i, '').replace(/^#+\s*/, '').trim();
              bodyContent = lines.slice(1).join('\n').trim();
            } else if (lines.length > 1 && first.length <= 90) {
              title = first;
              bodyContent = lines.slice(1).join('\n').trim();
            } else {
              title = first.length > 80 ? first.substring(0, 77) + '...' : first;
            }
          }
        }
        activeSeeds = [{
          prompt: title || 'Historia de Reddit',
          templateId: selectedTemplate || defaultTemp?.id,
          profileId: selectedProfile || defaultProf?.id,
          customStory: {
            title: title || 'Historia de Reddit',
            content: bodyContent || content,
            gender: 'auto'
          }
        }];
      }
    } else if (profileChain && profileChain.length > 0) {
      for (const item of profileChain) {
        const pSeeds = chainSeeds[item.profileId] || [];
        const itemProf = profiles.find(p => p.id === item.profileId) || profiles[0];
        const itemTmpl = templates.find(t => t.id === item.templateId) ||
                         templates.find(t => t.profileId === item.profileId) ||
                         templates.find(t => {
                           const pName = (item.profileName || itemProf?.name || '').toLowerCase().replace(/\(importado\)/g, '').trim();
                           const tName = (t.name || '').toLowerCase().replace(/\(importada\)/g, '').trim();
                           return (pName.length > 3 && tName.includes(pName)) || (tName.length > 3 && pName.includes(tName));
                         }) ||
                         templates[0];

        for (let i = 0; i < item.count; i++) {
          const prompt = (pSeeds[i] || '').trim();
          if (!prompt) hasEmpty = true;
          activeSeeds.push({
            prompt,
            templateId: itemTmpl?.id,
            profileId: itemProf?.id
          });
        }
      }
    } else {
      const currentSeeds = seeds.length > 0 ? seeds : [{ prompt: '' }];
      activeSeeds = currentSeeds.map(s => ({
        prompt: (s.prompt || '').trim(),
        templateId: selectedTemplate || s.templateId || defaultTemp?.id,
        profileId: selectedProfile || s.profileId || defaultProf?.id
      }));
      hasEmpty = activeSeeds.some(s => !s.prompt);
    }

    if (activeSeeds.length === 0) {
      setSubmitError('Debes ingresar al menos una idea o historia para generar.');
      setIsSubmitting(false);
      return;
    }

    if (hasEmpty && storySource !== 'custom') {
      setSubmitError('Por favor completa las ideas para todos los videos antes de comenzar.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seeds: activeSeeds,
          templateId: selectedTemplate || defaultTemp?.id,
          profileId: selectedProfile || defaultProf?.id,
          inputSource: storySource
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar la generación de videos.');
      }

      if (storySource === 'custom') {
        if (customInputMode === 'individual') {
          setCustomTitle('');
          setCustomContent('');
        } else {
          setCustomBulkText('');
        }
        showToast('¡Generación iniciada con tu historia propia!', 'success');
      } else {
        setSeeds([{
          prompt: '',
          templateId: selectedTemplate || defaultTemp?.id || '',
          profileId: selectedProfile || defaultProf?.id || ''
        }]);
        setChainSeeds({});
        setProfileChain(null);
        setCount(1);
      }
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelGeneration = async () => {
    const ok = await showConfirm(
      '¿Estás seguro de que deseas detener la generación de videos en curso? El proceso actual se abortará.',
      'Detener Generación',
      { confirmText: 'Detener Proceso', cancelText: 'Continuar Generando', type: 'danger' }
    );
    if (!ok) return;

    setIsCancelling(true);
    try {
      const res = await fetch('/api/jobs/cancel', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showAlert('Error al detener la generación: ' + (data.error || 'Desconocido'), 'Error al Detener', 'error');
      } else {
        showToast('Solicitud de cancelación enviada correctamente.', 'info');
      }
    } catch (err) {
      console.error('Error al solicitar la detención del proceso:', err);
      showAlert('Error de conexión con el servidor local.', 'Error de Conexión', 'error');
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
              {backgroundStatus?.count || 0} fondos · Vídeo #{backgroundStatus?.playhead?.currentVideoIndex || 0}
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
              <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wide border ${
                storySource === 'custom'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-brand-primary/15 text-brand-primary border-brand-primary/30'
              }`}>
                {storySource === 'custom'
                  ? (customInputMode === 'bulk' ? `Lote (${parseCustomStories(customBulkText).length} Videos)` : '1 Video Propio')
                  : (profileChain ? 'Modo Cadena' : count === 1 ? '1 Video' : `Lote (${count} Videos)`)}
              </span>
            </div>

            {/* Selector de Modo: IA vs Historia Propia (Sin API) */}
            <div className="grid grid-cols-2 p-1 bg-black/40 border border-white/10 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setStorySource('ai')}
                disabled={!!activeJob}
                className={`py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  storySource === 'ai'
                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 border border-brand-primary/50'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generar con IA</span>
              </button>
              <button
                type="button"
                onClick={() => setStorySource('custom')}
                disabled={!!activeJob}
                className={`py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  storySource === 'custom'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 border border-amber-400/50'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Historia Propia</span>
                <span className="text-[9px] bg-black/30 border border-white/20 px-1.5 py-0.5 rounded-full uppercase tracking-tighter text-amber-200">Sin API</span>
              </button>
            </div>

            {/* CONTENIDO SEGÚN MODO: IA vs HISTORIA PROPIA */}
            {storySource === 'ai' ? (
              <>
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
                          onClick={handleToggleChainBulkMode}
                          disabled={!!activeJob}
                          className={`px-3 py-2 rounded-xl text-[10.5px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                            chainBulkMode
                              ? 'bg-brand-primary text-white border-brand-primary shadow-md shadow-brand-primary/20'
                              : 'bg-black/40 hover:bg-black/60 text-gray-300 border-white/10'
                          }`}
                          title={chainBulkMode ? 'Desactivar pegado masivo para editar por video individual' : 'Activar pegado masivo por renglones'}
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          <span>{chainBulkMode ? '✓ Pegado Masivo' : '📋 Pegado Masivo'}</span>
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
                  </div>

                  {/* Input Area según Modo */}
                  {profileChain ? (
                    /* Modo Cadena */
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                      {profileChain.map((item) => (
                        <div key={item.profileId} className="bg-black/30 p-3 rounded-2xl border border-white/10 space-y-2.5">
                          <div className="flex items-center justify-between text-[11px] font-black text-white">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-brand-primary" />
                              {item.profileName} ({item.count} {item.count === 1 ? 'video' : 'videos'})
                            </span>
                            <span className="text-[9px] text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full font-bold border border-brand-primary/20">
                              {item.templateName}
                            </span>
                          </div>

                          {chainBulkMode ? (
                            /* Pegado Masivo Activado: Textarea por líneas */
                            <div className="space-y-1">
                              <textarea
                                value={chainBulkTexts[item.profileId] !== undefined ? chainBulkTexts[item.profileId] : (chainSeeds[item.profileId] || []).join('\n')}
                                onChange={(e) => handleChainBulkTextChange(item.profileId, e.target.value)}
                                placeholder={`Pega las ${item.count} ideas para ${item.profileName} (1 por renglón)...`}
                                rows={Math.max(2, Math.min(5, item.count || 2))}
                                disabled={!!activeJob}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-600 focus:border-brand-primary resize-none font-medium custom-scrollbar"
                              />
                              <span className="text-[9px] text-gray-500 block">
                                ✔ {(chainSeeds[item.profileId] || []).filter(Boolean).length} de {item.count} ideas completadas
                              </span>
                            </div>
                          ) : (
                            /* Pegado Masivo Desactivado: Inputs individuales por video */
                            <div className="space-y-1.5">
                              {Array.from({ length: item.count }).map((_, vIdx) => (
                                <div key={vIdx} className="flex items-center gap-2">
                                  <span className="text-[9.5px] font-bold text-brand-primary/80 w-14 shrink-0">
                                    Video #{vIdx + 1}:
                                  </span>
                                  <input
                                    type="text"
                                    value={(chainSeeds[item.profileId] && chainSeeds[item.profileId][vIdx]) || ''}
                                    onChange={(e) => handleChainSeedChange(item.profileId, vIdx, e.target.value)}
                                    placeholder={`Idea para ${item.profileName} #${vIdx + 1}...`}
                                    disabled={!!activeJob}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-brand-primary font-medium"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
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
                        onChange={(e) => handleSelectTemplate(e.target.value)}
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
                        onChange={(e) => handleSelectProfile(e.target.value)}
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
              </>
            ) : (
              /* MODO HISTORIA PROPIA (SIN API DE GEMINI) */
              <>
                {/* Paso 1: Modo de Entrada */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-black text-gray-400 uppercase tracking-wider text-[10.5px]">
                      1. Formato de Entrada
                    </label>
                    <span className="text-[9.5px] font-bold text-amber-400">
                      0 Tokens · Gemini API Omitida
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomInputMode('individual')}
                      disabled={!!activeJob}
                      className={`py-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border ${
                        customInputMode === 'individual'
                          ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-white/5 hover:bg-white/10 hover:border-amber-400/40 text-gray-300 hover:text-white border-white/10'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>1 Historia Individual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomInputMode('bulk')}
                      disabled={!!activeJob}
                      className={`py-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border ${
                        customInputMode === 'bulk'
                          ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-white/5 hover:bg-white/10 hover:border-amber-400/40 text-gray-300 hover:text-white border-white/10'
                      }`}
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>Lote de Historias (---)</span>
                    </button>
                  </div>
                </div>

                {/* Paso 2: Contenido de la Historia */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-black text-gray-400 uppercase tracking-wider text-[10.5px]">
                      2. Texto de la Historia
                    </label>
                    {customInputMode === 'individual' ? (
                      <span className="text-[9.5px] text-gray-400 font-medium">
                        {customContent.trim().length > 0
                          ? `${customContent.trim().split(/\s+/).filter(Boolean).length} palabras · ${customContent.length} car.`
                          : 'Pega el texto abajo'}
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-bold text-amber-400">
                        {parseCustomStories(customBulkText).length} {parseCustomStories(customBulkText).length === 1 ? 'historia detectada' : 'historias detectadas'}
                      </span>
                    )}
                  </div>

                  {customInputMode === 'individual' ? (
                    <div className="space-y-2.5">
                      <input
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="Título del Video (Opcional - se extrae de la 1ra línea si se omite)"
                        disabled={!!activeJob}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-amber-500 font-bold"
                      />
                      <textarea
                        value={customContent}
                        onChange={(e) => setCustomContent(e.target.value)}
                        placeholder="Pega aquí el texto completo o historia que deseas narrar en el video...&#10;&#10;Ejemplo:&#10;Descubrí un secreto familiar que lo cambió todo. Hace dos semanas mientras limpiaba el desván de mi abuelo..."
                        rows="8"
                        disabled={!!activeJob}
                        className="w-full bg-black/50 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-gray-600 focus:border-amber-500 resize-none font-medium custom-scrollbar"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-[10px] text-amber-200/90 leading-relaxed">
                        💡 <strong>Pegado por Lotes:</strong> Separa cada historia pegando una línea con <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300">---</code> entre ellas. La primera línea de cada bloque se usará como título para la tarjeta de Reddit.
                      </div>
                      <textarea
                        value={customBulkText}
                        onChange={(e) => setCustomBulkText(e.target.value)}
                        placeholder={"Título: Historia 1 de Prueba\nTexto completo de la primera historia aquí...\n\n---\n\nTítulo: Historia 2 de Prueba\nTexto completo de la segunda historia aquí..."}
                        rows="9"
                        disabled={!!activeJob}
                        className="w-full bg-black/50 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-gray-600 focus:border-amber-500 resize-none font-medium custom-scrollbar"
                      />
                    </div>
                  )}
                </div>

                {/* Paso 3: Plantilla Visual & Locución de Plantilla */}
                <div className="space-y-2 pt-1">
                  <label className="text-[10.5px] font-black text-gray-400 uppercase tracking-wider block">
                    3. Plantilla Visual & Locución
                  </label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Plantilla Visual
                        </label>
                        <select
                          value={selectedTemplate}
                          onChange={(e) => handleSelectTemplate(e.target.value)}
                          disabled={!!activeJob}
                          className="w-full bg-black/50 border border-white/10 rounded-2xl px-3 py-2 text-xs text-white font-bold focus:border-amber-500 cursor-pointer disabled:opacity-50"
                        >
                          {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-2.5 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-black text-[11px]">
                          <Zap className="w-3.5 h-3.5 shrink-0" />
                          <span>0 Tokens · API Omitida</span>
                        </div>
                        <p className="text-[9.5px] text-gray-400 font-medium mt-0.5 leading-tight">
                          No requiere API Key. Síntesis Edge-TTS y render NVENC directos.
                        </p>
                      </div>
                    </div>

                    {/* Fila informativa de la voz configurada en la plantilla */}
                    {(() => {
                      const curTmpl = templates.find(t => t.id === selectedTemplate) || templates[0];
                      const mVoiceName = curTmpl?.maleVoice ? curTmpl.maleVoice.split('-').slice(2).join(' ') : 'Masculina';
                      const fVoiceName = curTmpl?.femaleVoice ? curTmpl.femaleVoice.split('-').slice(2).join(' ') : 'Femenina';
                      const nMode = curTmpl?.narratorGender === 'female' 
                        ? `Femenina (${fVoiceName})` 
                        : (curTmpl?.narratorGender === 'auto' ? `Auto por historia (${mVoiceName} / ${fVoiceName})` : `Masculina (${mVoiceName})`);
                      return (
                        <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-[10.5px]">
                          <span className="text-gray-300 font-medium flex items-center gap-1.5">
                            <span className="text-amber-400">🎙️</span>
                            <span className="text-gray-400">Locución de plantilla:</span>
                            <span className="text-white font-black">{nMode}</span>
                          </span>
                          <span className="text-amber-400/90 font-mono text-[9.5px] bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 font-bold">
                            {curTmpl?.voiceRate || '+0%'} vel.
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}

            {/* Alertas de Error / Éxito */}
            {submitError && (
              <div className="bg-red-500/15 border border-red-500/30 text-red-400 rounded-2xl p-3 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span className="break-words font-medium">{submitError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitError('')}
                  className="text-red-400 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer shrink-0"
                  title="Cerrar mensaje"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {jobError && (
              <div className="bg-red-500/15 border border-red-500/30 text-red-400 rounded-2xl p-3 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span className="break-words font-medium">{jobError}</span>
                </div>
                {onClearJobError && (
                  <button
                    type="button"
                    onClick={onClearJobError}
                    className="text-red-400 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer shrink-0"
                    title="Cerrar mensaje"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {jobSuccess && (
              <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-2xl p-3 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="break-words font-medium">{jobSuccess}</span>
                </div>
                {onClearJobSuccess && (
                  <button
                    type="button"
                    onClick={onClearJobSuccess}
                    className="text-emerald-400 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer shrink-0"
                    title="Cerrar mensaje"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Botón Maestro de Lanzamiento */}
            <button
              type="submit"
              disabled={isSubmitting || !!activeJob}
              className={`w-full text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-xl disabled:opacity-40 disabled:scale-100 active:scale-97 ${
                storySource === 'custom'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25 border border-amber-400/40'
                  : 'bg-gradient-to-r from-brand-primary to-orange-500 hover:from-orange-600 hover:to-amber-500 shadow-brand-primary/25'
              }`}
            >
              {isSubmitting || activeJob ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>PRODUCIENDO COLA EN SEGUNDO PLANO...</span>
                </>
              ) : storySource === 'custom' ? (
                <>
                  <Play className="w-5 h-5 fill-current text-white" />
                  <span>
                    {customInputMode === 'bulk'
                      ? `RENDERIZAR LOTE (${parseCustomStories(customBulkText).length} HISTORIAS SIN API)`
                      : 'RENDERIZAR HISTORIA DIRECTA (0 TOKENS)'}
                  </span>
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

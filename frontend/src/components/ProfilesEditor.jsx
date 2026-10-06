import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, KeyRound, Cpu, FileText, CheckCircle2, FolderOpen, Eye, EyeOff, ChevronDown, ChevronUp, Search, RefreshCw } from 'lucide-react';
import { useUIModal } from '../context/UIModalContext';

const GEMINI_MODELS = [
  { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
  { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' }
];

export default function ProfilesEditor({ profiles, onSave, onDelete }) {
  const { showToast, showAlert, showConfirm } = useUIModal();
  const loadedProfileIdRef = useRef(null);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('Nuevo Perfil Gemini');
  const [apiKeys, setApiKeys] = useState(['']);
  const [keysExpanded, setKeysExpanded] = useState(true);
  const [visibleIndices, setVisibleIndices] = useState({});
  const [systemPrompt, setSystemPrompt] = useState('');
  const [backgroundFolder, setBackgroundFolder] = useState('');
  const [primaryAttempts, setPrimaryAttempts] = useState(2);
  const [fallbackAttempts, setFallbackAttempts] = useState(3);
  const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
  const [fallbackModels, setFallbackModels] = useState(['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
  const [availableModelOptions, setAvailableModelOptions] = useState(GEMINI_MODELS);
  const [detectingModels, setDetectingModels] = useState(false);
  const [success, setSuccess] = useState('');

  const toggleKeyVisibility = (index) => {
    setVisibleIndices(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const loadProfileData = (prof) => {
    if (!prof) return;
    loadedProfileIdRef.current = prof.id;
    setName(prof.name || '');
    const parsedKeys = (prof.apiKey || '').split('\n').filter(Boolean);
    setApiKeys(parsedKeys.length > 0 ? parsedKeys : ['']);
    setSystemPrompt(prof.systemPrompt || '');
    setBackgroundFolder(prof.backgroundFolder || '');
    setPrimaryAttempts(prof.primaryAttempts !== undefined ? parseInt(prof.primaryAttempts) : 2);
    setFallbackAttempts(prof.fallbackAttempts !== undefined ? parseInt(prof.fallbackAttempts) : 3);
    setMaxOutputTokens(prof.maxOutputTokens !== undefined ? parseInt(prof.maxOutputTokens) : 8192);
    
    let loadedModels = prof.fallbackModels && Array.isArray(prof.fallbackModels) && prof.fallbackModels.length > 0
      ? [...prof.fallbackModels]
      : (prof.model ? [prof.model] : ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']);
    
    loadedModels = loadedModels.filter(m => m && !m.includes('2.5') && m !== 'gemini-flash-lite-latest');
    if (loadedModels.length === 0) loadedModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
    setFallbackModels([...loadedModels]);
  };

  const handleProfileChange = (newId) => {
    setSelectedId(newId);
    if (newId === 'new') {
      handleCreateNew();
      return;
    }
    const prof = profiles.find(p => p.id === newId);
    if (prof) {
      loadProfileData(prof);
    }
  };

  // Sincronizar perfiles cargados
  useEffect(() => {
    if (profiles.length > 0) {
      if (selectedId === 'new') {
        return;
      }
      const targetId = selectedId || profiles[0].id;
      if (!selectedId) setSelectedId(targetId);
      if (loadedProfileIdRef.current !== targetId) {
        const active = profiles.find(p => p.id === targetId);
        if (active) loadProfileData(active);
      }
    }
  }, [selectedId, profiles]);

  const handleCreateNew = () => {
    setSelectedId('new');
    loadedProfileIdRef.current = 'new';
    setName('Nuevo Perfil de IA');
    setApiKeys(['']);
    setSystemPrompt('Eres un narrador experto de historias de Reddit. Genera historias cautivadoras, intrigantes y realistas que mantengan al espectador enganchado segundo a segundo. Estructura el relato en primera persona ("Yo..."). El tono debe ser natural, conversacional y misterioso.');
    setBackgroundFolder('');
    setPrimaryAttempts(2);
    setFallbackAttempts(3);
    setMaxOutputTokens(8192);
    setFallbackModels(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']);
    setSuccess('');
  };

  const handleDetectModels = async () => {
    const validKeys = apiKeys.map(k => k.trim()).filter(Boolean);
    if (validKeys.length === 0) {
      showToast('Introduce al menos una API Key para detectar modelos de Google Gemini.', 'warning');
      return;
    }

    setDetectingModels(true);
    try {
      const res = await fetch('/api/profiles/available-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: validKeys.join('\n') })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al consultar modelos');
      }

      if (data.models && Array.isArray(data.models) && data.models.length > 0) {
        const newOptions = data.models.map(m => ({
          value: m.id,
          label: m.name || m.id
        }));
        setAvailableModelOptions(newOptions);
        showToast(`¡Se detectaron ${data.models.length} modelos compatibles con tu cuenta de Gemini!`, 'success');
      } else {
        showToast('No se recibieron modelos adicionales. Se mantienen los modelos estándar.', 'info');
      }
    } catch (err) {
      console.error('Error detectando modelos:', err);
      showToast(`Error al detectar modelos: ${err.message}`, 'error');
    } finally {
      setDetectingModels(false);
    }
  };

  const handlePickFolder = async () => {
    try {
      const res = await fetch('/api/dialog/folder');
      const data = await res.json();
      if (data.path) {
        setBackgroundFolder(data.path);
      }
    } catch (err) {
      console.error('Error al abrir selector nativo de carpeta:', err);
    }
  };

  const handleDeleteClick = async () => {
    const activeProf = profiles.find(p => p.id === selectedId);
    const profName = activeProf ? activeProf.name : 'este perfil';
    const ok = await showConfirm(
      `¿Estás seguro de que deseas eliminar permanentemente el perfil de IA "${profName}"?`,
      'Eliminar Perfil de IA',
      { confirmText: 'Eliminar', cancelText: 'Cancelar', type: 'danger' }
    );
    if (ok) {
      await onDelete(selectedId);
      const remaining = (profiles || []).filter(p => p.id !== selectedId);
      if (remaining.length > 0) {
        loadedProfileIdRef.current = remaining[0].id;
        setSelectedId(remaining[0].id);
      } else {
        handleCreateNew();
      }
      showToast('Perfil de IA eliminado exitosamente.', 'success');
    }
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    
    const finalModels = fallbackModels.length > 0 ? fallbackModels : ['gemini-3.7-flash'];
    const primaryModel = finalModels[0];

    const targetId = selectedId && selectedId !== 'new' ? selectedId : (profiles[0]?.id || undefined);
    const activeProfile = (targetId ? profiles.find(p => p.id === targetId) : null) || {};
    const savedProfile = await onSave({
      ...activeProfile,
      id: selectedId === 'new' ? undefined : targetId,
      name,
      apiKey: apiKeys.map(k => k.trim()).filter(Boolean).join('\n'),
      model: primaryModel,
      systemPrompt,
      backgroundFolder,
      primaryAttempts: parseInt(primaryAttempts) || 2,
      fallbackAttempts: parseInt(fallbackAttempts) || 3,
      maxAttempts: (parseInt(primaryAttempts) || 2) + (parseInt(fallbackAttempts) || 3),
      maxOutputTokens: parseInt(maxOutputTokens) || 1200,
      fallbackModels: [...finalModels],
      fallbackModel: finalModels[1] || finalModels[0]
    });
    
    if (savedProfile && savedProfile.id) {
      setSelectedId(savedProfile.id);
      loadProfileData(savedProfile);
    }
    
    showToast(`Perfil de IA "${name}" guardado exitosamente.`, 'success');
    setSuccess('Perfil de IA guardado exitosamente.');
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-white">GESTIÓN DE PERFILES DE IA</h2>
          <p className="text-xs text-gray-400">Guarda tus API Keys y personaliza las directrices de personalidad que usará el modelo para redactar los guiones.</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-border-dark cursor-pointer animate-pulse-ring"
        >
          <Plus className="w-4 h-4 text-brand-primary" />
          <span>Crear Nuevo Perfil</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selector y Configuración Base (Panel 1/3) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
              <KeyRound className="w-4 h-4 text-brand-primary" />
              <span>Selección de Perfil</span>
            </h3>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400">PERFIL ACTIVO</label>
              <select
                value={selectedId}
                onChange={(e) => handleProfileChange(e.target.value)}
                className="w-full bg-black/40 border border-border-dark rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary font-bold"
              >
                {selectedId === 'new' && (
                  <option value="new">Nuevo Perfil (Creando...)</option>
                )}
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400">NOMBRE DEL PERFIL</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black/40 border border-border-dark rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary font-bold"
              />
            </div>
          </div>
        </div>

        {/* Credenciales y Prompts (Panel 2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveSubmit} className="glass-panel rounded-2xl p-6 space-y-6">
            
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
              <Cpu className="w-4 h-4 text-brand-primary" />
              <span>Credenciales & Prompt del Sistema</span>
            </h3>

            {/* API Keys */}
            <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-border-dark">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-400">GEMINI API KEYS ({apiKeys.length})</label>
                <button
                  type="button"
                  onClick={() => setKeysExpanded(!keysExpanded)}
                  className="text-gray-400 hover:text-white flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-all duration-200"
                >
                  <span>{keysExpanded ? 'Contraer' : 'Expandir'}</span>
                  {keysExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {keysExpanded && (
                <div className="space-y-3 pt-2 border-t border-border-dark/50">
                  {apiKeys.map((keyVal, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <input
                          type={visibleIndices[idx] ? "text" : "password"}
                          value={keyVal}
                          onChange={(e) => {
                            const newKeys = [...apiKeys];
                            newKeys[idx] = e.target.value;
                            setApiKeys(newKeys);
                          }}
                          placeholder={`Clave API Gemini #${idx + 1}`}
                          className="w-full bg-black/40 border border-border-dark rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary transition-all duration-200 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(idx)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
                        >
                          {visibleIndices[idx] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      
                      {apiKeys.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newKeys = apiKeys.filter((_, i) => i !== idx);
                            setApiKeys(newKeys);
                            const newVisibilities = { ...visibleIndices };
                            delete newVisibilities[idx];
                            setVisibleIndices(newVisibilities);
                          }}
                          className="bg-red-950/40 hover:bg-red-900/60 border border-red-900/30 text-red-400 p-2.5 rounded-xl cursor-pointer transition-all duration-200"
                          title="Eliminar esta clave"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setApiKeys([...apiKeys, '']);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-800/30 text-purple-300 font-bold py-2 rounded-xl text-xs transition-all duration-200 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Añadir otra API Key</span>
                  </button>

                  <span className="text-[9px] text-gray-500 block leading-normal pt-1">
                    Puedes añadir múltiples claves API para habilitar la **rotación automática**. Si una clave se agota por límite de cuota (error 429), el sistema utilizará la siguiente clave de la lista.
                  </span>
                </div>
              )}
            </div>

            {/* Carpeta de Videos de Fondo Personalizada (Opcional por Canal) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-400 uppercase">Carpeta de Videos de Fondo (Opcional por Canal)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={backgroundFolder}
                  onChange={(e) => setBackgroundFolder(e.target.value)}
                  placeholder="Usar carpeta global de Ajustes..."
                  className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary font-mono truncate"
                />
                <button
                  type="button"
                  onClick={handlePickFolder}
                  title="Seleccionar Carpeta para este Canal"
                  className="bg-gray-800 hover:bg-gray-700 text-white font-bold p-3 rounded-xl border border-border-dark cursor-pointer transition-all duration-200"
                >
                  <FolderOpen className="w-5 h-5 text-brand-primary" />
                </button>
              </div>
              <span className="text-[10px] text-gray-500 block leading-tight">
                Si configuras una carpeta aquí, este canal usará estos videos de fondo específicos para evitar problemas de derechos de autor (copyright) al compartir en distintas cuentas. Si se deja vacío, usará la carpeta configurada en Ajustes globales.
              </span>
            </div>

            {/* Robustez y Límite de Tokens */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-black/25 p-4 rounded-xl border border-border-dark">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase">Intentos Mod. Principal</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={primaryAttempts}
                  onChange={(e) => setPrimaryAttempts(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-primary transition-all duration-200 font-bold"
                />
                <span className="text-[9px] text-gray-500 block leading-tight">
                  Intentos con el modelo principal antes del fallback (ej: 2).
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase">Intentos Fallback</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={fallbackAttempts}
                  onChange={(e) => setFallbackAttempts(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                  className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-primary transition-all duration-200 font-bold"
                />
                <span className="text-[9px] text-gray-500 block leading-tight">
                  Intentos en los modelos de respaldo (ej: 3).
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase">Tokens Máx. Salida</label>
                <input
                  type="number"
                  min="1000"
                  max="16384"
                  step="100"
                  value={maxOutputTokens}
                  onChange={(e) => setMaxOutputTokens(Math.max(1000, Math.min(16384, parseInt(e.target.value) || 8192)))}
                  className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-primary transition-all duration-200 font-bold"
                />
                <span className="text-[9px] text-gray-500 block leading-tight">
                  Límite de generación (~8192 tokens recomendado para historias completas sin cortes).
                </span>
              </div>
            </div>

            {/* Secuencia Completa de Modelos de IA (Fallback) */}
            <div className="bg-black/25 p-5 rounded-xl border border-border-dark space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-200 uppercase flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-brand-primary" />
                    <span>SECUENCIA DE MODELOS Y RESPALDOS (FALLBACK)</span>
                  </label>
                  <span className="text-[11px] text-gray-400 block mt-0.5">
                    Se probará cada modelo en orden (1, 2, 3...) si los anteriores sufren alta demanda (503) o cuota agotada (429).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDetectModels}
                  disabled={detectingModels}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-brand-primary hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold border border-border-dark cursor-pointer transition-colors shrink-0 self-start sm:self-auto"
                  title="Detectar modelos compatibles con tus API Keys"
                >
                  <Search className={`w-3.5 h-3.5 ${detectingModels ? 'animate-spin' : ''}`} />
                  <span>{detectingModels ? 'Buscando...' : 'Detectar Modelos'}</span>
                </button>
              </div>

              {/* Lista de modelos configurados (ancho completo y sin texto truncado) */}
              <div className="space-y-2">
                {fallbackModels.map((modelVal, idx) => {
                  const modelObj = availableModelOptions.find(m => m.value === modelVal) || { label: modelVal, value: modelVal };
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 bg-black/40 hover:bg-black/60 border border-border-dark/80 rounded-xl px-4 py-3 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="bg-brand-primary/15 text-brand-primary text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border border-brand-primary/30 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0">
                          <span className="text-white font-extrabold text-sm tracking-wide">
                            {modelObj.label}
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono">
                            ({modelObj.value})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {idx === 0 ? (
                          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2.5 py-1 rounded-md font-black border border-emerald-500/30">
                            Principal
                          </span>
                        ) : (
                          <span className="bg-cyan-500/20 text-cyan-400 text-[10px] px-2.5 py-1 rounded-md font-bold border border-cyan-500/30">
                            Respaldo {idx}
                          </span>
                        )}

                        {fallbackModels.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newModels = fallbackModels.filter((_, i) => i !== idx);
                              setFallbackModels(newModels);
                            }}
                            className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar este modelo de la secuencia"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {fallbackModels.length === 0 && (
                  <span className="text-xs text-gray-500 italic block py-2">No hay modelos de IA configurados en este perfil.</span>
                )}
              </div>

              {/* Controles para agregar nuevo modelo a la secuencia */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-border-dark/50">
                <select
                  id="add-fallback-select"
                  className="flex-1 bg-black/40 border border-border-dark rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary font-semibold"
                  defaultValue="gemini-3.5-flash-lite"
                >
                  {availableModelOptions.map(m => (
                    <option key={m.value} value={m.value}>
                      {m.label} ({m.value})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const selectEl = document.getElementById('add-fallback-select');
                    const selectedVal = selectEl.value;
                    if (fallbackModels.includes(selectedVal)) {
                      showToast('Este modelo ya está en la lista de prioridad.', 'warning');
                      return;
                    }
                    setFallbackModels([...fallbackModels, selectedVal]);
                    showToast('Modelo agregado a la secuencia de fallback.', 'info');
                  }}
                  className="bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary hover:text-white font-extrabold px-5 py-2.5 rounded-xl text-xs border border-brand-primary/40 cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>AGREGAR A LA SECUENCIA</span>
                </button>
              </div>
            </div>

            {/* Prompt de Sistema */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-400 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-brand-primary" />
                <span>INSTRUCCIONES DEL SISTEMA (System Prompt)</span>
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows="10"
                placeholder="Escribe el comportamiento esperado del redactor de historias..."
                className="w-full bg-black/40 border border-border-dark rounded-xl p-4 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary transition-all duration-200 resize-none font-mono leading-relaxed"
              />
            </div>

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{success}</span>
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-4 border-t border-border-dark pt-6 justify-end">
              {selectedId && selectedId !== 'new' && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Perfil</span>
                </button>
              )}

              <button
                type="submit"
                className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-hover active:scale-[0.98] text-white font-extrabold px-6 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-brand-primary/20"
              >
                <Save className="w-4 h-4 fill-current" />
                <span>Guardar Perfil de IA</span>
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}

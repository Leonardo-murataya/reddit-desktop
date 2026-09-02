import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, KeyRound, Cpu, FileText, CheckCircle2, FolderOpen, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useUIModal } from '../context/UIModalContext';

const GEMINI_MODELS = [
  { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
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
  const [fallbackModels, setFallbackModels] = useState(['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']);
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
    
    let loadedModels = prof.fallbackModels && Array.isArray(prof.fallbackModels) && prof.fallbackModels.length > 0
      ? [...prof.fallbackModels]
      : (prof.model ? [prof.model] : ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']);
    
    loadedModels = loadedModels.filter(m => m && !m.includes('2.5') && m !== 'gemini-flash-lite-latest');
    if (loadedModels.length === 0) loadedModels = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
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
    setFallbackModels(['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']);
    setSuccess('');
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

            {/* Robustez y Modelo de Respaldo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/25 p-4 rounded-xl border border-border-dark">
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
                  Intentos con el modelo principal (ej: 2).
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
                  Intentos tras fallar el principal (ej: 3).
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase">Modelos de IA (Prioridad Secuencial)</label>
                
                {/* Lista de modelos configurados */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {fallbackModels.map((modelVal, idx) => {
                    const modelObj = GEMINI_MODELS.find(m => m.value === modelVal) || { label: modelVal, value: modelVal };
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2 bg-black/30 border border-border-dark/60 rounded-xl px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1 text-white font-bold">
                          <span className="bg-brand-primary/10 text-brand-primary text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-brand-primary/20 shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate">{modelObj.label}</span>
                          {idx === 0 ? (
                            <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded font-black border border-emerald-500/30 shrink-0">
                              Principal
                            </span>
                          ) : (
                            <span className="bg-cyan-500/20 text-cyan-400 text-[9px] px-1.5 py-0.5 rounded font-bold border border-cyan-500/30 shrink-0">
                              Respaldo {idx}
                            </span>
                          )}
                        </div>
                        {fallbackModels.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newModels = fallbackModels.filter((_, i) => i !== idx);
                              setFallbackModels(newModels);
                            }}
                            className="text-gray-400 hover:text-red-400 p-1.5 transition-colors cursor-pointer shrink-0"
                            title="Eliminar este modelo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {fallbackModels.length === 0 && (
                    <span className="text-[10px] text-gray-500 italic block py-1.5">No hay modelos de IA configurados.</span>
                  )}
                </div>

                {/* Controles para agregar nuevo modelo a la secuencia */}
                <div className="flex gap-2">
                  <select
                    id="add-fallback-select"
                    className="w-full bg-black/40 border border-border-dark rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
                    defaultValue="gemini-3.6-flash"
                  >
                    {GEMINI_MODELS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
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
                    className="bg-gray-800 hover:bg-gray-700 text-white font-extrabold px-3 py-2 rounded-xl text-[10px] border border-border-dark cursor-pointer transition-colors"
                  >
                    AGREGAR
                  </button>
                </div>
                <span className="text-[8px] text-gray-500 block leading-tight mt-1">
                  Se intentará cada modelo en orden (1, 2, 3...) de forma automática si los anteriores fallan o agotan cuota.
                </span>
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

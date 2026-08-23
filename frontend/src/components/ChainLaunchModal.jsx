import React, { useState } from 'react';
import { X, Play, Layers } from 'lucide-react';
import { useUIModal } from '../context/UIModalContext';

export default function ChainLaunchModal({ isOpen, onClose, templates = [], profiles = [], settings = {}, onLaunch }) {
  const { showAlert } = useUIModal();
  const [selected, setSelected] = useState({}); // { [templateId]: boolean }
  const [counts, setCounts] = useState({}); // { [templateId]: number }

  if (!isOpen) return null;

  const handleToggle = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCountChange = (id, val) => {
    setCounts(prev => ({ ...prev, [id]: val }));
  };

  const handleLaunchClick = () => {
    const batch = templates
      .filter(t => selected[t.id])
      .map(t => ({
        templateId: t.id,
        count: counts[t.id] || 1
      }));

    if (batch.length === 0) {
      showAlert('Por favor selecciona al menos una plantilla para iniciar la generación en cadena.', 'Selección Requerida', 'warning');
      return;
    }

    onLaunch({ batch });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#0b0f19] border border-gray-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Generación en Cadena (Lotes)</h3>
              <p className="text-[10px] text-gray-400">Selecciona qué plantillas activar y cuántos videos generar de cada una.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-3 flex-grow custom-scrollbar">
          {templates.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">No hay plantillas guardadas disponibles.</p>
          ) : (
            templates.map(t => {
              const isChecked = !!selected[t.id];
              const count = counts[t.id] || 1;
              const profile = profiles.find(p => p.id === t.profileId) || profiles[0];

              return (
                <div 
                  key={t.id} 
                  onClick={() => handleToggle(t.id)}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 ${
                    isChecked 
                      ? 'bg-orange-500/10 border-orange-500' 
                      : 'bg-black/25 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by div onClick
                      className="w-4 h-4 rounded border-gray-800 text-orange-500 focus:ring-orange-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white truncate">{t.name}</h4>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">
                        Voz M: {t.maleVoice ? t.maleVoice.split('-').slice(2).join(' ') : 'Ninguna'} • Voz F: {t.femaleVoice ? t.femaleVoice.split('-').slice(2).join(' ') : 'Ninguna'}
                      </p>
                      {profile && (
                        <p className="text-[9px] text-orange-500 font-bold mt-0.5 truncate uppercase">
                          Perfil IA: {profile.name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Counter Input */}
                  <div 
                    className="w-20 shrink-0 flex flex-col items-end gap-1"
                    onClick={(e) => e.stopPropagation()} // Prevent toggling the checkbox when interacting with input
                  >
                    <label className="text-[8px] font-bold text-gray-500 uppercase">Videos</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={count}
                      onChange={(e) => handleCountChange(t.id, Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                      className="w-full bg-black/40 border border-gray-800 rounded-xl px-2 py-1.5 text-xs text-white font-bold text-center focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 bg-black/20 flex items-center justify-between gap-4">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-800 rounded-xl text-xs text-gray-400 hover:text-white hover:border-gray-700 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleLaunchClick}
            className="flex-1 max-w-[260px] bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white font-black py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-orange-600/10"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>INICIAR EN CADENA</span>
          </button>
        </div>
      </div>
    </div>
  );
}

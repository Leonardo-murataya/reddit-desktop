import React, { useState, useEffect } from 'react';
import { X, Link, Users, ChevronRight, Info } from 'lucide-react';
import { useUIModal } from '../context/UIModalContext';

/**
 * ProfileChainModal
 * Permite seleccionar perfiles y asignar cuántos videos generará cada uno,
 * en cadena secuencial: Perfil 1 → #1–N, Perfil 2 → #N+1–N+M, etc.
 *
 * Props:
 *   isOpen       - bool
 *   onClose      - fn()
 *   profiles     - array de perfiles disponibles
 *   templates    - array de plantillas disponibles
 *   onSave       - fn(chain) donde chain = [{ profileId, profileName, templateId, templateName, count }]
 *   initialChain - cadena previa (o null)
 */
export default function ProfileChainModal({ isOpen, onClose, profiles = [], templates = [], onSave, initialChain = null }) {
  const { showAlert } = useUIModal();
  // { [profileId]: boolean }
  const [selected, setSelected] = useState({});
  // { [profileId]: number }
  const [counts, setCounts] = useState({});
  // { [profileId]: string (templateId) }
  const [selectedTemplates, setSelectedTemplates] = useState({});

  // Helper inteligente para buscar la plantilla que mejor corresponde al perfil
  const getAutoTemplateForProfile = (profile) => {
    if (!profile || templates.length === 0) return null;
    // 1. Coincidencia directa por profileId
    const directMatch = templates.find(t => t.profileId === profile.id);
    if (directMatch) return directMatch;
    // 2. Coincidencia por nombre (ej. "Solo Otra Historia Más" vs "Solo Otra Historia Más (Importada)")
    const pName = (profile.name || '').toLowerCase().replace(/\(importado\)/g, '').trim();
    const nameMatch = templates.find(t => {
      const tName = (t.name || '').toLowerCase().replace(/\(importada\)/g, '').trim();
      return (pName.length > 3 && tName.includes(pName)) || (tName.length > 3 && pName.includes(tName));
    });
    if (nameMatch) return nameMatch;
    // 3. Fallback a la primera plantilla disponible
    return templates[0];
  };

  useEffect(() => {
    if (isOpen) {
      if (initialChain && Array.isArray(initialChain) && initialChain.length > 0) {
        const sel = {};
        const cnts = {};
        const tmpls = {};
        initialChain.forEach(item => {
          sel[item.profileId] = true;
          cnts[item.profileId] = item.count;
          if (item.templateId) {
            tmpls[item.profileId] = item.templateId;
          }
        });
        // Para los perfiles que no estaban en initialChain, precalcular su mejor plantilla
        profiles.forEach(p => {
          if (!tmpls[p.id]) {
            const autoTmpl = getAutoTemplateForProfile(p);
            if (autoTmpl) tmpls[p.id] = autoTmpl.id;
          }
        });
        setSelected(sel);
        setCounts(cnts);
        setSelectedTemplates(tmpls);
      } else {
        const sel = {};
        const cnts = {};
        const tmpls = {};
        profiles.forEach(p => {
          const autoTmpl = getAutoTemplateForProfile(p);
          if (autoTmpl) tmpls[p.id] = autoTmpl.id;
        });
        setSelected(sel);
        setCounts(cnts);
        setSelectedTemplates(tmpls);
      }
    }
  }, [isOpen, initialChain, profiles, templates]);

  if (!isOpen) return null;

  const handleToggle = (profileId) => {
    setSelected(prev => {
      const nextVal = !prev[profileId];
      // Si se activa y no tenía plantilla elegida, asegurar la auto-plantilla
      if (nextVal && !selectedTemplates[profileId]) {
        const prof = profiles.find(p => p.id === profileId);
        const autoT = getAutoTemplateForProfile(prof);
        if (autoT) {
          setSelectedTemplates(tPrev => ({ ...tPrev, [profileId]: autoT.id }));
        }
      }
      return { ...prev, [profileId]: nextVal };
    });
  };

  const handleCountChange = (profileId, val) => {
    const n = Math.max(1, Math.min(200, parseInt(val) || 1));
    setCounts(prev => ({ ...prev, [profileId]: n }));
  };

  const handleTemplateChange = (profileId, tmplId) => {
    setSelectedTemplates(prev => ({ ...prev, [profileId]: tmplId }));
  };

  const getTemplateForProfile = (profile) => {
    const chosenId = selectedTemplates[profile.id];
    if (chosenId) {
      const found = templates.find(t => t.id === chosenId);
      if (found) return found;
    }
    return getAutoTemplateForProfile(profile) || templates[0];
  };

  const handleSaveClick = () => {
    const chain = profiles
      .filter(p => selected[p.id])
      .map(p => {
        const tmpl = getTemplateForProfile(p);
        return {
          profileId: p.id,
          profileName: p.name,
          templateId: tmpl?.id || '',
          templateName: tmpl?.name || 'Sin plantilla',
          count: counts[p.id] || 1
        };
      });

    if (chain.length === 0) {
      showAlert('Por favor selecciona al menos un perfil para activar la cadena.', 'Selección Requerida', 'warning');
      return;
    }

    onSave(chain);
    onClose();
  };

  // Calcular numeración previa acumulada para preview
  let globalOffset = 1;
  const profileRanges = profiles
    .filter(p => selected[p.id])
    .map(p => {
      const count = counts[p.id] || 1;
      const from = globalOffset;
      const to = globalOffset + count - 1;
      globalOffset += count;
      return { profileId: p.id, from, to, count };
    });

  const getRange = (profileId) => profileRanges.find(r => r.profileId === profileId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#0b0f19] border border-border-dark rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="p-5 border-b border-border-dark bg-black/25 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary">
              <Link className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Cadena Secuencial de Perfiles</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Cada perfil procesa su bloque de videos en orden automático.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer bg-black/30 border border-border-dark/60 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-3 flex-grow custom-scrollbar bg-black/10">
          {profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <Users className="w-8 h-8 text-gray-600" />
              <p className="text-xs text-gray-500">No hay perfiles de IA configurados.<br/>Ve a Perfiles para crear uno.</p>
            </div>
          ) : (
            <>
              {/* Info banner */}
              <div className="bg-brand-primary/8 border border-brand-primary/20 rounded-2xl p-3.5 flex items-start gap-2.5">
                <Info className="w-3.5 h-3.5 text-brand-primary shrink-0 mt-0.5" />
                <p className="text-[10.5px] text-gray-400 leading-relaxed">
                  El sistema ejecutará los perfiles en el orden de la lista. Cada perfil usa automáticamente su plantilla asignada.
                </p>
              </div>

              {profiles.map((profile, pi) => {
                const isChecked = !!selected[profile.id];
                const count = counts[profile.id] || 1;
                const tmpl = getTemplateForProfile(profile);
                const range = getRange(profile.id);

                return (
                  <div
                    key={profile.id}
                    onClick={() => handleToggle(profile.id)}
                    className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                      isChecked
                        ? 'bg-brand-primary/10 border-brand-primary shadow-lg shadow-brand-primary/5 scale-[1.01]'
                        : 'bg-black/35 border-border-dark hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox + Orden */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-border-dark text-brand-primary focus:ring-brand-primary cursor-pointer shrink-0"
                        />
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                          isChecked ? 'bg-brand-primary/20 border-brand-primary/40 text-brand-primary' : 'bg-black/40 border-border-dark/50 text-gray-500'
                        }`}>
                          {pi + 1}
                        </span>
                      </div>

                      {/* Info del perfil */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black text-white truncate">{profile.name}</h4>
                          <span className="text-[9px] text-gray-500 font-mono shrink-0">({profile.model})</span>
                        </div>
                        {tmpl && (
                          <p className="text-[9px] text-brand-primary font-bold mt-0.5 truncate uppercase tracking-wide">
                            Plantilla: {tmpl.name}
                          </p>
                        )}
                        {isChecked && range && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[9px] font-black text-white bg-brand-primary/20 border border-brand-primary/30 px-2 py-0.5 rounded-full">
                              Videos #{range.from} &rarr; #{range.to}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Flecha de cadena */}
                      {isChecked && (
                        <ChevronRight className="w-4 h-4 text-brand-primary shrink-0" />
                      )}

                      {/* Counter input */}
                      <div
                        className="w-20 shrink-0 flex flex-col items-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="text-[8px] font-black text-gray-500 uppercase">Videos</label>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={count}
                          onChange={(e) => handleCountChange(profile.id, e.target.value)}
                          className="w-full bg-black/55 border border-border-dark rounded-xl px-2 py-1.5 text-xs text-white font-bold text-center focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer con resumen */}
        <div className="p-5 border-t border-border-dark bg-black/25 space-y-3">
          {profileRanges.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {profileRanges.map((r, i) => {
                const p = profiles.find(p => p.id === r.profileId);
                return (
                  <React.Fragment key={r.profileId}>
                    <span className="text-[9.5px] font-bold text-white bg-brand-primary/15 border border-brand-primary/25 px-2.5 py-1.5 rounded-xl shrink-0 whitespace-nowrap">
                      {p?.name} <span className="text-brand-primary">#{r.from}–#{r.to}</span>
                    </span>
                    {i < profileRanges.length - 1 && (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border-dark rounded-xl text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-colors cursor-pointer bg-black/20"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={profiles.length === 0}
              className="flex-1 max-w-[280px] bg-brand-primary hover:bg-brand-primary-hover active:scale-[0.98] disabled:opacity-50 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-brand-primary/20"
            >
              <Link className="w-3.5 h-3.5" />
              <span>
                ACTIVAR CADENA
                {profileRanges.length > 0 && ` (${profileRanges.reduce((a, r) => a + r.count, 0)} videos)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

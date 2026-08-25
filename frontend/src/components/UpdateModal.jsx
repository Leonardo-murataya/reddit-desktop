import React from 'react';
import { Sparkles, Download, Clock, ExternalLink, X, CheckCircle2, Package, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';

export default function UpdateModal({ updateInfo, onClose }) {
  if (!updateInfo) return null;

  const handleOpenRelease = () => {
    if (updateInfo.releaseUrl) {
      window.open(updateInfo.releaseUrl, '_blank');
    } else {
      window.open('https://github.com/Leonardo-murataya/reddit-desktop/releases', '_blank');
    }
  };

  const handleDownloadAsset = (url) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  const isUpToDate = !updateInfo.hasUpdate && !updateInfo.error && !updateInfo.loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-[#0b0f19] border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden text-gray-100 flex flex-col max-h-[90vh]">
        
        {/* 1. Header con Gradiente según el estado */}
        <div className={`relative p-6 border-b border-white/10 ${
          updateInfo.hasUpdate 
            ? 'bg-gradient-to-r from-purple-950/80 via-indigo-950/80 to-purple-950/80' 
            : isUpToDate
            ? 'bg-gradient-to-r from-emerald-950/80 via-teal-950/80 to-emerald-950/80'
            : 'bg-gradient-to-r from-gray-900 via-gray-950 to-gray-900'
        }`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
            title="Cerrar"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl border ${
              updateInfo.hasUpdate
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-lg shadow-purple-500/20'
                : isUpToDate
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-500/20'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              {updateInfo.loading ? (
                <Loader2 size={24} className="animate-spin text-purple-400" />
              ) : updateInfo.hasUpdate ? (
                <Sparkles size={24} className="animate-pulse" />
              ) : isUpToDate ? (
                <ShieldCheck size={24} />
              ) : (
                <AlertTriangle size={24} />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full border ${
                  updateInfo.hasUpdate
                    ? 'bg-purple-500/30 text-purple-300 border-purple-400/40'
                    : isUpToDate
                    ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/40'
                    : 'bg-amber-500/30 text-amber-300 border-amber-400/40'
                }`}>
                  {updateInfo.loading
                    ? 'Verificando GitHub...'
                    : updateInfo.hasUpdate
                    ? 'Actualización Disponible'
                    : isUpToDate
                    ? 'Software al Día'
                    : 'Aviso del Sistema'}
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-1 truncate">
                {updateInfo.loading
                  ? 'Buscando nuevas versiones...'
                  : updateInfo.hasUpdate
                  ? (updateInfo.releaseTitle || `Versión v${updateInfo.latestVersion}`)
                  : isUpToDate
                  ? '¡Tienes la versión más reciente!'
                  : 'Estado de Actualizaciones'}
              </h3>
            </div>
          </div>
        </div>

        {/* 2. Cuerpo del Modal */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Caso A: Hay Actualización */}
          {updateInfo.hasUpdate && (
            <>
              {/* Comparador de versiones */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="text-left">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tu Versión</div>
                  <div className="text-sm font-black text-gray-300">v{updateInfo.currentVersion}</div>
                </div>
                <div className="text-purple-400 font-black text-xl">➔</div>
                <div className="text-right">
                  <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Nueva Versión</div>
                  <div className="text-sm font-black text-emerald-400">v{updateInfo.latestVersion} ✨</div>
                </div>
              </div>

              {/* Notas del Release / Novedades */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">
                  Novedades de la actualización:
                </h4>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-gray-300 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto custom-scrollbar font-medium">
                  {updateInfo.releaseNotes || 'Mejoras de rendimiento, corrección de errores y nuevas funciones.'}
                </div>
              </div>

              {/* Archivos descargables si están disponibles */}
              {updateInfo.assets && updateInfo.assets.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">
                    Descarga Directa de Instalador:
                  </h4>
                  <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                    {updateInfo.assets.map((asset, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <Package size={16} className="text-purple-400 shrink-0" />
                          <span className="text-xs font-bold text-gray-200 truncate" title={asset.name}>
                            {asset.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDownloadAsset(asset.downloadUrl)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm shadow-purple-600/30"
                        >
                          <Download size={13} />
                          <span>Descargar</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Caso B: Ya está al día (Todo actualizado) */}
          {isUpToDate && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/10">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  Reddit Video Generator v{updateInfo.currentVersion || '1.0.0'}
                </h4>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Estás disfrutando de la versión más reciente. Tu suite de escritorio cuenta con todas las optimizaciones de renderizado GPU y funciones activas.
                </p>
              </div>
            </div>
          )}

          {/* Caso C: Error o Aviso */}
          {updateInfo.error && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                <span>Información de Conexión</span>
              </div>
              <p className="leading-relaxed text-gray-300">
                {updateInfo.error}
              </p>
            </div>
          )}
        </div>

        {/* 3. Botones de Acción */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex items-center justify-between gap-3">
          {updateInfo.hasUpdate ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/5"
              >
                <Clock size={14} />
                <span>Recordar después</span>
              </button>
              
              <button
                onClick={handleOpenRelease}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer active:scale-95"
              >
                <ExternalLink size={14} />
                <span>Ver en GitHub</span>
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/10"
            >
              <span>Aceptar</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

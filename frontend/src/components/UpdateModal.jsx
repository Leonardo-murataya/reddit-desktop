import React from 'react';
import { Sparkles, Download, Clock, ExternalLink, X, CheckCircle, Package } from 'lucide-react';

export default function UpdateModal({ updateInfo, onClose }) {
  if (!updateInfo || !updateInfo.hasUpdate) return null;

  const handleOpenRelease = () => {
    if (updateInfo.releaseUrl) {
      window.open(updateInfo.releaseUrl, '_blank');
    }
  };

  const handleDownloadAsset = (url) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-gray-900 border border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden text-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header con gradiente estético */}
        <div className="relative bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-purple-900/60 p-6 border-b border-gray-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Cerrar"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Sparkles size={26} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-black uppercase tracking-wider bg-purple-500/30 text-purple-300 border border-purple-400/30 rounded-full">
                  Actualización Disponible
                </span>
              </div>
              <h3 className="text-xl font-black text-white mt-1">
                {updateInfo.releaseTitle || `Versión v${updateInfo.latestVersion}`}
              </h3>
            </div>
          </div>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Comparador de versiones */}
          <div className="flex items-center justify-between p-3.5 bg-gray-800/80 rounded-xl border border-gray-700/60">
            <div className="text-left">
              <div className="text-xs text-gray-400">Versión actual</div>
              <div className="text-sm font-bold text-gray-300">v{updateInfo.currentVersion}</div>
            </div>
            <div className="text-purple-400 font-bold text-lg">➜</div>
            <div className="text-right">
              <div className="text-xs text-purple-400 font-semibold">Nueva versión</div>
              <div className="text-sm font-bold text-green-400">v{updateInfo.latestVersion} ✨</div>
            </div>
          </div>

          {/* Notas del Release / Novedades */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Novedades y Cambios:
            </h4>
            <div className="bg-gray-950/70 border border-gray-800 rounded-xl p-3.5 text-xs text-gray-300 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
              {updateInfo.releaseNotes || 'Mejoras de rendimiento, estabilidad y nuevas funciones.'}
            </div>
          </div>

          {/* Archivos descargables si están disponibles */}
          {updateInfo.assets && updateInfo.assets.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Archivos Disponibles:
              </h4>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {updateInfo.assets.map((asset, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-gray-800/40 hover:bg-gray-800/80 border border-gray-700/40 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Package size={16} className="text-purple-400 shrink-0" />
                      <span className="text-xs font-medium text-gray-200 truncate" title={asset.name}>
                        {asset.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDownloadAsset(asset.downloadUrl)}
                      className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white rounded text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Download size={13} />
                      <span>Descargar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="p-4 bg-gray-950/80 border-t border-gray-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            <Clock size={15} />
            <span>Recordar más tarde</span>
          </button>
          
          <button
            onClick={handleOpenRelease}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all active:scale-95"
          >
            <ExternalLink size={15} />
            <span>Actualizar Ahora</span>
          </button>
        </div>

      </div>
    </div>
  );
}

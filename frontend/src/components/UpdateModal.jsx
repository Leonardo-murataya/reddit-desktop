import React, { useState } from 'react';
import { Sparkles, Download, Clock, X, CheckCircle2, Package, AlertTriangle, Loader2, ShieldCheck, Zap, Check, ExternalLink, ArrowRight, Ban } from 'lucide-react';

export default function UpdateModal({ updateInfo, onClose }) {
  const [downloadingAsset, setDownloadingAsset] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [installerLaunched, setInstallerLaunched] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  if (!updateInfo) return null;

  const defaultToken = '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';
  const token = updateInfo.githubToken || defaultToken;
  const isUpToDate = !updateInfo.hasUpdate && !updateInfo.error && !updateInfo.loading;
  const primaryAsset = updateInfo.assets && updateInfo.assets.length > 0 ? updateInfo.assets[0] : null;

  // 1. Manejador de "Actualizar ahora" (Estilo OBS Studio: Descarga e inicio directo del instalador)
  const handleUpdateNow = async (asset = null) => {
    const targetAsset = asset || primaryAsset || updateInfo.assets?.[0];
    const assetName = targetAsset?.name || 'Reddit_Video_Generator_1.0.1_Setup.exe';
    
    setDownloadingAsset(assetName);
    setDownloadProgress(35);
    setDownloadStatus('Descargando e iniciando instalador en Windows...');
    setDownloadSuccess(false);
    setInstallerLaunched(false);
    setDownloadError('');

    try {
      const launchRes = await fetch('/api/updates/launch-installer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: targetAsset?.id,
          filename: assetName,
          downloadUrl: targetAsset?.downloadUrl || targetAsset?.apiUrl
        })
      });

      if (launchRes.ok) {
        const launchData = await launchRes.json();
        if (launchData.executed) {
          setDownloadProgress(100);
          setDownloadSuccess(true);
          setInstallerLaunched(true);
          setDownloadStatus('¡Instalador ejecutado con éxito!');
          setDownloadingAsset(null);
          return;
        }
      } else {
        const errJson = await launchRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${launchRes.status} al descargar el instalador.`);
      }
    } catch (err) {
      console.error('Error durante la actualización:', err);
      setDownloadError(err.message || 'No se pudo descargar automáticamente el instalador. Verifica tu conexión a internet.');
      setDownloadingAsset(null);
    }
  };

  // 2. Manejador de "Omitir esta versión" (Estilo OBS Studio)
  const handleSkipVersion = async () => {
    try {
      if (updateInfo.latestVersion) {
        await fetch('/api/updates/skip-version', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: updateInfo.latestVersion })
        });
      }
    } catch (e) {
      console.warn('No se pudo guardar la versión omitida en settings:', e);
    }
    onClose();
  };

  // Formateador visual sencillo para notas de release de GitHub
  const formatReleaseNotes = (notes) => {
    if (!notes) return 'Mejoras de rendimiento, corrección de errores y nuevas funciones optimizadas.';
    return notes;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-xl bg-[#0b0f19] border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden text-gray-100 flex flex-col max-h-[90vh]">
        
        {/* 1. Header con Estilo OBS Studio */}
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
            title="Cerrar ventana"
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
                    ? 'Consultando Servidor...'
                    : updateInfo.hasUpdate
                    ? 'Actualización de Software'
                    : isUpToDate
                    ? 'Software al Día'
                    : 'Aviso de Conexión'}
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-1 truncate">
                {updateInfo.loading
                  ? 'Buscando actualizaciones...'
                  : updateInfo.hasUpdate
                  ? `Actualización Disponible: v${updateInfo.latestVersion}`
                  : isUpToDate
                  ? '¡Tienes la versión más reciente!'
                  : 'Estado de Actualizaciones'}
              </h3>
            </div>
          </div>
        </div>

        {/* 2. Cuerpo del Modal */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Caso A: Hay Actualización Disponible (Estilo OBS Studio) */}
          {updateInfo.hasUpdate && (
            <>
              {/* Comparador de versiones destacado */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="text-left">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Versión Instalada</div>
                  <div className="text-sm font-black text-gray-300">v{updateInfo.currentVersion || '1.0.0'}</div>
                </div>
                <ArrowRight className="text-purple-400 w-5 h-5 shrink-0" />
                <div className="text-right">
                  <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Nueva Versión</div>
                  <div className="text-sm font-black text-emerald-400">v{updateInfo.latestVersion} ✨</div>
                </div>
              </div>

              {/* Registro de Cambios / Release Notes (OBS Box) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                    Novedades y Registro de Cambios:
                  </h4>
                </div>
                <div className="bg-black/50 border border-white/10 rounded-2xl p-4 text-xs text-gray-300 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto custom-scrollbar font-medium font-sans">
                  {formatReleaseNotes(updateInfo.releaseNotes)}
                </div>
              </div>

              {/* Barra de Progreso de Descarga en Vivo */}
              {downloadingAsset && (
                <div className="p-4 bg-purple-950/40 border border-purple-500/40 rounded-2xl space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-200">
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-purple-400" />
                      <span>{downloadStatus}</span>
                    </span>
                    <span className="font-mono text-purple-300 font-black">{downloadProgress}%</span>
                  </div>
                  <div className="w-full bg-black/60 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 h-full transition-all duration-200 rounded-full"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Notificación de Instalador Iniciado en Windows */}
              {installerLaunched && (
                <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn font-bold">
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
                  <span>¡Instalador ejecutado con éxito! Sigue los pasos en pantalla para completar la actualización.</span>
                </div>
              )}

              {/* Mensaje de Éxito al descargar archivo */}
              {downloadSuccess && !installerLaunched && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn font-bold">
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
                  <span>¡Instalador descargado con éxito en tu carpeta de Descargas! Ejecútalo para actualizar.</span>
                </div>
              )}

              {/* Mensaje de Error */}
              {downloadError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2.5 animate-fadeIn">
                  <AlertTriangle size={18} className="shrink-0 text-rose-400" />
                  <span>{downloadError}</span>
                </div>
              )}
            </>
          )}

          {/* Caso B: Ya está al día (Todo actualizado) */}
          {isUpToDate && (
            <div className="space-y-4 text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/10">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-base font-black text-white uppercase tracking-wider">
                  Reddit Video Generator v{updateInfo.currentVersion || '1.0.0'}
                </h4>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Estás utilizando la versión más reciente disponible. Tu software cuenta con todas las funciones activas y soporte acelerado por GPU.
                </p>
              </div>
            </div>
          )}

          {/* Caso C: Error o Aviso de Conexión */}
          {updateInfo.error && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                <span>Información del Servidor</span>
              </div>
              <p className="leading-relaxed text-gray-300">
                {updateInfo.error}
              </p>
            </div>
          )}
        </div>

        {/* 3. Botones de Acción (Estilo Clásico OBS Studio: Actualizar ahora | Recordar más tarde | Omitir versión) */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
          {updateInfo.hasUpdate ? (
            <>
              {/* Botón 1: Omitir esta versión */}
              <button
                type="button"
                onClick={handleSkipVersion}
                className="px-3 py-2 text-gray-500 hover:text-gray-300 rounded-xl text-[11px] font-bold transition-all cursor-pointer hover:bg-white/5 active:scale-95 flex items-center gap-1.5"
                title="No volver a notificarme de esta versión en el arranque"
              >
                <Ban size={12} />
                <span>Omitir esta versión</span>
              </button>

              <div className="flex items-center gap-2 ml-auto">
                {/* Botón 2: Recordar más tarde */}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/5 active:scale-95"
                >
                  <Clock size={13} />
                  <span>Recordar más tarde</span>
                </button>
                
                {/* Botón 3: Actualizar ahora */}
                <button
                  type="button"
                  disabled={!!downloadingAsset}
                  onClick={() => handleUpdateNow(primaryAsset)}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer active:scale-95"
                >
                  {downloadingAsset ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Actualizando...</span>
                    </>
                  ) : installerLaunched ? (
                    <>
                      <Check size={13} />
                      <span>Instalador Listo</span>
                    </>
                  ) : (
                    <>
                      <Zap size={13} className="fill-current" />
                      <span>Actualizar ahora</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/10 active:scale-95"
            >
              <span>Aceptar</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

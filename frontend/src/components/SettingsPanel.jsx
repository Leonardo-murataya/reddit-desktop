import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, HardDrive, Cpu, Film, CheckCircle2, FileVideo, FileText, Sparkles, RefreshCw } from 'lucide-react';

export default function SettingsPanel({ 
  settings, 
  gpuInfo, 
  backgroundStatus, 
  profiles = [], 
  selectedProfileId = 'global',
  onProfileIdChange,
  onSave, 
  onSaveProfile, 
  refreshBackground,
  onGpuUpdate,
  onCheckUpdate
}) {
  const setSelectedProfileId = onProfileIdChange || (() => {});
  const [backgroundFolder, setBackgroundFolder] = useState('');
  const [exportFolder, setExportFolder] = useState('');
  const [renderEngine, setRenderEngine] = useState('auto');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [cleanTxtReport, setCleanTxtReport] = useState(false);
  const [hashtags, setHashtags] = useState('');
  const [reportFolderSameAsVideo, setReportFolderSameAsVideo] = useState(true);
  const [reportFolder, setReportFolder] = useState('');
  const [autoCheckUpdate, setAutoCheckUpdate] = useState(true);
  const [success, setSuccess] = useState('');

  const [isLoaded, setIsLoaded] = useState(false);

  // Actualizar previsualización de hardware en vivo
  useEffect(() => {
    if (!isLoaded) return;
    
    const updatePreviewGpu = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (renderEngine) queryParams.append('renderEngine', renderEngine);
        if (selectedProfileId) queryParams.append('profileId', selectedProfileId);
        
        const res = await fetch(`/api/detect-hardware?${queryParams.toString()}`);
        const data = await res.json();
        if (onGpuUpdate) {
          onGpuUpdate(data);
        }
      } catch (err) {
        console.error('Error actualizando previsualización de GPU:', err);
      }
    };
    
    const timer = setTimeout(updatePreviewGpu, 250);
    return () => clearTimeout(timer);
  }, [renderEngine, selectedProfileId, isLoaded, onGpuUpdate]);

  // Carga inicial de Ajustes Globales una sola vez
  useEffect(() => {
    if (settings && !isLoaded) {
      setBackgroundFolder(settings.backgroundFolder || '');
      setExportFolder(settings.exportFolder || '');
      setRenderEngine(settings.renderEngine || 'auto');
      setSelectedFiles(settings.selectedFiles || []);
      setCleanTxtReport(settings.cleanTxtReport || false);
      setHashtags(settings.hashtags || '');
      setReportFolderSameAsVideo(settings.reportFolderSameAsVideo !== false);
      setReportFolder(settings.reportFolder || '');
      setIsLoaded(true);
    }
  }, [settings, isLoaded]);

  // Cargar carpetas correspondientes al cambiar de perfil / canal seleccionado
  useEffect(() => {
    if (!isLoaded) return;

    let folderToRefresh = '';
    let profileToRefresh = 'global';

    if (selectedProfileId === 'global') {
      if (settings) {
        setBackgroundFolder(settings.backgroundFolder || '');
        setExportFolder(settings.exportFolder || '');
        setRenderEngine(settings.renderEngine || 'auto');
        setSelectedFiles(settings.selectedFiles || []);
        setCleanTxtReport(settings.cleanTxtReport || false);
        setHashtags(settings.hashtags || '');
        setReportFolderSameAsVideo(settings.reportFolderSameAsVideo !== false);
        setReportFolder(settings.reportFolder || '');
        setAutoCheckUpdate(settings.autoCheckUpdate !== false);
        folderToRefresh = settings.backgroundFolder || '';
      }
    } else {
      const activeProfile = profiles.find(p => p.id === selectedProfileId);
      if (activeProfile) {
        setBackgroundFolder(activeProfile.backgroundFolder || '');
        setExportFolder(activeProfile.exportFolder || '');
        setRenderEngine(activeProfile.renderEngine || 'global');
        setSelectedFiles(activeProfile.selectedFiles || []);
        setCleanTxtReport(activeProfile.cleanTxtReport || false);
        setHashtags(activeProfile.hashtags || '');
        setReportFolderSameAsVideo(activeProfile.reportFolderSameAsVideo !== false);
        setReportFolder(activeProfile.reportFolder || '');
        folderToRefresh = activeProfile.backgroundFolder || '';
        profileToRefresh = activeProfile.id;
      } else {
        setBackgroundFolder('');
        setExportFolder('');
        setRenderEngine('global');
        setSelectedFiles([]);
        setCleanTxtReport(false);
        setHashtags('');
        setReportFolderSameAsVideo(true);
        setReportFolder('');
      }
    }

    if (folderToRefresh) {
      refreshBackground(folderToRefresh, profileToRefresh);
    }
  }, [selectedProfileId, isLoaded]);

  const handlePickFolder = async (target) => {
    try {
      const res = await fetch('/api/dialog/folder');
      const data = await res.json();
      if (data.path) {
        if (target === 'background') {
          setBackgroundFolder(data.path);
          setSelectedFiles([]); // Limpiar selección manual de archivos al elegir carpeta
        } else if (target === 'report') {
          setReportFolder(data.path);
        } else {
          setExportFolder(data.path);
        }
      }
    } catch (err) {
      console.error('Error al abrir selector nativo de carpeta:', err);
    }
  };

  const handlePickFiles = async () => {
    try {
      const res = await fetch('/api/dialog/files');
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        setSelectedFiles(data.files);
        // Rellenar automáticamente la carpeta padre en el input visual
        const lastSlash = data.files[0].lastIndexOf('\\');
        if (lastSlash !== -1) {
          const parentDir = data.files[0].substring(0, lastSlash);
          setBackgroundFolder(parentDir);
        }
      }
    } catch (err) {
      console.error('Error al abrir selector nativo de archivos:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    
    if (selectedProfileId === 'global') {
      const res = await onSave({
        backgroundFolder,
        exportFolder,
        renderEngine,
        selectedFiles,
        cleanTxtReport,
        hashtags,
        reportFolderSameAsVideo,
        reportFolder,
        autoCheckUpdate
      });
      if (res && res.error) {
        showToast(`Error al guardar ajustes: ${res.error}`, 'error');
        return;
      }
      showToast('Ajustes y rutas globales guardados exitosamente.', 'success');
      setSuccess('Ajustes y rutas globales guardados exitosamente.');
      refreshBackground(backgroundFolder, 'global'); // Escanear biblioteca
    } else {
      const activeProfile = profiles.find(p => p.id === selectedProfileId);
      if (activeProfile) {
        const res = await onSaveProfile({
          ...activeProfile,
          backgroundFolder,
          exportFolder,
          renderEngine,
          selectedFiles,
          cleanTxtReport,
          hashtags,
          reportFolderSameAsVideo,
          reportFolder
        });
        if (res && res.error) {
          showToast(`Error al guardar rutas del canal: ${res.error}`, 'error');
          return;
        }
        showToast(`Rutas del canal "${activeProfile.name}" guardadas exitosamente.`, 'success');
        setSuccess(`Rutas del canal "${activeProfile.name}" guardadas exitosamente.`);
        refreshBackground(backgroundFolder, activeProfile.id); // Escanear biblioteca del perfil
      }
    }
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h2 className="text-2xl font-black text-white">AJUSTES DEL EDITOR DE VIDEO</h2>
        <p className="text-xs text-gray-400">Vincula tus directorios locales, elige videos específicos y fuerza de manera manual el codificador de hardware para FFmpeg.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Panel de Configuración de Rutas (3/5) */}
        <div className="lg:col-span-3 space-y-6">
          <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 space-y-6">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
              <HardDrive className="w-4 h-4 text-brand-primary" />
              <span>Directorios Locales de Trabajo</span>
            </h3>

            {/* Selector de Perfil / Canal */}
            <div className="space-y-1 bg-black/30 p-3.5 rounded-2xl border border-border-dark">
              <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Configurar Rutas Para</label>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full bg-black/50 border border-border-dark rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary font-bold"
              >
                <option value="global">★ Ajustes de Ruta Globales (Por Defecto)</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>Canal / Perfil de IA: {p.name}</option>
                ))}
              </select>
              <span className="text-[9px] text-gray-500 block leading-tight mt-1">
                Puedes definir carpetas de videos de fondo y exportación específicas por cada canal/perfil de IA para no mezclar contenido y evitar copyright. Si usas los Ajustes Globales, se usarán por defecto para todos los perfiles que dejes en blanco.
              </span>
            </div>

            {/* Carpeta de Videos de Fondo */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-400 uppercase">
                {selectedProfileId === 'global' ? 'Videos de Fondo (Global)' : 'Videos de Fondo (Canal)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={backgroundFolder}
                  onChange={(e) => setBackgroundFolder(e.target.value)}
                  placeholder={selectedProfileId === 'global' ? "Ningún directorio seleccionado..." : "Usar carpeta global de Ajustes..."}
                  className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary font-mono truncate"
                />
                
                {/* Botón de Archivos */}
                <button
                  type="button"
                  onClick={handlePickFiles}
                  title="Seleccionar Archivos de Video Específicos"
                  className="bg-gray-800 hover:bg-gray-700 text-white font-bold p-3 rounded-xl border border-border-dark cursor-pointer transition-all duration-200 flex items-center gap-1.5 text-xs shrink-0"
                >
                  <FileVideo className="w-5 h-5 text-brand-primary shrink-0" />
                  <span className="hidden sm:inline">Elegir Archivos</span>
                </button>
              </div>
              
              {selectedFiles.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-[10px] text-amber-400 font-bold block">
                    ★ Usando {selectedFiles.length} videos específicos seleccionados manualmente.
                  </span>
                  
                  <div className="bg-black/40 border border-border-dark rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider mb-1">Archivos Seleccionados:</span>
                    {selectedFiles.map((file, idx) => {
                      const filename = file.split('\\').pop().split('/').pop();
                      return (
                        <div key={idx} className="flex justify-between items-center text-[10px] text-gray-300 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                          <span className="truncate flex-1 pr-2" title={file}>
                            {idx + 1}. {filename}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-300 font-bold px-1 text-xs shrink-0 cursor-pointer"
                            title="Eliminar de la selección"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-gray-500 block">
                  Haz clic en "Elegir Archivos" para seleccionar los videos de fondo (.mp4, .mov) que se usarán secuencialmente.
                </span>
              )}
            </div>

            {/* Carpeta de Exportación */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-400 uppercase">
                {selectedProfileId === 'global' ? 'Carpeta de Salida de Videos (Global)' : 'Carpeta de Salida de Videos (Canal)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={exportFolder}
                  onChange={(e) => setExportFolder(e.target.value)}
                  placeholder={selectedProfileId === 'global' ? "Ningún directorio de salida seleccionado..." : "Usar carpeta global de Ajustes..."}
                  className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary font-mono truncate"
                />
                
                <button
                  type="button"
                  onClick={() => handlePickFolder('export')}
                  className="bg-gray-800 hover:bg-gray-700 text-white font-bold p-3 rounded-xl border border-border-dark cursor-pointer transition-all duration-200"
                >
                  <FolderOpen className="w-5 h-5 text-brand-primary" />
                </button>
              </div>
              <span className="text-[10px] text-gray-500 block">
                Ruta local donde se exportarán tus videos listos. Se guardarán en orden con el nombre de la historia generada.
              </span>
            </div>

            {/* Carpeta de Exportación de Reportes TXT */}
            <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-border-dark">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reportFolderSameAsVideo"
                  checked={reportFolderSameAsVideo}
                  onChange={(e) => setReportFolderSameAsVideo(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                />
                <label htmlFor="reportFolderSameAsVideo" className="text-xs font-bold text-gray-300 cursor-pointer select-none">
                  Guardar reporte consolidado (.txt) en la misma carpeta que los videos
                </label>
              </div>

              {!reportFolderSameAsVideo && (
                <div className="space-y-2 pt-2 border-t border-border-dark/50">
                  <label className="block text-[11px] font-bold text-gray-400 uppercase">
                    {selectedProfileId === 'global' ? 'Carpeta de Salida de Reportes TXT (Global)' : 'Carpeta de Salida de Reportes TXT (Canal)'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={reportFolder}
                      onChange={(e) => setReportFolder(e.target.value)}
                      placeholder={selectedProfileId === 'global' ? "Misma carpeta que los videos..." : "Usar carpeta global de Reportes..."}
                      className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary font-mono truncate"
                    />
                    
                    <button
                      type="button"
                      onClick={() => handlePickFolder('report')}
                      className="bg-gray-800 hover:bg-gray-700 text-white font-bold p-3 rounded-xl border border-border-dark cursor-pointer transition-all duration-200"
                    >
                      <FolderOpen className="w-5 h-5 text-brand-primary" />
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-500 block leading-tight">
                    Ruta local personalizada donde se guardará tu reporte batch consolidado `.txt`.
                  </span>
                </div>
              )}
            </div>

            {/* Forzar Renderizador GPU */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-400 uppercase">Codificador de Renderizado (Manual GPU/CPU Lock)</label>
              <select
                value={renderEngine}
                onChange={(e) => setRenderEngine(e.target.value)}
                className="w-full bg-black/40 border border-border-dark rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-brand-primary font-semibold"
              >
                {selectedProfileId !== 'global' && (
                  <option value="global">Usar Ajuste Global de Renderizado</option>
                )}
                <option value="auto">Auto-Detectar Gráfica Activa (Recomendado)</option>
                
                {/* Listar gráficas específicas detectadas en el sistema */}
                {gpuInfo?.allGpus && gpuInfo.allGpus.map((gpuName, idx) => (
                  <option key={idx} value={`gpu:${gpuName}`}>
                    Forzar GPU: {gpuName}
                  </option>
                ))}

                <option value="h264_nvenc">NVIDIA NVENC (Forzar Genérico NVIDIA)</option>
                <option value="h264_amf">AMD AMF (Forzar Genérico AMD/Radeon)</option>
                <option value="h264_qsv">Intel QuickSync (Forzar Genérico Intel QSV)</option>
                <option value="libx264">CPU Standard (Sin GPU - Más compatible, lento)</option>
              </select>
              <span className="text-[10px] text-gray-500 block">
                Elige "Auto-Detectar" para que el sistema elija la mejor opción, selecciona una tarjeta gráfica específica detectada en tu PC, o fuerza un codificador genérico específico si es necesario.
              </span>
            </div>

            {/* Configuración de Publicación (TXT) */}
            <div className="space-y-4 border-t border-border-dark pt-4">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-primary" />
                <span>Configuración de Publicación (TXT)</span>
              </h4>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase">Hashtags personalizados</label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="Ej. #chisme #reddit #historias #viral"
                  className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary font-semibold"
                />
                <span className="text-[10px] text-gray-500 block leading-tight">
                  Define los hashtags separados por espacios que se anexarán al final del archivo de texto detallado de cada video.
                </span>
              </div>
            </div>



            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{success}</span>
              </div>
            )}

            {/* Acciones */}
            <div className="flex justify-end pt-4 border-t border-border-dark">
              <button
                type="submit"
                className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-hover active:scale-[0.98] text-white font-extrabold px-6 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-brand-primary/20"
              >
                <Save className="w-4 h-4 fill-current" />
                <span>Guardar Ajustes de Ruta</span>
              </button>
            </div>

          </form>
        </div>

        {/* Panel de Hardware y Biblioteca (2/5) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Tarjeta de Gráfica */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
              <Cpu className="w-4 h-4 text-brand-primary" />
              <span>Especificación de Codificación GPU</span>
            </h3>

            <div className="space-y-3">
              <div className="bg-black/40 rounded-xl p-3 border border-border-dark space-y-2">
                <span className="text-[10px] text-gray-400 font-bold block uppercase">Tarjetas Gráficas Detectadas ({gpuInfo?.allGpus?.length || 0})</span>
                {gpuInfo?.allGpus && gpuInfo.allGpus.length > 0 ? (
                  <ul className="list-disc list-inside text-xs text-white space-y-1 font-bold">
                    {gpuInfo.allGpus.map((gpu, idx) => (
                      <li key={idx} className="truncate">{gpu}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs font-black text-white">{gpuInfo?.gpuName || 'CPU Standard'}</span>
                )}
              </div>

              <div className="bg-black/40 rounded-xl p-3 border border-border-dark">
                <span className="text-[10px] text-gray-400 font-bold block">MOTOR DE ENCODE ACTIVO</span>
                <span className="text-xs font-mono font-bold text-brand-primary">
                  {gpuInfo?.codec || 'libx264'} ({renderEngine === 'global' ? 'Global' : renderEngine})
                </span>
              </div>

              <p className="text-[10px] text-gray-500 leading-relaxed">
                {gpuInfo?.description || 'Cargando detalles del motor de renderizado...'}
              </p>
            </div>
          </div>

          {/* Estado biblioteca */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
              <Film className="w-4 h-4 text-brand-primary" />
              <span>Biblioteca de Fondos Actual</span>
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Archivos Cargados:</span>
                <span className="font-bold text-white">
                  {selectedFiles.length > 0 ? `${selectedFiles.length} específicos` : `${backgroundStatus?.count || 0} de carpeta`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Duración Total de Fondos:</span>
                <span className="font-bold text-white">
                  {backgroundStatus?.totalDuration ? `${Math.round(backgroundStatus.totalDuration / 60)} min` : '0 min'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Playhead Virtual actual:</span>
                <span className="font-mono text-brand-primary font-bold">
                  v_{backgroundStatus.playhead?.currentVideoIndex || 0} ({backgroundStatus.playhead?.currentOffset || 0}s)
                </span>
              </div>
              <p className="text-[9px] text-gray-500 mt-2">
                * El playhead virtual se desliza hacia adelante con cada video generado para lograr un fondo de corrido, simulando un gameplay continuo de fondo.
              </p>
            </div>
          </div>

          {/* Actualizaciones de Software (Estilo OBS Studio) */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between border-b border-border-dark pb-2">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Actualizaciones de Software</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-gray-400">v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}</span>
            </h3>

            <div className="space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer bg-black/40 p-3 rounded-xl border border-border-dark hover:border-purple-500/30 transition-all">
                <input
                  type="checkbox"
                  checked={autoCheckUpdate}
                  onChange={(e) => setAutoCheckUpdate(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-purple-600 bg-gray-900 border-gray-700 focus:ring-0 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-200 block">Comprobar actualizaciones al iniciar</span>
                  <span className="text-[10px] text-gray-400 block leading-tight">
                    Busca nuevas versiones en segundo plano de manera silenciosa (estilo OBS Studio).
                  </span>
                </div>
              </label>

              {onCheckUpdate && (
                <button
                  type="button"
                  onClick={onCheckUpdate}
                  className="w-full py-2.5 px-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Comprobar actualizaciones ahora</span>
                </button>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

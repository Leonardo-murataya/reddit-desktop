import React, { useState, useEffect, useRef } from 'react';
import { 
  Loader2, 
  Play, 
  Pause, 
  X, 
  ChevronUp, 
  ChevronDown, 
  ExternalLink, 
  Clock, 
  Film, 
  AlertTriangle, 
  Terminal, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';

const formatTime = (seconds) => {
  if (seconds === undefined || seconds === null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s} min`;
};

// Clasificador de badges para logs en miniatura
const parseLogTag = (line) => {
  const text = line.toLowerCase();
  if (text.includes('error') || text.includes('falló') || text.includes('❌')) {
    return { tag: 'ERROR', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  }
  if (text.includes('completado') || text.includes('exitosamente') || text.includes('🎉') || text.includes('100%')) {
    return { tag: 'ÉXITO', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  }
  if (text.includes('ffmpeg') || text.includes('render') || text.includes('gpu') || text.includes('video')) {
    return { tag: 'RENDER', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
  }
  if (text.includes('tts') || text.includes('audio') || text.includes('voz') || text.includes('edge')) {
    return { tag: 'AUDIO', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' };
  }
  if (text.includes('subtítulo') || text.includes('srt') || text.includes('transcri')) {
    return { tag: 'SRT', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
  }
  if (text.includes('ia') || text.includes('historia') || text.includes('prompt') || text.includes('gemini')) {
    return { tag: 'IA', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
  }
  return { tag: 'INFO', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
};

export default function FloatingProgressDock({
  activeJob,
  logs = [],
  onNavigateToDashboard,
  onPause,
  onResume,
  onCancel,
  isPausing = false,
  isResuming = false,
  isCancelling = false
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const miniLogsEndRef = useRef(null);

  useEffect(() => {
    if (isExpanded && miniLogsEndRef.current) {
      miniLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded]);

  if (!activeJob) return null;

  const progressPercent = activeJob.progress || 0;
  const currentVideo = activeJob.currentVideoIndex || 1;
  const totalVideos = activeJob.totalCount || 1;
  const isPaused = activeJob.isPaused;
  const currentStep = activeJob.currentStep || 'Procesando video...';

  // Obtener los últimos 4 logs para la vista rápida
  const recentLogs = logs.slice(-4);

  return (
    <aside 
      aria-label="Progreso de generación en segundo plano"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-[680px] select-none transition-all duration-300 ease-out animate-slideUp"
    >
      {/* Contenedor Flotante Estilo Dynamic Island / Glass Dock */}
      <div className="relative rounded-3xl bg-[#0c111d]/90 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-3.5 space-y-3 ring-1 ring-white/5 hover:border-brand-primary/40 transition-all duration-300">
        
        {/* Línea de brillo superior tipo Apple */}
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Fila Principal del Dock */}
        <div className="flex items-center justify-between gap-3">
          
          {/* Indicador de Estado + Info Principal */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Ícono de Estado Animado */}
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 ${
              isPaused 
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400' 
                : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10'
            }`}>
              {isPaused ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              )}
            </div>

            {/* Texto de Progreso */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-white tracking-wide uppercase">
                  Video {currentVideo} de {totalVideos}
                </span>
                <span className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-md border ${
                  isPaused
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {progressPercent}%
                </span>
                {activeJob.currentProfileName && (
                  <span className="hidden sm:inline-block text-[9px] font-bold text-gray-400 truncate max-w-[120px] bg-white/5 px-1.5 py-0.2 rounded border border-white/5">
                    {activeJob.currentProfileName}
                  </span>
                )}
              </div>

              {/* Sub-paso en ejecución */}
              <p className="text-[11px] text-gray-300 font-medium truncate flex items-center gap-1.5 mt-0.5">
                <Film className="w-3 h-3 text-brand-primary shrink-0" />
                <span className="truncate">{currentStep}</span>
              </p>
            </div>
          </div>

          {/* Temporizadores (Elapsed / ETA) */}
          <div className="hidden sm:flex flex-col items-end shrink-0 text-right pr-1">
            <div className="flex items-center gap-1 text-[10px] text-gray-300 font-semibold">
              <Clock className="w-3 h-3 text-gray-400" />
              <span>{formatTime(activeJob.elapsedSeconds)}</span>
            </div>
            <span className="text-[9.5px] text-brand-primary font-bold">
              ETA: {activeJob.etaSeconds !== null && activeJob.etaSeconds !== undefined ? formatTime(activeJob.etaSeconds) : '...'}
            </span>
          </div>

          {/* Botones de Acción Rápida */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Botón Pausar / Reanudar */}
            {isPaused ? (
              <button
                type="button"
                onClick={onResume}
                disabled={isResuming}
                title="Reanudar generación"
                className="w-8 h-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-md shadow-emerald-500/20"
              >
                {isResuming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={onPause}
                disabled={isPausing || activeJob.pauseRequested}
                title="Pausar generación"
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border border-white/10 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
              >
                {isPausing || activeJob.pauseRequested ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* Botón Abrir Mini Consola */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Ocultar mini logs' : 'Ver últimos logs'}
              className={`h-8 px-2 rounded-xl flex items-center gap-1 text-[10px] font-extrabold transition-all active:scale-95 cursor-pointer border ${
                isExpanded 
                  ? 'bg-brand-primary/20 text-brand-primary border-brand-primary/40' 
                  : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Logs</span>
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>

            {/* Botón Ir al Dashboard */}
            <button
              type="button"
              onClick={onNavigateToDashboard}
              title="Volver al Panel de Control principal"
              className="h-8 px-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white flex items-center gap-1.5 text-[10.5px] font-black tracking-wide uppercase transition-all shadow-md shadow-brand-primary/20 active:scale-95 cursor-pointer"
            >
              <span>Panel</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Barra de Progreso Continua y Elegante */}
        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden relative">
          <div 
            className="h-full bg-gradient-to-r from-brand-primary via-emerald-400 to-teal-300 rounded-full transition-all duration-300 ease-out relative"
            style={{ width: `${Math.max(2, progressPercent)}%` }}
          >
            {/* Brillo reflectante */}
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>

        {/* Mini Drawer de Logs Expandible */}
        {isExpanded && (
          <div className="pt-2 border-t border-white/10 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Actividad reciente en vivo:
              </span>
              <button 
                onClick={onNavigateToDashboard}
                className="text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver consola completa</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="bg-black/50 rounded-xl p-2.5 font-mono text-[10px] space-y-1.5 max-h-[110px] overflow-y-auto border border-white/5 custom-scrollbar">
              {recentLogs.length === 0 ? (
                <div className="text-gray-500 italic text-center py-1">Iniciando tareas...</div>
              ) : (
                recentLogs.map((log, i) => {
                  const { tag, color } = parseLogTag(log);
                  return (
                    <div key={i} className="flex items-start gap-1.5 leading-relaxed">
                      <span className={`text-[8px] font-extrabold px-1 py-0.2 rounded border shrink-0 ${color}`}>
                        {tag}
                      </span>
                      <span className="text-gray-300 truncate flex-1">{log}</span>
                    </div>
                  );
                })
              )}
              <div ref={miniLogsEndRef} />
            </div>
          </div>
        )}

      </div>
    </aside>
  );
}

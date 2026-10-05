import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Terminal, 
  Copy, 
  Check, 
  Download, 
  Trash2, 
  Search, 
  Filter, 
  ArrowDownCircle, 
  Sparkles, 
  Film, 
  Mic, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  ChevronRight
} from 'lucide-react';

// Pipeline de etapas del procesamiento de video
const PIPELINE_STEPS = [
  { id: 'script', label: '1. Guión & IA', icon: FileText, desc: 'Generación de historia' },
  { id: 'audio', label: '2. Audio & TTS', icon: Mic, desc: 'Síntesis de voz' },
  { id: 'subtitles', label: '3. Subtítulos', icon: Layers, desc: 'Transcripción y sincronización' },
  { id: 'render', label: '4. Render GPU', icon: Film, desc: 'Codificación FFmpeg' },
  { id: 'done', label: '5. Exportado', icon: CheckCircle2, desc: 'Video listo' },
];

// Detectar el paso activo actual basado en stage o texto del paso de Express
const detectActivePipelineStep = (activeJob = null) => {
  if (!activeJob) return 'script';
  if (activeJob.stage) {
    if (activeJob.stage === 'done') return 'done';
    if (activeJob.stage === 'render') return 'render';
    if (activeJob.stage === 'subtitles') return 'subtitles';
    if (activeJob.stage === 'audio') return 'audio';
    if (activeJob.stage === 'script') return 'script';
  }
  const text = (activeJob.currentStep || '').toLowerCase();
  if (text.includes('ffmpeg') || text.includes('render') || text.includes('gpu') || text.includes('ensamblando') || text.includes('codific') || text.includes('compilando')) {
    return 'render';
  }
  if (text.includes('subtítulo') || text.includes('subtitulo') || text.includes('srt') || text.includes('tarjeta') || text.includes('puppeteer') || text.includes('transcri')) {
    return 'subtitles';
  }
  if (text.includes('tts') || text.includes('audio') || text.includes('voz') || text.includes('voces') || text.includes('sintetizando') || text.includes('edge')) {
    return 'audio';
  }
  if (text.includes('completado') || text.includes('finalizada') || text.includes('guardado')) {
    return 'done';
  }
  return 'script';
};

// Clasificador y parseador de badges
const parseLogEntry = (log) => {
  // Extraer timestamp si existe [HH:MM:SS]
  let timestamp = '';
  let content = log;
  const timeMatch = log.match(/^\[(\d{1,2}:\d{2}:\d{2}(?:\s?[ap]\.?m\.?)?)\]\s*(.*)$/i);
  if (timeMatch) {
    timestamp = timeMatch[1];
    content = timeMatch[2];
  }

  // Quitar el prefijo del tipo "[Video X/Y]" para analizar el contenido real del mensaje sin que la palabra "video" interfiera
  const normalizedForClassification = content
    .replace(/^\[video\s*\d+\/\d+\]\s*/i, '')
    .toLowerCase();

  let tag = 'INFO';
  let badgeColor = 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  let rowTextColor = 'text-gray-300';

  if (
    normalizedForClassification.includes('error') || 
    normalizedForClassification.includes('falló') || 
    normalizedForClassification.includes('fallo') || 
    normalizedForClassification.includes('❌') || 
    normalizedForClassification.includes('exception') || 
    normalizedForClassification.includes('crítico')
  ) {
    tag = 'ERROR';
    badgeColor = 'bg-red-500/20 text-red-400 border-red-500/40 shadow-sm shadow-red-500/20';
    rowTextColor = 'text-red-300 font-semibold';
  } else if (
    normalizedForClassification.includes('tts') || 
    normalizedForClassification.includes('sintetizando') || 
    normalizedForClassification.includes('audio') || 
    normalizedForClassification.includes('audios') || 
    normalizedForClassification.includes('locución') || 
    normalizedForClassification.includes('locucion') || 
    normalizedForClassification.includes('voces') || 
    normalizedForClassification.includes('marcas de tiempo') || 
    normalizedForClassification.includes('diálogo') ||
    normalizedForClassification.includes('dialogo') ||
    normalizedForClassification.includes('diálogos') ||
    normalizedForClassification.includes('dialogos') ||
    normalizedForClassification.includes('pistas de diálogos') ||
    normalizedForClassification.includes('duración título') ||
    normalizedForClassification.includes('duración cuerpo') ||
    normalizedForClassification.includes('fragmento') ||
    normalizedForClassification.includes('subtítulo') || 
    normalizedForClassification.includes('subtitulo') || 
    normalizedForClassification.includes('srt') || 
    normalizedForClassification.includes('ass') || 
    normalizedForClassification.includes('transcri')
  ) {
    tag = 'AUDIO';
    badgeColor = 'bg-violet-500/20 text-violet-300 border-violet-500/30';
    rowTextColor = 'text-violet-200';
  } else if (
    normalizedForClassification.includes('ffmpeg') || 
    normalizedForClassification.includes('render') || 
    normalizedForClassification.includes('gpu') || 
    normalizedForClassification.includes('codific') || 
    normalizedForClassification.includes('nvenc') || 
    normalizedForClassification.includes('qsv') || 
    normalizedForClassification.includes('amf') || 
    normalizedForClassification.includes('compilando') || 
    normalizedForClassification.includes('compilación') || 
    normalizedForClassification.includes('progreso') || 
    normalizedForClassification.includes('playhead') || 
    normalizedForClassification.includes('fondos') || 
    normalizedForClassification.includes('tarjeta') || 
    normalizedForClassification.includes('puppeteer')
  ) {
    tag = 'RENDER';
    badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    rowTextColor = 'text-indigo-200';
  } else if (
    normalizedForClassification.includes('creados con éxito') || 
    normalizedForClassification.includes('compilado con éxito') || 
    normalizedForClassification.includes('completado') || 
    normalizedForClassification.includes('exitosamente') || 
    normalizedForClassification.includes('🎉') || 
    normalizedForClassification.includes('guardados en:') || 
    normalizedForClassification.includes('reporte')
  ) {
    tag = 'ÉXITO';
    badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    rowTextColor = 'text-emerald-300 font-semibold';
  } else if (
    normalizedForClassification.includes('gemini') || 
    normalizedForClassification.includes('guion') || 
    normalizedForClassification.includes('guión') || 
    normalizedForClassification.includes('historia') || 
    normalizedForClassification.includes('género clasificado') || 
    normalizedForClassification.includes('prompt') || 
    normalizedForClassification.includes('reintentando') || 
    normalizedForClassification.includes('rotando') || 
    normalizedForClassification.includes('modelo') || 
    normalizedForClassification.includes('reddit')
  ) {
    tag = 'IA';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    rowTextColor = 'text-amber-200';
  }

  return { timestamp, content, tag, badgeColor, rowTextColor, original: log };
};

// Caché en memoria para evitar re-parsear logs existentes con regex repetidamente
const logEntryCache = new Map();
const getParsedLog = (log) => {
  let cached = logEntryCache.get(log);
  if (!cached) {
    cached = parseLogEntry(log);
    // Limitar la caché a 1000 elementos
    if (logEntryCache.size > 1000) {
      const firstKey = logEntryCache.keys().next().value;
      logEntryCache.delete(firstKey);
    }
    logEntryCache.set(log, cached);
  }
  return cached;
};

// Componente de fila memoizado para evitar re-renderizados de líneas pasadas
const LogRow = React.memo(function LogRow({ item }) {
  return (
    <div 
      className="group flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-white/[0.03] transition-colors duration-150 leading-relaxed"
    >
      <span className="text-[9px] font-mono text-gray-600 select-none w-6 text-right shrink-0 pt-0.5">
        {item.id + 1}
      </span>

      {item.timestamp && (
        <span className="text-[9.5px] text-gray-500 font-mono select-none shrink-0 pt-0.5">
          [{item.timestamp}]
        </span>
      )}

      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded border uppercase tracking-wider shrink-0 select-none ${item.badgeColor}`}>
        {item.tag}
      </span>

      <span className={`break-words flex-1 ${item.rowTextColor}`}>
        {item.content}
      </span>
    </div>
  );
});

function GenerationLogsConsole({
  logs = [],
  activeJob = null,
  clearedLogsCount = 0,
  onClearLogs
}) {
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'ERROR' | 'RENDER' | 'AUDIO' | 'IA'
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef(null);
  const containerRef = useRef(null);

  // Filtrar logs que no fueron borrados por el usuario
  const visibleLogs = useMemo(() => {
    return logs.slice(clearedLogsCount);
  }, [logs, clearedLogsCount]);

  // Parsear usando la caché: los logs existentes se obtienen en O(1) sin re-ejecutar regex
  const parsedLogs = useMemo(() => {
    return visibleLogs.map((log, index) => ({ ...getParsedLog(log), id: index }));
  }, [visibleLogs]);

  // Logs filtrados por tipo o búsqueda
  const parsedAndFilteredLogs = useMemo(() => {
    return parsedLogs.filter((item) => {
      if (filterType !== 'ALL') {
        if (filterType === 'ERROR' && item.tag !== 'ERROR') return false;
        if (filterType === 'RENDER' && item.tag !== 'RENDER' && item.tag !== 'ÉXITO') return false;
        if (filterType === 'AUDIO' && item.tag !== 'AUDIO') return false;
        if (filterType === 'IA' && item.tag !== 'IA') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.original.toLowerCase().includes(q);
      }
      return true;
    });
  }, [parsedLogs, filterType, searchQuery]);

  // Contadores para filtros calculados sobre logs parseados
  const counts = useMemo(() => {
    let errorCount = 0;
    let renderCount = 0;
    let audioCount = 0;
    let iaCount = 0;

    parsedLogs.forEach((item) => {
      if (item.tag === 'ERROR') errorCount++;
      if (item.tag === 'RENDER' || item.tag === 'ÉXITO') renderCount++;
      if (item.tag === 'AUDIO') audioCount++;
      if (item.tag === 'IA') iaCount++;
    });

    return { errorCount, renderCount, audioCount, iaCount, total: parsedLogs.length };
  }, [parsedLogs]);

  // Auto-scroll al final cuando llegan logs nuevos si autoScroll está activo
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleLogs, autoScroll]);

  // Copiar todos los logs al portapapeles
  const handleCopyLogs = async () => {
    if (visibleLogs.length === 0) return;
    try {
      await navigator.clipboard.writeText(visibleLogs.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar logs:', err);
    }
  };

  // Descargar logs en formato .txt
  const handleDownloadLogs = () => {
    if (visibleLogs.length === 0) return;
    const blob = new Blob([visibleLogs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reddit-video-generator-logs-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentActiveStepId = detectActivePipelineStep(activeJob);
  const isAllBatchDone = activeJob?.status === 'completed' || activeJob?.status === 'completed_with_errors';

  return (
    <div className="glass-panel rounded-3xl flex flex-col overflow-hidden border border-border-dark/80 shadow-2xl transition-all duration-300">
      
      {/* 1. Pipeline Visual de Fases (Stepper Horizontal) */}
      {activeJob && (
        <div className="bg-black/30 border-b border-border-dark/60 p-3 px-4">
          <div className="flex items-center justify-between gap-1 overflow-x-auto custom-scrollbar">
            {PIPELINE_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const stepIndex = PIPELINE_STEPS.findIndex(s => s.id === step.id);
              const activeIndex = PIPELINE_STEPS.findIndex(s => s.id === currentActiveStepId);
              
              const isDone = isAllBatchDone || currentActiveStepId === 'done' || stepIndex < activeIndex;
              const isCurrent = !isAllBatchDone && currentActiveStepId !== 'done' && stepIndex === activeIndex;

              return (
                <React.Fragment key={step.id}>
                  <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-300 shrink-0 ${
                    isCurrent 
                      ? 'bg-brand-primary/15 border border-brand-primary/40 shadow-sm shadow-brand-primary/10' 
                      : isDone 
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                      : 'bg-white/5 border border-white/5 opacity-50 text-gray-400'
                  }`}>
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                      isCurrent
                        ? 'bg-brand-primary text-white animate-pulse'
                        : isDone
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/10 text-gray-400'
                    }`}>
                      {isDone ? <Check className="w-3 h-3 text-emerald-400" /> : <StepIcon className="w-3 h-3" />}
                    </div>
                    <div className="min-w-0">
                      <span className={`text-[10px] font-black uppercase tracking-wider block truncate ${
                        isCurrent ? 'text-white' : isDone ? 'text-emerald-300' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  </div>

                  {idx < PIPELINE_STEPS.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Cabecera de la Consola Estilo macOS Studio */}
      <div className="bg-gray-900/90 backdrop-blur-md border-b border-border-dark px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Lado izquierdo: Botones macOS + Título + Status Pulse */}
        <div className="flex items-center gap-3">
          {/* Botones de ventana tipo macOS */}
          <div className="flex gap-1.5 select-none">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]" />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
            <Terminal className="w-4 h-4 text-brand-primary" />
            <span className="tracking-wide uppercase font-black text-[11px]">Consola de Actividad</span>
            {activeJob ? (
              <span className="flex items-center gap-1.5 text-[9.5px] font-black bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                EN VIVO
              </span>
            ) : (
              <span className="text-[9.5px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                EN ESPERA
              </span>
            )}
          </div>
        </div>

        {/* Lado derecho: Acciones (Copiar, Descargar, Auto-scroll, Limpiar) */}
        <div className="flex items-center gap-1.5">
          {/* Toggle Auto-scroll */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Pausar auto-scroll' : 'Activar auto-scroll'}
            className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer border ${
              autoScroll 
                ? 'bg-brand-primary/15 text-brand-primary border-brand-primary/30' 
                : 'bg-black/40 text-gray-400 border-border-dark hover:text-white'
            }`}
          >
            <ArrowDownCircle className="w-3 h-3" />
            <span className="hidden sm:inline">{autoScroll ? 'Scroll ON' : 'Scroll OFF'}</span>
          </button>

          {/* Copiar Logs */}
          <button
            type="button"
            onClick={handleCopyLogs}
            disabled={visibleLogs.length === 0}
            title="Copiar todos los logs al portapapeles"
            className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-black/40 hover:bg-black/60 text-gray-300 hover:text-white border border-border-dark transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="hidden sm:inline">Copiar</span>
              </>
            )}
          </button>

          {/* Descargar Logs .txt */}
          <button
            type="button"
            onClick={handleDownloadLogs}
            disabled={visibleLogs.length === 0}
            title="Descargar archivo de logs .txt"
            className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-black/40 hover:bg-black/60 text-gray-300 hover:text-white border border-border-dark transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 active:scale-95"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          {/* Limpiar Consola */}
          {visibleLogs.length > 0 && onClearLogs && (
            <button
              type="button"
              onClick={onClearLogs}
              title="Limpiar la consola actual"
              className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Barra de Filtros Rápidos y Búsqueda */}
      <div className="bg-black/40 border-b border-border-dark/60 px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        
        {/* Segmented Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Todos ({counts.total})
          </button>

          {counts.errorCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('ERROR')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'ERROR'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Errores ({counts.errorCount})
            </button>
          )}

          <button
            type="button"
            onClick={() => setFilterType('RENDER')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
              filterType === 'RENDER'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-indigo-300 hover:bg-white/5'
            }`}
          >
            Render / GPU ({counts.renderCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('AUDIO')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
              filterType === 'AUDIO'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-violet-300 hover:bg-white/5'
            }`}
          >
            Audio & TTS ({counts.audioCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('IA')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
              filterType === 'IA'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-amber-300 hover:bg-white/5'
            }`}
          >
            Historias IA ({counts.iaCount})
          </button>
        </div>

        {/* Input de Búsqueda Rápida */}
        <div className="relative flex-1 min-w-[140px] max-w-[220px]">
          <Search className="w-3 h-3 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar logs..."
            className="w-full bg-black/50 border border-border-dark rounded-xl pl-7 pr-2.5 py-1 text-[10.5px] text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-primary"
          />
        </div>
      </div>

      {/* 4. Stream de Logs Formateados */}
      <div 
        ref={containerRef}
        className="bg-[#080b12] p-4 flex-grow overflow-y-auto h-[380px] font-mono text-[11px] space-y-1.5 border-t-0 text-gray-300 custom-scrollbar selection:bg-brand-primary selection:text-white"
      >
        {parsedAndFilteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center p-6 space-y-2 select-none">
            <Terminal className="w-8 h-8 opacity-30 text-brand-primary" />
            <p className="text-xs font-semibold">
              {searchQuery || filterType !== 'ALL'
                ? 'No hay registros que coincidan con los filtros actuales.'
                : 'Consola en espera. Inicia una cola de videos para ver el proceso en tiempo real.'}
            </p>
            {(searchQuery || filterType !== 'ALL') && (
              <button
                type="button"
                onClick={() => { setFilterType('ALL'); setSearchQuery(''); }}
                className="text-[10px] text-brand-primary hover:underline font-bold cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          parsedAndFilteredLogs.map((item) => (
            <LogRow key={item.id} item={item} />
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}

export default React.memo(GenerationLogsConsole);

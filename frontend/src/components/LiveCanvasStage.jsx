import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Eye,
  Move,
  RotateCcw,
  Smartphone,
  Monitor,
  ShieldCheck,
  Film,
  Play,
  Square,
  Zap,
  Volume2,
  Sparkles,
  AlertTriangle,
  Layers,
  SlidersHorizontal,
  Check
} from 'lucide-react';

export default function LiveCanvasStage({
  initialViewMode = 'both',
  // Orientación y Ratios
  previewOrientation = '9:16',
  setPreviewOrientation,

  // Estados de Tarjeta Reddit
  cardTheme = 'dark',
  cardType = 'static',
  cardUsername = 'reddit_user',
  cardSubreddit = 'r/AskReddit',
  cardAvatar = '/assets/reddit-avatar.png',
  upvotes = '14.5k',
  comments = '1.2k',
  cardShowVerified = true,
  cardShowAwards = true,
  cardSelectedAwards = [],
  cardWidth = 260,
  cardBorderRadius = 11,
  cardPadding = 12,
  cardGap = 7,
  cardScale = 1.0,
  cardOffsetX = 0,
  cardOffsetY = 0,
  setCardOffsetX,
  setCardOffsetY,
  cardScale_16_9 = 1.0,
  cardOffsetX_16_9 = 0,
  cardOffsetY_16_9 = 0,
  setCardOffsetX_16_9,
  setCardOffsetY_16_9,
  cardEntryAnimation = 'none',
  cardExitAnimation = 'none',
  cardEntryDuration = 0.4,
  cardExitDuration = 0.4,
  handleResetPosition,

  // Estados de Subtítulos
  font = 'Arial Bold',
  fontSize = 100,
  fontSize_16_9 = 100,
  subtitleColor = '#FFFF00',
  passiveColor = '#FFFFFF',
  animation = 'tiktok-pop',
  subtitleBorderStyle = 'outline',
  subtitleLetterSpacing = 0,
  subtitleOffsetX = 0,
  subtitleOffsetY = 0,
  setSubtitleOffsetX,
  setSubtitleOffsetY,
  subtitleOffsetX_16_9 = 0,
  subtitleOffsetY_16_9 = 0,
  setSubtitleOffsetX_16_9,
  setSubtitleOffsetY_16_9,
  handleResetSubtitlePosition,

  // Texto de Muestra
  testTitle = 'Mi historia de Reddit: Esto es lo que ocurrió cuando decidí confrontar la verdad...',
  testSubtitleText = 'ESTA ES UNA PRUEBA DE SUBTÍTULOS DINÁMICOS DE ALTA RETENCIÓN',
  setTestSubtitleText,

  // Efectos Cinemáticos y SFX Drift
  cardSfxEnabled = false,
  cardSfxSound = 'whoosh',
  cardSfxVolume = -6,
  backgroundBlur = 0,
  backgroundBlurMode = 'card-only',
  vignetteStrength = 0,
  backgroundSaturation = 1.15,
  backgroundContrast = 1.05,
  playSfxPreview,

  // Marca de Agua
  watermarkEnabled = false,
  watermarkType = 'text',
  watermarkText = '@marca_agua',
  watermarkFont = 'Arial Bold',
  watermarkSize = 24,
  watermarkColor = '#FFFFFF',
  watermarkOpacity = 0.4,
  watermarkAlignment = 9,
  watermarkOffsetX = 20,
  watermarkOffsetY = 20,
  watermarkAnimation = 'none',
  watermarkSpeed = 2.5,
  watermarkImageFile = '',
  watermarkImageScale = 0.15,
  watermarkImageOpacity = 0.5,
  watermarkImageAlignment = 9,
  watermarkImageOffsetX = 20,
  watermarkImageOffsetY = 20,
  overlays = [],
  overlayPreviews = {},

  // Música
  musicEnabled = false,
  musicVolume = -20,

  // Simulación de Timeline y Transporte
  previewState = 'idle',
  isPlayingTimeline = false,
  timelineProgress = 0,
  handleStartTimelineSimulation,
  handleResetTimelineSimulation,
  handleScrubTimeline,

  // Presets Rápidos
  stylePacks = [],
  applyStylePack
}) {
  const canvasRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(560);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [stageViewMode, setStageViewMode] = useState(initialViewMode); // 'both' | 'card' | 'subtitles'

  useEffect(() => {
    if (initialViewMode) {
      setStageViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  const [activeDragTarget, setActiveDragTarget] = useState(null); // 'card' | 'subtitles' | null
  const [isHoveredTarget, setIsHoveredTarget] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragInitialOffsets, setDragInitialOffsets] = useState({ x: 0, y: 0 });
  const [isSnappedX, setIsSnappedX] = useState(false);
  const [isSnappedY, setIsSnappedY] = useState(false);

  // Control de ciclo automático de subtítulos de prueba
  const [isAutoCycling, setIsAutoCycling] = useState(true);

  // Palabras activas para animación de subtítulos
  const wordsList = useMemo(() => {
    const raw = (testSubtitleText || 'SUBTÍTULOS DINÁMICOS DE REDDIT').trim();
    const list = raw.split(/\s+/).filter(Boolean);
    return list.length > 0 ? list : ['SUBTÍTULOS', 'DINÁMICOS'];
  }, [testSubtitleText]);

  const [activeWordIndex, setActiveWordIndex] = useState(0);

  // Clasificación de Animación (Idéntico a services/subtitles.js):
  // 1. Animaciones de 1 sola palabra a la vez (Word-by-Word / Pop):
  //    tiktok-pop, bounce-pop, kinetic-wave, typewriter, neon-glow, slide-up
  // 2. Animaciones de Frase en bloque (Máx 4 palabras por bloque, 1-2 líneas):
  //    borde-emergente-2, active-highlight, glow-karaoke, clean-fade
  const isSingleWordAnimation = [
    'tiktok-pop',
    'bounce-pop',
    'kinetic-wave',
    'typewriter',
    'neon-glow',
    'slide-up'
  ].includes(animation) || !animation;

  // Segmentación en bloques de frases de máximo 4 palabras (Algoritmo idéntico a services/subtitles.js)
  const phrases = useMemo(() => {
    const maxWordsPerPhrase = 4;
    const result = [];
    let current = [];

    wordsList.forEach((word, idx) => {
      current.push({ word, globalIndex: idx });
      const hasPunctuation = /[.!?]/.test(word);
      if (hasPunctuation || current.length >= maxWordsPerPhrase) {
        result.push(current);
        current = [];
      }
    });

    if (current.length > 0) {
      result.push(current);
    }
    return result.length > 0 ? result : [[{ word: wordsList[0] || 'SUBTÍTULO', globalIndex: 0 }]];
  }, [wordsList]);

  // Frase actual activa que se renderiza en pantalla
  const currentPhrase = useMemo(() => {
    for (const phrase of phrases) {
      if (phrase.some(item => item.globalIndex === activeWordIndex)) {
        return phrase;
      }
    }
    return phrases[0] || [];
  }, [phrases, activeWordIndex]);

  // Palabra individual activa (para animaciones de 1 sola palabra)
  const currentSingleWord = wordsList[activeWordIndex % wordsList.length] || 'SUBTÍTULO';

  // Observador de resolución del canvas para escalado 1:1 WYSIWYG
  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setCanvasWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [previewOrientation]);

  // Temporizador para avance rítmico de palabras idéntico a la locución (430ms)
  useEffect(() => {
    if (wordsList.length <= 1 || !isAutoCycling) return;
    const interval = setInterval(() => {
      setActiveWordIndex(prev => (prev + 1) % wordsList.length);
    }, 430);
    return () => clearInterval(interval);
  }, [wordsList.length, isAutoCycling]);

  // Dimensiones Nativas (1080x1920 en vertical, 1920x1080 en horizontal)
  const isLand = previewOrientation === '16:9';
  const nativeResX = isLand ? 1920 : 1080;
  const nativeResY = isLand ? 1080 : 1920;

  // Factor de escala visual 1:1 idéntico al renderizado de FFmpeg
  const scale = canvasWidth > 0 ? canvasWidth / nativeResX : (isLand ? 0.35 : 0.28);

  // Coordenadas actuales activas según orientación
  const currCardX = isLand ? cardOffsetX_16_9 : cardOffsetX;
  const currCardY = isLand ? cardOffsetY_16_9 : cardOffsetY;
  const currSubX = isLand ? subtitleOffsetX_16_9 : subtitleOffsetX;
  const currSubY = isLand ? subtitleOffsetY_16_9 : subtitleOffsetY;

  // Manejadores de Arrastre Directo (Pointer Events con captura)
  const handlePointerDown = (e, target) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveDragTarget(target);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    const initialX = target === 'card' ? currCardX : currSubX;
    const initialY = target === 'card' ? currCardY : currSubY;
    setDragInitialOffsets({ x: initialX, y: initialY });
  };

  useEffect(() => {
    if (!activeDragTarget) return;

    const handlePointerMove = (e) => {
      if (!canvasRef.current) return;
      const deltaX = (e.clientX - dragStartPos.x) / scale;
      const deltaY = (e.clientY - dragStartPos.y) / scale;

      let targetX = Math.round(dragInitialOffsets.x + deltaX);
      let targetY = Math.round(dragInitialOffsets.y + deltaY);

      // Snap magnético al centro con tolerancia de 22px nativos
      const snapThreshold = 22;
      const snappedX = Math.abs(targetX) < snapThreshold;
      const snappedY = Math.abs(targetY) < snapThreshold;

      if (snappedX) targetX = 0;
      if (snappedY) targetY = 0;

      setIsSnappedX(snappedX);
      setIsSnappedY(snappedY);

      if (activeDragTarget === 'card') {
        if (isLand) {
          setCardOffsetX_16_9(targetX);
          setCardOffsetY_16_9(targetY);
        } else {
          setCardOffsetX(targetX);
          setCardOffsetY(targetY);
        }
      } else if (activeDragTarget === 'subtitles') {
        if (isLand) {
          setSubtitleOffsetX_16_9(targetX);
          setSubtitleOffsetY_16_9(targetY);
        } else {
          setSubtitleOffsetX(targetX);
          setSubtitleOffsetY(targetY);
        }
      }
    };

    const handlePointerUp = () => {
      setActiveDragTarget(null);
      setIsSnappedX(false);
      setIsSnappedY(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDragTarget, dragStartPos, dragInitialOffsets, scale, isLand]);

  // Alerta de Invasión de Zonas Seguras en Formato 9:16
  const isCardInBlockedZone = !isLand && (currCardY > 480 || currCardY < -480);
  const isSubInBlockedZone = !isLand && (currSubY > 420 || currSubY < -420);

  // Visibilidad condicional según modo de estudio o simulación de timeline
  const shouldShowCard = isPlayingTimeline
    ? previewState !== 'subtitles'
    : (stageViewMode === 'both' || stageViewMode === 'card');
  const shouldShowSubtitles = isPlayingTimeline
    ? (previewState === 'subtitles' || previewState === 'idle')
    : (stageViewMode === 'both' || stageViewMode === 'subtitles');

  // Escala visual real para la tarjeta y los subtítulos
  const baseCardWidth = isLand
    ? 1920 * 0.40 * (cardScale_16_9 || 1.0)
    : 1080 * 0.74 * (cardScale || 1.0);
  const visualCardWidth = Math.round(baseCardWidth * scale);

  const activeFontSize = isLand ? fontSize_16_9 : fontSize;
  const visualFontSize = Math.max(12, Math.round((activeFontSize || 100) * scale));
  const maxSubtitleSafeWidth = Math.round((nativeResX - 120) * scale);
  const cleanFontFamily = font ? `"${font.replace(/\s+(Bold|Black|Light|Regular)$/i, '')}", sans-serif` : 'sans-serif';

  // Estilos de sombreado y borde de subtítulos
  const getSubtitleShadowStyle = () => {
    if (subtitleBorderStyle === 'outline') {
      return {
        textShadow: `${Math.max(1, 2 * scale)}px ${Math.max(1, 2 * scale)}px 0 #000, -${Math.max(1, 2 * scale)}px -${Math.max(1, 2 * scale)}px 0 #000, ${Math.max(1, 2 * scale)}px -${Math.max(1, 2 * scale)}px 0 #000, -${Math.max(1, 2 * scale)}px ${Math.max(1, 2 * scale)}px 0 #000`
      };
    }
    if (subtitleBorderStyle === 'heavy-outline') {
      return {
        textShadow: `${Math.max(2, 4 * scale)}px ${Math.max(2, 4 * scale)}px 0 #000, -${Math.max(2, 4 * scale)}px -${Math.max(2, 4 * scale)}px 0 #000, ${Math.max(2, 4 * scale)}px -${Math.max(2, 4 * scale)}px 0 #000, -${Math.max(2, 4 * scale)}px ${Math.max(2, 4 * scale)}px 0 #000`
      };
    }
    return {
      textShadow: `${Math.max(1, 2 * scale)}px ${Math.max(1, 2 * scale)}px ${Math.max(2, 4 * scale)}px rgba(0,0,0,0.9)`
    };
  };

  // Animaciones dinámicas para palabras individuales (1:1 con ASS libass)
  const getSingleWordAnimClass = () => {
    switch (animation) {
      case 'bounce-pop': return 'animate-[subBounceAnim_0.22s_cubic-bezier(0.34,1.56,0.64,1)_forwards]';
      case 'kinetic-wave': return 'animate-[subWaveAnim_0.25s_ease-out_forwards]';
      case 'slide-up': return 'animate-[subSlideAnim_0.2s_ease-out_forwards]';
      case 'typewriter': return 'animate-[subTypewriterAnim_0.15s_ease-out_forwards]';
      case 'neon-glow': return 'animate-[subNeonAnim_0.25s_ease-out_forwards]';
      case 'tiktok-pop':
      default:
        return 'animate-[subPopAnim_0.18s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]';
    }
  };

  // Clases de animación de tarjeta
  const getCardAnimClass = () => {
    if (previewState === 'intro') {
      if (cardEntryAnimation === 'fade-in') return 'opacity-0 animate-[fade-in_0.4s_ease-out_forwards]';
      if (cardEntryAnimation === 'slide-in-left') return '-translate-x-full animate-[slide-in-left_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards]';
      if (cardEntryAnimation === 'slide-in-right') return 'translate-x-full animate-[slide-in-right_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards]';
      if (cardEntryAnimation === 'slide-in-bottom') return 'translate-y-full animate-[slide-in-bottom_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards]';
      if (cardEntryAnimation === 'slide-in-top') return '-translate-y-full animate-[slide-in-top_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards]';
      if (cardEntryAnimation === 'zoom-in') return 'scale-50 opacity-0 animate-[zoom-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards]';
    }
    if (previewState === 'outro') {
      if (cardExitAnimation === 'fade-out') return 'animate-[fade-out_0.4s_ease-in_forwards]';
      if (cardExitAnimation === 'slide-out-left') return 'animate-[slide-out-left_0.4s_ease-in_forwards]';
      if (cardExitAnimation === 'slide-out-right') return 'animate-[slide-out-right_0.4s_ease-in_forwards]';
      if (cardExitAnimation === 'slide-out-bottom') return 'animate-[slide-out-bottom_0.4s_ease-in_forwards]';
      if (cardExitAnimation === 'slide-out-top') return 'animate-[slide-out-top_0.4s_ease-in_forwards]';
      if (cardExitAnimation === 'zoom-out') return 'animate-[zoom-out_0.4s_ease-in_forwards]';
    }
    return '';
  };

  return (
    <div className="w-full glass-panel rounded-2xl p-4 sm:p-6 border border-slate-800 bg-slate-950/70 shadow-2xl space-y-4">
      {/* Estilos CSS Inyectados para Animaciones de Subtítulos Fieles a ASS */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes subPopAnim {
          0% { transform: scale(1.28); }
          100% { transform: scale(1); }
        }
        @keyframes subBounceAnim {
          0% { transform: scale(1.42); }
          45% { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        @keyframes subWaveAnim {
          0% { transform: rotate(-5deg) scale(1.22); }
          50% { transform: rotate(3deg) scale(1.08); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes subSlideAnim {
          0% { transform: translateY(22px); opacity: 0.2; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes subTypewriterAnim {
          0% { opacity: 0; filter: blur(3px); }
          100% { opacity: 1; filter: blur(0); }
        }
        @keyframes subNeonAnim {
          0% { filter: drop-shadow(0 0 14px currentColor); transform: scale(1.18); }
          100% { filter: drop-shadow(0 0 5px currentColor); transform: scale(1); }
        }
      `}} />

      {/* 1. BARRA SUPERIOR DE CONTROL DEL LIENZO */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-amber-400" />
            <span>Lienzo en Vivo (Render 1:1 WYSIWYG)</span>
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {isLand ? '1920 x 1080 (YouTube)' : '1080 x 1920 (TikTok/Reels)'}
          </span>
        </div>

        {/* Controles de Formato y Zonas Seguras */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          {/* Switch 9:16 / 16:9 */}
          <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setPreviewOrientation('9:16')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                previewOrientation === '9:16'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>9:16 Vertical</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewOrientation('16:9')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                previewOrientation === '16:9'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>16:9 Panorámico</span>
            </button>
          </div>

          {/* Selector de Elemento Activo (Tarjeta / Subtítulos / Ambos) */}
          <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setStageViewMode('card')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                stageViewMode === 'card'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎴 Tarjeta
            </button>
            <button
              type="button"
              onClick={() => setStageViewMode('subtitles')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                stageViewMode === 'subtitles'
                  ? 'bg-cyan-400 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              💬 Subtítulos
            </button>
            <button
              type="button"
              onClick={() => setStageViewMode('both')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                stageViewMode === 'both'
                  ? 'bg-slate-700 text-white font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              👁️ Ambos
            </button>
          </div>

          {/* Toggle Zonas Seguras */}
          <button
            type="button"
            onClick={() => setShowSafeZones(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              showSafeZones
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zonas Seguras</span>
            <span className={`w-1.5 h-1.5 rounded-full ${showSafeZones ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          </button>
        </div>
      </div>

      {/* 2. BARRA DE HERRAMIENTAS: PRESETS RÁPIDOS & TEXTO DE MUESTRA */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
        {/* Presets Rápidos de Estilo */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-1 md:pb-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Presets:
          </span>
          {stylePacks.map(pack => (
            <button
              key={pack.id}
              type="button"
              onClick={() => applyStylePack(pack)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-800 hover:border-amber-400/50 transition-all cursor-pointer shrink-0"
            >
              <span>{pack.icon}</span>
              <span>{pack.name}</span>
            </button>
          ))}
        </div>

        {/* Campo de Texto de Prueba y Controles de Subtítulos */}
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Texto Muestra:</span>
            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold ${
              isSingleWordAnimation
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
            }`}>
              {isSingleWordAnimation ? '⚡ 1 Palabra (Pop)' : '📝 Frase (Máx 4 Palabras)'}
            </span>
          </div>

          <input
            type="text"
            value={testSubtitleText}
            onChange={(e) => setTestSubtitleText(e.target.value)}
            className="flex-1 min-w-[180px] bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-medium focus:border-amber-400"
            placeholder="Escribe texto de muestra..."
          />

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveWordIndex(prev => (prev > 0 ? prev - 1 : wordsList.length - 1))}
              title="Palabra anterior"
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => setIsAutoCycling(prev => !prev)}
              title={isAutoCycling ? "Pausar animación continua" : "Reanudar animación continua"}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                isAutoCycling
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isAutoCycling ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              onClick={() => setActiveWordIndex(prev => (prev + 1) % wordsList.length)}
              title="Palabra siguiente"
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              ▶
            </button>
            <button
              type="button"
              onClick={() => setActiveWordIndex(0)}
              title="Reiniciar palabra activa"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. CONTENEDOR PRINCIPAL DEL LIENZO EN VIVO (ESPACIO AMPLIO Y CÉNTRICO) */}
      <div className="w-full p-4 sm:p-8 rounded-2xl bg-black/85 border border-slate-800/90 flex flex-col items-center justify-center min-h-[460px] overflow-hidden relative shadow-inner">
        {/* Alerta flotante de invasión de zona de TikTok */}
        {(isCardInBlockedZone || isSubInBlockedZone) && showSafeZones && (
          <div className="absolute top-4 z-40 px-3 py-1.5 rounded-xl bg-rose-500/90 text-white text-xs font-bold text-center shadow-2xl border border-rose-400 animate-bounce flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>⚠️ Elemento tapado por la interfaz de TikTok/Reels. Arrástralo a la zona segura central.</span>
          </div>
        )}

        {/* Marco del Canvas (Con escalado 1:1 y aspecto dinámico) */}
        <div
          ref={canvasRef}
          className={`relative rounded-2xl overflow-hidden shadow-2xl select-none transition-all border-2 ${
            activeDragTarget ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-700'
          } ${
            isLand
              ? 'w-full max-w-3xl aspect-video'
              : 'w-72 sm:w-80 md:w-96 lg:w-[420px] aspect-[9/16] max-h-[72vh]'
          }`}
          style={{
            background: 'radial-gradient(ellipse at center, #1e293b 0%, #0a0e17 100%)',
            backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        >
          {/* Fondo Dinámico con Filtros de Post-Procesado Cinemático en Vivo */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-200 z-0 overflow-hidden pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(ellipse at center, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.95) 100%), linear-gradient(135deg, rgba(79, 70, 229, 0.28) 0%, rgba(13, 148, 136, 0.28) 100%)`,
              filter: `saturate(${backgroundSaturation || 1.15}) contrast(${backgroundContrast || 1.05}) blur(${
                (previewState === 'subtitles' && backgroundBlurMode === 'card-only') ? 0 : (backgroundBlur || 0)
              }px)`
            }}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `radial-gradient(circle at 25% 25%, rgba(245, 158, 11, 0.25) 0%, transparent 45%), radial-gradient(circle at 75% 75%, rgba(6, 182, 212, 0.25) 0%, transparent 45%), linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)`,
                backgroundSize: '100% 100%, 100% 100%, 32px 32px, 32px 32px'
              }}
            />
          </div>

          {/* Sombreado de Viñeta Cinemática en Vivo */}
          {vignetteStrength > 0 && (
            <div
              className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-200"
              style={{
                boxShadow: `inset 0 0 ${Math.round(vignetteStrength * 140)}px rgba(0, 0, 0, ${Math.min(0.95, vignetteStrength * 1.4)})`
              }}
            />
          )}

          {/* Cuadrícula Guía de Centro */}
          <div className="absolute inset-0 pointer-events-none opacity-25 z-0">
            <div
              className="w-full h-[1px] bg-slate-400 absolute top-1/2 left-0"
              style={{ transform: 'translateY(-50%)', translate: 'none' }}
            />
            <div
              className="h-full w-[1px] bg-slate-400 absolute left-1/2 top-0"
              style={{ transform: 'translateX(-50%)', translate: 'none' }}
            />
          </div>

          {/* Líneas Guía de Snapping Magnético */}
          {isSnappedX && (
            <div
              className="absolute top-0 bottom-0 left-1/2 w-[1.5px] bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)] z-40 pointer-events-none"
              style={{ transform: 'translateX(-50%)', translate: 'none' }}
            />
          )}
          {isSnappedY && (
            <div
              className="absolute left-0 right-0 top-1/2 h-[1.5px] bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)] z-40 pointer-events-none"
              style={{ transform: 'translateY(-50%)', translate: 'none' }}
            />
          )}
          {(isSnappedX || isSnappedY) && (
            <div
              className="absolute top-2 left-1/2 bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full z-40 pointer-events-none shadow-md uppercase tracking-wider"
              style={{ transform: 'translateX(-50%)', translate: 'none' }}
            >
              Snap Centro (0, 0)
            </div>
          )}

          {/* Overlay de Zonas Seguras de TikTok / Reels / Shorts (Solo en 9:16) */}
          {!isLand && showSafeZones && (
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* Barra Superior TikTok */}
              <div className="absolute top-0 left-0 right-0 h-[12%] bg-black/45 border-b border-rose-500/30 flex items-center justify-between px-3 text-[9px] text-slate-300">
                <span className="font-semibold text-slate-200">Siguiendo | Para ti</span>
                <span>🔍</span>
              </div>

              {/* Riel Lateral Derecho TikTok */}
              <div className="absolute right-0 top-[38%] bottom-[20%] w-[16%] bg-black/35 border-l border-rose-500/30 flex flex-col items-center justify-center gap-2 text-[9px] text-slate-300">
                <div className="w-5 h-5 rounded-full bg-rose-500/30 flex items-center justify-center text-[10px]">❤️</div>
                <div className="w-5 h-5 rounded-full bg-slate-700/50 flex items-center justify-center text-[10px]">💬</div>
                <div className="w-5 h-5 rounded-full bg-slate-700/50 flex items-center justify-center text-[10px]">🔖</div>
                <div className="w-5 h-5 rounded-full bg-slate-700/50 flex items-center justify-center text-[10px]">↗️</div>
              </div>

              {/* Barra Inferior TikTok */}
              <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-gradient-to-t from-black/85 to-transparent border-t border-rose-500/30 flex flex-col justify-end p-2.5 text-[9px] text-slate-300">
                <div className="font-bold text-white">@reddit_historias · #drama</div>
                <div className="text-[8px] text-slate-400 truncate">🎵 Sonido original de la historia</div>
              </div>

              {/* Rectángulo de Zona Segura Recomendada */}
              <div
                className="absolute border border-dashed border-emerald-400/60 rounded-xl"
                style={{
                  top: '14%',
                  left: '6%',
                  right: '18%',
                  bottom: '22%'
                }}
              >
                <span className="absolute top-1.5 left-2 text-[8px] font-bold text-emerald-400 bg-black/70 px-1 rounded border border-emerald-400/40">
                  🛡️ ZONA SEGURA RECOMENDADA
                </span>
              </div>
            </div>
          )}

          {/* Marca de Agua en Vivo */}
          {watermarkEnabled && (
            <div
              className="absolute z-20 pointer-events-none select-none"
              style={{
                top: (watermarkAlignment >= 7) ? `${watermarkOffsetY * scale}px` : (watermarkAlignment <= 3) ? 'auto' : '50%',
                bottom: (watermarkAlignment <= 3) ? `${watermarkOffsetY * scale}px` : 'auto',
                left: (watermarkAlignment % 3 === 1) ? `${watermarkOffsetX * scale}px` : (watermarkAlignment % 3 === 0) ? 'auto' : '50%',
                right: (watermarkAlignment % 3 === 0) ? `${watermarkOffsetX * scale}px` : 'auto',
                transform: `${watermarkAlignment === 5 ? 'translate(-50%, -50%)' : ''}`,
                opacity: watermarkOpacity
              }}
            >
              {watermarkType === 'image' && watermarkImageFile ? (
                <div className="text-[10px] font-mono bg-black/60 px-2 py-0.5 rounded text-white border border-white/20">
                  📷 WM_IMAGE
                </div>
              ) : (
                <span
                  style={{
                    fontFamily: watermarkFont,
                    fontSize: `${Math.max(10, Math.round(watermarkSize * scale))}px`,
                    color: watermarkColor
                  }}
                  className="font-bold drop-shadow-md"
                >
                  {watermarkText}
                </span>
              )}
            </div>
          )}

          {/* Overlays del mini editor (posición y tamaño relativos al lienzo, igual que en FFmpeg) */}
          {/* Animaciones de las capas de texto (en la vista previa se repiten en bucle para poder verlas) */}
          <style>{`
            @keyframes ovTextWiggle { 0% { transform: rotate(var(--w1)); } 33% { transform: rotate(var(--w2)); } 66% { transform: rotate(var(--w3)); } 100% { transform: rotate(var(--w1)); } }
            @keyframes ovTextPop { 0% { transform: scale(0.3); opacity: 0; } 6% { transform: scale(1.12); opacity: 1; } 10% { transform: scale(1); } 88% { opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
            @keyframes ovTextPulse { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }
            @keyframes ovTextSlide { 0% { transform: translateY(-150%); opacity: 0; } 10% { transform: translateY(0); opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(0); opacity: 0; } }
            @keyframes ovTextFade { 0% { opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { opacity: 0; } }
          `}</style>

          {overlays.filter(ov => ov.type === 'text' && ov.enabled && ov.text).map(ov => {
            // libass dibuja el em a ~0.6 del tamaño ASS en fuentes tipo Bangers; se aproxima igual aquí
            const cssSize = Math.max(8, ov.fontSize * scale * 0.6);
            const layerAnimation = {
              pop: 'ovTextPop 3s ease-out infinite',
              pulse: 'ovTextPulse 0.5s ease-in-out infinite alternate',
              'slide-down': 'ovTextSlide 3s ease-out infinite',
              fade: 'ovTextFade 3s linear infinite'
            }[ov.animation] || 'none';
            let letterIndex = 0;
            return (
              <div
                key={ov.id}
                className="absolute z-30 pointer-events-none select-none"
                style={{
                  left: `${ov.posX * 100}%`,
                  top: `${ov.posY * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div
                  className="text-center whitespace-pre font-bold"
                  style={{
                    animation: layerAnimation,
                    fontFamily: ov.font,
                    fontSize: `${cssSize}px`,
                    lineHeight: 0.78,
                    letterSpacing: `${(ov.letterSpacing || 0) * scale}px`,
                    color: ov.color,
                    WebkitTextStroke: `${Math.max(1, ov.outlineWidth * scale * 2)}px ${ov.outlineColor}`,
                    paintOrder: 'stroke fill'
                  }}
                >
                  {ov.animation === 'wiggle'
                    ? String(ov.text).split('\n').map((line, li) => (
                      <div key={li}>
                        {[...line].map((ch, ci) => {
                          // Ángulos pseudoaleatorios fijos por letra, como el bamboleo del render
                          const n = letterIndex++;
                          const angle = (k) => `${(((n * 37 + k * 53) % 15) - 7)}deg`;
                          return (
                            <span
                              key={ci}
                              style={{
                                display: 'inline-block',
                                whiteSpace: 'pre',
                                '--w1': angle(1),
                                '--w2': angle(2),
                                '--w3': angle(3),
                                animation: `ovTextWiggle ${0.42 + (n % 4) * 0.06}s linear infinite`
                              }}
                            >
                              {ch}
                            </span>
                          );
                        })}
                      </div>
                    ))
                    : ov.text}
                </div>
              </div>
            );
          })}

          {overlays.filter(ov => ov.type !== 'text' && ov.enabled && overlayPreviews[ov.id]?.image).map(ov => (
            <img
              key={ov.id}
              src={overlayPreviews[ov.id].image}
              alt={ov.name}
              className="absolute z-30 pointer-events-none select-none"
              style={{
                left: `${ov.posX * 100}%`,
                top: `${ov.posY * 100}%`,
                width: `${ov.scale * 100}%`,
                transform: 'translate(-50%, -50%)',
                opacity: ov.opacity
              }}
            />
          ))}

          {/* 4. ELEMENTO 1: TARJETA DE REDDIT INTERACTIVA (1:1 WYSIWYG) */}
          {shouldShowCard && (
            <div
              onPointerDown={(e) => handlePointerDown(e, 'card')}
              onMouseEnter={() => setIsHoveredTarget('card')}
              onMouseLeave={() => setIsHoveredTarget(prev => prev === 'card' ? null : prev)}
              className={`absolute z-20 cursor-grab active:cursor-grabbing touch-none select-none ${
                activeDragTarget === 'card' ? 'scale-102 ring-2 ring-amber-400 ring-offset-2 ring-offset-black/70 shadow-2xl' : 'hover:scale-[1.01]'
              } ${activeDragTarget === 'card' ? '' : 'transition-[left,top] duration-150'} ${getCardAnimClass()}`}
              style={{
                left: `calc(50% + ${currCardX * scale}px)`,
                top: `calc(50% + ${currCardY * scale}px)`,
                transform: 'translate(-50%, -50%)',
                translate: 'none',
                width: `${visualCardWidth}px`
              }}
            >
              {/* Badge Identificador flotante al pasar el ratón */}
              {(isHoveredTarget === 'card' || activeDragTarget === 'card') && (
                <div
                  className="absolute -top-7 left-1/2 bg-amber-400 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap z-50 flex items-center gap-1"
                  style={{ transform: 'translateX(-50%)', translate: 'none' }}
                >
                  <Move className="w-2.5 h-2.5" />
                  <span>Tarjeta [X: {currCardX}px | Y: {currCardY}px]</span>
                </div>
              )}

              {/* Contenido Visual de la Tarjeta con escala proporcional */}
              <div
                style={{
                  borderRadius: `${Math.round(cardBorderRadius * scale * 2.8)}px`,
                  padding: `${Math.round(cardPadding * scale * 2.8)}px`,
                  gap: `${Math.round(cardGap * scale * 2.8)}px`,
                  backgroundColor: cardTheme === 'dark' ? '#1c1c1e' : '#ffffff',
                  borderColor: cardTheme === 'dark' ? '#2c2c2e' : '#edeff1',
                  color: cardTheme === 'dark' ? '#e5e5e7' : '#11151a'
                }}
                className="border shadow-2xl flex flex-col font-sans select-none overflow-hidden"
              >
                {/* Cabecera: Avatar, Subreddit y Usuario */}
                <div className="flex items-start gap-2">
                  <div
                    className="relative shrink-0 overflow-hidden rounded-full"
                    style={{
                      width: `${Math.round(36 * scale * 2.5)}px`,
                      height: `${Math.round(36 * scale * 2.5)}px`
                    }}
                  >
                    <img
                      className="absolute w-full h-full object-cover"
                      src={cardAvatar || '/assets/reddit-avatar.png'}
                      alt="avatar"
                      onError={(e) => { e.target.src = '/assets/reddit-avatar.png'; }}
                    />
                  </div>
                  <div className="flex flex-col items-start leading-tight">
                    <div className="flex items-center gap-1">
                      <span
                        style={{
                          color: cardTheme === 'dark' ? '#ffffff' : '#11151a',
                          fontSize: `${Math.max(10, Math.round(14 * scale * 2.5))}px`
                        }}
                        className="font-extrabold truncate"
                      >
                        {cardSubreddit}
                      </span>
                      {cardShowVerified && (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-blue-500 inline shrink-0">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span
                      style={{
                        color: cardTheme === 'dark' ? '#94a3b8' : '#5c6c74',
                        fontSize: `${Math.max(8, Math.round(11 * scale * 2.5))}px`
                      }}
                      className="font-medium"
                    >
                      u/{cardUsername}
                    </span>
                  </div>
                </div>

                {/* Awards Medallas */}
                {cardShowAwards && cardSelectedAwards && cardSelectedAwards.length > 0 && (
                  <div className="flex gap-1.5 items-center flex-wrap my-0.5">
                    {cardSelectedAwards.map((item, idx) => (
                      <img key={idx} src={`/assets/awards/${item.file}`} alt={item.name} className="w-4 h-4 object-contain" />
                    ))}
                  </div>
                )}

                {/* Título de la Historia */}
                <div
                  style={{
                    color: cardTheme === 'dark' ? '#ffffff' : '#11151a',
                    fontSize: `${Math.max(11, Math.round(15 * scale * 2.5))}px`
                  }}
                  className="font-extrabold leading-snug break-words mt-1"
                >
                  {testTitle}
                </div>

                {/* Pie de Tarjeta: Upvotes y Comentarios */}
                <div className="flex justify-between items-center gap-2 mt-1 select-none pt-1 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        color: cardTheme === 'dark' ? '#94a3b8' : '#5c6c74',
                        fontSize: `${Math.max(8, Math.round(11 * scale * 2.5))}px`
                      }}
                      className="flex items-center gap-1 font-bold"
                    >
                      <span>❤️</span> {upvotes}
                    </span>
                    <span
                      style={{
                        color: cardTheme === 'dark' ? '#94a3b8' : '#5c6c74',
                        fontSize: `${Math.max(8, Math.round(11 * scale * 2.5))}px`
                      }}
                      className="flex items-center gap-1 font-bold"
                    >
                      <span>💬</span> {comments}
                    </span>
                  </div>
                  <span
                    style={{
                      color: cardTheme === 'dark' ? '#94a3b8' : '#5c6c74',
                      fontSize: `${Math.max(8, Math.round(11 * scale * 2.5))}px`
                    }}
                    className="font-bold"
                  >
                    Share
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 5. ELEMENTO 2: SUBTÍTULOS ANIMADOS (1:1 WYSIWYG) */}
          {shouldShowSubtitles && (
            <div
              className={`absolute z-30 touch-none select-none ${
                activeDragTarget === 'subtitles' ? '' : 'transition-[left,top] duration-150'
              }`}
              style={{
                left: `calc(50% + ${currSubX * scale}px)`,
                top: `calc(50% + ${currSubY * scale}px)`,
                transform: 'translate(-50%, -50%)',
                translate: 'none',
                width: `${maxSubtitleSafeWidth}px`,
                maxWidth: `${maxSubtitleSafeWidth}px`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                pointerEvents: 'none'
              }}
            >
              <div
                onPointerDown={(e) => handlePointerDown(e, 'subtitles')}
                onMouseEnter={() => setIsHoveredTarget('subtitles')}
                onMouseLeave={() => setIsHoveredTarget(prev => prev === 'subtitles' ? null : prev)}
                className={`relative cursor-grab active:cursor-grabbing pointer-events-auto max-w-full text-center font-black select-none leading-[1.12] transition-transform ${
                  activeDragTarget === 'subtitles' ? 'scale-105 ring-2 ring-cyan-400 ring-offset-2 ring-offset-black/70 shadow-2xl' : 'hover:scale-[1.02]'
                }`}
                style={{
                  fontFamily: cleanFontFamily,
                  fontSize: `${visualFontSize}px`,
                  letterSpacing: `${subtitleLetterSpacing}px`,
                  textTransform: 'uppercase',
                  padding: `${Math.max(2, 4 * scale)}px ${Math.max(6, 12 * scale)}px`,
                  ...(subtitleBorderStyle === 'box' ? {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    borderRadius: `${Math.max(4, 12 * scale)}px`,
                    border: '1.5px solid rgba(255, 255, 255, 0.15)'
                  } : getSubtitleShadowStyle())
                }}
              >
                {/* Badge Identificador flotante al pasar el ratón */}
                {(isHoveredTarget === 'subtitles' || activeDragTarget === 'subtitles') && (
                  <div
                    className="absolute -top-7 left-1/2 bg-cyan-400 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap z-50 flex items-center gap-1"
                    style={{ transform: 'translateX(-50%)', translate: 'none' }}
                  >
                    <Move className="w-2.5 h-2.5" />
                    <span>
                      Subtítulos [X: {currSubX}px | Y: {currSubY}px] · {isSingleWordAnimation ? '1 Palabra a la vez (Pop)' : 'Frase (Máx 4 Palabras)'}
                    </span>
                  </div>
                )}

                {/* Subtítulo: Modo 1 Palabra vs Modo Frase de Bloque */}
                {isSingleWordAnimation ? (
                  // MODO 1 PALABRA A LA VEZ: IDÉNTICO A TIKTOK-POP / BOUNCE-POP DE FFMPEG
                  <span
                    key={activeWordIndex}
                    className={`inline-block ${getSingleWordAnimClass()}`}
                    style={{
                      color: subtitleColor,
                      WebkitTextStroke: subtitleBorderStyle === 'heavy-outline'
                        ? `${Math.max(1.5, 5 * scale)}px #000000`
                        : subtitleBorderStyle === 'outline'
                        ? `${Math.max(1, 3.5 * scale)}px #000000`
                        : 'none',
                      paintOrder: 'stroke fill'
                    }}
                  >
                    {currentSingleWord.toUpperCase()}
                  </span>
                ) : (
                  // MODO FRASE EN BLOQUE: MÁXIMO 3-4 PALABRAS (FLUJO HORIZONTAL NATURAL, MÁXIMO 1-2 LÍNEAS)
                  <div className="text-center w-full">
                    {currentPhrase.map(({ word, globalIndex }, idx) => {
                      const isCurrent = globalIndex === activeWordIndex;
                      const isBordeEmergente = animation === 'borde-emergente-2';

                      return (
                        <React.Fragment key={globalIndex}>
                          {idx > 0 && ' '}
                          <span
                            className={`inline-block transition-all duration-100 ${
                              isCurrent ? 'scale-[1.03]' : 'scale-100'
                            } ${
                              isBordeEmergente && isCurrent
                                ? 'px-1.5 py-0.5 rounded shadow-lg'
                                : ''
                            }`}
                            style={{
                              color: isCurrent
                                ? (isBordeEmergente ? '#FFFFFF' : subtitleColor)
                                : passiveColor,
                              backgroundColor: (isBordeEmergente && isCurrent)
                                ? '#6C138E'
                                : 'transparent',
                              WebkitTextStroke: (subtitleBorderStyle === 'heavy-outline' && !isBordeEmergente)
                                ? `${Math.max(1.5, 5 * scale)}px #000000`
                                : (subtitleBorderStyle === 'outline' && !isBordeEmergente)
                                ? `${Math.max(1, 3.5 * scale)}px #000000`
                                : 'none',
                              paintOrder: 'stroke fill'
                            }}
                          >
                            {word.toUpperCase()}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. TELEMETRÍA HUD FLOTANTE (PIXELS, COORDENADAS ASS Y RESOLUCIÓN) */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[9px] font-mono bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 pointer-events-none z-30">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                <strong>CARD:</strong> ({currCardX}, {currCardY}) | <strong>SUBS:</strong> ({currSubX}, {currSubY})
              </span>
            </div>
            <div className="text-amber-400 font-bold hidden sm:inline">
              ASS: \pos({Math.round((nativeResX / 2) + currSubX)}, {Math.round((nativeResY / 2) + currSubY)})
            </div>
            <div className="text-slate-400">
              {font} · {activeFontSize}px
            </div>
          </div>
        </div>

        {/* Barra de Atajos Rápidos de Centrado y Gizmos */}
        <div className="flex items-center gap-3 mt-3 text-xs">
          <button
            type="button"
            onClick={handleResetPosition}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Centrar Tarjeta (0, 0)</span>
          </button>
          <button
            type="button"
            onClick={handleResetSubtitlePosition}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3 text-cyan-400" />
            <span>Centrar Subtítulos (0, 0)</span>
          </button>
        </div>
      </div>

      {/* 4. LÍNEA DE TIEMPO MULTITRACK INTEGRADA (ESTILO DRIFT STUDIO) */}
      <div className="w-full bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2.5 shadow-lg">
        {/* Encabezado y Controles de Transporte de Timeline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black text-slate-200 uppercase tracking-wide">
              Línea de Tiempo Multitrack
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {((timelineProgress / 100) * 5.3).toFixed(1)}s / 5.3s
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isPlayingTimeline ? handleResetTimelineSimulation : handleStartTimelineSimulation}
              className={`flex items-center gap-1.5 font-black px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer shadow-sm uppercase ${
                isPlayingTimeline
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:brightness-110 active:scale-[0.97]'
              }`}
            >
              {isPlayingTimeline ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span>Detener</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Simular Secuencia</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetTimelineSimulation}
              className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-slate-800 transition-colors cursor-pointer"
              title="Reiniciar cabezal al inicio (0.0s)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Pistas Interactivas con Aguja de Scrubber */}
        <div
          className="relative bg-black/90 rounded-xl p-2 border border-white/5 space-y-1.5 cursor-pointer select-none group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            handleScrubTimeline(pct);
          }}
        >
          {/* Regla y Marcas de Tiempo */}
          <div className="flex justify-between text-[8px] font-mono text-slate-500 px-1 pointer-events-none">
            <span>0.0s</span>
            <span>1.0s</span>
            <span>2.0s</span>
            <span>3.0s</span>
            <span>4.0s</span>
            <span>5.3s</span>
          </div>

          {/* Aguja / Cabezal de Reproducción (Playhead Needle) */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)] z-30 pointer-events-none transition-[left] duration-75"
            style={{ left: `${Math.max(1, Math.min(99, timelineProgress))}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rotate-45 rounded-[1px] shadow-sm" />
          </div>

          {/* Pista 1: Tarjeta Reddit */}
          <div className="h-6 w-full bg-white/5 rounded-lg relative overflow-hidden flex items-center text-[9px] font-mono px-1">
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-amber-600/40 via-amber-500/25 to-orange-600/40 border border-amber-500/40 rounded flex items-center px-2 justify-between overflow-hidden"
              style={{ width: '53%' }}
            >
              <span className="text-amber-300 font-bold truncate">🎴 Reddit Card (Entrada + Hold + Salida)</span>
              {cardSfxEnabled && (
                <span className="bg-amber-400 text-black font-black text-[7px] px-1 py-0.2 rounded shadow uppercase shrink-0">
                  🔊 SFX: {cardSfxSound}
                </span>
              )}
            </div>
          </div>

          {/* Pista 2: Subtítulos Dinámicos */}
          <div className="h-6 w-full bg-white/5 rounded-lg relative overflow-hidden flex items-center text-[9px] font-mono px-1">
            <div
              className="absolute top-0 bottom-0 left-[53%] right-0 bg-gradient-to-r from-cyan-600/35 via-blue-600/30 to-indigo-600/35 border border-cyan-400/40 rounded flex items-center px-2 justify-between overflow-hidden"
            >
              <span className="text-cyan-300 font-bold truncate">💬 Subtítulos ({animation})</span>
              <span className="text-slate-400 text-[8px] font-mono shrink-0">{font}</span>
            </div>
          </div>

          {/* Pista 3: Video de Fondo & Audio */}
          <div className="h-6 w-full bg-white/5 rounded-lg relative overflow-hidden flex items-center text-[9px] font-mono px-1">
            <div className="w-full h-full bg-gradient-to-r from-slate-700/30 via-indigo-950/40 to-slate-700/30 border border-slate-600/30 rounded flex items-center px-2 justify-between overflow-hidden">
              <span className="text-slate-300 truncate">🎬 Video de Fondo</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {backgroundBlur > 0 && (
                  <span className="bg-indigo-500/30 text-indigo-300 text-[8px] px-1.5 py-0.2 rounded">
                    Blur {backgroundBlur}px
                  </span>
                )}
                {musicEnabled && (
                  <span className="bg-emerald-500/30 text-emerald-300 text-[8px] px-1.5 py-0.2 rounded">
                    🎵 {musicVolume}dB
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Estado de Reproducción Drift */}
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="text-slate-400 font-medium">Estado del Motor:</span>
          <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-0.5 rounded ${
            previewState === 'idle' ? 'bg-slate-800 text-slate-300' :
            previewState === 'intro' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
            previewState === 'static' ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
            previewState === 'outro' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' :
            'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
          }`}>
            {previewState === 'idle' ? 'Edición Estática' :
             previewState === 'intro' ? 'Entrada Spring Card' :
             previewState === 'static' ? 'Card en Pantalla' :
             previewState === 'outro' ? 'Salida Easing Card' :
             'Subtítulos Dinámicos'}
          </span>
        </div>
      </div>
    </div>
  );
}

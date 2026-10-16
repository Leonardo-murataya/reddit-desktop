import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, Palette, Volume2, Type, Move, Upload, Eye, Zap, Play, RotateCcw, VolumeX, Sparkles, Download, Shield, Music, AlertTriangle, FolderOpen, Users, Info, Layers, Film, Clock, Square } from 'lucide-react';
import AwardPickerModal from './AwardPickerModal';
import LiveCanvasStage from './LiveCanvasStage';
import { useUIModal } from '../context/UIModalContext';

const EDGE_VOICES = [
  { value: 'es-MX-JorgeNeural', label: 'Español (México) - Jorge (Masculino, Natural)' },
  { value: 'es-MX-DaliaNeural', label: 'Español (México) - Dalia (Femenino, Dulce)' },
  { value: 'es-ES-AlvaroNeural', label: 'Español (España) - Alvaro (Masculino)' },
  { value: 'es-ES-ElviraNeural', label: 'Español (España) - Elvira (Femenino)' },
  { value: 'es-US-AlonsoNeural', label: 'Español (USA) - Alonso (Masculino)' },
  { value: 'es-US-PalomaNeural', label: 'Español (USA) - Paloma (Femenino)' },
  { value: 'en-US-GuyNeural', label: 'Inglés (USA) - Guy (Masculino, Profundo)' },
  { value: 'en-US-AriaNeural', label: 'Inglés (USA) - Aria (Femenino, Claro)' }
];

const FONTS = [
  { value: 'Arial Bold', label: 'Arial Bold (Altamente visible, estándar)' },
  { value: 'Bangers', label: 'Bangers (Estilo Cómic / Viral)' },
  { value: 'Impact', label: 'Impact (Estilo memes, grueso)' },
  { value: 'Montserrat', label: 'Montserrat (Moderno, elegante)' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS (Redondeado)' }
];

const ANIMATIONS = [
  { value: 'tiktok-pop', label: 'TikTok Pop (Palabra a la vez, escala y resalte rápido)' },
  { value: 'bounce-pop', label: 'Bounce Pop (Palabra a la vez, efecto rebote elástico)' },
  { value: 'kinetic-wave', label: 'Kinetic Wave (Onda cinética con micro-giro, estilo Drift)' },
  { value: 'typewriter', label: 'Typewriter (Máquina de escribir cinemática rápida)' },
  { value: 'neon-glow', label: 'Neon Glow (Resplandor de neón de alto impacto)' },
  { value: 'slide-up', label: 'Slide Up (Deslizamiento ascendente fluido)' },
  { value: 'borde-emergente-2', label: 'Borde Emergente II (Caja Capcut con Borde de Color)' },
  { value: 'active-highlight', label: 'Active Highlight (Bloque frase, ilumina activa)' },
  { value: 'glow-karaoke', label: 'Glow Karaoke (Frase bloque con brillo neón contorno)' },
  { value: 'clean-fade', label: 'Clean Fade (Bloque de texto con fundido suave)' }
];

const STYLE_PACKS = [
  { id: 'hormozi', name: 'Viral Hormozi', icon: '🔥', font: 'Bangers', color: '#FFFF00', passive: '#FFFFFF', anim: 'tiktok-pop', border: 'heavy-outline' },
  { id: 'drift', name: 'Drift Kinetic', icon: '⚡', font: 'Montserrat', color: '#00FFFF', passive: '#FFFFFF', anim: 'kinetic-wave', border: 'outline' },
  { id: 'capcut', name: 'Capcut Box II', icon: '🎬', font: 'Arial Bold', color: '#FFFFFF', passive: '#D1D5DB', anim: 'borde-emergente-2', border: 'box' },
  { id: 'neon', name: 'Cyberpunk Neon', icon: '🕹️', font: 'Montserrat', color: '#FF007F', passive: '#FFFFFF', anim: 'neon-glow', border: 'outline' },
  { id: 'typewriter', name: 'Typewriter', icon: '📜', font: 'Arial Bold', color: '#FACC15', passive: '#E2E8F0', anim: 'typewriter', border: 'outline' },
  { id: 'slide', name: 'Slide Up', icon: '🚀', font: 'Trebuchet MS', color: '#38BDF8', passive: '#FFFFFF', anim: 'slide-up', border: 'outline' },
  { id: 'minimal', name: 'Minimalist Clean', icon: '💎', font: 'Arial Bold', color: '#FFFFFF', passive: '#94A3B8', anim: 'clean-fade', border: 'outline' }
];

const BORDER_STYLES = [
  { value: 'outline', label: 'Borde Fino Estándar (Outline)' },
  { value: 'heavy-outline', label: 'Contorno Grueso Negrita' },
  { value: 'box', label: 'Caja de Fondo Sólida (Capcut/TikTok Style)' }
];

const ENTRY_ANIMS = [
  { value: 'none', label: 'Sin animación (Instantáneo)' },
  { value: 'fade-in', label: 'Fade In (Fundido suave)' },
  { value: 'slide-in-left', label: 'Slide In Left (Desplazamiento izquierda)' },
  { value: 'slide-in-right', label: 'Slide In Right (Desplazamiento derecha)' },
  { value: 'slide-in-bottom', label: 'Slide In Bottom (Desplazamiento abajo)' },
  { value: 'slide-in-top', label: 'Slide In Top (Desplazamiento arriba)' },
  { value: 'zoom-in', label: 'Zoom In (Escalado elegante)' }
];

const WATERMARK_ANIMS = [
  { value: 'none', label: 'Estática (Fija en posición)' },
  { value: 'bounce', label: 'Rebote de Esquina (DVD Bounce)' },
  { value: 'wobble', label: 'Bamboleo (Giro de vaivén)' },
  { value: 'bounce-wobble', label: 'Rebote de Esquina + Bamboleo' }
];

const ALIGNMENTS = [
  { value: 7, label: 'Arriba Izquierda' },
  { value: 8, label: 'Arriba Centro' },
  { value: 9, label: 'Arriba Derecha' },
  { value: 4, label: 'Centro Izquierda' },
  { value: 5, label: 'Centro Centro' },
  { value: 6, label: 'Centro Derecha' },
  { value: 1, label: 'Abajo Izquierda' },
  { value: 2, label: 'Abajo Centro' },
  { value: 3, label: 'Abajo Derecha' }
];

const EXIT_ANIMS = [
  { value: 'none', label: 'Sin animación (Instantáneo)' },
  { value: 'fade-out', label: 'Fade Out (Fundido suave)' },
  { value: 'slide-out-left', label: 'Slide Out Left (Desplazamiento izquierda)' },
  { value: 'slide-out-right', label: 'Slide Out Right (Desplazamiento derecha)' },
  { value: 'slide-out-bottom', label: 'Slide Out Bottom (Desplazamiento abajo)' },
  { value: 'slide-out-top', label: 'Slide Out Top (Desplazamiento arriba)' },
  { value: 'zoom-out', label: 'Zoom Out (Reducción elegante)' }
];


// Convierte un string de rate relativo (ej. "+15%", "-20%") a un porcentaje numérico absoluto (ej. 115, 80)
const rateToPercentValue = (rateStr) => {
  if (!rateStr) return 100;
  const match = rateStr.match(/^([+-])(\d+)%$/);
  if (match) {
    const sign = match[1];
    const val = parseInt(match[2]);
    return sign === '+' ? (100 + val) : (100 - val);
  }
  const pctMatch = rateStr.match(/^(\d+)%$/);
  if (pctMatch) {
    return parseInt(pctMatch[1]);
  }
  return 100;
};

// Convierte un porcentaje numérico absoluto (ej. 115, 80) a un string de rate relativo (ej. "+15%", "-20%")
const percentValueToRateStr = (val) => {
  const num = parseInt(val) || 100;
  if (num >= 100) {
    return `+${num - 100}%`;
  } else {
    return `-${100 - num}%`;
  }
};

export default function TemplateEditor({ templates, profiles = [], onSave, onDelete, onImport }) {
  const { showToast, showAlert, showConfirm } = useUIModal();
  const [selectedId, setSelectedId] = useState('');
  
  // Pestaña activa del editor para organizar y no abrumar al usuario
  const [activeTab, setActiveTab] = useState('card'); // 'card' | 'subtitles' | 'voice'

  // Estados de los campos
  const [name, setName] = useState('Nueva Plantilla');
  const [profileId, setProfileId] = useState(''); // Vinculación de perfil de IA
  const [defaultIdea, setDefaultIdea] = useState(''); // Semilla/Idea por defecto
  const [maleVoice, setMaleVoice] = useState('es-MX-JorgeNeural');
  const [femaleVoice, setFemaleVoice] = useState('es-MX-DaliaNeural');
  const [narratorGender, setNarratorGender] = useState('male'); // 'male' | 'female' | 'auto'
  const [voiceRate, setVoiceRate] = useState('+0%'); // Velocidad de las voces
  const [font, setFont] = useState('Arial Bold');
  const [fontSize, setFontSize] = useState(100);
  const [subtitleColor, setSubtitleColor] = useState('#FFFF00');
  const [passiveColor, setPassiveColor] = useState('#FFFFFF');
  const [animation, setAnimation] = useState('tiktok-pop');
  const [subtitleBorderStyle, setSubtitleBorderStyle] = useState('outline'); // Estilo sombreado
  
  // Tarjeta de Reddit
  const [cardTheme, setCardTheme] = useState('dark');
  const [cardType, setCardType] = useState('static'); // 'static' (PNG fija) o 'animated' (Medallas GIF)
  const [cardUsername, setCardUsername] = useState('postfully_user');
  const [cardSubreddit, setCardSubreddit] = useState('r/AskReddit');
  const [cardAvatar, setCardAvatar] = useState('/assets/reddit-avatar.png');
  const avatarFileInputRef = useRef(null);
  const [upvotes, setUpvotes] = useState('12.4k');
  const [comments, setComments] = useState('890');
  
  // Parámetros de Postfully V2
  const [cardShowVerified, setCardShowVerified] = useState(true);
  const [cardShowAwards, setCardShowAwards] = useState(true);
  const [cardSelectedAwards, setCardSelectedAwards] = useState([]);
  const [showAwardPicker, setShowAwardPicker] = useState(false);
  const [cardWidth, setCardWidth] = useState(260);
  const [cardBorderRadius, setCardBorderRadius] = useState(11);
  const [cardPadding, setCardPadding] = useState(12);
  const [cardGap, setCardGap] = useState(7);
  
  // Posicionamiento y Animaciones del Card
  const [cardOffsetX, setCardOffsetX] = useState(0);
  const [cardOffsetY, setCardOffsetY] = useState(0);
  const [cardEntryAnimation, setCardEntryAnimation] = useState('none');
  const [cardExitAnimation, setCardExitAnimation] = useState('none');
  const [cardEntryDuration, setCardEntryDuration] = useState(0.4);
  const [cardExitDuration, setCardExitDuration] = useState(0.4);

  // Posicionamiento y Animaciones de Subtítulos
  const [subtitleOffsetX, setSubtitleOffsetX] = useState(0);
  const [subtitleOffsetY, setSubtitleOffsetY] = useState(0);
  const [subtitleAnimationSpeed, setSubtitleAnimationSpeed] = useState(80);

  // Título de prueba para previsualización dinámica
  const [testTitle, setTestTitle] = useState('Mi vecino de al lado tiene cámaras apuntando directamente a mi ventana y la policía dice que es legal [Card Dinámica]');
  const [testSubtitleText, setTestSubtitleText] = useState('Esta es una previsualización de subtítulos dinámicos de Reddit');
  const [activeWordIndex, setActiveWordIndex] = useState(0);

  // Fuentes dinámicas (Cargadas de /api/fonts)
  const [availableFonts, setAvailableFonts] = useState(FONTS);

  useEffect(() => {
    fetch('/api/fonts')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableFonts(data);
        }
      })
      .catch(err => console.error('Error cargando fuentes dinámicas:', err));
  }, []);

  const handleFontFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      fetch('/api/fonts/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, data: evt.target.result })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setAvailableFonts(data.fonts);
            setFont(data.fontName);
            showToast(`Fuente "${data.fontName}" cargada exitosamente.`, 'success');
          } else {
            showAlert(data.error || 'No se pudo procesar el archivo de fuente seleccionado.', 'Error al Subir Fuente', 'error');
          }
        })
        .catch(err => console.error('Error al subir fuente:', err));
    };
    reader.readAsDataURL(file);
  };

  // Estados del Audicionador de Voz en Vivo
  const [previewTestText, setPreviewTestText] = useState('Hola, esto es una prueba en tiempo real para verificar la entonación y velocidad de la voz seleccionada.');
  const [previewVoice, setPreviewVoice] = useState('es-MX-JorgeNeural');
  const [previewRate, setPreviewRate] = useState('+15%');
  const [previewAudioUrl, setPreviewAudioUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewWarningMsg, setPreviewWarningMsg] = useState('');
  const [previewProgress, setPreviewProgress] = useState(0);
  const [subtitleLetterSpacing, setSubtitleLetterSpacing] = useState(0);
  const [subtitleDelay, setSubtitleDelay] = useState(0.15);
  const [cardScale, setCardScale] = useState(1.0);
  const [cardOffsetX_16_9, setCardOffsetX_16_9] = useState(0);
  const [cardOffsetY_16_9, setCardOffsetY_16_9] = useState(0);
  const [cardScale_16_9, setCardScale_16_9] = useState(1.0);
  const [subtitleOffsetX_16_9, setSubtitleOffsetX_16_9] = useState(0);
  const [subtitleOffsetY_16_9, setSubtitleOffsetY_16_9] = useState(0);
  const [fontSize_16_9, setFontSize_16_9] = useState(100);
  const [exportFormat, setExportFormat] = useState('9-16'); // '9-16' | '16-9' | 'both'
  const [previewOrientation, setPreviewOrientation] = useState('9:16'); // '9:16' | '16:9'
  const [includeApiKeyInExport, setIncludeApiKeyInExport] = useState(false);

  // Estados para el Gizmo de Arrastre Directo en Pantalla (Drift Transform Gizmo)
  const previewContainerRef = useRef(null);
  const [activeDragTarget, setActiveDragTarget] = useState(null); // 'subtitles' | 'card' | null
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragInitialOffsets, setDragInitialOffsets] = useState({ x: 0, y: 0 });
  const [isSnappedX, setIsSnappedX] = useState(false);
  const [isSnappedY, setIsSnappedY] = useState(false);
  const [isHoveredTarget, setIsHoveredTarget] = useState(null); // 'subtitles' | 'card' | null

  // Estados de la marca de agua
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState('@marca_agua');
  const [watermarkFont, setWatermarkFont] = useState('Arial Bold');
  const [watermarkSize, setWatermarkSize] = useState(24);
  const [watermarkColor, setWatermarkColor] = useState('#FFFFFF');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.4);
  const [watermarkAlignment, setWatermarkAlignment] = useState(9); // 9 = Arriba Derecha
  const [watermarkOffsetX, setWatermarkOffsetX] = useState(20);
  const [watermarkOffsetY, setWatermarkOffsetY] = useState(20);
  const [watermarkAnimation, setWatermarkAnimation] = useState('none');
  const [watermarkSpeed, setWatermarkSpeed] = useState(2.5);

  // Estados de la marca de agua con imagen
  const [watermarkType, setWatermarkType] = useState('text'); // 'text' | 'image'
  const [watermarkImageFile, setWatermarkImageFile] = useState('');
  const [watermarkImageScale, setWatermarkImageScale] = useState(0.15);
  const [watermarkImageOpacity, setWatermarkImageOpacity] = useState(0.5);
  const [watermarkImageAlignment, setWatermarkImageAlignment] = useState(9);
  const [watermarkImageOffsetX, setWatermarkImageOffsetX] = useState(20);
  const [watermarkImageOffsetY, setWatermarkImageOffsetY] = useState(20);

  // Estados de la música de fondo
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicFile, setMusicFile] = useState('');
  const [musicVolume, setMusicVolume] = useState(-20);
  const [musicFileExists, setMusicFileExists] = useState(true);

  // Estados de multivoz (nuevo)
  const [multiVoiceEnabled, setMultiVoiceEnabled] = useState(false);
  const [multiVoiceSecondaryFemale1, setMultiVoiceSecondaryFemale1] = useState('es-MX-DaliaNeural');
  const [multiVoiceSecondaryFemale2, setMultiVoiceSecondaryFemale2] = useState('es-MX-DaliaNeural');
  const [multiVoiceSecondaryMale1, setMultiVoiceSecondaryMale1] = useState('es-MX-JorgeNeural');
  const [multiVoiceSecondaryMale2, setMultiVoiceSecondaryMale2] = useState('es-MX-JorgeNeural');
  const [multiVoiceMaxVoices, setMultiVoiceMaxVoices] = useState(4);
  const [multiVoicePromptExtension, setMultiVoicePromptExtension] = useState(
    'Si la historia contiene interacciones o confrontaciones entre múltiples personas, reescribe el campo "content" no como un monólogo continuo, sino como un diálogo dramático y dinámico donde participen los distintos personajes (ej. Clara, Sofía, Alejandro). Devuelve el campo "content" como una lista (array de objetos) en formato JSON estructurado llamado "dialogues" en lugar de la cadena de texto tradicional. Cada objeto del diálogo debe tener: "role" (narrator para la protagonista, o el nombre del personaje secundario como "alejandro", "sofia"), "text" (la frase corta que dice, máximo 15 palabras sin repetir nombres), y "gender" (male o female para ese personaje). Asegúrate de que las confrontaciones se sientan intensas y los diálogos sean breves y de alta retención.'
  );

  // Estados de Efectos Cinemáticos y SFX estilo Drift
  const [cardSfxEnabled, setCardSfxEnabled] = useState(false);
  const [cardSfxSound, setCardSfxSound] = useState('whoosh'); // 'whoosh' | 'pop' | 'slam' | 'ding'
  const [cardSfxVolume, setCardSfxVolume] = useState(-6);
  const [backgroundBlur, setBackgroundBlur] = useState(0);
  const [backgroundBlurMode, setBackgroundBlurMode] = useState('card-only'); // 'card-only' | 'all'
  const [vignetteStrength, setVignetteStrength] = useState(0);
  const [backgroundSaturation, setBackgroundSaturation] = useState(1.15);
  const [backgroundContrast, setBackgroundContrast] = useState(1.05);

  // Estados de la Línea de Tiempo Multitrack (Drift Studio)
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [timelineProgress, setTimelineProgress] = useState(0); // 0% a 100%
  const timelineRafRef = useRef(null);

  // Reproductor de preescucha SFX
  const playSfxPreview = (soundName = cardSfxSound) => {
    try {
      const audio = new Audio(`/assets/sfx/${soundName}.wav`);
      audio.volume = Math.min(1, Math.max(0, Math.pow(10, cardSfxVolume / 20)));
      audio.play().catch(e => console.warn('[SFX Preview] Error al reproducir audio:', e.message));
    } catch (err) {
      console.warn('[SFX Preview] Error creando Audio:', err);
    }
  };

  // Cargar dinámicamente la fuente Bangers de Google Fonts para la previsualización en vivo
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Bangers&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      try {
        document.head.removeChild(link);
      } catch {
        // Ignorar si ya fue removido
      }
    };
  }, []);

  const checkMusicFileExists = async (filePath) => {
    if (!filePath) {
      setMusicFileExists(true);
      return;
    }
    try {
      const res = await fetch(`/api/utils/file-exists?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      setMusicFileExists(data.exists);
    } catch {
      setMusicFileExists(false);
    }
  };

  // Controladores de simulación de video cronológico
  const [previewState, setPreviewState] = useState('idle'); // 'idle' | 'intro' | 'static' | 'outro' | 'subtitles'
  const timelineTimeoutRef = useRef([]);

  // Cargar plantilla activa en los campos
  useEffect(() => {
    if (templates.length > 0) {
      if (selectedId === 'new') {
        return;
      }

      let targetId = selectedId;
      if (!targetId) {
        targetId = templates[0].id;
      }

      const active = templates.find(t => t.id === targetId);
      if (!active) {
        // Esperar defensivamente a que la prop de plantillas se actualice asíncronamente desde el componente padre
        return;
      }

      if (selectedId !== active.id) {
        setSelectedId(active.id);
      }
      setName(active.name);
        setProfileId(active.profileId || '');
        setDefaultIdea(active.defaultIdea || '');
        setMaleVoice(active.maleVoice);
        setFemaleVoice(active.femaleVoice);
        setNarratorGender(active.narratorGender || 'male');
        setVoiceRate(active.voiceRate || '+0%');
        setFont(active.font);
        setFontSize(active.fontSize || 24);
        setSubtitleColor(active.subtitleColor || '#FFFF00');
        setPassiveColor(active.passiveColor || '#FFFFFF');
        setAnimation(active.animation || 'tiktok-pop');
        setSubtitleBorderStyle(active.subtitleBorderStyle || 'outline');
        setCardTheme(active.cardTheme || 'dark');
        setCardType(active.cardType || 'static');
        setCardUsername(active.cardUsername || 'postfully_user');
        setCardSubreddit(active.cardSubreddit || 'r/AskReddit');
        setCardAvatar(active.cardAvatar || '/assets/reddit-avatar.png');
        setUpvotes(active.upvotes || '12.4k');
        setComments(active.comments || '890');
        setCardShowVerified(active.cardShowVerified !== undefined ? active.cardShowVerified : true);
        setCardShowAwards(active.cardShowAwards !== undefined ? active.cardShowAwards : true);
        setCardSelectedAwards(active.cardSelectedAwards || []);
        setCardWidth(active.cardWidth !== undefined ? active.cardWidth : 260);
        setCardBorderRadius(active.cardBorderRadius !== undefined ? active.cardBorderRadius : 11);
        setCardPadding(active.cardPadding !== undefined ? active.cardPadding : 12);
        setCardGap(active.cardGap !== undefined ? active.cardGap : 7);
        setCardOffsetX(active.cardOffsetX !== undefined ? active.cardOffsetX : 0);
        setCardOffsetY(active.cardOffsetY !== undefined ? active.cardOffsetY : 0);
        setCardEntryAnimation(active.cardEntryAnimation || 'none');
        setCardExitAnimation(active.cardExitAnimation || 'none');
        setCardEntryDuration(active.cardEntryDuration !== undefined ? active.cardEntryDuration : 0.4);
        setCardExitDuration(active.cardExitDuration !== undefined ? active.cardExitDuration : 0.4);
        setSubtitleOffsetX(active.subtitleOffsetX !== undefined ? active.subtitleOffsetX : 0);
        setSubtitleOffsetY(active.subtitleOffsetY !== undefined ? active.subtitleOffsetY : 0);
        setSubtitleAnimationSpeed(active.subtitleAnimationSpeed !== undefined ? active.subtitleAnimationSpeed : 80);
        setSubtitleLetterSpacing(active.subtitleLetterSpacing !== undefined ? active.subtitleLetterSpacing : 0);
        setSubtitleDelay(active.subtitleDelay !== undefined ? active.subtitleDelay : 0.15);
        setCardScale(active.cardScale !== undefined ? active.cardScale : 1.0);
        setCardOffsetX_16_9(active.cardOffsetX_16_9 !== undefined ? active.cardOffsetX_16_9 : 0);
        setCardOffsetY_16_9(active.cardOffsetY_16_9 !== undefined ? active.cardOffsetY_16_9 : 0);
        setCardScale_16_9(active.cardScale_16_9 !== undefined ? active.cardScale_16_9 : 1.0);
        setSubtitleOffsetX_16_9(active.subtitleOffsetX_16_9 !== undefined ? active.subtitleOffsetX_16_9 : 0);
        setSubtitleOffsetY_16_9(active.subtitleOffsetY_16_9 !== undefined ? active.subtitleOffsetY_16_9 : 0);
        setFontSize_16_9(active.fontSize_16_9 !== undefined ? active.fontSize_16_9 : 24);
        setExportFormat(active.exportFormat || '9-16');
        setWatermarkEnabled(active.watermarkEnabled !== undefined ? active.watermarkEnabled : false);
        setWatermarkText(active.watermarkText || '@marca_agua');
        setWatermarkFont(active.watermarkFont || 'Arial Bold');
        setWatermarkSize(active.watermarkSize !== undefined ? active.watermarkSize : 24);
        setWatermarkColor(active.watermarkColor || '#FFFFFF');
        setWatermarkOpacity(active.watermarkOpacity !== undefined ? active.watermarkOpacity : 0.4);
        setWatermarkAlignment(active.watermarkAlignment !== undefined ? active.watermarkAlignment : 9);
        setWatermarkOffsetX(active.watermarkOffsetX !== undefined ? active.watermarkOffsetX : 20);
        setWatermarkOffsetY(active.watermarkOffsetY !== undefined ? active.watermarkOffsetY : 20);
        setWatermarkAnimation(active.watermarkAnimation || 'none');
        setWatermarkSpeed(active.watermarkSpeed !== undefined ? active.watermarkSpeed : 2.5);
        setWatermarkType(active.watermarkType || 'text');
        setWatermarkImageFile(active.watermarkImageFile || '');
        setWatermarkImageScale(active.watermarkImageScale !== undefined ? active.watermarkImageScale : 0.15);
        setWatermarkImageOpacity(active.watermarkImageOpacity !== undefined ? active.watermarkImageOpacity : 0.5);
        setWatermarkImageAlignment(active.watermarkImageAlignment !== undefined ? active.watermarkImageAlignment : 9);
        setWatermarkImageOffsetX(active.watermarkImageOffsetX !== undefined ? active.watermarkImageOffsetX : 20);
        setWatermarkImageOffsetY(active.watermarkImageOffsetY !== undefined ? active.watermarkImageOffsetY : 20);
        const activeMusicFile = active.musicFile || '';
        setMusicEnabled(active.musicEnabled !== undefined ? active.musicEnabled : false);
        setMusicFile(activeMusicFile);
        setMusicVolume(active.musicVolume !== undefined ? active.musicVolume : -20);
        checkMusicFileExists(activeMusicFile);
        
        // Cargar multivoz
        setMultiVoiceEnabled(active.multiVoiceEnabled !== undefined ? active.multiVoiceEnabled : false);
        setMultiVoiceSecondaryFemale1(active.multiVoiceSecondaryFemale1 || 'es-MX-DaliaNeural');
        setMultiVoiceSecondaryFemale2(active.multiVoiceSecondaryFemale2 || 'es-MX-DaliaNeural');
        setMultiVoiceSecondaryMale1(active.multiVoiceSecondaryMale1 || 'es-MX-JorgeNeural');
        setMultiVoiceSecondaryMale2(active.multiVoiceSecondaryMale2 || 'es-MX-JorgeNeural');
        setMultiVoiceMaxVoices(active.multiVoiceMaxVoices !== undefined ? active.multiVoiceMaxVoices : 4);
        setMultiVoicePromptExtension(active.multiVoicePromptExtension !== undefined ? active.multiVoicePromptExtension : 'Si la historia contiene interacciones o confrontaciones entre múltiples personas, reescribe el campo "content" no como un monólogo continuo, sino como un diálogo dramático y dinámico donde participen los distintos personajes (ej. Clara, Sofía, Alejandro). Devuelve el campo "content" como una lista (array de objetos) en formato JSON estructurado llamado "dialogues" en lugar de la cadena de texto tradicional. Cada objeto del diálogo debe tener: "role" (narrator para la protagonista, o el nombre del personaje secundario como "alejandro", "sofia"), "text" (la frase corta que dice, máximo 15 palabras sin repetir nombres), y "gender" (male o female para ese personaje). Asegúrate de que las confrontaciones se sientan intensas y los diálogos sean breves y de alta retención.');

        // Cargar efectos cinemáticos y SFX estilo Drift
        setCardSfxEnabled(active.cardSfxEnabled !== undefined ? active.cardSfxEnabled : false);
        setCardSfxSound(active.cardSfxSound || 'whoosh');
        setCardSfxVolume(active.cardSfxVolume !== undefined ? active.cardSfxVolume : -6);
        setBackgroundBlur(active.backgroundBlur !== undefined ? active.backgroundBlur : 0);
        setBackgroundBlurMode(active.backgroundBlurMode || 'card-only');
        setVignetteStrength(active.vignetteStrength !== undefined ? active.vignetteStrength : 0);
        setBackgroundSaturation(active.backgroundSaturation !== undefined ? active.backgroundSaturation : 1.15);
        setBackgroundContrast(active.backgroundContrast !== undefined ? active.backgroundContrast : 1.05);
    }
  }, [selectedId, templates]);

  // Sincronizar selectores de prueba al cambiar voces del template
  useEffect(() => {
    setPreviewVoice(maleVoice);
    setPreviewRate(voiceRate);
  }, [maleVoice, voiceRate]);

  // Intervalo dinámico para simular la animación de subtítulos
  useEffect(() => {
    const words = testSubtitleText.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    
    const interval = setInterval(() => {
      if (previewState === 'subtitles' || previewState === 'idle') {
        setActiveWordIndex((prev) => (prev + 1) % words.length);
      }
    }, 450);
    
    return () => clearInterval(interval);
  }, [testSubtitleText, previewState]);

  // Limpiar timers y animación RAF en desmontaje
  useEffect(() => {
    return () => {
      timelineTimeoutRef.current.forEach(clearTimeout);
      if (timelineRafRef.current) cancelAnimationFrame(timelineRafRef.current);
    };
  }, []);

  const handleStartTimelineSimulation = () => {
    timelineTimeoutRef.current.forEach(clearTimeout);
    timelineTimeoutRef.current = [];
    if (timelineRafRef.current) cancelAnimationFrame(timelineRafRef.current);

    setPreviewState('intro');
    setActiveWordIndex(0);
    setIsPlayingTimeline(true);
    setTimelineProgress(0);

    if (cardSfxEnabled) {
      playSfxPreview();
    }

    const tEntry = (parseFloat(cardEntryDuration) || 0.4) * 1000;
    const tStatic = 2000;
    const tExit = (parseFloat(cardExitDuration) || 0.4) * 1000;
    const tSubs = 2500;
    const totalDuration = tEntry + tStatic + tExit + tSubs;
    const simStartTime = Date.now();

    const loopRaf = () => {
      const elapsed = Date.now() - simStartTime;
      const progress = Math.min(100, (elapsed / totalDuration) * 100);
      setTimelineProgress(progress);
      if (progress < 100) {
        timelineRafRef.current = requestAnimationFrame(loopRaf);
      }
    };
    timelineRafRef.current = requestAnimationFrame(loopRaf);

    const t1 = setTimeout(() => {
      setPreviewState('static');
    }, tEntry);
    timelineTimeoutRef.current.push(t1);

    const t2 = setTimeout(() => {
      setPreviewState('outro');
    }, tEntry + tStatic);
    timelineTimeoutRef.current.push(t2);

    const t3 = setTimeout(() => {
      setPreviewState('subtitles');
    }, tEntry + tStatic + tExit);
    timelineTimeoutRef.current.push(t3);

    const t4 = setTimeout(() => {
      setIsPlayingTimeline(false);
      setTimelineProgress(100);
      if (timelineRafRef.current) cancelAnimationFrame(timelineRafRef.current);
    }, totalDuration);
    timelineTimeoutRef.current.push(t4);
  };

  const handleResetTimelineSimulation = () => {
    timelineTimeoutRef.current.forEach(clearTimeout);
    timelineTimeoutRef.current = [];
    if (timelineRafRef.current) cancelAnimationFrame(timelineRafRef.current);
    setPreviewState('idle');
    setActiveWordIndex(0);
    setIsPlayingTimeline(false);
    setTimelineProgress(0);
  };

  const handleScrubTimeline = (pct) => {
    timelineTimeoutRef.current.forEach(clearTimeout);
    timelineTimeoutRef.current = [];
    if (timelineRafRef.current) cancelAnimationFrame(timelineRafRef.current);
    setIsPlayingTimeline(false);
    const clamped = Math.max(0, Math.min(100, pct));
    setTimelineProgress(clamped);

    const tEntry = (parseFloat(cardEntryDuration) || 0.4) * 1000;
    const tStatic = 2000;
    const tExit = (parseFloat(cardExitDuration) || 0.4) * 1000;
    const tSubs = 2500;
    const totalDuration = tEntry + tStatic + tExit + tSubs;
    const currentMs = (clamped / 100) * totalDuration;

    if (currentMs < tEntry) {
      setPreviewState('intro');
    } else if (currentMs < tEntry + tStatic) {
      setPreviewState('static');
    } else if (currentMs < tEntry + tStatic + tExit) {
      setPreviewState('outro');
    } else {
      setPreviewState('subtitles');
    }
  };

  const handleCreateNew = () => {
    setSelectedId('new');
    setName('Nueva Plantilla de Video');
    setProfileId('');
    setDefaultIdea('');
    setMaleVoice('es-MX-JorgeNeural');
    setFemaleVoice('es-MX-DaliaNeural');
    setNarratorGender('male');
    setVoiceRate('+0%');
    setFont('Arial Bold');
    setFontSize(100);
    setSubtitleColor('#FFFF00');
    setPassiveColor('#FFFFFF');
    setAnimation('tiktok-pop');
    setSubtitleBorderStyle('outline');
    setCardTheme('dark');
    setCardType('static');
    setCardUsername('reddit_new');
    setCardSubreddit('r/nosleep');
    setCardAvatar('/assets/reddit-avatar.png');
    setUpvotes('5.2k');
    setComments('321');
    setCardShowVerified(true);
    setCardShowAwards(true);
    setCardWidth(260);
    setCardBorderRadius(11);
    setCardPadding(12);
    setCardGap(7);
    setCardOffsetX(0);
    setCardOffsetY(0);
    setCardEntryAnimation('none');
    setCardExitAnimation('none');
    setCardEntryDuration(0.4);
    setCardExitDuration(0.4);
    setSubtitleOffsetX(0);
    setSubtitleOffsetY(0);
    setSubtitleAnimationSpeed(80);
    setSubtitleLetterSpacing(0);
    setSubtitleDelay(0.15);
    setCardScale(1.0);
    setCardOffsetX_16_9(0);
    setCardOffsetY_16_9(0);
    setCardScale_16_9(1.0);
    setSubtitleOffsetX_16_9(0);
    setSubtitleOffsetY_16_9(0);
    setFontSize_16_9(100);
    setExportFormat('9-16');
    setWatermarkEnabled(false);
    setWatermarkText('@marca_agua');
    setWatermarkFont('Arial Bold');
    setWatermarkSize(24);
    setWatermarkColor('#FFFFFF');
    setWatermarkOpacity(0.4);
    setWatermarkAlignment(9);
    setWatermarkOffsetX(20);
    setWatermarkOffsetY(20);
    setWatermarkAnimation('none');
    setWatermarkSpeed(2.5);
    setWatermarkType('text');
    setWatermarkImageFile('');
    setWatermarkImageScale(0.15);
    setWatermarkImageOpacity(0.5);
    setWatermarkImageAlignment(9);
    setWatermarkImageOffsetX(20);
    setWatermarkImageOffsetY(20);
    setMusicEnabled(false);
    setMusicFile('');
    setMusicVolume(-20);
    setMusicFileExists(true);
    
    // Resetear multivoz
    setMultiVoiceEnabled(false);
    setMultiVoiceSecondaryFemale1('es-MX-DaliaNeural');
    setMultiVoiceSecondaryFemale2('es-MX-DaliaNeural');
    setMultiVoiceSecondaryMale1('es-MX-JorgeNeural');
    setMultiVoiceSecondaryMale2('es-MX-JorgeNeural');
    setMultiVoiceMaxVoices(4);
    setMultiVoicePromptExtension('Si la historia contiene interacciones o confrontaciones entre múltiples personas, reescribe el campo "content" no como un monólogo continuo, sino como un diálogo dramático y dinámico donde participen los distintos personajes (ej. Clara, Sofía, Alejandro). Devuelve el campo "content" como una lista (array de objetos) en formato JSON estructurado llamado "dialogues" en lugar de la cadena de texto tradicional. Cada objeto del diálogo debe tener: "role" (narrator para la protagonista, o el nombre del personaje secundario como "alejandro", "sofia"), "text" (la frase corta que dice, máximo 15 palabras sin repetir nombres), y "gender" (male o female para ese personaje). Asegúrate de que las confrontaciones se sientan intensas y los diálogos sean breves y de alta retención.');

    // Resetear cinemática y SFX
    setCardSfxEnabled(false);
    setCardSfxSound('whoosh');
    setCardSfxVolume(-6);
    setBackgroundBlur(0);
    setBackgroundBlurMode('card-only');
    setVignetteStrength(0);
    setBackgroundSaturation(1.15);
    setBackgroundContrast(1.05);

    setPreviewState('idle');
    setIsPlayingTimeline(false);
  };

  const handlePickMusicFile = async () => {
    try {
      const res = await fetch('/api/dialog/music');
      const data = await res.json();
      if (data.path) {
        setMusicFile(data.path);
        checkMusicFileExists(data.path);
      }
    } catch (err) {
      console.error('Error al seleccionar música local:', err);
    }
  };

  const handlePickWatermarkImage = async () => {
    try {
      const res = await fetch('/api/dialog/watermark-image');
      const data = await res.json();
      if (data.path) {
        setWatermarkImageFile(data.path);
      }
    } catch (err) {
      console.error('Error al seleccionar imagen de marca de agua:', err);
    }
  };

  const handleDeleteSubmit = async () => {
    const template = templates.find(t => t.id === selectedId);
    const templateName = template ? template.name : 'esta plantilla';
    const ok = await showConfirm(
      `¿Estás seguro de que deseas eliminar permanentemente la plantilla "${templateName}"?`,
      'Eliminar Plantilla',
      { confirmText: 'Eliminar', cancelText: 'Cancelar', type: 'danger' }
    );
    if (ok) {
      const res = await onDelete(selectedId);
      if (res && res.error) {
        showToast(`Error al eliminar plantilla: ${res.error}`, 'error');
        return;
      }
      const remaining = (templates || []).filter(t => t.id !== selectedId);
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id);
      } else {
        handleCreateNew();
      }
      showToast('Plantilla eliminada exitosamente.', 'success');
    }
  };

  const handleExportTemplate = async () => {
    try {
      const template = templates.find(t => t.id === selectedId);
      if (!template) {
        showAlert('No se pudo encontrar la plantilla seleccionada para exportar.', 'Error al Exportar', 'warning');
        return;
      }
      
      const profile = profiles.find(p => p.id === template.profileId);
      let exportedProfile = null;

      if (profile) {
        if (includeApiKeyInExport) {
          exportedProfile = { ...profile };
        } else {
          exportedProfile = { ...profile, apiKey: '' };
        }
      }

      const templatePackage = {
        type: "reddit-generador-template-package",
        template: { ...template },
        profile: exportedProfile,
        exportedWithApiKey: includeApiKeyInExport
      };

      const defaultFileName = `${(template.name || 'plantilla').toLowerCase().replace(/[^a-z0-9_-]/gi, '_')}_template.json`;
      let saved = false;

      // 1. Probar diálogo nativo del navegador / WebView (File System Access API)
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: defaultFileName,
            types: [{
              description: 'Plantilla de Video JSON (*.json)',
              accept: { 'application/json': ['.json'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(templatePackage, null, 2));
          await writable.close();
          saved = true;
        } catch (pickerErr) {
          if (pickerErr.name === 'AbortError') {
            return; // El usuario cerró o canceló el diálogo
          }
        }
      }

      // 2. Si no se guardó en el frontend, probar el diálogo nativo de Windows del backend
      if (!saved) {
        try {
          const res = await fetch('/api/dialog/save-template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templatePackage,
              defaultName: defaultFileName,
              title: `Guardar Plantilla: ${template.name}`
            })
          });
          const data = await res.json();
          if (data.cancelled) {
            return; // El usuario canceló
          }
          if (data.success) {
            saved = true;
          }
        } catch (serverErr) {
          console.warn('Fallback a descarga tradicional:', serverErr);
        }
      }

      // 3. Fallback en caso extremo
      if (!saved) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(templatePackage, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", defaultFileName);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
      
      if (includeApiKeyInExport) {
        showAlert('⚠️ Plantilla exportada exitosamente CON la clave de API incluida (bajo tu propio riesgo). Recuerda no compartir este archivo con personas no autorizadas.', 'Plantilla Exportada', 'warning');
      } else {
        showToast('Plantilla exportada exitosamente.', 'success');
      }
    } catch (err) {
      console.error(err);
      showAlert('Error al exportar plantilla: ' + err.message, 'Error al Exportar', 'error');
    }
  };

  const handleImportTemplate = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed || parsed.type !== "reddit-generador-template-package" || !parsed.template) {
          showAlert('El archivo seleccionado no contiene un paquete de plantilla de video válido.', 'Formato No Válido', 'warning');
          return;
        }

        const templateName = parsed.template.name;
        const profileName = parsed.profile ? parsed.profile.name : 'Ninguno';

        const ok = await showConfirm(
          `¿Deseas importar la plantilla "${templateName}"?\nSe asociará al perfil de IA: "${profileName}".`,
          'Importar Paquete de Plantilla',
          { confirmText: 'Importar', cancelText: 'Cancelar', type: 'info' }
        );

        if (ok) {
          const res = await onImport(parsed);
          if (res.success) {
            showToast(`¡Plantilla "${templateName}" importada exitosamente!`, 'success');
            if (res.newTemplateId) {
              setSelectedId(res.newTemplateId);
            }
          } else {
            showAlert('Error al importar la plantilla: ' + res.error, 'Error de Importación', 'error');
          }
        }
      } catch (err) {
        console.error(err);
        showAlert('Error al leer el archivo JSON: ' + err.message, 'Error de Lectura', 'error');
      }
    };
    
    fileReader.readAsText(file);
    // Limpiar input
    e.target.value = '';
  };

  const handleNativeAvatarFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      if (base64Data) {
        setCardAvatar(base64Data);
        showToast('Foto de perfil cargada exitosamente.', 'success');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUploadLocalAvatar = async () => {
    try {
      const res = await fetch('/api/dialog/avatar');
      const data = await res.json();
      if (data && data.base64) {
        setCardAvatar(data.base64); // Guardar Base64 para visualización directa
        showToast('Foto de perfil local cargada exitosamente.', 'success');
        return;
      }
    } catch (err) {
      console.warn('Diálogo de servidor no disponible, abriendo selector web:', err);
    }
    if (avatarFileInputRef.current) {
      avatarFileInputRef.current.click();
    }
  };

  const handleResetPosition = () => {
    if (previewOrientation === '16:9') {
      setCardOffsetX_16_9(0);
      setCardOffsetY_16_9(0);
      setCardScale_16_9(1.0);
    } else {
      setCardOffsetX(0);
      setCardOffsetY(0);
      setCardScale(1.0);
    }
  };

  const handleResetSubtitlePosition = () => {
    if (previewOrientation === '16:9') {
      setSubtitleOffsetX_16_9(0);
      setSubtitleOffsetY_16_9(0);
    } else {
      setSubtitleOffsetX(0);
      setSubtitleOffsetY(0);
    }
    showToast('Posición de subtítulos centrada (0, 0)', 'info');
  };

  // Aplicar Pack de Estilo Rápido (Drift Style Packs)
  const applyStylePack = (pack) => {
    if (!pack) return;
    if (pack.font) setFont(pack.font);
    if (pack.color) setSubtitleColor(pack.color);
    if (pack.passive) setPassiveColor(pack.passive);
    if (pack.anim) setAnimation(pack.anim);
    if (pack.border) setSubtitleBorderStyle(pack.border);
    showToast(`Pack de estilo "${pack.name}" aplicado.`, 'success');
  };

  // Manejadores de eventos del Gizmo de arrastre directo (Inspirado en Drift TransformGizmo)
  const handleSubtitlePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveDragTarget('subtitles');
    setDragStartPos({ x: e.clientX, y: e.clientY });
    const currX = previewOrientation === '16:9' ? subtitleOffsetX_16_9 : subtitleOffsetX;
    const currY = previewOrientation === '16:9' ? subtitleOffsetY_16_9 : subtitleOffsetY;
    setDragInitialOffsets({ x: currX, y: currY });
  };

  const handleCardPointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveDragTarget('card');
    setDragStartPos({ x: e.clientX, y: e.clientY });
    const currX = previewOrientation === '16:9' ? cardOffsetX_16_9 : cardOffsetX;
    const currY = previewOrientation === '16:9' ? cardOffsetY_16_9 : cardOffsetY;
    setDragInitialOffsets({ x: currX, y: currY });
  };

  useEffect(() => {
    if (!activeDragTarget) return;

    const handlePointerMove = (e) => {
      if (!previewContainerRef.current) return;
      const rect = previewContainerRef.current.getBoundingClientRect();
      const isLand = previewOrientation === '16:9';
      const trueWidth = isLand ? 1920 : 1080;
      const scale = rect.width / trueWidth;

      const deltaX = (e.clientX - dragStartPos.x) / scale;
      const deltaY = (e.clientY - dragStartPos.y) / scale;

      let targetX = Math.round(dragInitialOffsets.x + deltaX);
      let targetY = Math.round(dragInitialOffsets.y + deltaY);

      // Snap magnético inteligente al centro (tolerancia de 20px de video)
      const snapThreshold = 20;
      const snappedX = Math.abs(targetX) < snapThreshold;
      const snappedY = Math.abs(targetY) < snapThreshold;

      if (snappedX) targetX = 0;
      if (snappedY) targetY = 0;

      setIsSnappedX(snappedX);
      setIsSnappedY(snappedY);

      if (activeDragTarget === 'subtitles') {
        if (isLand) {
          setSubtitleOffsetX_16_9(targetX);
          setSubtitleOffsetY_16_9(targetY);
        } else {
          setSubtitleOffsetX(targetX);
          setSubtitleOffsetY(targetY);
        }
      } else if (activeDragTarget === 'card') {
        if (isLand) {
          setCardOffsetX_16_9(targetX);
          setCardOffsetY_16_9(targetY);
        } else {
          setCardOffsetX(targetX);
          setCardOffsetY(targetY);
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
  }, [activeDragTarget, dragStartPos, dragInitialOffsets, previewOrientation]);

  const handleGenerateVoicePreview = async () => {
    if (!previewTestText.trim()) return;
    setPreviewLoading(true);
    setPreviewProgress(0);
    setPreviewWarningMsg('');
    setPreviewAudioUrl('');
    
    // Iniciar intervalo para simular progreso realista de síntesis de voz
    let progressVal = 0;
    const progressInterval = setInterval(() => {
      if (progressVal < 40) {
        progressVal += 5;
      } else if (progressVal < 75) {
        progressVal += 2.5;
      } else if (progressVal < 95) {
        progressVal += 0.8;
      }
      setPreviewProgress(Math.min(95, Math.round(progressVal)));
    }, 100);

    try {
      const res = await fetch('/api/tts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: previewTestText,
          voice: previewVoice,
          rate: previewRate
        })
      });
      const data = await res.json();
      
      // Detener intervalo y completar progreso visualmente
      clearInterval(progressInterval);
      setPreviewProgress(100);
      
      // Esperar brevemente para mostrar la finalización
      await new Promise(resolve => setTimeout(resolve, 350));

      if (data.success && data.audioUrl) {
        setPreviewAudioUrl(data.audioUrl);
        setPreviewWarningMsg('El archivo de voz temporal ha sido creado y se eliminará del servidor automáticamente en 1 minuto.');
      } else {
        showAlert(data.error || 'No se pudo generar la locución de prueba.', 'Error de Voz', 'error');
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Error generando locución de prueba:', err);
      showAlert('Error de conexión con el servidor local.', 'Error de Conexión', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    const saved = await onSave({
      id: (selectedId && selectedId !== 'new') ? selectedId : undefined,
      name,
      profileId: profileId || undefined, // Guardar el perfil de IA enlazado
      defaultIdea: defaultIdea || undefined, // Guardar la idea por defecto
      maleVoice,
      femaleVoice,
      narratorGender: narratorGender || 'male',
      voiceRate,
      font,
      fontSize: parseInt(fontSize),
      subtitleColor,
      passiveColor,
      animation,
      subtitleBorderStyle,
      cardTheme,
      cardType: cardType || 'static',
      cardUsername,
      cardSubreddit,
      cardAvatar,
      upvotes,
      comments,
      cardShowVerified,
      cardShowAwards,
      cardSelectedAwards,
      cardWidth: parseInt(cardWidth),
      cardBorderRadius: parseInt(cardBorderRadius),
      cardPadding: parseInt(cardPadding),
      cardGap: parseInt(cardGap),
      cardOffsetX: parseInt(cardOffsetX),
      cardOffsetY: parseInt(cardOffsetY),
      cardEntryAnimation,
      cardExitAnimation,
      cardEntryDuration: parseFloat(cardEntryDuration),
      cardExitDuration: parseFloat(cardExitDuration),
      subtitleOffsetX: parseInt(subtitleOffsetX),
      subtitleOffsetY: parseInt(subtitleOffsetY),
      subtitleAnimationSpeed: parseInt(subtitleAnimationSpeed),
      subtitleLetterSpacing: parseInt(subtitleLetterSpacing),
      subtitleDelay: parseFloat(subtitleDelay),
      cardScale: parseFloat(cardScale),
      cardOffsetX_16_9: parseInt(cardOffsetX_16_9),
      cardOffsetY_16_9: parseInt(cardOffsetY_16_9),
      cardScale_16_9: parseFloat(cardScale_16_9),
      subtitleOffsetX_16_9: parseInt(subtitleOffsetX_16_9),
      subtitleOffsetY_16_9: parseInt(subtitleOffsetY_16_9),
      fontSize_16_9: parseInt(fontSize_16_9),
      exportFormat,
      watermarkEnabled,
      watermarkText,
      watermarkFont,
      watermarkSize: parseInt(watermarkSize),
      watermarkColor,
      watermarkOpacity: parseFloat(watermarkOpacity),
      watermarkAlignment: parseInt(watermarkAlignment),
      watermarkOffsetX: parseInt(watermarkOffsetX),
      watermarkOffsetY: parseInt(watermarkOffsetY),
      watermarkAnimation,
      watermarkSpeed: parseFloat(watermarkSpeed),
      watermarkType,
      watermarkImageFile,
      watermarkImageScale: parseFloat(watermarkImageScale),
      watermarkImageOpacity: parseFloat(watermarkImageOpacity),
      watermarkImageAlignment: parseInt(watermarkImageAlignment),
      watermarkImageOffsetX: parseInt(watermarkImageOffsetX),
      watermarkImageOffsetY: parseInt(watermarkImageOffsetY),
      musicEnabled,
      musicFile,
      musicVolume: parseInt(musicVolume),
      
      // Multivoz
      multiVoiceEnabled,
      multiVoiceSecondaryFemale1,
      multiVoiceSecondaryFemale2,
      multiVoiceSecondaryMale1,
      multiVoiceSecondaryMale2,
      multiVoiceMaxVoices: parseInt(multiVoiceMaxVoices),
      multiVoicePromptExtension,

      // Efectos Cinemáticos y SFX estilo Drift
      cardSfxEnabled,
      cardSfxSound,
      cardSfxVolume: parseInt(cardSfxVolume),
      backgroundBlur: parseInt(backgroundBlur),
      backgroundBlurMode,
      vignetteStrength: parseFloat(vignetteStrength),
      backgroundSaturation: parseFloat(backgroundSaturation),
      backgroundContrast: parseFloat(backgroundContrast)
    });

    if (saved && saved.error) {
      showToast(`Error al guardar plantilla: ${saved.error}`, 'error');
      return;
    }

    if (saved && saved.id) {
      setSelectedId(saved.id);
      showToast(`Plantilla "${name}" guardada exitosamente.`, 'success');
    } else {
      showToast('No se pudo confirmar el guardado de la plantilla en el servidor.', 'error');
    }
  };

  const wordsList = testSubtitleText.trim().split(/\s+/).filter(Boolean);

  // Obtener estilo de texto y sombras según el tipo de contorno seleccionado
  const getSubtitleShadowStyle = () => {
    if (subtitleBorderStyle === 'outline') {
      return {
        textShadow: '0px 0px 3px #000000, 0px 0px 3px #000000, 0px 0px 3px #000000'
      };
    }
    if (subtitleBorderStyle === 'heavy-outline') {
      return {
        textShadow: '0px 0px 5px #000000, 0px 0px 5px #000000, 0px 0px 5px #000000, 0px 0px 6px #000000, 0px 0px 6px #000000'
      };
    }
    // Para 'box', el contorno es limpio y se le da background de capsula a la palabra/frase
    return {
      textShadow: 'none'
    };
  };

  const getWatermarkStyle = () => {
    const align = parseInt(watermarkAlignment || 9);
    const offX = (watermarkOffsetX !== undefined ? watermarkOffsetX : 20) * 0.14;
    const offY = (watermarkOffsetY !== undefined ? watermarkOffsetY : 20) * 0.14;
    
    let positionStyle = {};
    
    if (watermarkAnimation === 'bounce' || watermarkAnimation === 'bounce-wobble') {
      positionStyle = {
        animation: `watermark-bounce-sim 12s linear infinite${watermarkAnimation === 'bounce-wobble' ? ', watermark-wobble-sim 2s ease-in-out infinite' : ''}`,
        position: 'absolute',
        zIndex: 5
      };
    } else {
      let topVal = 'auto', bottomVal = 'auto', leftVal = 'auto', rightVal = 'auto', transformVal = '';
      
      if (align === 7 || align === 8 || align === 9) {
        topVal = `${12 + offY}px`;
      } else if (align === 4 || align === 5 || align === 6) {
        topVal = '50%';
        transformVal += 'translateY(-50%) ';
      } else if (align === 1 || align === 2 || align === 3) {
        bottomVal = `${12 + offY}px`;
      }
      
      if (align === 7 || align === 4 || align === 1) {
        leftVal = `${12 + offX}px`;
      } else if (align === 8 || align === 5 || align === 2) {
        leftVal = '50%';
        transformVal += 'translateX(-50%) ';
      } else if (align === 9 || align === 6 || align === 3) {
        rightVal = `${12 + offX}px`;
      }
      
      if (watermarkAnimation === 'wobble') {
        positionStyle = {
          animation: 'watermark-wobble-sim 2s ease-in-out infinite'
        };
      }
      
      positionStyle = {
        ...positionStyle,
        position: 'absolute',
        top: topVal,
        bottom: bottomVal,
        left: leftVal,
        right: rightVal,
        transform: transformVal.trim(),
        zIndex: 5
      };
    }
    
    return {
      ...positionStyle,
      fontFamily: watermarkFont.split(' ')[0],
      fontSize: `${(watermarkSize || 24) * 0.14}px`,
      color: watermarkColor,
      opacity: watermarkOpacity,
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      fontWeight: 'bold',
      textShadow: '0px 0px 2px rgba(0, 0, 0, 0.8)'
    };
  };

  const getWatermarkImageStyle = () => {
    const align = parseInt(watermarkImageAlignment || 9);
    const offX = (watermarkImageOffsetX !== undefined ? watermarkImageOffsetX : 20) * 0.14;
    const offY = (watermarkImageOffsetY !== undefined ? watermarkImageOffsetY : 20) * 0.14;
    
    let positionStyle;
    let topVal = 'auto', bottomVal = 'auto', leftVal = 'auto', rightVal = 'auto', transformVal = '';
    
    if (align === 7 || align === 8 || align === 9) {
      topVal = `${12 + offY}px`;
    } else if (align === 4 || align === 5 || align === 6) {
      topVal = '50%';
      transformVal += 'translateY(-50%) ';
    } else if (align === 1 || align === 2 || align === 3) {
      bottomVal = `${12 + offY}px`;
    }
    
    if (align === 7 || align === 4 || align === 1) {
      leftVal = `${12 + offX}px`;
    } else if (align === 8 || align === 5 || align === 2) {
      leftVal = '50%';
      transformVal += 'translateX(-50%) ';
    } else if (align === 9 || align === 6 || align === 3) {
      rightVal = `${12 + offX}px`;
    }
    
    positionStyle = {
      position: 'absolute',
      top: topVal,
      bottom: bottomVal,
      left: leftVal,
      right: rightVal,
      transform: transformVal.trim(),
      zIndex: 5
    };
    
    return {
      ...positionStyle,
      width: `${Math.round(200 * (parseFloat(watermarkImageScale) || 0.15))}px`,
      opacity: watermarkImageOpacity,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(128, 90, 213, 0.2)',
      border: '2px dashed rgba(128, 90, 213, 0.7)',
      borderRadius: '4px',
      color: '#E9D8FD',
      padding: '4px 6px',
      fontFamily: 'monospace',
      fontSize: '8px',
      fontWeight: 'bold',
      whiteSpace: 'nowrap'
    };
  };

  const getCardAnimClass = () => {
    if (previewState === 'intro') {
      switch (cardEntryAnimation) {
        case 'fade-in': return 'animate-fade-in-preview';
        case 'slide-in-left': return 'animate-slide-in-left-preview';
        case 'slide-in-right': return 'animate-slide-in-right-preview';
        case 'slide-in-bottom': return 'animate-slide-in-bottom-preview';
        case 'slide-in-top': return 'animate-slide-in-top-preview';
        case 'zoom-in': return 'animate-zoom-in-preview';
        default: return '';
      }
    }
    if (previewState === 'outro') {
      switch (cardExitAnimation) {
        case 'fade-out': return 'animate-fade-out-preview';
        case 'slide-out-left': return 'animate-slide-out-left-preview';
        case 'slide-out-right': return 'animate-slide-out-right-preview';
        case 'slide-out-bottom': return 'animate-slide-out-bottom-preview';
        case 'slide-out-top': return 'animate-slide-out-top-preview';
        case 'zoom-out': return 'animate-zoom-out-preview';
        default: return '';
      }
    }
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Estilos CSS Inyectados para las Animaciones Premium de Preview */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes pSlideInLeft { from { transform: translate(-120%, 0) scale(0.95); opacity: 0; } to { transform: translate(0, 0) scale(1); opacity: 1; } }
        @keyframes pSlideInRight { from { transform: translate(120%, 0) scale(0.95); opacity: 0; } to { transform: translate(0, 0) scale(1); opacity: 1; } }
        @keyframes pSlideInBottom { from { transform: translate(0, 150%) scale(0.95); opacity: 0; } to { transform: translate(0, 0) scale(1); opacity: 1; } }
        @keyframes pSlideInTop { from { transform: translate(0, -150%) scale(0.95); opacity: 0; } to { transform: translate(0, 0) scale(1); opacity: 1; } }
        @keyframes pZoomIn { from { transform: scale(0.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        @keyframes pSlideOutLeft { from { transform: translate(0, 0); opacity: 1; } to { transform: translate(-130%, 0); opacity: 0; } }
        @keyframes pSlideOutRight { from { transform: translate(0, 0); opacity: 1; } to { transform: translate(130%, 0); opacity: 0; } }
        @keyframes pSlideOutBottom { from { transform: translate(0, 0); opacity: 1; } to { transform: translate(0, 130%); opacity: 0; } }
        @keyframes pSlideOutTop { from { transform: translate(0, 0); opacity: 1; } to { transform: translate(0, -130%); opacity: 0; } }
        @keyframes pZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.2); opacity: 0; } }

        .animate-fade-in-preview { animation: pFadeIn ${cardEntryDuration}s ease-out forwards; }
        .animate-slide-in-left-preview { animation: pSlideInLeft ${cardEntryDuration}s cubic-bezier(0.175, 0.885, 0.32, 1.15) forwards; }
        .animate-slide-in-right-preview { animation: pSlideInRight ${cardEntryDuration}s cubic-bezier(0.175, 0.885, 0.32, 1.15) forwards; }
        .animate-slide-in-bottom-preview { animation: pSlideInBottom ${cardEntryDuration}s cubic-bezier(0.175, 0.885, 0.32, 1.15) forwards; }
        .animate-slide-in-top-preview { animation: pSlideInTop ${cardEntryDuration}s cubic-bezier(0.175, 0.885, 0.32, 1.15) forwards; }
        .animate-zoom-in-preview { animation: pZoomIn ${cardEntryDuration}s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

        .animate-fade-out-preview { animation: pFadeOut ${cardExitDuration}s ease-in forwards; }
        .animate-slide-out-left-preview { animation: pSlideOutLeft ${cardExitDuration}s ease-in forwards; }
        .animate-slide-out-right-preview { animation: pSlideOutRight ${cardExitDuration}s ease-in forwards; }
        .animate-slide-out-bottom-preview { animation: pSlideOutBottom ${cardExitDuration}s ease-in forwards; }
        .animate-slide-out-top-preview { animation: pSlideOutTop ${cardExitDuration}s ease-in forwards; }
        .animate-zoom-out-preview { animation: pZoomOut ${cardExitDuration}s ease-in forwards; }
      `}} />

      {/* Encabezado */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">DISEÑADOR DE PLANTILLAS DE VIDEO</h2>
          <p className="text-xs text-gray-400">Personaliza la posición, transiciones, voces (Edge TTS), velocidad de locución y perfiles de IA de tus plantillas.</p>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          {selectedId && selectedId !== 'new' && (
            <>
              <label className="flex items-center gap-2 bg-black/40 hover:bg-black/60 text-gray-300 font-bold px-3 py-2.5 rounded-xl text-xs transition-all border border-border-dark cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeApiKeyInExport}
                  onChange={(e) => setIncludeApiKeyInExport(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-900 text-cyan-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                />
                <span className={includeApiKeyInExport ? "text-amber-400 font-black" : "text-gray-400"}>
                  Incluir API Key {includeApiKeyInExport ? "(⚠️ RIESGO)" : ""}
                </span>
              </label>

              <button
                onClick={handleExportTemplate}
                type="button"
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-border-dark cursor-pointer"
              >
                <Download className="w-4 h-4 text-brand-primary" />
                <span>Exportar Plantilla</span>
              </button>
            </>
          )}

          <label className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-border-dark cursor-pointer">
            <Upload className="w-4 h-4 text-brand-primary" />
            <span>Importar Plantilla</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportTemplate}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Selector de Plantillas Horizontal en Píldoras (Estilo imagenes ai) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {templates.map(tpl => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => setSelectedId(tpl.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-2 ${
              selectedId === tpl.id
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20 font-black'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <span>🎴 {tpl.name}</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${selectedId === tpl.id ? 'bg-black/20 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
              {tpl.exportFormat || '9:16'}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={handleCreateNew}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
            selectedId === 'new'
              ? 'bg-amber-500 text-slate-950 border-amber-500 font-black'
              : 'bg-slate-950 hover:bg-slate-900 text-amber-400 border-amber-500/30'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva Plantilla</span>
        </button>
      </div>

      {/* PANELES DE INSPECCIÓN Y CONFIGURACIÓN MODULAR (FULL WIDTH) */}
      <form onSubmit={handleSaveSubmit} className="glass-panel rounded-2xl p-6 space-y-6 w-full shadow-2xl">
            
            {/* Nombre de la Plantilla */}
            <div className="border-b border-border-dark pb-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide">Nombre de la Plantilla</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre de la plantilla"
                  className="w-full bg-black/40 border border-border-dark rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary font-bold"
                />
              </div>
            </div>

            {/* SECCIÓN GENERAL: VINCULACIÓN DE PERFIL DE IA */}
            <div className="bg-gradient-to-r from-brand-primary/10 to-transparent p-4 rounded-xl border border-brand-primary/20 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-primary animate-pulse" />
                <span className="text-xs font-black text-white uppercase">Perfil de IA & Idea por Defecto</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Vincula un perfil de IA y una semilla/idea predeterminada a esta plantilla para autocompletar la generación rápidamente.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400">PERFIL DE IA VINCULADO</label>
                  <select
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold"
                  >
                    <option value="">(Usar Perfil predeterminado en Ajustes)</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400">IDEA O TEMA PREDETERMINADO</label>
                  <input
                    type="text"
                    value={defaultIdea}
                    onChange={(e) => setDefaultIdea(e.target.value)}
                    placeholder="Ej. Mi suegra intentó sabotear mi boda confesando..."
                    className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400">TIPO DE EXPORTACIÓN</label>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold"
                  >
                    <option value="9-16">9:16 Vertical (Celular)</option>
                    <option value="16-9">16:9 Horizontal (PC/TV)</option>
                    <option value="both">Ambos (9:16 y 16:9 Sincronizados)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Selector de Pestañas Visuales (Card vs Subtitles vs Voces vs Marca de Agua) */}
            <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-border-dark">
              <button
                type="button"
                onClick={() => setActiveTab('card')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  activeTab === 'card' 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>1. Reddit Card</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('subtitles')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  activeTab === 'subtitles' 
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Type className="w-4 h-4" />
                <span>2. Subtítulos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('voice')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  activeTab === 'voice' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span>3. Locución</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('watermark')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  activeTab === 'watermark' 
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/25 shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>4. Marca Agua</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('music')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  activeTab === 'music' 
                    ? 'bg-pink-500/10 text-pink-400 border border-pink-500/25 shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Music className="w-4 h-4" />
                <span>5. Música</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('multivoice')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  activeTab === 'multivoice' 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/25 shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>6. Multivoz</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('effects')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  activeTab === 'effects' 
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/25 shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>7. Cinemática & SFX</span>
              </button>
            </div>

            {/* CONTENIDO PESTAÑA CARD */}
            {activeTab === 'card' && (
              <div className="space-y-6 animate-[pFadeIn_0.2s_ease-out]">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Palette className="w-4 h-4 text-amber-400" />
                    <span>Propiedades del Reddit Card</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">TEMA DEL CARD</label>
                      <select
                        value={cardTheme}
                        onChange={(e) => setCardTheme(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-semibold cursor-pointer"
                      >
                        <option value="dark">Modo Oscuro Reddit</option>
                        <option value="light">Modo Claro Reddit</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">TIPO DE TARJETA</label>
                      <select
                        value={cardType}
                        onChange={(e) => setCardType(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-brand-primary font-black cursor-pointer"
                      >
                        <option value="static">📷 Estática (Imagen PNG)</option>
                        <option value="animated">✨ Animada (Medallas GIF)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">NOMBRE DE USUARIO</label>
                      <input
                        type="text"
                        value={cardUsername}
                        onChange={(e) => setCardUsername(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">SUBREDDIT / ENCABEZADO</label>
                      <input
                        type="text"
                        value={cardSubreddit}
                        onChange={(e) => setCardSubreddit(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">CANTIDAD VOTOS (Upvotes)</label>
                      <input
                        type="text"
                        value={upvotes}
                        onChange={(e) => setUpvotes(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">COMENTARIOS (Comments)</label>
                      <input
                        type="text"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold"
                      />
                    </div>
                  </div>

                  {/* Subida de Avatar Local */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">FOTO DE PERFIL DEL CARD</label>
                      <input
                        type="text"
                        value={cardAvatar}
                        onChange={(e) => setCardAvatar(e.target.value)}
                        placeholder="URL o ruta de imagen..."
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2 text-xs text-white truncate"
                      />
                    </div>
                    
                    <input
                      type="file"
                      ref={avatarFileInputRef}
                      onChange={handleNativeAvatarFile}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handleUploadLocalAvatar}
                      className="bg-gray-800 hover:bg-gray-700 text-white font-bold p-2.5 rounded-xl border border-border-dark cursor-pointer text-xs flex items-center justify-center gap-1.5 mt-4"
                    >
                      <Upload className="w-4 h-4 text-amber-400" />
                      <span>Subir Foto Local</span>
                    </button>
                  </div>
                </div>

                {/* Ajustes de Diseño Avanzado (Postfully V2) */}
                <div className="space-y-4 bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10">
                  <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 border-b border-indigo-500/20 pb-2">
                    <Palette className="w-3.5 h-3.5" />
                    <span>Diseño Avanzado (Estilo Postfully V2)</span>
                  </h4>
                  
                  {/* Interruptores / Toggles */}
                  <div className="flex flex-wrap gap-6 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={cardShowVerified}
                        onChange={(e) => setCardShowVerified(e.target.checked)}
                        className="rounded bg-black/40 border-border-dark text-indigo-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                      />
                      <span className="text-[10px] font-bold text-gray-300">MOSTRAR VERIFICADO</span>
                    </label>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={cardShowAwards}
                          onChange={(e) => setCardShowAwards(e.target.checked)}
                          className="rounded bg-black/40 border-border-dark text-indigo-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                        />
                        <span className="text-[10px] font-bold text-gray-300">MOSTRAR PREMIOS (AWARDS)</span>
                      </label>

                      {cardShowAwards && (
                        <button
                          type="button"
                          onClick={() => setShowAwardPicker(true)}
                          className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <span>🎖️</span>
                          <span>Elegir Medallas ({cardSelectedAwards.reduce((a, b) => a + (b.count || 0), 0)})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sliders de Dimensiones */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">
                        ANCHO DE LA TARJETA: {cardWidth}px
                      </label>
                      <input
                        type="range"
                        min="200"
                        max="380"
                        value={cardWidth}
                        onChange={(e) => setCardWidth(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">
                        BORDES REDONDEADOS: {cardBorderRadius}px
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={cardBorderRadius}
                        onChange={(e) => setCardBorderRadius(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">
                        RELLENO INTERNO: {cardPadding}px
                      </label>
                      <input
                        type="range"
                        min="8"
                        max="24"
                        value={cardPadding}
                        onChange={(e) => setCardPadding(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">
                        ESPACIADO ENTRE ELEMENTOS: {cardGap}px
                      </label>
                      <input
                        type="range"
                        min="4"
                        max="16"
                        value={cardGap}
                        onChange={(e) => setCardGap(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Posicionamiento y sliders del Card */}
                <div className="space-y-4 bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      <Move className="w-3.5 h-3.5" />
                      <span>Ajuste de Posición X e Y (Offset {previewOrientation === '16:9' ? 'Horizontal 16:9' : 'Vertical 9:16'})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleResetPosition}
                      className="text-[9px] font-bold bg-gray-800 text-gray-300 hover:text-white px-2.5 py-1 rounded-md border border-border-dark cursor-pointer"
                    >
                      Centrar Card (0,0)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">
                        COORDENADA X: {previewOrientation === '16:9' ? cardOffsetX_16_9 : cardOffsetX}px
                      </label>
                      <input
                        type="range"
                        min="-400"
                        max="400"
                        value={previewOrientation === '16:9' ? cardOffsetX_16_9 : cardOffsetX}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (previewOrientation === '16:9') setCardOffsetX_16_9(val);
                          else setCardOffsetX(val);
                        }}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">
                        COORDENADA Y: {previewOrientation === '16:9' ? cardOffsetY_16_9 : cardOffsetY}px
                      </label>
                      <input
                        type="range"
                        min="-600"
                        max="600"
                        value={previewOrientation === '16:9' ? cardOffsetY_16_9 : cardOffsetY}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (previewOrientation === '16:9') setCardOffsetY_16_9(val);
                          else setCardOffsetY(val);
                        }}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">
                        ESCALADO DEL CARD: {Math.round((previewOrientation === '16:9' ? cardScale_16_9 : cardScale) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.4"
                        max="1.8"
                        step="0.05"
                        value={previewOrientation === '16:9' ? cardScale_16_9 : cardScale}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (previewOrientation === '16:9') setCardScale_16_9(val);
                          else setCardScale(val);
                        }}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Transiciones y Duraciones */}
                <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-border-dark">
                  <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-wide">Efectos de Transición del Card</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-gray-400">EFECTO DE ENTRADA</label>
                      <select
                        value={cardEntryAnimation}
                        onChange={(e) => setCardEntryAnimation(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-semibold"
                      >
                        {ENTRY_ANIMS.map(a => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                      <div className="flex justify-between items-center text-[9px] text-gray-500">
                        <span>Duración Entrada:</span>
                        <span className="font-bold text-amber-400">{cardEntryDuration}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        value={cardEntryDuration}
                        onChange={(e) => setCardEntryDuration(parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-gray-400">EFECTO DE SALIDA</label>
                      <select
                        value={cardExitAnimation}
                        onChange={(e) => setCardExitAnimation(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-semibold"
                      >
                        {EXIT_ANIMS.map(a => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                      <div className="flex justify-between items-center text-[9px] text-gray-500">
                        <span>Duración Salida:</span>
                        <span className="font-bold text-amber-400">{cardExitDuration}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        value={cardExitDuration}
                        onChange={(e) => setCardExitDuration(parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                  </div>
                </div>

                {/* ÁREA DE ESTUDIO DOMINANTE: LIENZO EN VIVO 1:1 & TIMELINE MULTITRACK */}
                <LiveCanvasStage
                  previewOrientation={previewOrientation}
                  setPreviewOrientation={setPreviewOrientation}
                  cardTheme={cardTheme}
                  cardType={cardType}
                  cardUsername={cardUsername}
                  cardSubreddit={cardSubreddit}
                  cardAvatar={cardAvatar}
                  upvotes={upvotes}
                  comments={comments}
                  cardShowVerified={cardShowVerified}
                  cardShowAwards={cardShowAwards}
                  cardSelectedAwards={cardSelectedAwards}
                  cardWidth={cardWidth}
                  cardBorderRadius={cardBorderRadius}
                  cardPadding={cardPadding}
                  cardGap={cardGap}
                  cardScale={cardScale}
                  cardOffsetX={cardOffsetX}
                  cardOffsetY={cardOffsetY}
                  setCardOffsetX={setCardOffsetX}
                  setCardOffsetY={setCardOffsetY}
                  cardScale_16_9={cardScale_16_9}
                  cardOffsetX_16_9={cardOffsetX_16_9}
                  cardOffsetY_16_9={cardOffsetY_16_9}
                  setCardOffsetX_16_9={setCardOffsetX_16_9}
                  setCardOffsetY_16_9={setCardOffsetY_16_9}
                  cardEntryAnimation={cardEntryAnimation}
                  cardExitAnimation={cardExitAnimation}
                  cardEntryDuration={cardEntryDuration}
                  cardExitDuration={cardExitDuration}
                  handleResetPosition={handleResetPosition}
                  font={font}
                  fontSize={fontSize}
                  fontSize_16_9={fontSize_16_9}
                  subtitleColor={subtitleColor}
                  passiveColor={passiveColor}
                  animation={animation}
                  subtitleBorderStyle={subtitleBorderStyle}
                  subtitleLetterSpacing={subtitleLetterSpacing}
                  subtitleOffsetX={subtitleOffsetX}
                  subtitleOffsetY={subtitleOffsetY}
                  setSubtitleOffsetX={setSubtitleOffsetX}
                  setSubtitleOffsetY={setSubtitleOffsetY}
                  subtitleOffsetX_16_9={subtitleOffsetX_16_9}
                  subtitleOffsetY_16_9={subtitleOffsetY_16_9}
                  setSubtitleOffsetX_16_9={setSubtitleOffsetX_16_9}
                  setSubtitleOffsetY_16_9={setSubtitleOffsetY_16_9}
                  handleResetSubtitlePosition={handleResetSubtitlePosition}
                  testTitle={testTitle}
                  testSubtitleText={testSubtitleText}
                  setTestSubtitleText={setTestSubtitleText}
                  cardSfxEnabled={cardSfxEnabled}
                  cardSfxSound={cardSfxSound}
                  cardSfxVolume={cardSfxVolume}
                  backgroundBlur={backgroundBlur}
                  backgroundBlurMode={backgroundBlurMode}
                  vignetteStrength={vignetteStrength}
                  backgroundSaturation={backgroundSaturation}
                  backgroundContrast={backgroundContrast}
                  playSfxPreview={playSfxPreview}
                  watermarkEnabled={watermarkEnabled}
                  watermarkType={watermarkType}
                  watermarkText={watermarkText}
                  watermarkFont={watermarkFont}
                  watermarkSize={watermarkSize}
                  watermarkColor={watermarkColor}
                  watermarkOpacity={watermarkOpacity}
                  watermarkAlignment={watermarkAlignment}
                  watermarkOffsetX={watermarkOffsetX}
                  watermarkOffsetY={watermarkOffsetY}
                  watermarkAnimation={watermarkAnimation}
                  watermarkSpeed={watermarkSpeed}
                  watermarkImageFile={watermarkImageFile}
                  watermarkImageScale={watermarkImageScale}
                  watermarkImageOpacity={watermarkImageOpacity}
                  watermarkImageAlignment={watermarkImageAlignment}
                  watermarkImageOffsetX={watermarkImageOffsetX}
                  watermarkImageOffsetY={watermarkImageOffsetY}
                  musicEnabled={musicEnabled}
                  musicVolume={musicVolume}
                  previewState={previewState}
                  isPlayingTimeline={isPlayingTimeline}
                  timelineProgress={timelineProgress}
                  handleStartTimelineSimulation={handleStartTimelineSimulation}
                  handleResetTimelineSimulation={handleResetTimelineSimulation}
                  handleScrubTimeline={handleScrubTimeline}
                  stylePacks={STYLE_PACKS}
                  applyStylePack={applyStylePack}
                />
              </div>
            )}

            {/* CONTENIDO PESTAÑA SUBTÍTULOS */}
            {activeTab === 'subtitles' && (
              <div className="space-y-6 animate-[pFadeIn_0.2s_ease-out]">

                {/* 1. Packs de Estilo Rápido (1 Clic) - Inspirado en Drift StylePacks */}
                <div className="space-y-3 bg-gradient-to-r from-amber-500/10 via-black/40 to-cyan-500/10 border border-amber-500/25 p-4 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Packs de Estilo Rápido (1 Clic)</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">Estilos de retención inspirados en Drift & Capcut</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {STYLE_PACKS.map(pack => (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => applyStylePack(pack)}
                        className="flex flex-col items-center justify-center p-2 rounded-xl bg-black/50 border border-white/10 hover:border-amber-400 hover:bg-amber-500/10 transition-all text-center cursor-pointer group active:scale-95 shadow-sm"
                      >
                        <span className="text-lg group-hover:scale-125 transition-transform">{pack.icon}</span>
                        <span className="text-[10px] font-black text-gray-200 mt-1 truncate max-w-full">{pack.name}</span>
                        <span className="text-[8px] text-gray-400 truncate max-w-full">{pack.anim}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Tipografía y Estilo */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Type className="w-4 h-4 text-cyan-400" />
                    <span>Tipografía & Contorno</span>
                  </h3>
                  {/* Fila 1: Selector de Fuente (2 col) + Botón Subir + Tamaños 9:16 y 16:9 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">FUENTE TIPOGRÁFICA (.ass)</label>
                      <div className="flex gap-2.5 items-center">
                        <select
                          value={font}
                          onChange={(e) => setFont(e.target.value)}
                          className="flex-1 min-w-0 bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-500 overflow-hidden text-ellipsis"
                        >
                          {availableFonts.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>

                        <label className="px-3.5 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 shrink-0 select-none border border-cyan-400/30 whitespace-nowrap">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Subir Fuente</span>
                          <input
                            type="file"
                            accept=".ttf,.otf,.woff,.woff2"
                            onChange={handleFontFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="md:col-span-1 space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">TAMAÑO FUENTE (9:16)</label>
                      <input
                        type="number"
                        value={fontSize}
                        onChange={(e) => setFontSize(parseInt(e.target.value) || 24)}
                        min="12"
                        max="150"
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold"
                      />
                    </div>

                    <div className="md:col-span-1 space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">TAMAÑO FUENTE (16:9)</label>
                      <input
                        type="number"
                        value={fontSize_16_9}
                        onChange={(e) => setFontSize_16_9(parseInt(e.target.value) || 24)}
                        min="12"
                        max="150"
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold"
                      />
                    </div>
                  </div>

                  {/* Fila 2: Sliders de Separación de Letras y Sync/Retraso */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">SEPARACIÓN DE LETRAS: {subtitleLetterSpacing}px</label>
                      <input
                        type="range"
                        min="-4"
                        max="20"
                        value={subtitleLetterSpacing}
                        onChange={(e) => setSubtitleLetterSpacing(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">SYNC / RETRASO VOZ: {subtitleDelay}s</label>
                      <input
                        type="range"
                        min="-0.50"
                        max="0.50"
                        step="0.05"
                        value={subtitleDelay}
                        onChange={(e) => setSubtitleDelay(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">COLOR PALABRA ACTIVA (Highlight)</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={subtitleColor}
                          onChange={(e) => setSubtitleColor(e.target.value)}
                          className="w-10 h-8 bg-transparent border-0 cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={subtitleColor}
                          onChange={(e) => setSubtitleColor(e.target.value)}
                          className="w-full bg-black/40 border border-border-dark rounded-xl p-1.5 text-[11px] text-white text-center font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">COLOR PALABRA PASIVA</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={passiveColor}
                          onChange={(e) => setPassiveColor(e.target.value)}
                          className="w-10 h-8 bg-transparent border-0 cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={passiveColor}
                          onChange={(e) => setPassiveColor(e.target.value)}
                          className="w-full bg-black/40 border border-border-dark rounded-xl p-1.5 text-[11px] text-white text-center font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">ANIMACIÓN</label>
                      <select
                        value={animation}
                        onChange={(e) => setAnimation(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-semibold"
                      >
                        {ANIMATIONS.map(a => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* NUEVA OPCIÓN: ESTILO DE CONTORNO (SOMBREADO / CAJA CAPCUT) */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-400">ESTILO DE CONTORNO / SOMBREADO DE LETRA</label>
                    <select
                      value={subtitleBorderStyle}
                      onChange={(e) => setSubtitleBorderStyle(e.target.value)}
                      className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold"
                    >
                      {BORDER_STYLES.map(b => (
                        <option key={b.value} value={b.value}>{b.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. Posición y velocidad de subtítulos */}
                <div className="space-y-4 bg-cyan-500/5 p-4 rounded-xl border border-cyan-500/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                      <Move className="w-3.5 h-3.5" />
                      <span>Coordenadas del Subtítulo (0,0 es Centrado Vertical/Horizontal)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleResetSubtitlePosition}
                      className="text-[9px] font-bold bg-gray-800 text-gray-300 hover:text-white px-2.5 py-1 rounded-md border border-border-dark cursor-pointer"
                    >
                      Centrar Subtítulos (0,0)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">
                        COORDENADA X: {previewOrientation === '16:9' ? subtitleOffsetX_16_9 : subtitleOffsetX}px (Horizontal)
                      </label>
                      <input
                        type="range"
                        min="-600"
                        max="600"
                        value={previewOrientation === '16:9' ? subtitleOffsetX_16_9 : subtitleOffsetX}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (previewOrientation === '16:9') setSubtitleOffsetX_16_9(val);
                          else setSubtitleOffsetX(val);
                        }}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">
                        COORDENADA Y: {previewOrientation === '16:9' ? subtitleOffsetY_16_9 : subtitleOffsetY}px (Vertical)
                      </label>
                      <input
                        type="range"
                        min="-600"
                        max="400"
                        value={previewOrientation === '16:9' ? subtitleOffsetY_16_9 : subtitleOffsetY}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (previewOrientation === '16:9') setSubtitleOffsetY_16_9(val);
                          else setSubtitleOffsetY(val);
                        }}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">VELOCIDAD POP: {subtitleAnimationSpeed}ms</label>
                      <input
                        type="range"
                        min="40"
                        max="300"
                        value={subtitleAnimationSpeed}
                        onChange={(e) => setSubtitleAnimationSpeed(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* CONTENIDO PESTAÑA VOCES & VELOCIDAD (NUEVO) */}
            {activeTab === 'voice' && (
              <div className="space-y-6 animate-[pFadeIn_0.2s_ease-out]">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span>Perfil de Voces & Velocidad de Locución</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">VOZ MASCULINA PREDETERMINADA</label>
                      <select
                        value={maleVoice}
                        onChange={(e) => setMaleVoice(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-semibold"
                      >
                        {EDGE_VOICES.map(v => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">VOZ FEMENINA PREDETERMINADA</label>
                      <select
                        value={femaleVoice}
                        onChange={(e) => setFemaleVoice(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-semibold"
                      >
                        {EDGE_VOICES.map(v => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Narrador Principal de la Plantilla</label>
                      <select
                        value={narratorGender}
                        onChange={(e) => setNarratorGender(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-semibold"
                      >
                        <option value="male">Voz Masculina Predeterminada ({EDGE_VOICES.find(v => v.value === maleVoice)?.label || maleVoice})</option>
                        <option value="female">Voz Femenina Predeterminada ({EDGE_VOICES.find(v => v.value === femaleVoice)?.label || femaleVoice})</option>
                        <option value="auto">Automático por contexto (según la historia)</option>
                      </select>
                      <span className="text-[9px] text-gray-500 block mt-0.5">
                        Define la voz que narrará los videos de esta plantilla (o déjalo en automático si prefieres que se detecte por el texto).
                      </span>
                    </div>
                  </div>


                  <div className="space-y-1 bg-black/25 p-4 rounded-xl border border-border-dark">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ajustar Velocidad de Locución global (Rate)</label>
                    <p className="text-[9px] text-gray-500 mb-2">Afecta tanto a la voz masculina como femenina. Las velocidades rápidas (+15%) retienen mejor al espectador.</p>
                    <input
                      type="number"
                      min="50"
                      max="250"
                      value={rateToPercentValue(voiceRate)}
                      onChange={(e) => setVoiceRate(percentValueToRateStr(e.target.value))}
                      className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-brand-primary"
                    />
                    <span className="text-[9px] text-gray-500 block leading-tight mt-1">
                      Especifica el porcentaje manualmente. **100** es la velocidad estándar (normal). Valores mayores (ej. **115**) aceleran la voz y menores (ej. **85**) la ralentizan.
                    </span>
                  </div>
                </div>

                {/* PROBAR VOZ EN VIVO (AUDICIONADOR AUTOMÁTICO DE PREVIEW) */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-emerald-400 animate-bounce" />
                    <span className="text-xs font-black text-white uppercase">Probar Voces en Tiempo Real</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-gray-400">VOZ A PROBAR</label>
                        <select
                          value={previewVoice}
                          onChange={(e) => setPreviewVoice(e.target.value)}
                          className="w-full bg-black/40 border border-border-dark rounded-xl p-2 text-xs text-white"
                        >
                          {EDGE_VOICES.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-gray-400">VELOCIDAD A PROBAR</label>
                        <input
                          type="number"
                          min="50"
                          max="250"
                          value={rateToPercentValue(previewRate)}
                          onChange={(e) => setPreviewRate(percentValueToRateStr(e.target.value))}
                          className="w-full bg-black/40 border border-border-dark rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-400">TEXTO A LEER</label>
                      <textarea
                        rows="2"
                        value={previewTestText}
                        onChange={(e) => setPreviewTestText(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2 text-xs text-white resize-none"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={previewLoading}
                      onClick={handleGenerateVoicePreview}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:bg-gray-700 text-white font-extrabold p-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md shadow-emerald-600/10"
                    >
                      {previewLoading ? (
                        <span className="animate-spin text-[10px]">⌛ Generando audio...</span>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Escuchar Locución de Prueba</span>
                        </>
                      )}
                    </button>

                    {previewLoading && (
                      <div className="bg-black/50 p-3 rounded-xl border border-border-dark flex flex-col gap-2.5 mt-2 transition-all duration-300">
                        <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                            <span>Sintetizando voz en tiempo real...</span>
                          </span>
                          <span className="text-emerald-400">{previewProgress}%</span>
                        </div>
                        
                        {/* Barra de progreso */}
                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-border-dark/50">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-100 ease-out"
                            style={{ width: `${previewProgress}%` }}
                          />
                        </div>

                        {/* Ondas de audio animadas simuladas */}
                        <div className="flex items-center justify-center gap-1 h-8 mt-1">
                          <div className="w-1 bg-emerald-500/60 rounded animate-pulse h-4" style={{ animationDelay: '0ms', animationDuration: '0.8s' }}></div>
                          <div className="w-1 bg-emerald-500/80 rounded animate-pulse h-6" style={{ animationDelay: '150ms', animationDuration: '0.6s' }}></div>
                          <div className="w-1 bg-emerald-500 rounded animate-pulse h-3" style={{ animationDelay: '300ms', animationDuration: '0.9s' }}></div>
                          <div className="w-1 bg-emerald-600 rounded animate-pulse h-7" style={{ animationDelay: '450ms', animationDuration: '0.5s' }}></div>
                          <div className="w-1 bg-emerald-500 rounded animate-pulse h-5" style={{ animationDelay: '200ms', animationDuration: '0.7s' }}></div>
                          <div className="w-1 bg-emerald-500/80 rounded animate-pulse h-2" style={{ animationDelay: '350ms', animationDuration: '0.8s' }}></div>
                        </div>
                      </div>
                    )}

                    {!previewLoading && previewAudioUrl && (
                      <div className="bg-black/50 p-2.5 rounded-xl border border-border-dark flex flex-col items-center gap-2 mt-2">
                        <audio 
                          key={previewAudioUrl}
                          src={previewAudioUrl} 
                          controls 
                          autoPlay 
                          className="w-full h-8 bg-gray-900 rounded-lg text-white"
                        />
                        <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                          <VolumeX className="w-3 h-3" />
                          <span>{previewWarningMsg}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO PESTAÑA MARCA DE AGUA */}
            {activeTab === 'watermark' && (
              <div className="space-y-6 animate-[pFadeIn_0.2s_ease-out]">
                
                {/* 1. Activar / Desactivar y Texto */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span>Control de Marca de Agua</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-border-dark flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="block text-[10px] font-bold text-gray-300 uppercase">Activar Marca de Agua</label>
                        <p className="text-[9px] text-gray-500">Muestra una marca de agua en todo el video.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={watermarkEnabled}
                        onChange={(e) => setWatermarkEnabled(e.target.checked)}
                        className="w-4 h-4 rounded bg-black/40 border border-border-dark text-purple-500 focus:ring-purple-500/30 accent-purple-500 cursor-pointer"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">TIPO DE MARCA DE AGUA</label>
                      <select
                        disabled={!watermarkEnabled}
                        value={watermarkType}
                        onChange={(e) => setWatermarkType(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-bold cursor-pointer"
                      >
                        <option value="text">Texto de Subtítulo</option>
                        <option value="image">Imagen / Logotipo</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">TEXTO PERSONALIZADO</label>
                      <input
                        type="text"
                        disabled={!watermarkEnabled || watermarkType !== 'text'}
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        placeholder="Ej: @RedditHistorias"
                        className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Estilos y Apariencia para TEXTO */}
                {watermarkEnabled && watermarkType === 'text' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                      <Palette className="w-4 h-4 text-purple-400" />
                      <span>Tipografía & Apariencia (Texto)</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">FUENTE</label>
                        <select
                          disabled={!watermarkEnabled}
                          value={watermarkFont}
                          onChange={(e) => setWatermarkFont(e.target.value)}
                          className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-bold"
                        >
                          {availableFonts.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">TAMAÑO (PT)</label>
                        <input
                          type="number"
                          disabled={!watermarkEnabled}
                          min="10"
                          max="100"
                          value={watermarkSize}
                          onChange={(e) => setWatermarkSize(parseInt(e.target.value) || 24)}
                          className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2 text-xs text-white font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">COLOR</label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            disabled={!watermarkEnabled}
                            value={watermarkColor}
                            onChange={(e) => setWatermarkColor(e.target.value)}
                            className="w-8 h-8 rounded-lg bg-transparent border border-border-dark cursor-pointer disabled:opacity-40"
                          />
                          <span className="text-xs text-gray-400 font-bold uppercase">{watermarkColor}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">OPACIDAD: {Math.round(watermarkOpacity * 100)}%</label>
                        <input
                          type="range"
                          disabled={!watermarkEnabled}
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2.5 disabled:opacity-40"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Estilos y Apariencia para IMAGEN */}
                {watermarkEnabled && watermarkType === 'image' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                      <Palette className="w-4 h-4 text-purple-400" />
                      <span>Configuración del Logotipo / Imagen</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1 md:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400">RUTA ABSOLUTA DEL ARCHIVO DE IMAGEN (.PNG, .JPG)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            disabled={!watermarkEnabled}
                            value={watermarkImageFile}
                            onChange={(e) => setWatermarkImageFile(e.target.value)}
                            placeholder="Ej: C:\Users\Nombre\Pictures\logo.png"
                            className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-mono truncate"
                          />
                          <button
                            type="button"
                            disabled={!watermarkEnabled}
                            onClick={handlePickWatermarkImage}
                            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-bold p-2.5 rounded-xl border border-border-dark cursor-pointer transition-all duration-200"
                            title="Seleccionar archivo de imagen"
                          >
                            <FolderOpen className="w-5 h-5 text-brand-primary" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">ESCALA: {Math.round(watermarkImageScale * 100)}% del ancho</label>
                        <input
                          type="range"
                          disabled={!watermarkEnabled}
                          min="0.05"
                          max="0.5"
                          step="0.01"
                          value={watermarkImageScale}
                          onChange={(e) => setWatermarkImageScale(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2.5 disabled:opacity-40"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">OPACIDAD: {Math.round(watermarkImageOpacity * 100)}%</label>
                        <input
                          type="range"
                          disabled={!watermarkEnabled}
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={watermarkImageOpacity}
                          onChange={(e) => setWatermarkImageOpacity(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2.5 disabled:opacity-40"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">ALINEACIÓN</label>
                        <select
                          disabled={!watermarkEnabled}
                          value={watermarkImageAlignment}
                          onChange={(e) => setWatermarkImageAlignment(parseInt(e.target.value))}
                          className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-bold cursor-pointer"
                        >
                          <option value="7">Arriba-Izquierda (7)</option>
                          <option value="9">Arriba-Derecha (9)</option>
                          <option value="1">Abajo-Izquierda (1)</option>
                          <option value="3">Abajo-Derecha (3)</option>
                          <option value="5">Centro (5)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">OFFSET X: {watermarkImageOffsetX}px</label>
                        <input
                          type="range"
                          disabled={!watermarkEnabled}
                          min="0"
                          max="200"
                          value={watermarkImageOffsetX}
                          onChange={(e) => setWatermarkImageOffsetX(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2.5 disabled:opacity-40"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">OFFSET Y: {watermarkImageOffsetY}px</label>
                        <input
                          type="range"
                          disabled={!watermarkEnabled}
                          min="0"
                          max="200"
                          value={watermarkImageOffsetY}
                          onChange={(e) => setWatermarkImageOffsetY(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2.5 disabled:opacity-40"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Alineación, Posición y Animación para TEXTO */}
                {watermarkEnabled && watermarkType === 'text' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                      <Move className="w-4 h-4 text-purple-400" />
                      <span>Posición & Animación de Marca</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">ALINEACIÓN FIJA</label>
                        <select
                          disabled={!watermarkEnabled || watermarkAnimation === 'bounce' || watermarkAnimation === 'bounce-wobble'}
                          value={watermarkAlignment}
                          onChange={(e) => setWatermarkAlignment(parseInt(e.target.value))}
                          className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-bold cursor-pointer"
                        >
                          {ALIGNMENTS.map(a => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">OFFSET X: {watermarkOffsetX}px</label>
                        <input
                          type="range"
                          disabled={!watermarkEnabled || watermarkAnimation === 'bounce' || watermarkAnimation === 'bounce-wobble'}
                          min="0"
                          max="200"
                          value={watermarkOffsetX}
                          onChange={(e) => setWatermarkOffsetX(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2.5 disabled:opacity-40"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">OFFSET Y: {watermarkOffsetY}px</label>
                        <input
                          type="range"
                          disabled={!watermarkEnabled || watermarkAnimation === 'bounce' || watermarkAnimation === 'bounce-wobble'}
                          min="0"
                          max="200"
                          value={watermarkOffsetY}
                          onChange={(e) => setWatermarkOffsetY(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2.5 disabled:opacity-40"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400">ANIMACIÓN</label>
                        <select
                          disabled={!watermarkEnabled}
                          value={watermarkAnimation}
                          onChange={(e) => setWatermarkAnimation(e.target.value)}
                          className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-bold cursor-pointer"
                        >
                          {WATERMARK_ANIMS.map(a => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {watermarkEnabled && watermarkAnimation !== 'none' && (
                      <div className="space-y-3 bg-purple-500/5 p-3 rounded-lg border border-purple-500/10">
                        <p className="text-[9px] text-purple-400 font-semibold">
                          ℹ️ La animación de la marca de agua ignora los offsets/alineación fija (si es rebote) y se repite de forma continua en el video. Ajusta su velocidad abajo.
                        </p>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-gray-300">
                            <span className="font-bold uppercase tracking-wider">Velocidad del ciclo: {watermarkSpeed || 2.5}s</span>
                            <span className="text-[8px] text-purple-400 font-bold uppercase">Menor tiempo = Más rápido</span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="8.0"
                            step="0.5"
                            value={watermarkSpeed || 2.5}
                            onChange={(e) => setWatermarkSpeed(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-1 disabled:opacity-40"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* CONTENIDO PESTAÑA MÚSICA DE FONDO (NUEVO) */}
            {activeTab === 'music' && (
              <div className="space-y-6 animate-[pFadeIn_0.2s_ease-out]">
                
                {/* 1. Activar / Desactivar y Canción */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Music className="w-4 h-4 text-pink-400" />
                    <span>Control de Música de Fondo</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-border-dark flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="block text-[10px] font-bold text-gray-300 uppercase">Activar Música de Fondo</label>
                        <p className="text-[9px] text-gray-500">Mezcla música instrumental suave de fondo con el audio de la historia.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={musicEnabled}
                        onChange={(e) => setMusicEnabled(e.target.checked)}
                        className="w-4 h-4 rounded bg-black/40 border border-border-dark text-pink-500 focus:ring-pink-500/30 accent-pink-500 cursor-pointer"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">ARCHIVO DE AUDIO LOCAL (MP3/WAV)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          disabled={!musicEnabled}
                          value={musicFile}
                          onChange={(e) => {
                            setMusicFile(e.target.value);
                            checkMusicFileExists(e.target.value);
                          }}
                          placeholder="Elige un archivo de música..."
                          className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-mono truncate"
                        />
                        <button
                          type="button"
                          disabled={!musicEnabled}
                          onClick={handlePickMusicFile}
                          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-bold px-3 py-2 rounded-xl border border-border-dark cursor-pointer transition-all duration-200 flex items-center justify-center"
                        >
                          <Upload className="w-4 h-4 text-pink-400" />
                        </button>
                      </div>
                      {musicFile && !musicFileExists && (
                        <div className="mt-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl p-3 text-[10px] flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
                          <span>
                            <strong>¡Archivo no encontrado!</strong> La ruta del archivo de audio no existe en este equipo. 
                            Si importaste esta plantilla de otro equipo, vuelve a seleccionarlo usando el explorador de carpetas.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Volumen y Configuración de FFmpeg */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Volume2 className="w-4 h-4 text-pink-400" />
                    <span>Ajuste de Volumen</span>
                  </h3>
                  
                  <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-border-dark">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">VOLUMEN DE MÚSICA: {musicVolume} dB</label>
                      <span className="text-[9px] text-gray-500">Recomendado: -20 dB a -26 dB para no opacar la voz.</span>
                    </div>
                    <input
                      type="range"
                      min="-40"
                      max="-5"
                      step="1"
                      disabled={!musicEnabled}
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
                    />
                    <div className="flex justify-between text-[8.5px] text-gray-500">
                      <span>Muy suave (-40 dB)</span>
                      <span>Por defecto (-20 dB)</span>
                      <span>Fuerte (-5 dB)</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* CONTENIDO PESTAÑA MULTIVOZ */}
            {activeTab === 'multivoice' && (
              <div className="space-y-6 animate-[pFadeIn_0.2s_ease-out]">
                
                {/* Aviso de Voces Principales Activas */}
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">Voces Principales de la Plantilla</span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-normal">
                    Estas son las voces configuradas en la pestaña <strong>3. Locución</strong>. Se usarán de manera prioritaria como narrador masculino o femenino principal de la historia. Es recomendable elegir voces secundarias distintas a estas para evitar repeticiones:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                    <div className="bg-black/25 border border-border-dark/40 rounded-xl p-3">
                      <span className="text-[8px] font-black text-gray-500 block tracking-widest uppercase">NARRADOR MASCULINO PRINCIPAL</span>
                      <span className="text-[10px] font-extrabold text-white block mt-1 truncate">
                        {EDGE_VOICES.find(v => v.value === maleVoice)?.label || maleVoice}
                      </span>
                    </div>
                    <div className="bg-black/25 border border-border-dark/40 rounded-xl p-3">
                      <span className="text-[8px] font-black text-gray-500 block tracking-widest uppercase">NARRADORA FEMENINA PRINCIPAL</span>
                      <span className="text-[10px] font-extrabold text-white block mt-1 truncate">
                        {EDGE_VOICES.find(v => v.value === femaleVoice)?.label || femaleVoice}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 1. Activar / Desactivar y Límite */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>Control de Diálogos Multivoz</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-border-dark flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="block text-[10px] font-bold text-gray-300 uppercase">Activar Diálogos de Personajes</label>
                        <p className="text-[9px] text-gray-500">Permite que los personajes de la historia hablen usando diferentes voces configuradas.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={multiVoiceEnabled}
                        onChange={(e) => setMultiVoiceEnabled(e.target.checked)}
                        className="w-4 h-4 rounded bg-black/40 border border-border-dark text-blue-500 focus:ring-blue-500/30 accent-blue-500 cursor-pointer"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">CANTIDAD MÁXIMA DE VOCES A USAR</label>
                      <input
                        type="number"
                        min="2"
                        max="6"
                        disabled={!multiVoiceEnabled}
                        value={multiVoiceMaxVoices}
                        onChange={(e) => setMultiVoiceMaxVoices(parseInt(e.target.value) || 4)}
                        className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Asignación de Pool de Voces Secundarias */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Volume2 className="w-4 h-4 text-blue-400" />
                    <span>Pool de Voces Secundarias para Personajes</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">VOZ SECUNDARIA FEMENINA 1</label>
                      <select
                        disabled={!multiVoiceEnabled}
                        value={multiVoiceSecondaryFemale1}
                        onChange={(e) => setMultiVoiceSecondaryFemale1(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-semibold"
                      >
                        {EDGE_VOICES.map(v => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">VOZ SECUNDARIA FEMENINA 2</label>
                      <select
                        disabled={!multiVoiceEnabled}
                        value={multiVoiceSecondaryFemale2}
                        onChange={(e) => setMultiVoiceSecondaryFemale2(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-semibold"
                      >
                        {EDGE_VOICES.map(v => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">VOZ SECUNDARIA MASCULINA 1</label>
                      <select
                        disabled={!multiVoiceEnabled}
                        value={multiVoiceSecondaryMale1}
                        onChange={(e) => setMultiVoiceSecondaryMale1(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-semibold"
                      >
                        {EDGE_VOICES.map(v => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">VOZ SECUNDARIA MASCULINA 2</label>
                      <select
                        disabled={!multiVoiceEnabled}
                        value={multiVoiceSecondaryMale2}
                        onChange={(e) => setMultiVoiceSecondaryMale2(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-semibold"
                      >
                        {EDGE_VOICES.map(v => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Adaptación del Prompt del Guión */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span>Adaptación del Prompt del Guión (Instrucción de Diálogos)</span>
                  </h3>
                  
                  <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-border-dark">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Instrucción Adicional del Sistema</label>
                      <span className="text-[9px] text-gray-500">Se añade automáticamente al systemPrompt cuando la opción está activa.</span>
                    </div>
                    <textarea
                      disabled={!multiVoiceEnabled}
                      value={multiVoicePromptExtension}
                      onChange={(e) => setMultiVoicePromptExtension(e.target.value)}
                      rows={5}
                      className="w-full bg-black/40 border border-border-dark disabled:opacity-40 rounded-xl p-2.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* CONTENIDO PESTAÑA CINEMÁTICA Y EFECTOS SFX (DRIFT SUITE) */}
            {activeTab === 'effects' && (
              <div className="space-y-6 animate-[pFadeIn_0.2s_ease-out]">
                {/* 1. Efectos de Sonido (SFX Sync) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border-dark pb-2">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-amber-400" />
                      <span>Efectos de Sonido (SFX Sincronizados)</span>
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={cardSfxEnabled}
                        onChange={(e) => setCardSfxEnabled(e.target.checked)}
                        className="rounded border-gray-700 bg-gray-900 text-amber-500 focus:ring-0 cursor-pointer w-4 h-4"
                      />
                      <span className="text-xs font-bold text-gray-300">Activar Sonido al Entrar Tarjeta</span>
                    </label>
                  </div>

                  {cardSfxEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/20 p-4 rounded-xl border border-border-dark">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Sonido de Impacto / Entrada</label>
                        <div className="flex gap-2">
                          <select
                            value={cardSfxSound}
                            onChange={(e) => {
                              setCardSfxSound(e.target.value);
                              playSfxPreview(e.target.value);
                            }}
                            className="flex-1 bg-black/40 border border-border-dark rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
                          >
                            <option value="whoosh">💨 Whoosh (Deslizamiento Rápido)</option>
                            <option value="pop">🎯 Pop (Impacto Seco y Limpio)</option>
                            <option value="slam">💥 Slam / Thud (Golpe Cinematográfico)</option>
                            <option value="ding">🔔 Ding / Chime (Campana Suave)</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => playSfxPreview(cardSfxSound)}
                            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                            title="Escuchar sonido"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Probar</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                          <span>Volumen SFX</span>
                          <span className="text-amber-400 font-mono">{cardSfxVolume} dB</span>
                        </div>
                        <input
                          type="range"
                          min="-24"
                          max="0"
                          step="1"
                          value={cardSfxVolume}
                          onChange={(e) => setCardSfxVolume(parseInt(e.target.value))}
                          className="w-full accent-amber-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Tratamiento y Desenfoque del Fondo (Background Blur) */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Desenfoque y Tratamiento Cinematográfico del Fondo</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/20 p-4 rounded-xl border border-border-dark">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                        <span>Desenfoque de Fondo (Gaussian Blur)</span>
                        <span className="text-cyan-400 font-mono">{backgroundBlur} px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="16"
                        step="1"
                        value={backgroundBlur}
                        onChange={(e) => setBackgroundBlur(parseInt(e.target.value))}
                        className="w-full accent-cyan-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                      />
                      <span className="text-[9px] text-gray-500">0 = Nítido, 4-8 = Estética cine suave, 12-16 = Desenfoque intenso</span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase">Modo de Aplicación del Desenfoque</label>
                      <select
                        value={backgroundBlurMode}
                        onChange={(e) => setBackgroundBlurMode(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
                      >
                        <option value="card-only">Solo mientras la Tarjeta está en pantalla (Recomendado)</option>
                        <option value="all">Durante todo el video continuo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Viñeta y Color Grading (Estilo Drift) */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Palette className="w-4 h-4 text-purple-400" />
                    <span>Viñeta y Color Grading (Vibrancia Viral)</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/20 p-4 rounded-xl border border-border-dark">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                        <span>Viñeta Perimetral</span>
                        <span className="text-purple-400 font-mono">{Math.round(vignetteStrength * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={vignetteStrength}
                        onChange={(e) => setVignetteStrength(parseFloat(e.target.value))}
                        className="w-full accent-purple-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                      />
                      <span className="text-[9px] text-gray-500">Oscurece sutilmente las esquinas</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                        <span>Saturación del Fondo</span>
                        <span className="text-purple-400 font-mono">{backgroundSaturation.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="1.6"
                        step="0.05"
                        value={backgroundSaturation}
                        onChange={(e) => setBackgroundSaturation(parseFloat(e.target.value))}
                        className="w-full accent-purple-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                      />
                      <span className="text-[9px] text-gray-500">1.15x recomendado para TikTok</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                        <span>Contraste del Fondo</span>
                        <span className="text-purple-400 font-mono">{backgroundContrast.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.9"
                        max="1.3"
                        step="0.02"
                        value={backgroundContrast}
                        onChange={(e) => setBackgroundContrast(parseFloat(e.target.value))}
                        className="w-full accent-purple-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                      />
                      <span className="text-[9px] text-gray-500">1.05x realza sombras y luces</span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setBackgroundBlur(0);
                        setBackgroundBlurMode('card-only');
                        setVignetteStrength(0);
                        setBackgroundSaturation(1.15);
                        setBackgroundContrast(1.05);
                        showToast('Valores de cinemática restablecidos.', 'info');
                      }}
                      className="text-[10px] font-bold text-gray-400 hover:text-white underline cursor-pointer"
                    >
                      Restablecer filtros a valores por defecto
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* BOTONES ACCIÓN */}
            <div className="flex gap-4 border-t border-border-dark pt-6 justify-end">
              {selectedId && selectedId !== 'new' && (
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Plantilla</span>
                </button>
              )}
              
              <button
                type="submit"
                className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-hover active:scale-[0.98] text-white font-extrabold px-6 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-brand-primary/20"
              >
                <Save className="w-4 h-4 fill-current" />
                <span>Guardar Plantilla de Video</span>
              </button>
            </div>

          </form>

      {/* Modal Selector de Medallas (Awards) */}
      {showAwardPicker && (
        <AwardPickerModal
          selectedAwards={cardSelectedAwards}
          onSave={(newAwards) => setCardSelectedAwards(newAwards)}
          onClose={() => setShowAwardPicker(false)}
        />
      )}
    </div>
  );
}

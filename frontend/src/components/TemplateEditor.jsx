import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, Palette, Volume2, Type, Move, Upload, Eye, Zap, Play, RotateCcw, VolumeX, Sparkles, Download, Shield, Music, AlertTriangle, FolderOpen, Users, Info } from 'lucide-react';
import AwardPickerModal from './AwardPickerModal';

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
  { value: 'borde-emergente-2', label: 'Borde Emergente II (Caja Capcut con Borde de Color)' },
  { value: 'active-highlight', label: 'Active Highlight (Bloque frase, ilumina activa)' },
  { value: 'glow-karaoke', label: 'Glow Karaoke (Frase bloque con brillo neón contorno)' },
  { value: 'clean-fade', label: 'Clean Fade (Bloque de texto con fundido suave)' }
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
  const [selectedId, setSelectedId] = useState('');
  
  // Pestaña activa del editor para organizar y no abrumar al usuario
  const [activeTab, setActiveTab] = useState('card'); // 'card' | 'subtitles' | 'voice'

  // Estados de los campos
  const [name, setName] = useState('Nueva Plantilla');
  const [profileId, setProfileId] = useState(''); // Vinculación de perfil de IA
  const [defaultIdea, setDefaultIdea] = useState(''); // Semilla/Idea por defecto
  const [maleVoice, setMaleVoice] = useState('es-MX-JorgeNeural');
  const [femaleVoice, setFemaleVoice] = useState('es-MX-DaliaNeural');
  const [voiceRate, setVoiceRate] = useState('+0%'); // Velocidad de las voces
  const [font, setFont] = useState('Arial Bold');
  const [fontSize, setFontSize] = useState(100);
  const [subtitleColor, setSubtitleColor] = useState('#FFFF00');
  const [passiveColor, setPassiveColor] = useState('#FFFFFF');
  const [animation, setAnimation] = useState('tiktok-pop');
  const [subtitleBorderStyle, setSubtitleBorderStyle] = useState('outline'); // Estilo sombreado
  
  // Tarjeta de Reddit
  const [cardTheme, setCardTheme] = useState('dark');
  const [cardUsername, setCardUsername] = useState('postfully_user');
  const [cardSubreddit, setCardSubreddit] = useState('r/AskReddit');
  const [cardAvatar, setCardAvatar] = useState('https://www.redditstatic.com/avatars/avatar_default_02_FF4500.png');
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
          } else {
            alert('Error al subir fuente: ' + (data.error || 'Desconocido'));
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

  // Cargar dinámicamente la fuente Bangers de Google Fonts para la previsualización en vivo
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Bangers&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      try {
        document.head.removeChild(link);
      } catch (e) {
        // Ignorar si ya fue removido
      }
    };
  }, []);

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
        setVoiceRate(active.voiceRate || '+0%');
        setFont(active.font);
        setFontSize(active.fontSize || 24);
        setSubtitleColor(active.subtitleColor || '#FFFF00');
        setPassiveColor(active.passiveColor || '#FFFFFF');
        setAnimation(active.animation || 'tiktok-pop');
        setSubtitleBorderStyle(active.subtitleBorderStyle || 'outline');
        setCardTheme(active.cardTheme || 'dark');
        setCardUsername(active.cardUsername || 'postfully_user');
        setCardSubreddit(active.cardSubreddit || 'r/AskReddit');
        setCardAvatar(active.cardAvatar || 'https://www.redditstatic.com/avatars/avatar_default_02_FF4500.png');
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

  // Limpiar timers en desmontaje
  useEffect(() => {
    return () => {
      timelineTimeoutRef.current.forEach(clearTimeout);
    };
  }, []);

  const handleStartTimelineSimulation = () => {
    timelineTimeoutRef.current.forEach(clearTimeout);
    timelineTimeoutRef.current = [];

    setPreviewState('intro');
    setActiveWordIndex(0);

    const t1 = setTimeout(() => {
      setPreviewState('static');
    }, cardEntryDuration * 1000);
    timelineTimeoutRef.current.push(t1);

    const t2 = setTimeout(() => {
      setPreviewState('outro');
    }, (cardEntryDuration + 2.0) * 1000);
    timelineTimeoutRef.current.push(t2);

    const t3 = setTimeout(() => {
      setPreviewState('subtitles');
    }, (cardEntryDuration + 2.0 + cardExitDuration) * 1000);
    timelineTimeoutRef.current.push(t3);
  };

  const handleResetTimelineSimulation = () => {
    timelineTimeoutRef.current.forEach(clearTimeout);
    timelineTimeoutRef.current = [];
    setPreviewState('idle');
    setActiveWordIndex(0);
  };

  const handleCreateNew = () => {
    setSelectedId('new');
    setName('Nueva Plantilla de Video');
    setProfileId('');
    setDefaultIdea('');
    setMaleVoice('es-MX-JorgeNeural');
    setFemaleVoice('es-MX-DaliaNeural');
    setVoiceRate('+0%');
    setFont('Arial Bold');
    setFontSize(100);
    setSubtitleColor('#FFFF00');
    setPassiveColor('#FFFFFF');
    setAnimation('tiktok-pop');
    setSubtitleBorderStyle('outline');
    setCardTheme('dark');
    setCardUsername('reddit_new');
    setCardSubreddit('r/nosleep');
    setCardAvatar('https://www.redditstatic.com/avatars/avatar_default_02_FF4500.png');
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

    setPreviewState('idle');
  };

  const checkMusicFileExists = async (filePath) => {
    if (!filePath) {
      setMusicFileExists(true);
      return;
    }
    try {
      const res = await fetch(`/api/utils/file-exists?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      setMusicFileExists(data.exists);
    } catch (err) {
      setMusicFileExists(false);
    }
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
    if (confirm('¿Estás seguro de que deseas eliminar esta plantilla?')) {
      await onDelete(selectedId);
      const remaining = templates.filter(t => t.id !== selectedId);
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id);
      } else {
        setSelectedId('new');
      }
      alert('Plantilla eliminada exitosamente.');
    }
  };

  const handleExportTemplate = () => {
    try {
      const template = templates.find(t => t.id === selectedId);
      if (!template) {
        alert('No se pudo encontrar la plantilla seleccionada para exportar.');
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

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(templatePackage, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${template.name.toLowerCase().replace(/\s+/g, '_')}_template.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      if (includeApiKeyInExport) {
        alert('⚠️ Plantilla exportada exitosamente CON la clave de API incluida (bajo tu propio riesgo). Recuerda no compartir este archivo públicamente.');
      } else {
        alert('Plantilla exportada exitosamente (el perfil de IA se incluyó sin la clave de API por seguridad).');
      }
    } catch (err) {
      console.error(err);
      alert('Error al exportar plantilla: ' + err.message);
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
          alert('El archivo no contiene un paquete de plantilla de video válido.');
          return;
        }

        const templateName = parsed.template.name;
        const profileName = parsed.profile ? parsed.profile.name : 'Ninguno';

        if (confirm(`¿Deseas importar la plantilla "${templateName}"?\nSe asociará al perfil de IA: "${profileName}".`)) {
          const res = await onImport(parsed);
          if (res.success) {
            alert('¡Plantilla importada exitosamente!\nSi se creó un nuevo perfil de IA, recuerda configurarle su Gemini API Key en la sección Perfiles de IA.');
            if (res.newTemplateId) {
              setSelectedId(res.newTemplateId);
            }
          } else {
            alert('Error al importar la plantilla: ' + res.error);
          }
        }
      } catch (err) {
        console.error(err);
        alert('Error al leer el archivo JSON: ' + err.message);
      }
    };
    
    fileReader.readAsText(file);
    // Limpiar input
    e.target.value = '';
  };

  const handleUploadLocalAvatar = async () => {
    try {
      const res = await fetch('/api/dialog/avatar');
      const data = await res.json();
      if (data.base64) {
        setCardAvatar(data.base64); // Guardar Base64 para visualización directa
        alert('Foto de perfil local cargada exitosamente.');
      }
    } catch (err) {
      console.error('Error abriendo diálogo de imagen nativo:', err);
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
  };

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
        alert('Error generando la locución de prueba: ' + (data.error || 'Desconocido'));
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Error generando locución de prueba:', err);
      alert('Error de conexión al servidor local.');
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
      voiceRate,
      font,
      fontSize: parseInt(fontSize),
      subtitleColor,
      passiveColor,
      animation,
      subtitleBorderStyle,
      cardTheme,
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
      multiVoicePromptExtension
    });

    if (saved && saved.id) {
      setSelectedId(saved.id);
      alert('Plantilla guardada exitosamente.');
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
    
    let positionStyle = {};
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

          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-border-dark cursor-pointer animate-pulse-ring"
          >
            <Plus className="w-4 h-4 text-brand-primary" />
            <span>Crear Nueva Plantilla</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor de Parámetros (Columna Izquierda - 7/12) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSaveSubmit} className="glass-panel rounded-2xl p-6 space-y-6">
            
            {/* Selección de plantilla */}
            <div className="flex items-center gap-4 border-b border-border-dark pb-4">
              <div className="flex-grow space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">Selecciona Plantilla</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full bg-black/40 border border-border-dark rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary font-bold"
                >
                  {selectedId === 'new' && (
                    <option value="new">-- Nueva Plantilla (Sin Guardar) --</option>
                  )}
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-black/40 border border-border-dark rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary font-bold"
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
            </div>

            {/* CONTENIDO PESTAÑA CARD */}
            {activeTab === 'card' && (
              <div className="space-y-6 animate-[pFadeIn_0.2s_ease-out]">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
                    <Palette className="w-4 h-4 text-amber-400" />
                    <span>Propiedades del Reddit Card</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400">TEMA DEL CARD</label>
                      <select
                        value={cardTheme}
                        onChange={(e) => setCardTheme(e.target.value)}
                        className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-semibold"
                      >
                        <option value="dark">Modo Oscuro Reddit</option>
                        <option value="light">Modo Claro Reddit</option>
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
              </div>
            )}

            {/* CONTENIDO PESTAÑA SUBTÍTULOS */}
            {activeTab === 'subtitles' && (
              <div className="space-y-6 animate-[pFadeIn_0.2s_ease-out]">
                
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

            {/* BOTONES ACCIÓN */}
            <div className="flex gap-4 border-t border-border-dark pt-6 justify-end">
              {templates.length > 1 && selectedId && selectedId !== 'new' && (
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
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
        </div>

        {/* Previsualización en Vivo de la Tarjeta y el Subtítulo (Columna Derecha - 5/12) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-2xl p-4 flex flex-col items-center gap-4 h-full min-h-[540px] relative overflow-hidden bg-gradient-to-b from-gray-900 to-black">
            
            {/* Cabecera sección */}
            <div className="w-full border-b border-border-dark pb-2 flex flex-col items-center shrink-0">
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-brand-primary" />
                <span>Previa en Vivo</span>
              </span>
            </div>

            {/* Aspect Ratio Simulator Toggle */}
            <div className="w-full shrink-0 flex items-center justify-between bg-black/40 rounded-xl p-1.5 border border-border-dark">
              <span className="text-[10px] font-bold text-gray-400 ml-2 uppercase">Previsualizar Aspect Ratio:</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewOrientation('9:16')}
                  className={`px-3 py-1 text-[9px] font-black rounded-lg transition-all cursor-pointer uppercase ${
                    previewOrientation === '9:16'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  9:16 Vertical
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOrientation('16:9')}
                  className={`px-3 py-1 text-[9px] font-black rounded-lg transition-all cursor-pointer uppercase ${
                    previewOrientation === '16:9'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  16:9 Horizontal
                </button>
              </div>
            </div>

            {/* Controles de Simulación Premium */}
            <div className="flex gap-3 w-full shrink-0">
              <button
                type="button"
                onClick={handleStartTimelineSimulation}
                className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 active:scale-[0.98] text-white font-black py-2 px-3 rounded-xl text-[10px] transition-all cursor-pointer shadow-lg shadow-orange-500/10"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Reproducir Animación Secuencial</span>
              </button>
              {previewState !== 'idle' && (
                <button
                  type="button"
                  onClick={handleResetTimelineSimulation}
                  className="flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white p-2 rounded-xl border border-border-dark cursor-pointer text-[10px] transition-all"
                  title="Reiniciar a Vista Estática"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Monitor de Estado Simulador */}
            <div className="w-full bg-black/60 rounded-xl px-3 py-1.5 text-center shrink-0 border border-border-dark flex justify-between items-center">
              <span className="text-[9px] font-bold text-gray-500">ESTADO DEL VIDEO:</span>
              <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded ${
                previewState === 'idle' ? 'bg-gray-800 text-gray-300' :
                previewState === 'intro' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                previewState === 'static' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                previewState === 'outro' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              }`}>
                {previewState === 'idle' ? 'Edición Estática' :
                 previewState === 'intro' ? 'Entrada del Card' :
                 previewState === 'static' ? 'Título en Pantalla' :
                 previewState === 'outro' ? 'Salida del Card' :
                 'Card Oculto + Subtítulos Corriendo'}
              </span>
            </div>

            {/* Simulación del layout vertical 9:16 o horizontal 16:9 */}
            <div 
              className={`rounded-2xl bg-gray-950 border-2 border-gray-800 shadow-2xl relative flex flex-col justify-between p-3 overflow-hidden shrink-0 select-none transition-all duration-300 ${
                previewOrientation === '16:9' ? 'w-[380px] h-[215px]' : 'w-[230px] h-[395px]'
              }`}
            >
              
              {/* Fondo del juego simulado */}
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/30 via-slate-900/40 to-teal-900/30 opacity-70 z-0"></div>
              
              {/* Línea de cuadrícula para centrado del simulador */}
              <div className="absolute inset-0 border border-white/5 pointer-events-none z-0"></div>

              {/* Marca de agua simulada */}
              {watermarkEnabled && (
                watermarkType === 'image' ? (
                  <div style={getWatermarkImageStyle()}>
                    📷 LOGO_WM
                  </div>
                ) : (
                  <div style={getWatermarkStyle()}>
                    {watermarkText}
                  </div>
                )
              )}

              {/* Animaciones CSS locales para la marca de agua */}
              <style>{`
                @keyframes watermark-bounce-sim {
                  0% { top: 10%; left: 10%; }
                  25% { top: 75%; left: 60%; }
                  50% { top: 10%; left: 60%; }
                  75% { top: 75%; left: 10%; }
                  100% { top: 10%; left: 10%; }
                }
                @keyframes watermark-wobble-sim {
                  0%, 100% { transform: rotate(-5deg) scale(1); }
                  50% { transform: rotate(5deg) scale(1.05); }
                }
              `}</style>

              {/* CARD DE REDDIT INTERACTIVA (CON DESPLAZAMIENTO SCALADO EN VIVO Y CONTROL DE TIMELINE) */}
              {previewState !== 'subtitles' && (
                <div 
                  className={`z-10 w-full transition-transform duration-100 ease-out flex justify-center items-center h-full absolute inset-0 p-4 ${getCardAnimClass()}`}
                  style={{ 
                    transform: `translate(${
                      (previewOrientation === '16:9' ? cardOffsetX_16_9 : cardOffsetX) * 0.14
                    }px, ${
                      (previewOrientation === '16:9' ? cardOffsetY_16_9 : cardOffsetY) * 0.14
                    }px) scale(${
                      previewOrientation === '16:9' ? cardScale_16_9 : cardScale
                    })` 
                  }}
                >
                  <div 
                    style={{
                      width: `${cardWidth}px`,
                      borderRadius: `${cardBorderRadius}px`,
                      padding: `${cardPadding}px`,
                      gap: `${cardGap}px`,
                      backgroundColor: cardTheme === 'dark' ? '#1c1c1e' : '#ffffff',
                      borderColor: cardTheme === 'dark' ? '#2c2c2e' : '#edeff1',
                      color: cardTheme === 'dark' ? '#e5e5e7' : '#11151a'
                    }}
                    className="border shadow-xl flex flex-col font-sans select-none overflow-hidden transition-all duration-300"
                  >
                    {/* Header */}
                    <div className="flex items-start gap-1.5">
                      <div className="relative w-9 h-9 shrink-0 overflow-hidden rounded-full">
                        <img 
                          className="absolute w-full h-full object-cover" 
                          src={cardAvatar && cardAvatar.startsWith('/avatars/') ? `http://localhost:5000${cardAvatar}` : (cardAvatar || 'https://www.redditstatic.com/avatars/avatar_default_02_FF4500.png')} 
                          alt="avatar" 
                          onError={(e) => { e.target.src = 'https://www.redditstatic.com/avatars/avatar_default_02_FF4500.png'; }}
                        />
                      </div>
                      <div className="flex flex-col items-start gap-0.5">
                        <div className="flex items-center gap-1">
                          <span 
                            style={{ color: cardTheme === 'dark' ? '#ffffff' : '#11151a' }}
                            className="text-[12px] font-extrabold truncate max-w-[120px]"
                          >
                            {cardSubreddit}
                          </span>
                          {cardShowVerified && (
                            <svg 
                              viewBox="0 0 20 20" 
                              fill="currentColor" 
                              className="w-3.5 h-3.5 text-blue-500 inline shrink-0"
                            >
                              <path 
                                fillRule="evenodd" 
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" 
                                clipRule="evenodd" 
                              />
                            </svg>
                          )}
                        </div>
                        <span 
                          style={{ color: cardTheme === 'dark' ? '#94a3b8' : '#5c6c74' }}
                          className="text-[9px] font-medium"
                        >
                          u/{cardUsername}
                        </span>
                      </div>
                    </div>

                    {cardShowAwards && (
                      <div className="flex gap-2 mt-1 mb-1 items-center flex-wrap">
                        {cardSelectedAwards && cardSelectedAwards.length > 0 ? (
                          cardSelectedAwards.map((item, idx) => (
                            <img key={idx} src={`/assets/awards/${item.file}`} alt={item.name} className="w-4 h-4 object-contain" />
                          ))
                        ) : (
                          <img 
                            src="/reddit-awards.png" 
                            alt="awards" 
                            className="h-[14px] w-auto object-contain block" 
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const fallback = e.target.nextSibling;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* Title */}
                    <div 
                      style={{ gap: `${cardGap * 1.5}px` }}
                      className="flex flex-col mt-0.5"
                    >
                      <div 
                        style={{ color: cardTheme === 'dark' ? '#ffffff' : '#11151a' }}
                        className="text-[12px] font-extrabold leading-tight break-words"
                      >
                        {testTitle || 'Aquí se mostrará el título de la historia...'}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center gap-2 mt-1 select-none">
                      <div className="flex items-center gap-2">
                        {/* Upvotes (Heart SVG) */}
                        <div 
                          style={{ color: cardTheme === 'dark' ? '#94a3b8' : '#5c6c74' }}
                          className="flex items-center gap-1 text-[9px] font-bold"
                        >
                          <svg className="w-3.5 h-3.5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                            <path d="M12 21C13 21 22 16.0003 22 9.00046C22 5.5006 19 3.04408 16 3.00068C14.5 2.97897 13 3.50068 12 5.00062C11 3.50068 9.47405 3.00068 8 3.00068C5 3.00068 2 5.5006 2 9.00046C2 16.0003 11 21 12 21Z" strokeLinecap="round" strokeLinejoin="round"></path>
                          </svg>
                          <span>{upvotes}</span>
                        </div>

                        {/* Comments (Speech bubble SVG) */}
                        <div 
                          style={{ color: cardTheme === 'dark' ? '#94a3b8' : '#5c6c74' }}
                          className="flex items-center gap-1 text-[9px] font-bold"
                        >
                          <svg className="w-3.5 h-3.5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.499 2.33015 14.921 2.9214 16.1973C3.38829 17.2052 3.83022 18.0644 3.50454 19.1977C3.34789 19.7429 2.95529 20.2798 2.90866 20.8475C2.85534 21.4967 3.42708 22.0228 4.06965 21.9157C5.3779 21.6977 6.0076 20.6574 7.52552 21.0144C7.69003 21.0531 8.11879 21.2065 8.97627 21.5132C9.88354 21.8377 10.8606 22 12 22Z" strokeLinecap="round" strokeLinejoin="round"></path>
                          </svg>
                          <span>{comments}</span>
                        </div>
                      </div>

                      {/* Share */}
                      <div 
                        style={{ color: cardTheme === 'dark' ? '#94a3b8' : '#5c6c74' }}
                        className="flex items-center gap-1 text-[9px] font-bold"
                      >
                        <svg className="w-3.5 h-3.5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                          <path d="M8 10H7.5V10C6.10444 10 5.40666 10 4.83886 10.1722C3.56046 10.56 2.56004 11.5605 2.17224 12.8389C2 13.4067 2 14.1044 2 15.5V16C2 17.8638 2 18.7956 2.30448 19.5307C2.71046 20.5108 3.48915 21.2895 4.46927 21.6955C5.20435 22 6.13623 22 8 22L16 22C17.8638 22 18.7956 22 19.5307 21.6955C20.5108 21.2895 21.2895 20.5108 21.6955 19.5307C22 18.7956 22 17.8638 22 16V15.5C22 14.1044 22 13.4067 21.8278 12.8389C21.44 11.5605 20.4395 10.56 19.1611 10.1722C18.5933 10 17.8956 10 16.5 10V10H16M12 15V2M12 2L8 6M12 2L16 6" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                        <span>Share</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DEMO DE SUBTÍTULOS ANIMADOS EN VIVO (SE MUESTRAN EN IDLE O EXCLUSIVAMENTE DURANTE SU ESTADO DE TIMELINE) */}
              {(previewState === 'subtitles' || previewState === 'idle') && (
                <div 
                  className={`z-20 absolute top-[50%] left-0 right-0 flex justify-center text-center px-4 pointer-events-none transition-transform duration-100 ease-out -translate-y-1/2 ${
                    previewOrientation === '16:9' ? 'w-[65%] mx-auto inset-x-0' : 'w-full'
                  }`}
                  style={{ 
                    // Cuando es 0,0 en la base de datos se centra totalmente.
                    // En el simulador esto se logra colocándolo en top-[50%] y -translate-y-1/2, 
                    // y luego desplazándolo proporcionalmente con la coordenada del usuario.
                    transform: `translate(${
                      (previewOrientation === '16:9' ? subtitleOffsetX_16_9 : subtitleOffsetX) * 0.14
                    }px, ${
                      (previewOrientation === '16:9' ? subtitleOffsetY_16_9 : subtitleOffsetY) * 0.14
                    }px) translateY(-50%)` 
                  }}
                >
                  {(animation === 'tiktok-pop' || animation === 'bounce-pop') && (
                    <span 
                      key={activeWordIndex}
                      className={`font-extrabold uppercase shadow-sm filter tracking-wide inline-block ${
                        animation === 'bounce-pop' ? 'animate-[bounce_0.25s_ease-in-out_infinite]' : 'scale-[1.12] transition-transform duration-100'
                      }`}
                      style={{ 
                        fontFamily: font.split(' ')[0], 
                        fontSize: `${previewOrientation === '16:9' ? (fontSize_16_9 / 100) * 11 : (fontSize / 100) * 12.5}px`, 
                        letterSpacing: `${subtitleLetterSpacing}px`,
                        color: subtitleColor,
                        // Soporte premium para la caja de fondo o los bordes
                        ...(subtitleBorderStyle === 'box' ? {
                          backgroundColor: 'rgba(0, 0, 0, 0.75)',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        } : getSubtitleShadowStyle())
                      }}
                    >
                      {wordsList[activeWordIndex] || 'SUBTÍTULO'}
                    </span>
                  )}
                  
                  {(animation === 'active-highlight' || animation === 'glow-karaoke' || animation === 'borde-emergente-2') && (
                    <div 
                      className={`flex flex-wrap justify-center items-center gap-1.5 font-bold filter leading-tight ${
                        subtitleBorderStyle === 'box' && animation !== 'borde-emergente-2' ? 'bg-black/75 px-3 py-2 rounded-xl border border-white/10' : ''
                      }`}
                      style={{ 
                        fontFamily: font.split(' ')[0], 
                        fontSize: `${previewOrientation === '16:9' ? (fontSize_16_9 / 100) * 10 : (fontSize / 100) * 11.5}px`,
                        letterSpacing: `${subtitleLetterSpacing}px`,
                        ...(animation !== 'borde-emergente-2' ? getSubtitleShadowStyle() : {})
                      }}
                    >
                      {wordsList.map((w, idx) => {
                        const isActive = idx === activeWordIndex;
                        const wordText = animation === 'borde-emergente-2' ? w.toUpperCase() : w;
                        if (isActive) {
                          if (animation === 'borde-emergente-2') {
                            return (
                              <span 
                                key={idx}
                                style={{
                                  color: '#FFFFFF',
                                  backgroundColor: '#6C138E',
                                  padding: '3px 4px',
                                  borderRadius: '6px',
                                  display: 'inline-block'
                                }} 
                                className="font-extrabold mx-0.5 text-center animate-[pFadeIn_0.1s_ease-out]"
                              >
                                {wordText}
                              </span>
                            );
                          }
                          return (
                            <span 
                              key={idx}
                              style={
                                animation === 'glow-karaoke' 
                                  ? { color: subtitleColor, textShadow: `0px 0px 6px ${subtitleColor}`, transition: `all ${subtitleAnimationSpeed}ms ease` }
                                  : { color: subtitleColor, transition: `all ${subtitleAnimationSpeed}ms ease` }
                              } 
                              className="font-extrabold mx-0.5"
                            >
                              {wordText}
                            </span>
                          );
                        } else {
                          if (animation === 'borde-emergente-2') {
                            return (
                              <span 
                                key={idx}
                                style={{
                                  color: passiveColor,
                                  backgroundColor: 'transparent',
                                  padding: '3px 4px',
                                  borderRadius: '6px',
                                  display: 'inline-block'
                                }} 
                                className="font-extrabold mx-0.5 text-center"
                              >
                                {wordText}
                              </span>
                            );
                          }
                          return (
                            <span 
                              key={idx} 
                              style={{ 
                                color: passiveColor, 
                                transition: `all ${subtitleAnimationSpeed}ms ease`,
                                ...(animation === 'borde-emergente-2' ? getSubtitleShadowStyle() : {})
                              }}
                              className="font-extrabold mx-0.5"
                            >
                              {wordText}
                            </span>
                          );
                        }
                      })}
                    </div>
                  )}
                  
                  {animation === 'clean-fade' && (
                    <span 
                      className="font-medium tracking-wide leading-relaxed animate-pulse"
                      style={{ 
                        fontFamily: font.split(' ')[0], 
                        fontSize: `${((previewOrientation === '16:9' ? fontSize_16_9 : fontSize) / 100) * 14}px`,
                        letterSpacing: `${subtitleLetterSpacing}px`,
                        color: passiveColor,
                        ...(subtitleBorderStyle === 'box' ? {
                          backgroundColor: 'rgba(0, 0, 0, 0.75)',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        } : getSubtitleShadowStyle())
                      }}
                    >
                      {testSubtitleText}
                    </span>
                  )}
                </div>
              )}

            </div>

            {/* Input de Prueba del Card */}
            <div className="w-full shrink-0 space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Título de Prueba del Card:</label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                className="w-full bg-black/40 border border-border-dark rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
              />
            </div>

            {/* Input de Prueba del Subtítulo */}
            <div className="w-full shrink-0 space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Texto de Prueba de Subtítulos:</label>
              <input
                type="text"
                value={testSubtitleText}
                onChange={(e) => setTestSubtitleText(e.target.value)}
                className="w-full bg-black/40 border border-border-dark rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary"
              />
            </div>

          </div>
        </div>
      </div>

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

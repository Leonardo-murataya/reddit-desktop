import React, { useEffect, useRef, useState } from 'react';
import { Layers, Plus, Trash2, FolderOpen, Move, Clock, Droplet, Info, Type, Volume2 } from 'lucide-react';

const DEFAULT_OVERLAY = {
  type: 'media',
  enabled: true,
  name: 'Overlay',
  file: '',
  chromaEnabled: true,
  chromaColor: '#00FF00',
  chromaSimilarity: 0.25,
  chromaBlend: 0.08,
  scale: 0.65,
  posX: 0.5,
  posY: 0.8,
  opacity: 1,
  startTime: 10,
  repeatEvery: 0,
  duration: 0,
  includeAudio: false,
  audioVolume: 0
};

// Valores por defecto de una capa de texto: replica el "HISTORIA COMPLETA" de los videos editados en CapCut
const DEFAULT_TEXT_LAYER = {
  type: 'text',
  enabled: true,
  name: 'Texto',
  text: 'HISTORIA\nCOMPLETA',
  font: 'Bangers',
  fontSize: 140,
  color: '#FFD400',
  outlineColor: '#000000',
  outlineWidth: 7,
  letterSpacing: 0,
  posX: 0.5,
  posY: 0.13,
  startTime: 0,
  duration: 10,
  repeatEvery: 0,
  animation: 'wiggle'
};

const TEXT_ANIMATIONS = [
  { value: 'wiggle', label: 'Bamboleo letra por letra (estilo CapCut)' },
  { value: 'pop', label: 'Pop (aparece creciendo)' },
  { value: 'pulse', label: 'Latido (crece y encoge)' },
  { value: 'slide-down', label: 'Cae desde arriba' },
  { value: 'fade', label: 'Fundido' },
  { value: 'none', label: 'Sin animación' }
];

const POSITION_PRESETS = [
  { label: 'Arriba', posX: 0.5, posY: 0.15 },
  { label: 'Centro', posX: 0.5, posY: 0.5 },
  { label: 'Abajo', posX: 0.5, posY: 0.8 }
];

const newOverlayId = () => `ov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const createOverlay = (index = 0) => ({
  ...DEFAULT_OVERLAY,
  id: newOverlayId(),
  name: `Overlay ${index + 1}`
});

export const createTextLayer = (index = 0) => ({
  ...DEFAULT_TEXT_LAYER,
  id: newOverlayId(),
  name: `Texto ${index + 1}`
});

// Completa campos faltantes de overlays guardados (plantillas viejas o importadas)
export const normalizeOverlays = (list) => (Array.isArray(list) ? list : []).map((ov) => ({
  ...(ov.type === 'text' ? DEFAULT_TEXT_LAYER : DEFAULT_OVERLAY),
  ...ov,
  id: ov.id || newOverlayId()
}));

const previewKey = (ov) => `${ov.file}|${!!ov.chromaEnabled}|${ov.chromaColor}|${ov.chromaSimilarity}|${ov.chromaBlend}`;

/**
 * Genera (con croma aplicado) y cachea la vista previa de cada overlay para el lienzo en vivo.
 * Devuelve un mapa { [overlay.id]: { image, duration, isImage } }.
 */
export function useOverlayPreviews(overlays) {
  const [previews, setPreviews] = useState({});
  const cacheRef = useRef({});

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const next = {};
      for (const ov of overlays || []) {
        if (ov.type === 'text' || !ov.file) continue;
        const key = previewKey(ov);
        if (!cacheRef.current[key]) {
          try {
            const res = await fetch('/api/overlays/preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                file: ov.file,
                chromaEnabled: ov.chromaEnabled,
                chromaColor: ov.chromaColor,
                chromaSimilarity: ov.chromaSimilarity,
                chromaBlend: ov.chromaBlend
              })
            });
            const data = await res.json();
            cacheRef.current[key] = data.image ? data : { error: data.error || 'Sin vista previa' };
          } catch (err) {
            cacheRef.current[key] = { error: err.message };
          }
        }
        next[ov.id] = cacheRef.current[key];
      }
      if (!cancelled) setPreviews(next);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [overlays]);

  return previews;
}

function SliderField({ label, value, min, max, step, onChange, display }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-bold text-gray-400">{label}: {display}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2.5"
      />
    </div>
  );
}

function NumberField({ label, value, min, step, onChange, hint }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-bold text-gray-400">{label}</label>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-black/40 border border-border-dark rounded-xl p-2 text-xs text-white font-bold"
      />
      {hint && <p className="text-[9px] text-gray-500">{hint}</p>}
    </div>
  );
}

function describeTiming(ov, preview) {
  const clip = ov.type === 'text'
    ? (ov.duration > 0 ? ov.duration : null)
    : (ov.duration > 0 ? ov.duration : (preview?.isImage ? 5 : preview?.duration));
  const clipText = clip
    ? `${Number(clip).toFixed(1)}s`
    : (ov.type === 'text' ? 'hasta el final del video' : 'el clip completo');
  if (!ov.repeatEvery || ov.repeatEvery <= 0) {
    return `Aparece una sola vez en el segundo ${ov.startTime} y dura ${clipText}.`;
  }
  const inTenMinutes = Math.max(0, Math.floor((600 - ov.startTime) / ov.repeatEvery) + 1);
  return `Aparece en el segundo ${ov.startTime} y se repite cada ${ov.repeatEvery}s (dura ${clipText} cada vez; ~${inTenMinutes} veces en un video de 10 min).`;
}

function LayerHeader({ ov, icon, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={ov.enabled}
        onChange={(e) => onChange({ enabled: e.target.checked })}
        className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
        title="Activar / desactivar esta capa"
      />
      {icon}
      <input
        type="text"
        value={ov.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="flex-1 bg-black/40 border border-border-dark rounded-xl p-2 text-xs text-white font-bold"
      />
      <button
        type="button"
        onClick={onRemove}
        className="bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 p-2 rounded-xl cursor-pointer"
        title="Eliminar capa"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function PositionSection({ ov, onChange, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
        <Move className="w-3.5 h-3.5 text-emerald-400" />
        <span>Posición y tamaño</span>
        <span className="flex gap-1 ml-auto normal-case">
          {POSITION_PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange({ posX: p.posX, posY: p.posY })}
              className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </span>
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {children}
        <SliderField
          label="POSICIÓN HORIZONTAL"
          value={ov.posX}
          min={0}
          max={1}
          step={0.01}
          display={`${Math.round(ov.posX * 100)}%`}
          onChange={(v) => onChange({ posX: v })}
        />
        <SliderField
          label="POSICIÓN VERTICAL"
          value={ov.posY}
          min={0}
          max={1}
          step={0.01}
          display={`${Math.round(ov.posY * 100)}%`}
          onChange={(v) => onChange({ posY: v })}
        />
      </div>
    </div>
  );
}

function TimingSection({ ov, preview, onChange }) {
  const isText = ov.type === 'text';
  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-emerald-400" />
        <span>Cuándo aparece</span>
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NumberField
          label="APARECE EN EL SEGUNDO"
          value={ov.startTime}
          min={0}
          step={0.5}
          onChange={(v) => onChange({ startTime: Math.max(0, v) })}
        />
        <NumberField
          label="REPETIR CADA (SEGUNDOS)"
          value={ov.repeatEvery}
          min={0}
          step={5}
          hint="0 = solo una vez"
          onChange={(v) => onChange({ repeatEvery: Math.max(0, v) })}
        />
        <NumberField
          label="DURACIÓN (SEGUNDOS)"
          value={ov.duration}
          min={0}
          step={0.5}
          hint={isText ? '0 = hasta el final del video' : '0 = clip completo (imágenes: 5s)'}
          onChange={(v) => onChange({ duration: Math.max(0, v) })}
        />
      </div>
      <p className="text-[9px] text-emerald-400/80 flex items-center gap-1">
        <Info className="w-3 h-3" />
        <span>{describeTiming(ov, preview)}</span>
      </p>
    </div>
  );
}

function MediaLayerCard({ ov, preview, onChange, onRemove, onPickFile }) {
  return (
    <>
      <LayerHeader ov={ov} icon={<Layers className="w-4 h-4 text-emerald-400" />} onChange={onChange} onRemove={onRemove} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Vista previa con croma */}
        <div
          className="rounded-xl border border-border-dark flex items-center justify-center min-h-[90px] p-2"
          style={{
            backgroundColor: '#1f2937',
            backgroundImage: 'linear-gradient(45deg, #374151 25%, transparent 25%), linear-gradient(-45deg, #374151 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #374151 75%), linear-gradient(-45deg, transparent 75%, #374151 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
          }}
        >
          {preview?.image ? (
            <img src={preview.image} alt={ov.name} className="max-h-24 max-w-full object-contain" />
          ) : (
            <span className="text-[9px] text-gray-400 text-center">
              {ov.file ? (preview?.error ? `⚠️ ${preview.error}` : 'Cargando vista previa…') : 'Sin archivo'}
            </span>
          )}
        </div>

        {/* Archivo */}
        <div className="space-y-1 md:col-span-3">
          <label className="block text-[10px] font-bold text-gray-400">ARCHIVO (VIDEO CON FONDO VERDE, GIF O IMAGEN PNG)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={ov.file}
              onChange={(e) => onChange({ file: e.target.value })}
              placeholder="Ej: C:\Users\Nombre\Videos\globo_facebook.mp4"
              className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-mono truncate"
            />
            <button
              type="button"
              onClick={onPickFile}
              className="bg-gray-800 hover:bg-gray-700 text-white font-bold p-2.5 rounded-xl border border-border-dark cursor-pointer"
              title="Seleccionar archivo"
            >
              <FolderOpen className="w-5 h-5 text-brand-primary" />
            </button>
          </div>
          {preview?.duration > 0 && (
            <p className="text-[9px] text-gray-500">Duración del clip: {preview.duration}s</p>
          )}
        </div>
      </div>

      {/* Croma */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <Droplet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Quitar fondo (Chroma Key)</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center justify-between bg-black/30 p-3 rounded-xl border border-border-dark">
            <label className="text-[10px] font-bold text-gray-300 uppercase">Activar croma</label>
            <input
              type="checkbox"
              checked={ov.chromaEnabled}
              onChange={(e) => onChange({ chromaEnabled: e.target.checked })}
              className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400">COLOR A QUITAR</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                disabled={!ov.chromaEnabled}
                value={ov.chromaColor}
                onChange={(e) => onChange({ chromaColor: e.target.value })}
                className="w-8 h-8 rounded-lg bg-transparent border border-border-dark cursor-pointer disabled:opacity-40"
              />
              <span className="text-xs text-gray-400 font-bold uppercase">{ov.chromaColor}</span>
            </div>
          </div>
          <SliderField
            label="TOLERANCIA"
            value={ov.chromaSimilarity}
            min={0.05}
            max={0.6}
            step={0.01}
            display={ov.chromaSimilarity.toFixed(2)}
            onChange={(v) => onChange({ chromaSimilarity: v })}
          />
          <SliderField
            label="SUAVIZADO DE BORDE"
            value={ov.chromaBlend}
            min={0}
            max={0.3}
            step={0.01}
            display={ov.chromaBlend.toFixed(2)}
            onChange={(v) => onChange({ chromaBlend: v })}
          />
        </div>
        <p className="text-[9px] text-gray-500">
          Si queda borde verde, sube la tolerancia. Si se borran partes del logo, bájala.
        </p>
      </div>

      <PositionSection ov={ov} onChange={onChange}>
        <SliderField
          label="TAMAÑO"
          value={ov.scale}
          min={0.05}
          max={1}
          step={0.01}
          display={`${Math.round(ov.scale * 100)}% del ancho`}
          onChange={(v) => onChange({ scale: v })}
        />
        <SliderField
          label="OPACIDAD"
          value={ov.opacity}
          min={0.1}
          max={1}
          step={0.05}
          display={`${Math.round(ov.opacity * 100)}%`}
          onChange={(v) => onChange({ opacity: v })}
        />
      </PositionSection>

      {/* Sonido propio del overlay */}
      {!preview?.isImage && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sonido del overlay (SFX)</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between bg-black/30 p-3 rounded-xl border border-border-dark md:col-span-2">
              <div className="space-y-0.5">
                <label className="block text-[10px] font-bold text-gray-300 uppercase">Incluir su sonido</label>
                <p className="text-[9px] text-gray-500">Suena cada vez que aparece (ej. el "pop" del globo).</p>
              </div>
              <input
                type="checkbox"
                checked={ov.includeAudio}
                onChange={(e) => onChange({ includeAudio: e.target.checked })}
                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
              />
            </div>
            <div className="md:col-span-2">
              <SliderField
                label="VOLUMEN"
                value={ov.audioVolume}
                min={-30}
                max={6}
                step={1}
                display={`${ov.audioVolume > 0 ? '+' : ''}${ov.audioVolume} dB`}
                onChange={(v) => onChange({ audioVolume: v })}
              />
            </div>
          </div>
        </div>
      )}

      <TimingSection ov={ov} preview={preview} onChange={onChange} />
    </>
  );
}

function TextLayerCard({ ov, fonts, onChange, onRemove }) {
  return (
    <>
      <LayerHeader ov={ov} icon={<Type className="w-4 h-4 text-amber-400" />} onChange={onChange} onRemove={onRemove} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1 md:col-span-2">
          <label className="block text-[10px] font-bold text-gray-400">TEXTO (ENTER = NUEVO RENGLÓN)</label>
          <textarea
            rows={2}
            value={ov.text}
            onChange={(e) => onChange({ text: e.target.value })}
            className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold resize-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-gray-400">FUENTE</label>
          <select
            value={ov.font}
            onChange={(e) => onChange({ font: e.target.value })}
            className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold"
          >
            {fonts.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-gray-400">ANIMACIÓN</label>
          <select
            value={ov.animation}
            onChange={(e) => onChange({ animation: e.target.value })}
            className="w-full bg-black/40 border border-border-dark rounded-xl p-2.5 text-xs text-white font-bold"
          >
            {TEXT_ANIMATIONS.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-gray-400">COLOR DEL TEXTO</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={ov.color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="w-8 h-8 rounded-lg bg-transparent border border-border-dark cursor-pointer"
            />
            <span className="text-xs text-gray-400 font-bold uppercase">{ov.color}</span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-gray-400">COLOR DEL CONTORNO</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={ov.outlineColor}
              onChange={(e) => onChange({ outlineColor: e.target.value })}
              className="w-8 h-8 rounded-lg bg-transparent border border-border-dark cursor-pointer"
            />
            <span className="text-xs text-gray-400 font-bold uppercase">{ov.outlineColor}</span>
          </div>
        </div>
        <SliderField
          label="GROSOR DEL CONTORNO"
          value={ov.outlineWidth}
          min={0}
          max={20}
          step={1}
          display={`${ov.outlineWidth}px`}
          onChange={(v) => onChange({ outlineWidth: v })}
        />
        <SliderField
          label="ESPACIADO DE LETRAS"
          value={ov.letterSpacing}
          min={-5}
          max={20}
          step={1}
          display={`${ov.letterSpacing}px`}
          onChange={(v) => onChange({ letterSpacing: v })}
        />
      </div>

      <PositionSection ov={ov} onChange={onChange}>
        <SliderField
          label="TAMAÑO DE LETRA"
          value={ov.fontSize}
          min={30}
          max={260}
          step={2}
          display={`${ov.fontSize}`}
          onChange={(v) => onChange({ fontSize: v })}
        />
      </PositionSection>

      <TimingSection ov={ov} onChange={onChange} />
    </>
  );
}

export default function OverlaysPanel({ overlays, setOverlays, previews, fonts = [] }) {
  const updateOverlay = (id, changes) => {
    setOverlays(prev => prev.map(ov => (ov.id === id ? { ...ov, ...changes } : ov)));
  };

  const removeOverlay = (id) => {
    setOverlays(prev => prev.filter(ov => ov.id !== id));
  };

  const addOverlay = () => {
    setOverlays(prev => [...prev, createOverlay(prev.length)]);
  };

  const addTextLayer = () => {
    setOverlays(prev => [...prev, createTextLayer(prev.filter(ov => ov.type === 'text').length)]);
  };

  const pickFile = async (id) => {
    try {
      const res = await fetch('/api/dialog/overlay-media');
      const data = await res.json();
      if (data.path) {
        const fileName = data.path.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
        updateOverlay(id, { file: data.path, name: fileName });
      }
    } catch (err) {
      console.error('Error al seleccionar el archivo del overlay:', err);
    }
  };

  // La fuente elegida siempre aparece en la lista aunque no sea de las cargadas
  const fontOptions = (ov) => (fonts.some(f => f.value === ov.font) ? fonts : [{ value: ov.font, label: ov.font }, ...fonts]);

  return (
    <div className="space-y-6 animate-[pFadeIn_0.2s_ease-out]">
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Overlays y Textos (Logos, Globos con Croma, Títulos)</span>
        </h3>
        <p className="text-[10px] text-gray-500">
          Capas que se ponen encima de todo el video, como las pistas superiores de CapCut: tu globo de página con fondo verde o textos como "HISTORIA COMPLETA".
        </p>
      </div>

      {overlays.length === 0 && (
        <div className="bg-black/20 p-6 rounded-xl border border-dashed border-border-dark text-center space-y-2">
          <p className="text-xs text-gray-400 font-bold">Esta plantilla todavía no tiene capas.</p>
          <p className="text-[10px] text-gray-500">Añade un overlay (video con fondo verde, GIF o PNG) o un texto animado.</p>
        </div>
      )}

      {overlays.map((ov) => (
        <div key={ov.id} className={`space-y-4 bg-black/20 p-4 rounded-xl border border-border-dark ${ov.enabled ? '' : 'opacity-60'}`}>
          {ov.type === 'text' ? (
            <TextLayerCard
              ov={ov}
              fonts={fontOptions(ov)}
              onChange={(changes) => updateOverlay(ov.id, changes)}
              onRemove={() => removeOverlay(ov.id)}
            />
          ) : (
            <MediaLayerCard
              ov={ov}
              preview={previews[ov.id]}
              onChange={(changes) => updateOverlay(ov.id, changes)}
              onRemove={() => removeOverlay(ov.id)}
              onPickFile={() => pickFile(ov.id)}
            />
          )}
        </div>
      ))}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={addOverlay}
          className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 font-bold py-3 rounded-xl text-xs cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir overlay (video / imagen)</span>
        </button>
        <button
          type="button"
          onClick={addTextLayer}
          className="flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 font-bold py-3 rounded-xl text-xs cursor-pointer transition-all"
        >
          <Type className="w-4 h-4" />
          <span>Añadir texto</span>
        </button>
      </div>
    </div>
  );
}

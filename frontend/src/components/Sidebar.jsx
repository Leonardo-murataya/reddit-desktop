import React from 'react';
import { 
  LayoutDashboard, 
  Palette, 
  KeyRound, 
  Settings, 
  Sparkles, 
  Bell, 
  Cpu, 
  ChevronLeft, 
  ChevronRight,
  Video,
  Zap,
  RefreshCw
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, gpuInfo, isCollapsed, onToggleCollapse, onCheckUpdate }) {
  const menuItems = [
    { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard, badge: null },
    { id: 'presets', label: 'Generación Rápida', icon: Sparkles, badge: null },
    { id: 'templates', label: 'Plantillas de Video', icon: Palette, badge: null },
    { id: 'profiles', label: 'Perfiles de IA', icon: KeyRound, badge: null },
    { id: 'settings', label: 'Ajustes de Render', icon: Settings, badge: null },
    { id: 'integrations', label: 'Integraciones', icon: Bell, badge: null }
  ];

  return (
    <aside 
      className={`bg-[#080c14] border-r border-white/5 flex flex-col h-full shrink-0 z-40 transition-all duration-300 ease-out select-none ${
        isCollapsed ? 'w-[72px]' : 'w-60'
      }`}
    >
      {/* 1. Header / Logo del App */}
      <div className="h-16 px-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-brand-primary via-orange-500 to-amber-500 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-brand-primary/25 shrink-0">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 animate-fadeIn">
              <h1 className="font-black text-xs text-white tracking-widest leading-none uppercase truncate">
                REDDIT STUDIO
              </h1>
              <span className="text-[8.5px] text-gray-400 font-bold tracking-widest block mt-1 uppercase">
                Desktop Suite v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
              </span>
            </div>
          )}
        </div>

        {/* Botón de Colapso */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 border border-white/5 active:scale-95"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 2. Menú de Navegación */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={isCollapsed ? item.label : ''}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 cursor-pointer relative group ${
                isActive
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              {/* Indicador de barra izquierda activa */}
              {isActive && (
                <span className="absolute -left-1 top-2 bottom-2 w-1.5 rounded-r-full bg-white shadow-sm" />
              )}

              <Icon className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${
                isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
              }`} />

              {!isCollapsed && (
                <span className="truncate flex-1 text-left tracking-wide font-extrabold text-[11.5px]">
                  {item.label}
                </span>
              )}

              {!isCollapsed && item.badge && (
                <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-md border shrink-0 ${
                  isActive 
                    ? 'bg-white/20 text-white border-white/30' 
                    : 'bg-brand-primary/15 text-brand-primary border-brand-primary/30'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 3. Footer con Tarjeta de GPU / Hardware y Actualizaciones */}
      <div className="p-3 border-t border-white/5 shrink-0 space-y-2">
        {isCollapsed ? (
          <>
            <div 
              title={`Motor de Render: ${gpuInfo?.gpuName || 'GPU Hardware'}`}
              className="w-10 h-10 mx-auto rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-brand-primary cursor-help"
            >
              <Cpu className="w-5 h-5" />
            </div>
            {onCheckUpdate && (
              <button
                type="button"
                onClick={onCheckUpdate}
                title="Buscar Actualizaciones"
                className="w-10 h-10 mx-auto rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 flex items-center justify-center text-purple-400 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <>
            <div className="rounded-2xl bg-[#0c101a] p-3 border border-white/5 space-y-2 animate-fadeIn shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-brand-primary" />
                  <span>GPU HARDWARE</span>
                </span>
                <span className={`w-2 h-2 rounded-full ${gpuInfo?.codec !== 'libx264' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              </div>

              <div className="text-white font-black text-[11px] truncate" title={gpuInfo?.gpuName}>
                {gpuInfo?.gpuName || 'Detectando GPU...'}
              </div>

              <div className="flex items-center justify-between text-[9px] font-bold text-gray-400 pt-0.5">
                <span>Códec:</span>
                <span className="text-emerald-400 font-mono font-black uppercase">
                  {gpuInfo?.codec || 'AUTO'}
                </span>
              </div>
            </div>

            {onCheckUpdate && (
              <button
                type="button"
                onClick={onCheckUpdate}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-white border border-purple-500/20 text-[10.5px] font-extrabold transition-all active:scale-95 cursor-pointer shadow-sm"
                title="Comprobar si hay una nueva versión disponible en GitHub"
              >
                <RefreshCw className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Buscar Actualizaciones</span>
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

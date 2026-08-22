import React from 'react';
import { LayoutDashboard, Palette, KeyRound, Settings, Film, Cpu, HardDrive, Sparkles, Bell, RefreshCw } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, gpuInfo }) {
  const menuItems = [
    { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard },
    { id: 'presets', label: 'Plantillas Guardadas', icon: Sparkles },
    { id: 'templates', label: 'Plantillas de Video', icon: Palette },
    { id: 'profiles', label: 'Perfiles de IA', icon: KeyRound },
    { id: 'settings', label: 'Ajustes de Ruta', icon: Settings },
    { id: 'integrations', label: 'Integraciones', icon: Bell }
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-900 flex flex-col h-screen sticky top-0 z-50">
      {/* Logotipo */}
      <div className="p-6 border-b border-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-primary to-orange-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-brand-primary/20">
            R
          </div>
          <div>
            <h1 className="font-black text-sm text-white tracking-wider leading-none uppercase">Redit Gen</h1>
            <span className="text-[9px] text-slate-500 font-bold tracking-widest block mt-1 uppercase">V2 Automation</span>
          </div>
        </div>
      </div>

      {/* Menú de Navegación */}
      <nav className="flex-1 p-4 space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-brand-primary to-orange-600 text-white shadow-md shadow-brand-primary/15'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Estado del Hardware */}
      <div className="p-4 border-t border-slate-900 bg-slate-950">
        <div className="rounded-xl bg-slate-900/60 p-3.5 border border-slate-900 flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
            <Cpu className="w-3.5 h-3.5 text-brand-primary" />
            <span>Motor de Render</span>
          </div>
          <div className="text-white font-extrabold text-[10.5px] truncate leading-tight">
            {gpuInfo?.gpuName || 'Buscando gráfica...'}
          </div>
          
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold w-fit ${
            gpuInfo?.codec !== 'libx264'
              ? 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/10'
              : 'bg-amber-500/5 text-amber-400 border border-amber-500/10'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${gpuInfo?.codec !== 'libx264' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span>{gpuInfo?.codec !== 'libx264' ? 'ACELERACIÓN GPU' : 'CPU FALLBACK'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

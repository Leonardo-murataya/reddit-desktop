import React, { createContext, useContext, useState, useCallback } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  XCircle, 
  X, 
  Sparkles
} from 'lucide-react';

const UIModalContext = createContext(null);

export function UIModalProvider({ children }) {
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((msg, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 4);
    const newToast = { id, message: msg, type };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const showAlert = useCallback((message, title = 'Notificación', type = 'info') => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        title,
        message,
        type,
        confirmText: 'Entendido',
        isConfirm: false,
        resolve: () => {
          setModal(null);
          resolve(true);
        }
      });
    });
  }, []);

  const showConfirm = useCallback((message, title = 'Confirmación', options = {}) => {
    const { confirmText = 'Aceptar', cancelText = 'Cancelar', type = 'warning' } = options;
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        title,
        message,
        type,
        confirmText,
        cancelText,
        isConfirm: true,
        resolve: (result) => {
          setModal(null);
          resolve(result);
        }
      });
    });
  }, []);

  const closeModal = (result = false) => {
    if (modal && modal.resolve) {
      modal.resolve(result);
    } else {
      setModal(null);
    }
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <UIModalContext.Provider value={{ showToast, showAlert, showConfirm }}>
      {children}

      {/* Toasts Flotantes */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {toasts.map(toast => {
          let bgClass = 'bg-[#0f172a]/95 border-brand-primary/40 text-brand-primary';
          let Icon = Sparkles;
          if (toast.type === 'success') {
            bgClass = 'bg-[#062417]/95 border-emerald-500/40 text-emerald-400';
            Icon = CheckCircle2;
          } else if (toast.type === 'error' || toast.type === 'danger') {
            bgClass = 'bg-[#290d14]/95 border-red-500/40 text-red-400';
            Icon = XCircle;
          } else if (toast.type === 'warning') {
            bgClass = 'bg-[#2a1d08]/95 border-amber-500/40 text-amber-400';
            Icon = AlertTriangle;
          } else if (toast.type === 'info') {
            bgClass = 'bg-[#0f1d3a]/95 border-cyan-500/40 text-cyan-400';
            Icon = Info;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl animate-fadeIn ${bgClass}`}
            >
              <Icon className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white leading-snug break-words">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-white cursor-pointer p-0.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal Dialog Studio */}
      {modal && modal.isOpen && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-gradient-to-b from-[#131929] to-[#0a0e18] border border-white/10 rounded-3xl p-6 shadow-2xl text-left space-y-5 animate-scaleUp">
            
            {/* Header con Icono */}
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-2xl shrink-0 ${
                modal.type === 'danger' || modal.type === 'error'
                  ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                  : modal.type === 'warning'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : modal.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-brand-primary/15 text-brand-primary border border-brand-primary/20'
              }`}>
                {modal.type === 'danger' || modal.type === 'error' ? (
                  <XCircle className="w-6 h-6" />
                ) : modal.type === 'warning' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : modal.type === 'success' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <Info className="w-6 h-6" />
                )}
              </div>

              <div className="flex-1 min-w-0 pr-6">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {modal.title}
                </h3>
                <div className="text-xs text-gray-300 mt-1 leading-relaxed whitespace-pre-line break-words">
                  {modal.message}
                </div>
              </div>

              <button
                onClick={() => closeModal(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
              {modal.isConfirm && (
                <button
                  type="button"
                  onClick={() => closeModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold border border-white/10 cursor-pointer transition-all active:scale-95"
                >
                  {modal.cancelText || 'Cancelar'}
                </button>
              )}

              <button
                type="button"
                onClick={() => closeModal(true)}
                autoFocus
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all cursor-pointer active:scale-95 ${
                  modal.type === 'danger' || modal.type === 'error'
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-600/25'
                    : modal.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25'
                    : 'bg-brand-primary hover:bg-brand-primary-hover shadow-brand-primary/25'
                }`}
              >
                {modal.confirmText || 'Aceptar'}
              </button>
            </div>

          </div>
        </div>
      )}
    </UIModalContext.Provider>
  );
}

export function useUIModal() {
  const ctx = useContext(UIModalContext);
  if (!ctx) {
    // Fallback seguro si se usa fuera de provider
    return {
      showToast: (m) => console.log('Toast:', m),
      showAlert: (m, t) => window.alert(`${t ? t + ': ' : ''}${m}`),
      showConfirm: (m, t) => Promise.resolve(window.confirm(`${t ? t + ': ' : ''}${m}`))
    };
  }
  return ctx;
}

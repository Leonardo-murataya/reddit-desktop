import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary detectó un error no controlado:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#07090e] text-white flex items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl bg-gradient-to-b from-[#101624] to-[#0a0e18] text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-black text-white tracking-wide uppercase">
                Ocurrió un error inesperado
              </h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                La aplicación encontró una excepción al renderizar los datos. Puedes restablecer la vista o reiniciar la ventana.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-black/60 rounded-xl p-3 border border-red-500/20 text-left overflow-x-auto max-h-28 custom-scrollbar">
                <p className="text-[11px] font-mono text-red-300 break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-white/5 hover:bg-white/10 text-gray-200 font-bold py-2.5 rounded-xl text-xs border border-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Ir al Inicio</span>
              </button>

              <button
                onClick={this.handleReload}
                className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-brand-primary/25 active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recargar Vista</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

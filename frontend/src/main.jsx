import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { UIModalProvider } from './context/UIModalContext.jsx'

// Enrutador universal de API para entorno de escritorio Tauri (tauri.localhost)
const isTauriEnv = window.location.origin.includes('tauri.localhost') || 
                   window.location.origin.includes('tauri') || 
                   window.__TAURI_INTERNALS__ || 
                   window.__TAURI__ || 
                   (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') ||
                   window.location.port !== '3000';

const BACKEND_ORIGIN = 'http://127.0.0.1:5000';

if (isTauriEnv) {
  const originalFetch = window.fetch;
  window.fetch = function(resource, init) {
    if (typeof resource === 'string') {
      if (resource.startsWith('/api') || resource.startsWith('/avatars') || resource.startsWith('/previews')) {
        resource = `${BACKEND_ORIGIN}${resource}`;
      }
    } else if (resource instanceof Request) {
      try {
        const url = new URL(resource.url, window.location.href);
        if (url.pathname.startsWith('/api') || url.pathname.startsWith('/avatars') || url.pathname.startsWith('/previews')) {
          const targetUrl = `${BACKEND_ORIGIN}${url.pathname}${url.search}`;
          resource = new Request(targetUrl, resource);
        }
      } catch (e) {}
    }
    return originalFetch.call(this, resource, init);
  };

  const OriginalEventSource = window.EventSource;
  window.EventSource = function(url, configuration) {
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = `${BACKEND_ORIGIN}${url}`;
    }
    return new OriginalEventSource(url, configuration);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <UIModalProvider>
        <App />
      </UIModalProvider>
    </ErrorBoundary>
  </StrictMode>,
)

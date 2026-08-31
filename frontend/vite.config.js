import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function createProxyOptions(target) {
  return {
    target,
    changeOrigin: true,
    secure: false,
    configure: (proxy) => {
      proxy.on('error', (err, req, res) => {
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
          if (res && !res.headersSent && typeof res.writeHead === 'function') {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Iniciando servidor backend...' }));
          }
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 31825,
    proxy: {
      '/api': createProxyOptions('http://127.0.0.1:31826'),
      '/avatars': createProxyOptions('http://127.0.0.1:31826'),
      '/previews': createProxyOptions('http://127.0.0.1:31826')
    }
  }
});

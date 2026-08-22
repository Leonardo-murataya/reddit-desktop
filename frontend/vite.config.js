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
    port: 3000,
    proxy: {
      '/api': createProxyOptions('http://localhost:5000'),
      '/avatars': createProxyOptions('http://localhost:5000'),
      '/previews': createProxyOptions('http://localhost:5000')
    }
  }
});

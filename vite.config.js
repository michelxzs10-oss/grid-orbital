import { defineConfig } from 'vite';

// El proxy manda las peticiones /celestrak/... a celestrak.org desde el servidor
// local, así el navegador no tiene problemas de CORS al descargar las órbitas.
const proxy = {
  '/celestrak': {
    target: 'https://celestrak.org',
    changeOrigin: true,
    rewrite: (ruta) => ruta.replace(/^\/celestrak/, ''),
  },
};

export default defineConfig({
  server: { proxy, open: true },
  preview: { proxy },
});

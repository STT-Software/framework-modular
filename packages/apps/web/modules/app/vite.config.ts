import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  server: {
    port: 6020,
    proxy: {
      // super-admin-auth: el navegador llama a /api/super-admin-auth y Vite lo
      // reenvía al servicio (evita CORS y funciona aunque el navegador no esté en esta máquina).
      "/api/super-admin-auth": {
        target: process.env.SUPER_ADMIN_AUTH_URL ?? "http://localhost:8080",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/super-admin-auth/, ""),
      },
    },
  },
});

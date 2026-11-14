import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

// Dónde corre el backend (necto-api). SUPER_ADMIN_AUTH_URL se sigue aceptando por compatibilidad.
const API_URL = process.env.API_URL ?? process.env.SUPER_ADMIN_AUTH_URL ?? "http://localhost:8080";

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
      // Un solo backend: el navegador llama a /api/<módulo> y Vite lo reenvía a necto-api (evita CORS y
      // funciona aunque el navegador no esté en esta máquina). Cada módulo del frontend tiene su prefijo.
      "/api/super-admin-auth": {
        target: API_URL,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/super-admin-auth/, ""),
      },
      // Mismo backend; prefijo propio del módulo onboarding.
      "/api/onboarding": {
        target: API_URL,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/onboarding/, ""),
      },
      // Mismo backend; prefijo propio del módulo businesses (negocios y su invitación).
      "/api/businesses": {
        target: API_URL,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/businesses/, ""),
      },
      // Mismo backend; prefijo propio del módulo business-access (acceso del jefe por código).
      "/api/business-access": {
        target: API_URL,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/business-access/, ""),
      },
    },
  },
});

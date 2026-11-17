import { defineConfig } from "vitest/config";
import path from "path";

// Pruebas unitarias (lógica pura y stores): entorno node, sin DOM. Mismo alias `@` que vite.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

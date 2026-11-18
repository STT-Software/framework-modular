import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "@fontsource/dm-sans/latin-300.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@/index.css";
import App from "@/app/App";
import { AppMetaProvider } from "@/shell/meta";
import { ShellProvider } from "@/shell";

/**
 * App entry point - Clean starter application
 * 
 * Run with: npm run dev
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppMetaProvider>
      <ShellProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ShellProvider>
    </AppMetaProvider>
  </StrictMode>
);

// Re-exports for library usage
export { AppShell } from "@/app/AppShell";
export { AppSidebar } from "@/app/AppSidebar";

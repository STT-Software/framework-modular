import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "./styles/auth-layout.css";
import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { CodeVerificationArt } from "@/brand/CodeVerificationArt";
import { AuthThemeToggle } from "./components/AuthThemeToggle";
import { DecorativeCircles } from "./components/DecorativeCircles";
import InteractiveDotGrid from "@/brand/InteractiveDotGrid";
import { NectoLogo } from "./components/NectoLogo";
import {
  BrandMessageDisplay,
  BrandMessageIndicators,
  useRotatingBrandMessages,
  type BrandMessage,
} from "./components/RotatingBrandMessages";
import { REGISTER_SLIDES, RegisterSlideArt } from "./components/RegisterScenes";

const BRAND_MESSAGES: BrandMessage[] = [
  {
    title: "Más conexiones. Más posibilidades.",
    subtitle: "Conecta, comparte y crece con tu comunidad.",
  },
  {
    title: "El poder de conectar.",
    subtitle: "Tu próxima gran conexión empieza aquí.",
  },
  {
    title: "Crece en buena compañía.",
    subtitle: "Plataforma modular e integral para tus operaciones.",
  },
];

const CODE_STEP_MESSAGE: BrandMessage = {
  title: "Verifica tu correo.",
  subtitle: "Ingresa el código de 6 dígitos que enviamos a tu buzón.",
};

/** Lo que el layout comparte con sus páginas por `useOutletContext`. */
export interface AuthLayoutContext {
  /** El registro avisa cuándo está en el paso del código, para fijar la escena del código en el panel. */
  setCodeStep: (active: boolean) => void;
}

/**
 * Layout de acceso del superadmin: formulario a la izquierda y panel de marca
 * (puntos blancos iluminables al pasar el cursor, brillo y aros) a la derecha. Login y registro
 * comparten este layout, así el panel de marca no se reinicia al cambiar de pantalla. En el registro, el panel muestra
 * cinco ilustraciones estáticas (`RegisterScenes.tsx`) que rotan junto con sus mensajes; en el paso del código
 * muestra fija la escena del código (`@/brand/CodeVerificationArt`, la misma del slide "codigo" de business-access).
 */
export default function SuperAdminAuthLayout() {
  const isRegister = useLocation().pathname.replace(/\/$/, "").endsWith("/register");
  const [codeStep, setCodeStep] = useState(false);
  const showCodeScene = isRegister && codeStep;
  const messages = isRegister ? REGISTER_SLIDES.map((slide) => slide.message) : BRAND_MESSAGES;
  const { index: rawIndex, fadeState, selectIndex } = useRotatingBrandMessages(messages.length);
  // Login and register rotate different lists through the same timer: keep the index inside the current one.
  const index = rawIndex % messages.length;
  const currentMessage = messages[index] ?? messages[0];

  return (
    <main className="sa-auth grid min-h-screen lg:grid-cols-2">
      <section className="sa-form-side flex flex-col bg-white dark:bg-gray-900">
        <header className="sa-header flex items-center justify-between">
          <Link to="/super/login" className="sa-logo-link" aria-label="Necto, ir a inicio de sesión">
            <NectoLogo />
          </Link>
          <AuthThemeToggle />
        </header>

        <div className="sa-body flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <Outlet context={{ setCodeStep } satisfies AuthLayoutContext} />
          </div>
        </div>

        <footer className="sa-footer text-[12px] font-light text-[#212121]/70 dark:text-[#ECECEC]/70">
          © {new Date().getFullYear()} Necto
        </footer>
      </section>

      <aside
        className="sa-brand-side relative flex items-center justify-center overflow-hidden"
        aria-label="Necto, conecta, comparte y crece"
      >
        <InteractiveDotGrid
          dotGap={24}
          baseRadius={1.5}
          activeRadius={3.0}
          glowDistance={160}
        />
        <div className="dark:hidden">
          <DecorativeCircles variant="brand" />
        </div>
        <div className="hidden dark:block">
          <DecorativeCircles variant="indigo" />
        </div>
        <div className="sa-brand-glow" aria-hidden="true" />

        <div className="sa-brand-content relative z-10 text-center">
          {showCodeScene ? (
            <div className="sa-code-scene sa-scene-enter" aria-hidden="true">
              <CodeVerificationArt classPrefix="sa" />
            </div>
          ) : isRegister ? (
            <div className="sa-register-scene" aria-hidden="true">
              <div key={index} className={fadeState === "out" ? "sa-msg-exit" : "sa-scene-enter"}>
                <RegisterSlideArt slide={REGISTER_SLIDES[index].id} />
              </div>
            </div>
          ) : (
            <div className="sa-brand-logo-large">
              <NectoLogo tone="on-brand" />
            </div>
          )}
          <div className="sa-brand-divider" />
          <BrandMessageDisplay
            message={showCodeScene ? CODE_STEP_MESSAGE : currentMessage}
            messageKey={showCodeScene ? -1 : index}
            fadeState={showCodeScene ? "in" : fadeState}
          />
        </div>

        {!showCodeScene && (
          <BrandMessageIndicators
            count={messages.length}
            activeIndex={index}
            onSelect={selectIndex}
          />
        )}
      </aside>
    </main>
  );
}

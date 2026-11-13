import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/700.css";
import "./styles/auth-layout.css";
import { Link, Outlet } from "react-router";
import { AuthThemeToggle } from "./components/AuthThemeToggle";
import { DecorativeCircles } from "./components/DecorativeCircles";
import InteractiveDotGrid from "./components/InteractiveDotGrid";
import { NectoLogo } from "./components/NectoLogo";
import {
  BrandMessageDisplay,
  BrandMessageIndicators,
  useRotatingBrandMessages,
  type BrandMessage,
} from "./components/RotatingBrandMessages";

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

/**
 * Layout de acceso del superadmin: formulario a la izquierda y panel de marca
 * (rejilla, brillo y órbitas animadas) a la derecha. Login y registro comparten
 * este layout, así el panel de marca no se reinicia al cambiar de pantalla.
 */
export default function SuperAdminAuthLayout() {
  const { index, fadeState, selectIndex } = useRotatingBrandMessages(BRAND_MESSAGES.length);
  const currentMessage = BRAND_MESSAGES[index] ?? BRAND_MESSAGES[0];

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
            <Outlet />
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
          <div className="sa-brand-logo-large">
            <NectoLogo tone="on-brand" />
          </div>
          <div className="sa-brand-divider" />
          <BrandMessageDisplay
            message={currentMessage}
            messageKey={index}
            fadeState={fadeState}
          />
        </div>

        <BrandMessageIndicators
          count={BRAND_MESSAGES.length}
          activeIndex={index}
          onSelect={selectIndex}
        />
      </aside>
    </main>
  );
}

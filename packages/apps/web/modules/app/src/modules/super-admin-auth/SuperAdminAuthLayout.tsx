import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "./styles/auth-layout.css";
import { Link, Outlet, useLocation } from "react-router";
import { AuthThemeToggle } from "./components/AuthThemeToggle";
import { NectoLogo } from "./components/NectoLogo";

/**
 * Layout de acceso del superadmin: formulario a la izquierda y panel de marca
 * (rejilla, brillo y órbitas animadas) a la derecha. Login y registro comparten
 * este layout, así el panel de marca no se reinicia al cambiar de pantalla.
 */
export default function SuperAdminAuthLayout() {
  const { pathname } = useLocation();
  const isRegister = pathname.endsWith("/register");

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

        <footer className="sa-footer text-xs text-gray-400">
          © {new Date().getFullYear()} Necto <span>Crece en buena compañía.</span>
        </footer>
      </section>

      <aside
        className="sa-brand-side relative flex items-center justify-center overflow-hidden"
        aria-label="Necto, conecta, comparte y crece"
      >
        <div className="sa-brand-grid" aria-hidden="true" />
        <div className="sa-brand-glow" aria-hidden="true" />
        <div className="sa-orbits" aria-hidden="true">
          <div className="sa-orbit sa-orbit-outer"><span /></div>
          <div className="sa-orbit sa-orbit-inner"><span /></div>
        </div>

        <div className="sa-brand-topline"><span />EL PODER DE CONECTAR</div>

        <div className="sa-brand-content relative z-10 text-center">
          <div className="sa-brand-logo-large">
            <NectoLogo tone="on-brand" />
          </div>
          <div className="sa-brand-divider" />
          <h2 className="sa-brand-headline">
            {isRegister ? (
              <>Tu próxima conexión<br />empieza aquí<span>.</span></>
            ) : (
              <>Más conexiones.<br />Más posibilidades<span>.</span></>
            )}
          </h2>
          <p className="sa-brand-description">
            Conecta, comparte y crece<br />con tu comunidad.
          </p>
        </div>

        <div className="sa-brand-bottom">
          <span className="sa-brand-bottom-dots"><i /><i /><i /></span>
          <span>Conecta. Comparte. Crece.</span>
        </div>
      </aside>
    </main>
  );
}

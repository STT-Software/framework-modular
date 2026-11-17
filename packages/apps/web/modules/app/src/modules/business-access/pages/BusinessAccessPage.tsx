import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "../styles/business-access.css";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { PageMeta } from "@/shell/meta";
import { ThemeIconButton } from "@/shell";
import { cn } from "@/utils";
import { BrandPanel } from "../components/BrandPanel";
import { BusinessPicker } from "../components/BusinessPicker";
import { CodeStep } from "../components/CodeStep";
import { EmailStep } from "../components/EmailStep";
import { HelpDialog, type HelpKind } from "../components/HelpDialog";
import { ReadyStep } from "../components/ReadyStep";
import { ReturnStep } from "../components/ReturnStep";
import { adminAccessStore, type AccessView } from "../stores/adminAccess.store";

const TITLES: Record<Exclude<AccessView, "loading">, string> = {
  acceso: "Necto · Accede a tu negocio",
  codigo: "Necto · Verifica tu correo",
  regreso: "Necto · Continúa con tu sesión",
  negocios: "Necto · Elige tu negocio",
  listo: "Necto · Acceso a tu negocio listo",
};

/**
 * Where an administrator of a business signs in: email, a code sent to it, and either the business they administer
 * or a choice among them. With a session already on this device they can continue without another code. Everything
 * that decides access happens on the server; this page only shows the steps.
 */
const BusinessAccessPage = observer(() => {
  const store = adminAccessStore;
  const [help, setHelp] = useState<HelpKind | null>(null);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    void store.start();
  }, [store]);

  // Plays the side panel's animation again: the class has to be removed and put back for CSS to restart it.
  const replay = useCallback(() => {
    setMotion(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setMotion(true)));
  }, []);
  useEffect(() => {
    replay();
  }, [store.view, replay]);

  const view = store.view;
  return (
    <section className={cn("na-root", motion && "na-motion")} aria-label="Acceso de administradores de negocio" data-view={view}>
      <PageMeta title={TITLES[view === "loading" ? "acceso" : view]} />
      <div className="na-auth">
        <header className="na-header">
          <Link to="/business/access" className="na-logo" aria-label="Necto, acceso a mi negocio">
            <NectoLogo width={161} height={23} />
          </Link>
          <ThemeIconButton className="na-theme" />
        </header>
        <main className="na-main">
          {view === "loading" && (
            <p className="na-description" role="status">
              Un momento…
            </p>
          )}
          {view === "acceso" && <EmailStep onHelp={() => setHelp("access")} />}
          {view === "codigo" && store.rules && <CodeStep onHelp={() => setHelp("code")} />}
          {view === "regreso" && <ReturnStep />}
          {view === "negocios" && <BusinessPicker />}
          {view === "listo" && <ReadyStep />}
        </main>
        <footer className="na-auth-footer">
          <span>© 2026 Necto</span>
          <Link to="/super/login">
            Soy superadministrador <span aria-hidden="true">↗</span>
          </Link>
        </footer>
      </div>
      <BrandPanel view={view} onReplay={replay} />
      <HelpDialog kind={help} onClose={() => setHelp(null)} />
    </section>
  );
});

export default BusinessAccessPage;

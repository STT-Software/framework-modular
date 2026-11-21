import "../styles/business-access.css";
import "@/css/business-configuration.css";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { Skeleton, SkeletonGroup } from "@/components/skeleton";
import { PageMeta } from "@/shell/meta";
import { ThemeIconButton } from "@/shell";
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

  useEffect(() => {
    void store.start();
  }, [store]);

  const view = store.view;
  return (
    <section className="na-root" aria-label="Acceso de administradores de negocio" data-view={view}>
      <PageMeta title={TITLES[view === "loading" ? "acceso" : view]} />
      <div className="na-auth">
        <header className="na-header">
          <Link to="/business/access" className="na-logo" aria-label="Necto, acceso a mi negocio">
            <NectoLogo width={161} height={23} />
          </Link>
          <div className="na-header-actions">
            {(view === "negocios" || view === "regreso") && (
              <button
                type="button"
                className="na-signout-btn"
                disabled={store.busy}
                onClick={() => void store.leave("Sesión cerrada. Verifica tu correo para volver a entrar.")}
                aria-label="Cerrar sesión"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                <span className="na-signout-label">Cerrar sesión</span>
              </button>
            )}
            <ThemeIconButton className="na-theme" />
          </div>
        </header>
        <main className="na-main">
          {view === "loading" && (
            <SkeletonGroup className="sk-stack" style={{ maxWidth: 400, ["--sk-gap" as string]: "14px" }}>
              <Skeleton width="70%" height={34} />
              <Skeleton width="90%" height={14} />
              <Skeleton width="55%" height={14} style={{ marginBottom: 14 }} />
              <Skeleton width={120} height={12} />
              <Skeleton height={48} radius={10} />
              <Skeleton height={48} radius={10} style={{ marginTop: 6 }} />
            </SkeletonGroup>
          )}
          {view === "acceso" && <EmailStep onHelp={() => setHelp("access")} />}
          {view === "codigo" && store.rules && <CodeStep onHelp={() => setHelp("code")} />}
          {view === "regreso" && <ReturnStep />}
          {view === "negocios" && <BusinessPicker />}
          {view === "listo" && <ReadyStep />}
        </main>
        <footer className="na-auth-footer">
          <span>© 2026 Necto</span>
        </footer>
      </div>
      <BrandPanel view={view} />
      <HelpDialog kind={help} onClose={() => setHelp(null)} />
    </section>
  );
});

export default BusinessAccessPage;

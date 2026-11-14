import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "../styles/business-access.css";
import { observer } from "mobx-react-lite";
import { useSearchParams } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { PageMeta } from "@/shell/meta";
import { ThemeIconButton } from "@/shell";
import { BossHome } from "../components/BossHome";
import { CodeLogin } from "../components/CodeLogin";
import { bossSessionStore } from "../stores/bossSession.store";

/** The id the service uses for a business: 24 hexadecimal characters. */
const BUSINESS_ID = /^[a-f0-9]{24}$/;

/**
 * Where the boss of a business signs in: the link of the invitation email opens it with `?business=<id>`.
 * No password: they ask for a code, receive it by email and use it.
 */
const BusinessAccessPage = observer(() => {
  const [params] = useSearchParams();
  const businessId = params.get("business") ?? "";
  const validLink = BUSINESS_ID.test(businessId);
  const session = bossSessionStore.session;
  // A session of another business is not this page's: signing in again replaces it.
  const ownSession = session && session.business.id === businessId ? session : null;

  return (
    <div className="ba">
      <PageMeta title="Necto · Acceso del jefe de negocio" />
      <header className="ba-topbar">
        <NectoLogo width={161} height={23} />
        <ThemeIconButton className="ba-icon-button" />
      </header>
      <main className="ba-main">
        {!validLink ? (
          <section className="ba-card" aria-labelledby="ba-title">
            <span className="ba-eyebrow">ENLACE NO VÁLIDO</span>
            <h1 id="ba-title" tabIndex={-1}>
              No pudimos abrir este acceso
            </h1>
            <p className="ba-lead">
              Este enlace no corresponde a ningún negocio. Abre el enlace del correo de invitación, o pídele a quien administra tu negocio que te lo envíe
              de nuevo.
            </p>
          </section>
        ) : ownSession ? (
          <BossHome session={ownSession} />
        ) : (
          <CodeLogin businessId={businessId} />
        )}
      </main>
      <footer className="ba-footer">
        <span>© 2026 Necto</span>
        <span>Conecta. Comparte. Crece.</span>
      </footer>
    </div>
  );
});

export default BusinessAccessPage;

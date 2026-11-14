import { useEffect, useRef, useState } from "react";
import { AccessError, businessAccessApi, type BossOverview, type BossSessionResult } from "../api/businessAccessApi";
import { bossSessionStore } from "../stores/bossSession.store";

/** Names of the functionalities, for showing the ones this business has enabled. */
const MODULE_NAMES: Record<string, string> = {
  reservas: "Reservas",
  turnos: "Turnos",
  agendamiento: "Agendamiento",
  referidos: "Referidos",
  inventario: "Inventario",
  pedidos: "Pedidos",
};

type View = { state: "loading" } | { state: "ready"; overview: BossOverview } | { state: "paused" } | { state: "failed"; message: string };

/**
 * What the boss sees after signing in. The service checks the session on every request, so if the business was
 * paused or the boss was replaced, this says so instead of showing stale data.
 */
export function BossHome({ session }: { session: BossSessionResult }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [view, setView] = useState<View>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const token = session.accessToken;

  useEffect(() => {
    let cancelled = false;
    setView({ state: "loading" });
    businessAccessApi
      .me(token)
      .then((overview) => !cancelled && setView({ state: "ready", overview }))
      .catch((failure: unknown) => {
        if (cancelled) return;
        if (failure instanceof AccessError && failure.kind === "unauthorized") {
          // Replaced as boss or the session expired: this session is no longer valid.
          bossSessionStore.signOut();
        } else if (failure instanceof AccessError && failure.kind === "forbidden") {
          setView({ state: "paused" });
        } else {
          setView({ state: "failed", message: "No pudimos cargar tu negocio. Inténtalo de nuevo." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [view.state]);

  return (
    <section className="ba-card" aria-labelledby="ba-home-title">
      <span className="ba-eyebrow">JEFE DE NEGOCIO</span>
      <h1 id="ba-home-title" ref={headingRef} tabIndex={-1}>
        Hola, {session.boss.name}
      </h1>
      {view.state === "loading" && (
        <p className="ba-lead" role="status">
          Cargando tu negocio…
        </p>
      )}
      {view.state === "paused" && (
        <p className="ba-lead" role="status">
          {session.business.name} está en pausa. Cuando quien lo administra lo reanude, podrás volver a entrar.
        </p>
      )}
      {view.state === "failed" && (
        <>
          <p className="ba-error" role="alert">
            {view.message}
          </p>
          <button type="button" className="ba-link" onClick={() => setAttempt((count) => count + 1)}>
            Intentar de nuevo
          </button>
        </>
      )}
      {view.state === "ready" && (
        <>
          <p className="ba-lead">
            Estás al frente de <strong>{view.overview.business.name}</strong>.
          </p>
          <dl className="ba-data">
            <div>
              <dt>Estado</dt>
              <dd>{view.overview.business.status === "active" ? "Activo" : "En pausa"}</dd>
            </div>
            <div>
              <dt>Tu correo de acceso</dt>
              <dd>{view.overview.boss.email}</dd>
            </div>
            <div>
              <dt>Módulos habilitados</dt>
              <dd>
                {view.overview.business.modules.length
                  ? view.overview.business.modules.map((id) => MODULE_NAMES[id] ?? id).join(", ")
                  : "Aún no hay módulos habilitados."}
              </dd>
            </div>
          </dl>
          <p className="ba-note">Las herramientas de cada módulo aparecerán aquí cuando estén disponibles.</p>
        </>
      )}
      <button type="button" className="ba-link" onClick={() => bossSessionStore.signOut()}>
        Cerrar sesión
      </button>
    </section>
  );
}

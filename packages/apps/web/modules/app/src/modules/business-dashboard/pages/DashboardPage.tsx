import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { WorkspaceAnnouncementBanner } from "@/components/configuration/WorkspaceAnnouncementBanner";
import { adminAccessStore } from "@/modules/business-access";
import { categoryLabel } from "@/modules/businesses";
import type { DashboardModuleView } from "../api/dashboardApi";
import { AppDialog } from "../components/AppDialog";
import { ActivityList, BusinessAppShell, PageHeading } from "../components/BusinessAppShell";
import { moduleDescriptor, type IconName } from "../components/icons";
import { Badge, CardHeading, Icon, InfoBox, SectionHeading, Stat } from "../components/ui";
import { activityText } from "../components/activity";
import { dashboardStore } from "../stores/dashboard.store";
/** Lo que describe cada módulo cuando el servidor no manda nada más: su aspecto es de la referencia, su estado lo dice el servidor. */
const PREVIEW_ICONS: IconName[] = ["queue", "calendar", "users", "tickets", "grid"];
const turnosPath = (businessId: string, section = "dashboard") => `/business/app/${businessId}/turnos/${section}`;
/**
 * El dashboard general del administrador de un negocio:
 *   /business/app/:businessId          el resumen del negocio
 *   /business/app/:businessId/modules  «Mis módulos»
 * Solo muestra los módulos asignados al negocio y su estado real, y los indicadores de los módulos que ya funcionan (Turnos), contados de
 * sus datos. Si falta algo por configurar, el servidor lo dice (`entry: "setup"`) y la persona continúa la configuración.
 */
const DashboardPage = observer(() => {
  const { businessId = "", section } = useParams();
  const navigate = useNavigate();
  const store = dashboardStore;
  const [detail, setDetail] = useState<DashboardModuleView | null>(null);
  useEffect(() => {
    void store.load(businessId);
    return () => store.reset();
  }, [businessId, store]);
  useEffect(() => {
    if (store.status === "signed-out") navigate("/business/access", { replace: true });
  }, [store.status, navigate]);
  const state = store.state;
  if (store.status === "loading" || store.status === "signed-out") {
    return (
      <section className="nd-root" aria-busy="true" aria-label="Cargando tu negocio">
        <p className="nd-muted" style={{ margin: "auto" }}>
          Cargando tu negocio…
        </p>
      </section>
    );
  }
  if (store.status !== "ready" || !state) {
    return (
      <section className="nd-root" aria-label="Mi negocio en Necto">
        <main className="nd-main" style={{ margin: "auto", maxWidth: 560 }}>
          <div className="nd-card nd-empty">
            <span className="nd-module-symbol">
              <Icon name="lock" />
            </span>
            <h2>{store.status === "not-found" ? "Este negocio ya no está disponible para ti" : "No pudimos abrir tu negocio"}</h2>
            <p>{store.status === "not-found" ? "Necesitas una asignación vigente como administrador para entrar." : "Revisa tu conexión e inténtalo de nuevo."}</p>
            <Link className="nd-primary" to="/business/access">
              Volver al acceso
            </Link>
          </div>
        </main>
      </section>
    );
  }
  // Falta algo por configurar: la persona continúa donde quedó, no entra a un dashboard a medias.
  if (state.entry === "setup") {
    const next = state.setup.next;
    const target = next?.step === "module" && next.moduleId === "turnos" ? `/business/turnos/${businessId}/profile` : `/business/setup/${businessId}`;
    return <Navigate to={target} replace />;
  }
  const modulesView = section === "modules";
  const turnos = state.modules.find((module) => module.id === "turnos");
  const stats = turnos?.indicators?.turnos ?? null;
  const access = adminAccessStore.accesses.find((item) => item.businessId === businessId && item.role === "admin");
  const personName = access?.personName ?? "Administrador";
  const readyCount = state.modules.filter((module) => module.setup.status === "ready").length;
  const open = (module: DashboardModuleView) => {
    if (module.id === "turnos") navigate(module.setup.status === "ready" ? turnosPath(businessId) : `/business/turnos/${businessId}/profile`);
    else if (module.id === "pedidos")
      navigate(module.setup.status === "ready" ? `/business/app/${businessId}/pedidos/dashboard` : `/business/pedidos/${businessId}/profile`);
    else setDetail(module);
  };
  const signOut = async () => {
    await adminAccessStore.leave("Cerraste sesión.");
    navigate("/business/access", { replace: true });
  };
  return (
    <BusinessAppShell
      businessName={state.business.name}
      businessSubtitle="Espacio de trabajo"
      navTitle="MI NEGOCIO"
      nav={[
        { to: `/business/app/${businessId}`, label: "Resumen", icon: "grid", current: !modulesView },
        { to: `/business/app/${businessId}/modules`, label: "Mis módulos", icon: "grid", current: modulesView },
      ]}
      logoTo={`/business/app/${businessId}`}
      person={{ name: personName, email: adminAccessStore.email, roleLabel: "Administrador del negocio", isAdmin: true }}
      crumbs={modulesView ? [{ label: "Mi negocio", href: `/business/app/${businessId}` }, { label: "Mis módulos" }] : [{ label: "Mi negocio" }]}
      settingsTo={`/business/setup/${businessId}`}
      activity={store.activity.map((entry) => ({ text: activityText(entry.type, entry.ticket.code, entry.queue.name, entry.automatic), at: entry.at }))}
      onSignOut={() => void signOut()}
      documentTitle={modulesView ? "Mis módulos" : "Mi negocio"}
    >
      <PageHeading
        eyebrow="MI NEGOCIO · ESPACIO DE TRABAJO"
        title={modulesView ? "Tus módulos, en un solo lugar." : `Qué bueno verte, ${personName.split(" ")[0]}.`}
        description={modulesView ? `Abre las herramientas que ya preparaste para ${state.business.name}.` : `Este es el pulso de ${state.business.name}. Conecta con lo que necesita tu negocio hoy.`}
        actions={
          <button type="button" className="nd-secondary" onClick={() => navigate(`/business/setup/${businessId}`)}>
            Ver configuración
          </button>
        }
      />
      <div id="nd-content">
        {modulesView ? null : <WorkspaceAnnouncementBanner />}
        {modulesView ? null : (
          <div className="nd-stat-grid">
            <Stat label="Módulos habilitados" value={state.modules.length} icon="grid" foot="Asignados a este negocio" />
            {stats ? (
              <>
                <Stat label="Personas esperando" value={stats.today.waiting} icon="users" foot="En el módulo de Turnos" />
                <Stat label="Turnos completados" value={stats.today.completed} unit="hoy" icon="check" />
                <Stat label="Operadores activos" value={stats.operators.active} icon="users" foot="Equipo de Turnos" />
              </>
            ) : null}
          </div>
        )}
        <SectionHeading title={`Los módulos de ${state.business.name}`} description="Un espacio propio para cada parte de tu operación." right={<Badge color="purple">{`${state.modules.length} habilitados`}</Badge>} />
        {state.modules.length === 0 ? (
          <div className="nd-card nd-empty">
            <span className="nd-module-symbol">
              <Icon name="grid" />
            </span>
            <h2>Todavía no hay módulos asignados</h2>
            <p>El superadministrador asigna los módulos de tu negocio.</p>
          </div>
        ) : (
          <div className="nd-module-grid">
            {state.modules.map((module) => (
              <ModuleCard key={module.id} module={module} onOpen={() => open(module)} />
            ))}
          </div>
        )}
        {modulesView ? null : (
          <div className="nd-hub-bottom">
            <section className="nd-card nd-pad">
              <CardHeading title="Lo que está pasando" description="Actividad de Turnos en esta jornada" />
              <ActivityList
                items={store.activity.map((entry) => ({ text: activityText(entry.type, entry.ticket.code, entry.queue.name, entry.automatic), at: entry.at }))}
              />
            </section>
            <section className="nd-card nd-pad">
              <CardHeading
                title="La identidad de tu negocio"
                description="Información de la configuración base"
                right={
                  <button type="button" className="nd-text-button" onClick={() => navigate(`/business/setup/${businessId}`)}>
                    Revisar
                  </button>
                }
              />
              <dl className="nd-business-data">
                {[
                  ["Categoría", categoryLabel(state.business.category as never, state.business.categoryOther)],
                  ["Responsable", personName],
                  ["Correo", adminAccessStore.email || "Sin registrar"],
                  ["Zona horaria", state.business.timezone],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        )}
      </div>
      <AppDialog open={detail !== null} title={detail?.name ?? ""} eyebrow="MI NEGOCIO · MÓDULOS" onClose={() => setDetail(null)}>
        {detail ? (
          <>
            <div className="nd-detail-person">
              <span className={`nd-module-symbol ${moduleDescriptor(detail.id)?.color ?? ""}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: moduleDescriptor(detail.id)?.icon ?? "" }} />
              </span>
              <div>
                <h3>{detail.name}</h3>
                <p>Habilitado para {state.business.name}</p>
              </div>
            </div>
            <p className="nd-muted">{detail.description}</p>
            <InfoBox>
              {detail.configurable
                ? `La configuración de ${detail.name} está ${detail.setup.status === "ready" ? "preparada" : "pendiente"}. Su espacio de trabajo todavía no está disponible: se publicará en una próxima etapa.`
                : `El espacio de ${detail.name} todavía no está disponible. Aparece aquí porque está asignado a tu negocio, y se habilitará en una próxima etapa.`}
            </InfoBox>
          </>
        ) : null}
      </AppDialog>
    </BusinessAppShell>
  );
});
function ModuleCard({ module, onOpen }: { module: DashboardModuleView; onOpen: () => void }) {
  const look = moduleDescriptor(module.id);
  const ready = module.setup.status === "ready";
  const indicators = module.indicators?.turnos;
  const label =
    module.id === "turnos" || module.id === "pedidos" ? (ready ? `Abrir ${module.name}` : "Configurar") : "Ver detalles";
  return (
    <article className="nd-card nd-module-card">
      <div className="nd-module-card-top">
        <span className={`nd-module-symbol ${look?.color ?? ""}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: look?.icon ?? "" }} />
        </span>
        {module.configurable ? <Badge color={ready ? "green" : "amber"}>{ready ? "Configurado" : "Por configurar"}</Badge> : <Badge color="purple">Próximamente</Badge>}
      </div>
      <h3>{module.name}</h3>
      <p>{module.description}</p>
      <div className="nd-module-card-footer">
        <small>{indicators ? `${indicators.queues.total} filas · ${indicators.operators.active} operadores` : module.configurable ? "Exclusivo de este negocio" : "Asignado a este negocio"}</small>
        <button type="button" className="nd-text-button" onClick={onOpen}>
          {label}
        </button>
      </div>
    </article>
  );
}
export default DashboardPage;

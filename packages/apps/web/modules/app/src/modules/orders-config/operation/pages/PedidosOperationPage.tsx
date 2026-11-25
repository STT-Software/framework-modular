import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { adminAccessStore } from "@/modules/business-access/public";
import { BusinessAppShell, Empty, type NavItem } from "@/modules/business-dashboard/public";
import "../../styles/orders-config.css";
import { OperationDashboard } from "../components/OperationDashboard";
import { SalesWorkspace } from "../components/SalesWorkspace";
import { salesSections } from "../sections";
import { pedidosOperationStore as store } from "../stores/operation.store";

const PedidosOperationPage = observer(() => {
  const { businessId = "", section, id } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    void store.load(businessId);
    return () => store.reset();
  }, [businessId]);

  if (store.status === "signed-out") return <Navigate to="/business/access" replace />;
  if (store.status === "error" || store.status === "unavailable") {
    return <Empty title={store.status === "error" ? "No pudimos abrir Pedidos" : "Acceso a Pedidos pendiente"}
      text={store.error ?? "Pide al administrador que revise tu asignación al módulo."}
      action={<Link to="/business/access">Volver al acceso</Link>} />;
  }
  const view = store.view;
  if (store.status !== "ready" || view?.business.id !== businessId) {
    return <p className="oc-status-shell" role="status">Cargando el espacio de Pedidos…</p>;
  }

  const base = `/business/app/${businessId}/pedidos`;
  const selected = salesSections.find(item => item.id === section);
  if (section !== "dashboard" && !selected) return <Navigate to={base + "/dashboard"} replace />;
  if (id && section !== "orders" && section !== "incidents") return <Navigate to={base + "/" + section} replace />;
  const title = selected?.name ?? "Inicio de Pedidos";
  const configPath = `/business/pedidos/${businessId}/profile`;
  const home = `/business/app/${businessId}`;
  const nav: NavItem[] = [
    { to: base + "/dashboard", label: "Inicio", icon: "grid", current: !selected },
    ...salesSections.map(item => ({ to: base + "/" + item.id, label: item.name, icon: item.icon, current: item === selected })),
  ];
  const signOut = async () => {
    await adminAccessStore.leave("Cerraste sesión.");
    navigate("/business/access", { replace: true });
  };

  return (
    <BusinessAppShell businessName={view.business.name} businessSubtitle="Módulo de Pedidos" navTitle="VENTAS"
      nav={nav} homeLink={store.isAdmin ? { to: home, label: "Mi negocio" } : undefined}
      logoTo={store.isAdmin ? home : base + "/dashboard"}
      person={{ name: view.operator.name, email: view.operator.email, roleLabel: store.isAdmin ? "Administrador del negocio" : "Operador · Pedidos", isAdmin: store.isAdmin }}
      crumbs={[{ label: "Pedidos", href: base + "/dashboard" }, { label: title }]}
      settingsTo={store.isAdmin ? configPath : undefined} onSignOut={() => void signOut()} documentTitle={title}
      dataStatus={selected ? "Vista previa en memoria" : undefined}>
      <div className="oc-root">
        <SalesWorkspace key={businessId + ":" + view.operator.id} view={view} section={selected?.id} detailId={id}
          openSection={(target, detail) => navigate(base + "/" + target + (detail ? "/" + encodeURIComponent(detail) : ""))}>
          <OperationDashboard view={view} operatorCount={store.operatorCount}
            onOpenConfig={store.isAdmin ? () => navigate(configPath) : undefined} />
        </SalesWorkspace>
      </div>
    </BusinessAppShell>
  );
});

export default PedidosOperationPage;

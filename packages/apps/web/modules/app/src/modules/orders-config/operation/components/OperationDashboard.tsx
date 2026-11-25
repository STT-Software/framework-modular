import {
  Badge,
  CardHeading,
  Icon,
  InfoBox,
  PageHeading,
  SectionHeading,
  Stat,
  initials,
} from "@/modules/business-dashboard/public";
import {
  ALL_OPERATOR_STAGES,
  type ConfirmationMode,
  type ModalityType,
  type OrderOperator,
  type OrderOperatorStage,
  type PedidosOperatorView,
} from "../../types";

const stageLabels: Record<OrderOperatorStage, string> = {
  confirmation: "Confirmación",
  preparation: "Preparación",
  dispatch: "Despacho",
};

const stageDescriptions: Record<OrderOperatorStage, string> = {
  confirmation: "Recepción, validación de pago y confirmación de pedidos entrantes en tiempo real.",
  preparation: "Organiza el alistamiento, cocina o empaque respetando los tiempos objetivo.",
  dispatch: "Coordina el despacho con mensajería propia, transportadoras o entrega en local.",
};

const modalityLabels: Record<ModalityType, string> = {
  delivery: "Envío a domicilio",
  pickup: "Retiro en local",
  on_site: "En el establecimiento",
};

const confirmationLabels: Record<ConfirmationMode, string> = {
  manual: "Manual",
  automatic: "Auto",
  agent: "Agente",
};

/** «Inicio» de Pedidos: el mismo tablero de Turnos (cabecera, cifras del día y tarjetas) con los datos reales del módulo. */
export function OperationDashboard({ view, operatorCount, operators, isAdmin, onOpenOrders, onOpenIncidents, onOpenOperators }: {
  view: PedidosOperatorView;
  operatorCount: number;
  operators: OrderOperator[];
  isAdmin: boolean;
  onOpenOrders?: () => void;
  onOpenIncidents?: () => void;
  onOpenOperators?: () => void;
}) {
  const assignedSet = new Set(view.operator.stages);
  const open = view.schedule.openNow;
  const modalities = view.modalities.map(modality => modalityLabels[modality]).join(" · ");

  return (
    <>
      <PageHeading
        eyebrow="PEDIDOS · TU OPERACIÓN"
        title={isAdmin ? "Cada pedido, una buena conexión." : "Tu jornada de pedidos."}
        description={
          isAdmin
            ? `Sigue la confirmación, preparación y despacho de los pedidos de ${view.business.name}.`
            : "Este resumen corresponde únicamente a las etapas que te asignaron."
        }
        actions={
          <>
            {onOpenIncidents ? (
              <button type="button" className="nd-secondary" onClick={onOpenIncidents}>
                Ver novedades
              </button>
            ) : null}
            {onOpenOrders ? (
              <button type="button" className="nd-primary" onClick={onOpenOrders}>
                Ver pedidos
              </button>
            ) : null}
          </>
        }
      />
      <div id="nd-content">
        <div className="nd-control-top">
          <section className="nd-now-card">
            <div className="nd-now-copy">
              <span className="nd-eyebrow">ESTADO DEL NEGOCIO</span>
              <h2>{open === true ? "Abierto ahora" : open === false ? "Fuera de horario" : "Horario por definir"}</h2>
              <p>
                {view.modalities.length > 0
                  ? `${modalities} · ${view.operator.stages.length} de 3 etapas habilitadas`
                  : "Todavía no hay modalidades habilitadas para este negocio."}
              </p>
              <div style={{ marginTop: 15 }}>
                <Badge color="purple">
                  {isAdmin
                    ? `${operatorCount} ${operatorCount === 1 ? "operador" : "operadores"}`
                    : `${view.operator.stages.length} de 3 etapas`}
                </Badge>
              </div>
            </div>
            <div className="nd-now-ticket" aria-hidden="true">
              <Icon name="tickets" />
              <strong>{initials(view.business.name)}</strong>
              <small>Una conexión a la vez.</small>
            </div>
          </section>
          <div className="nd-control-stats">
            <Stat label="Modalidades" value={view.modalities.length} icon="grid" foot={modalities || "Sin habilitar"} />
            <Stat
              label="Tus etapas"
              value={view.operator.stages.length}
              unit="/ 3"
              icon="queue"
              foot={view.operator.stages.map(stage => stageLabels[stage]).join(" · ") || "Sin etapas asignadas"}
            />
            {isAdmin ? (
              <Stat label="Operadores" value={operatorCount} icon="users" foot="Equipo de Pedidos" />
            ) : (
              <Stat
                label="Horario"
                value={open === true ? "Abierto" : open === false ? "Cerrado" : "—"}
                icon="clock"
                foot="Según el horario del negocio"
              />
            )}
            <Stat
              label="Confirmación"
              value={confirmationLabels[view.confirmationMode]}
              icon="check"
              foot="Modo configurado en el módulo"
            />
          </div>
        </div>
        <SectionHeading
          title="Las etapas de tu operación"
          description={isAdmin ? "Un espacio propio para cada parte del pedido." : "Solo las etapas que puedes atender."}
          right={
            onOpenOrders ? (
              <button type="button" className="nd-text-button" onClick={onOpenOrders}>
                Ver pedidos
              </button>
            ) : undefined
          }
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 18 }}>
          {ALL_OPERATOR_STAGES.map(stage => (
            <section key={stage} className="nd-card nd-pad">
              <CardHeading
                title={stageLabels[stage]}
                description={stageDescriptions[stage]}
                right={
                  <Badge color={assignedSet.has(stage) ? "green" : ""}>
                    {assignedSet.has(stage) ? "Habilitada" : "Sin asignar"}
                  </Badge>
                }
              />
            </section>
          ))}
        </div>
        <div className="nd-two-columns">
          <section className="nd-card">
            {isAdmin ? (
              <>
                <div className="nd-pad" style={{ paddingBottom: 0 }}>
                  <CardHeading
                    title="El equipo, conectado"
                    description="Operadores y etapas que atiende cada uno"
                    right={
                      onOpenOperators ? (
                        <button type="button" className="nd-text-button" onClick={onOpenOperators}>
                          Ver equipo
                        </button>
                      ) : undefined
                    }
                  />
                </div>
                <div className="nd-pad" style={{ paddingTop: 6 }}>
                  {operators.length === 0 ? (
                    <p className="nd-muted">Todavía no hay operadores en Pedidos.</p>
                  ) : (
                    operators.slice(0, 5).map(operator => (
                      <div key={operator.id} className="nd-person-cell" style={{ padding: "10px 0" }}>
                        <span className="nd-avatar">{initials(operator.name)}</span>
                        <div>
                          <strong>{operator.name}</strong>
                          <small>{operator.stages.map(stage => stageLabels[stage]).join(" · ")}</small>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="nd-pad">
                <CardHeading title="Tu espacio de trabajo" description="Las etapas que te asignó el administrador" />
                <InfoBox title="Un acceso a tu medida">
                  Puedes consultar y atender únicamente las etapas que te asignaron. El administrador decide cuáles ves.
                </InfoBox>
              </div>
            )}
          </section>
          <section className="nd-card nd-pad">
            <CardHeading title="Cómo se mueve un pedido" description="De la confirmación a la entrega" />
            <InfoBox title="Tres etapas, un solo flujo">
              Cada pedido pasa por confirmación, preparación y despacho. La configuración del módulo decide qué modalidades
              están habilitadas y quién atiende cada etapa.
            </InfoBox>
          </section>
        </div>
      </div>
    </>
  );
}

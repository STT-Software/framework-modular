import { useState } from "react";
import { observer } from "mobx-react-lite";
import {
  AppDialog,
  Badge,
  Field,
  Icon,
  InfoBox,
  PageHeading,
  initials,
  toastStore,
} from "@/modules/business-dashboard/public";
import { ALL_OPERATOR_STAGES, type OrderOperator, type OrderOperatorStage } from "../../types";
import { pedidosOperationStore as store } from "../stores/operation.store";

const stageLabels: Record<OrderOperatorStage, string> = {
  confirmation: "Confirmación",
  preparation: "Preparación",
  dispatch: "Despacho",
};

/** «Operadores»: el equipo de Pedidos y las etapas que atiende cada uno. Solo el administrador. */
export const OperatorsPage = observer(() => {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // El equipo lo gestiona el administrador; el operador solo ve el aviso (como en Turnos).
  if (!store.isAdmin) {
    return (
      <>
        <PageHeading
          eyebrow="PEDIDOS · TU OPERACIÓN"
          title="El equipo de Pedidos."
          description="Solo el administrador del negocio gestiona al equipo y las etapas de cada persona."
        />
        <div id="nd-content">
          <InfoBox title="Acceso del administrador">
            Tu acceso atiende las etapas que te asignaron. Si necesitas un cambio en el equipo, pídeselo al administrador.
          </InfoBox>
        </div>
      </>
    );
  }

  const people = store.operators.filter(operator =>
    `${operator.name} ${operator.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeading
        eyebrow="PEDIDOS · TU OPERACIÓN"
        title="El equipo detrás de cada pedido."
        description="Gestiona quién atiende la confirmación, la preparación y el despacho."
        actions={
          <button type="button" className="nd-primary" disabled={store.operatorsBusy} onClick={() => setEditing({ id: null })}>
            Añadir operador
          </button>
        }
      />
      <div id="nd-content">
        <div className="nd-filter-bar">
          <div className="nd-input-search">
            <Icon name="search" />
            <input
              type="search"
              aria-label="Buscar operador"
              placeholder="Buscar por nombre o correo"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
          <Badge color={store.operators.length > 0 ? "green" : ""}>
            {`${store.operators.length} ${store.operators.length === 1 ? "operador" : "operadores"}`}
          </Badge>
        </div>
        <section className="nd-card">
          <div className="nd-table-wrap">
            <table className="nd-table">
              <thead>
                <tr>
                  <th scope="col">OPERADOR</th>
                  <th scope="col">CONTACTO</th>
                  <th scope="col">ETAPAS ASIGNADAS</th>
                  <th scope="col">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {people.map(person => (
                  <tr key={person.id}>
                    <td>
                      <div className="nd-person-cell">
                        <span className="nd-avatar">{initials(person.name)}</span>
                        <div>
                          <strong>{person.name}</strong>
                          <small>{`${person.stages.length} de 3 etapas`}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span style={{ display: "block", fontSize: 13 }}>{person.email}</span>
                        {person.phone ? (
                          <small style={{ display: "block", color: "var(--nd-faint)", fontSize: 12 }}>{person.phone}</small>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="nd-permission-summary">
                        {person.stages.map(stage => (
                          <Badge key={stage}>{stageLabels[stage]}</Badge>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="nd-row-actions">
                        <button
                          type="button"
                          className="nd-icon-button"
                          aria-label={`Editar operador ${person.name}`}
                          disabled={store.operatorsBusy}
                          onClick={() => setEditing({ id: person.id })}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          type="button"
                          className="nd-icon-button"
                          aria-label={`Quitar operador ${person.name}`}
                          disabled={store.operatorsBusy}
                          onClick={() => setDeleteId(person.id)}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {people.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="nd-empty inline">
                        <h2>No hay operadores para mostrar</h2>
                        <p>{store.operators.length === 0 ? "Agrega a tu equipo para repartir las etapas del pedido." : "Cambia la búsqueda para encontrar a alguien del equipo."}</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <InfoBox title="Un acceso a su medida">
          El administrador atiende las tres etapas. Cada operador recibe solo las que le asignes aquí, y entra con el mismo
          código por correo del módulo. Los cambios se guardan en el servidor al confirmar.
        </InfoBox>
      </div>
      {editing ? (
        <OperatorDialog
          id={editing.id}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleteId ? <DeleteOperatorDialog id={deleteId} onClose={() => setDeleteId(null)} /> : null}
    </>
  );
});

function StageChecks({ selected, onChange }: { selected: OrderOperatorStage[]; onChange: (stages: OrderOperatorStage[]) => void }) {
  return (
    <div className="nd-check-list">
      {ALL_OPERATOR_STAGES.map(stage => (
        <label key={stage}>
          <input
            type="checkbox"
            checked={selected.includes(stage)}
            onChange={event =>
              onChange(event.target.checked ? [...selected, stage] : selected.filter(candidate => candidate !== stage))
            }
          />
          {stageLabels[stage]}
        </label>
      ))}
    </div>
  );
}

function OperatorDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const person = id ? store.operators.find(operator => operator.id === id) : undefined;
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [stages, setStages] = useState<OrderOperatorStage[]>(person ? [...person.stages] : [...ALL_OPERATOR_STAGES]);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (stages.length === 0) {
      setError("Asigna al menos una etapa al operador.");
      return;
    }
    const result = person
      ? await store.updateOperator(person.id, { name, email, phone, stages })
      : await store.addOperator({ name, email, phone, stages });
    if (!result.ok) {
      setError(result.message ?? "No pudimos guardar el operador.");
      return;
    }
    onClose();
    toastStore.announce(person ? "Operador actualizado." : "Operador añadido al equipo de Pedidos.");
  };

  return (
    <AppDialog
      open
      eyebrow="EQUIPO · PEDIDOS"
      title={person ? "Editar operador" : "Añadir operador"}
      submitLabel={person ? "Guardar operador" : "Agregar operador"}
      busy={store.operatorsBusy}
      error={error}
      onClose={onClose}
      onSubmit={save}
    >
      <Field id="oc-op-name" label="Nombre" required>
        <input id="oc-op-name" maxLength={80} autoComplete="name" placeholder="Ej. Laura Gómez" value={name} onChange={event => setName(event.target.value)} />
      </Field>
      <Field id="oc-op-email" label="Correo para su acceso con código" required>
        <input id="oc-op-email" type="email" maxLength={160} autoComplete="email" placeholder="nombre@example.com" value={email} onChange={event => setEmail(event.target.value)} />
      </Field>
      <Field id="oc-op-phone" label={<>Teléfono <small>Opcional</small></>}>
        <input id="oc-op-phone" type="tel" maxLength={25} autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} />
      </Field>
      <div className="nd-form-heading">
        Etapas que puede atender <b style={{ color: "var(--nd-orange)" }}>*</b>
      </div>
      <StageChecks selected={stages} onChange={setStages} />
      <InfoBox title="Acceso exclusivo de Pedidos">
        Al crearlo podrá entrar a las etapas que le asignes. Este acceso no habilita el dashboard general del administrador.
      </InfoBox>
    </AppDialog>
  );
}

function DeleteOperatorDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const person: OrderOperator | undefined = store.operators.find(operator => operator.id === id);
  const [error, setError] = useState<string | null>(null);

  if (!person) return null;

  const remove = async () => {
    const result = await store.removeOperator(person.id);
    if (!result.ok) {
      setError(result.message ?? "No pudimos quitar al operador.");
      return;
    }
    onClose();
    toastStore.announce("Operador retirado del equipo de Pedidos.");
  };

  return (
    <AppDialog
      open
      title={`Quitar a ${person.name}`}
      eyebrow="EQUIPO · PEDIDOS"
      submitLabel="Quitar de Pedidos"
      danger
      busy={store.operatorsBusy}
      error={error}
      onClose={onClose}
      onSubmit={remove}
    >
      <InfoBox>
        Se retirará únicamente su asignación a Pedidos en este negocio. La identidad del usuario y sus otros accesos no se
        eliminan.
      </InfoBox>
    </AppDialog>
  );
}

import { observer } from "mobx-react-lite";
import { useState } from "react";
import { Checkbox } from "@/elements/form/checkbox";
import { Input } from "@/elements/form/input";
import { Button } from "@/elements/ui/button";
import { OperatorAccessDialog } from "../../components/OperatorAccessDialog";
import { ALL_OPERATOR_STAGES, type OrderOperator, type OrderOperatorStage } from "../../types";
import { validateStep } from "../../validation";
import type { OrdersConfigState } from "../../types";
import type { OrdersConfigStore } from "../../ordersConfig.store";
import { operatorStageLabels, toggleStageInList, renderOperatorStages } from "./panelPresentation";

export const OperatorsPanel = observer(({ state, store }: { state: OrdersConfigState; store: OrdersConfigStore }) => {
  const [newOpName, setNewOpName] = useState("");
  const [newOpEmail, setNewOpEmail] = useState("");
  const [newOpPhone, setNewOpPhone] = useState("");
  const [newOpStages, setNewOpStages] = useState<OrderOperatorStage[]>([...ALL_OPERATOR_STAGES]);
  const [newOpError, setNewOpError] = useState<{ field: string; message: string } | null>(null);

  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editOpName, setEditOpName] = useState("");
  const [editOpEmail, setEditOpEmail] = useState("");
  const [editOpPhone, setEditOpPhone] = useState("");
  const [editOpStages, setEditOpStages] = useState<OrderOperatorStage[]>([...ALL_OPERATOR_STAGES]);
  const [editOpError, setEditOpError] = useState<{ field: string; message: string } | null>(null);

  const [accessDialogOperator, setAccessDialogOperator] = useState<OrderOperator | null>(null);
  const handleAddOperator = async () => {
    if (store.saving) return;
    const result = await store.addOperator({
      name: newOpName,
      email: newOpEmail,
      phone: newOpPhone,
      stages: newOpStages,
    });
    if (!result.ok) {
      setNewOpError({ field: result.field, message: result.message });
      return;
    }
    setNewOpName("");
    setNewOpEmail("");
    setNewOpPhone("");
    setNewOpStages([...ALL_OPERATOR_STAGES]);
    setNewOpError(null);
  };

  const startEditOperator = (operator: OrderOperator) => {
    setEditingOpId(operator.id);
    setEditOpName(operator.name);
    setEditOpEmail(operator.email);
    setEditOpPhone(operator.phone ?? "");
    setEditOpStages([...operator.stages]);
    setEditOpError(null);
  };

  const cancelEditOperator = () => {
    setEditingOpId(null);
    setEditOpName("");
    setEditOpEmail("");
    setEditOpPhone("");
    setEditOpStages([...ALL_OPERATOR_STAGES]);
    setEditOpError(null);
  };

  const saveEditOperator = async (operatorId: string) => {
    if (store.saving) return;
    const result = await store.updateOperator(operatorId, {
      name: editOpName,
      email: editOpEmail,
      phone: editOpPhone,
      stages: editOpStages,
    });
    if (!result.ok) {
      setEditOpError({ field: result.field, message: result.message });
      return;
    }
    cancelEditOperator();
  };
  const operatorsIssues = validateStep(state, "operators");
  const assignedEmails = new Set(state.operators.map((op) => op.email.trim().toLowerCase()));
  const availableCandidates = store.candidateOperators.filter(
    (candidate) => !assignedEmails.has(candidate.email.trim().toLowerCase()),
  );
  const formatCandidateSource = (source: string) =>
    source === "admin"
      ? "Administrador"
      : source === "turnos"
        ? "Turnos"
        : source === "pedidos"
          ? "Pedidos"
          : source;
  const selectedCandidateEmail =
    availableCandidates.find((c) => c.email.toLowerCase() === newOpEmail.trim().toLowerCase())?.email ??
    "";

  return (
    <>
    <div>
      <h3 className="oc-section-title">Agregar operador al equipo</h3>
      {availableCandidates.length > 0 && (
        <div className="oc-field" style={{ marginBottom: "16px" }}>
          <label htmlFor="oc-operatorCandidateSelect">
            Seleccionar persona ya registrada en el negocio
          </label>
          <select
            id="oc-operatorCandidateSelect"
            value={selectedCandidateEmail}
            disabled={store.saving}
            onChange={(e) => {
              const chosen = availableCandidates.find((c) => c.email === e.target.value);
              if (!chosen) {
                setNewOpName("");
                setNewOpEmail("");
                setNewOpPhone("");
                setNewOpError(null);
                return;
              }
              setNewOpName(chosen.name);
              setNewOpEmail(chosen.email);
              setNewOpPhone(chosen.phone ?? "");
              setNewOpError(null);
            }}
            style={{
              width: "100%",
              height: "44px",
              borderRadius: "10px",
              border: "1px solid var(--oc-border)",
              background: "var(--oc-surface)",
              color: "var(--oc-text)",
              padding: "0 12px",
              fontSize: "14px",
            }}
          >
            <option value="">
              {`— Elegir del registro (${availableCandidates.length} disponible${availableCandidates.length === 1 ? "" : "s"}) o escribir manualmente —`}
            </option>
            {availableCandidates.map((candidate) => (
              <option key={candidate.email} value={candidate.email}>
                {`${candidate.name} · ${candidate.email} (${candidate.sources.map(formatCandidateSource).join(" + ")})`}
              </option>
            ))}
          </select>
          <span className="oc-field-counter">
            Puedes elegir al administrador o a un operador ya creado en otro módulo para autocompletar sus datos.
          </span>
        </div>
      )}
      <div className="oc-operator-form">
        <div
          className={`oc-field ${newOpError?.field === "name" ? "has-error" : ""}`}
          style={{ marginBottom: 0 }}
        >
          <label htmlFor="oc-newOpName">Nombre completo</label>
          <Input
            id="oc-newOpName"
            type="text"
            placeholder="Ej. Camila Rojas"
            value={newOpName}
            error={newOpError?.field === "name"}
            hint={newOpError?.field === "name" ? newOpError.message : undefined}
            onChange={(e) => {
              setNewOpName(e.target.value);
              if (newOpError?.field === "name") setNewOpError(null);
            }}
          />
        </div>

        <div
          className={`oc-field ${newOpError?.field === "email" ? "has-error" : ""}`}
          style={{ marginBottom: 0 }}
        >
          <label htmlFor="oc-newOpEmail">Correo de acceso</label>
          <Input
            id="oc-newOpEmail"
            type="email"
            placeholder="operador@negocio.com"
            value={newOpEmail}
            error={newOpError?.field === "email"}
            hint={newOpError?.field === "email" ? newOpError.message : undefined}
            onChange={(e) => {
              setNewOpEmail(e.target.value);
              if (newOpError?.field === "email") setNewOpError(null);
            }}
          />
        </div>

        <div
          className={`oc-field ${newOpError?.field === "phone" ? "has-error" : ""}`}
          style={{ marginBottom: 0 }}
        >
          <label htmlFor="oc-newOpPhone">Teléfono (opcional)</label>
          <Input
            id="oc-newOpPhone"
            type="tel"
            placeholder="+57 300 123 4567"
            value={newOpPhone}
            error={newOpError?.field === "phone"}
            hint={newOpError?.field === "phone" ? newOpError.message : undefined}
            onChange={(e) => {
              setNewOpPhone(e.target.value);
              if (newOpError?.field === "phone") setNewOpError(null);
            }}
          />
        </div>
      </div>

      <div className={`oc-stage-picker ${newOpError?.field === "stages" ? "has-error" : ""}`}>
        <span className="oc-stage-picker-label">Etapas operativas asignadas</span>
        <div className="oc-stage-checkboxes">
          {ALL_OPERATOR_STAGES.map((stage) => (
            <Checkbox
              key={stage}
              id={`oc-newOpStage-${stage}`}
              checked={newOpStages.includes(stage)}
              label={operatorStageLabels[stage]}
              onChange={(checked) => {
                setNewOpStages((prev) => toggleStageInList(prev, stage, checked));
                if (newOpError?.field === "stages") setNewOpError(null);
              }}
            />
          ))}
        </div>
        {newOpError?.field === "stages" && (
          <span className="oc-field-error" role="alert">
            {newOpError.message}
          </span>
        )}
      </div>

      {newOpError?.field === "operator" && (
        <div className="oc-alert-error" role="alert" style={{ marginBottom: "12px" }}>
          <span>{newOpError.message}</span>
        </div>
      )}

      <div className="oc-operator-form-actions">
        <Button
          type="button"
          className="oc-primary"
          disabled={store.saving || !newOpName.trim() || !newOpEmail.trim()}
          onClick={() => void handleAddOperator()}
        >
          {store.saving ? "Guardando…" : "+ Agregar operador"}
        </Button>
      </div>

      {operatorsIssues.length > 0 && (
        <div className="oc-alert-error" role="alert" style={{ marginBottom: "16px" }}>
          <strong>Revisa los operadores registrados:</strong>
          <ul className="oc-blocking-list">
            {operatorsIssues.map((issue) => (
              <li key={issue.field}>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="oc-section-title">{`Equipo asignado (${state.operators.length})`}</h3>
      {state.operators.length === 0 ? (
        <div className="oc-empty-box">
          No hay operadores adicionales. Como administrador puedes operar directamente todas las
          órdenes.
        </div>
      ) : (
        <div className="oc-record-list">
          {state.operators.map((op) => {
            const isEditing = editingOpId === op.id;
            return (
              <div key={op.id} className="oc-record-row">
                {isEditing ? (
                  <div className="oc-operator-edit-box">
                    <div className="oc-operator-edit-grid">
                      <div
                        className={`oc-field ${editOpError?.field === "name" ? "has-error" : ""}`}
                        style={{ marginBottom: 0 }}
                      >
                        <label htmlFor={`oc-editOpName-${op.id}`}>Nombre completo</label>
                        <Input
                          id={`oc-editOpName-${op.id}`}
                          type="text"
                          value={editOpName}
                          error={editOpError?.field === "name"}
                          hint={editOpError?.field === "name" ? editOpError.message : undefined}
                          onChange={(e) => {
                            setEditOpName(e.target.value);
                            if (editOpError?.field === "name") setEditOpError(null);
                          }}
                        />
                      </div>
                      <div
                        className={`oc-field ${editOpError?.field === "email" ? "has-error" : ""}`}
                        style={{ marginBottom: 0 }}
                      >
                        <label htmlFor={`oc-editOpEmail-${op.id}`}>Correo de acceso</label>
                        <Input
                          id={`oc-editOpEmail-${op.id}`}
                          type="email"
                          value={editOpEmail}
                          error={editOpError?.field === "email"}
                          hint={editOpError?.field === "email" ? editOpError.message : undefined}
                          onChange={(e) => {
                            setEditOpEmail(e.target.value);
                            if (editOpError?.field === "email") setEditOpError(null);
                          }}
                        />
                      </div>
                      <div
                        className={`oc-field ${editOpError?.field === "phone" ? "has-error" : ""}`}
                        style={{ marginBottom: 0 }}
                      >
                        <label htmlFor={`oc-editOpPhone-${op.id}`}>Teléfono (opcional)</label>
                        <Input
                          id={`oc-editOpPhone-${op.id}`}
                          type="tel"
                          placeholder="+57 300 123 4567"
                          value={editOpPhone}
                          error={editOpError?.field === "phone"}
                          hint={editOpError?.field === "phone" ? editOpError.message : undefined}
                          onChange={(e) => {
                            setEditOpPhone(e.target.value);
                            if (editOpError?.field === "phone") setEditOpError(null);
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className={`oc-stage-picker ${editOpError?.field === "stages" ? "has-error" : ""}`}
                      style={{ marginBottom: 0 }}
                    >
                      <span className="oc-stage-picker-label">Etapas operativas asignadas</span>
                      <div className="oc-stage-checkboxes">
                        {ALL_OPERATOR_STAGES.map((stage) => (
                          <Checkbox
                            key={stage}
                            id={`oc-editOpStage-${op.id}-${stage}`}
                            checked={editOpStages.includes(stage)}
                            label={operatorStageLabels[stage]}
                            onChange={(checked) => {
                              setEditOpStages((prev) => toggleStageInList(prev, stage, checked));
                              if (editOpError?.field === "stages") setEditOpError(null);
                            }}
                          />
                        ))}
                      </div>
                      {editOpError?.field === "stages" && (
                        <span className="oc-field-error" role="alert">
                          {editOpError.message}
                        </span>
                      )}
                    </div>

                    {editOpError?.field === "operator" && (
                      <span className="oc-field-error" role="alert">
                        {editOpError.message}
                      </span>
                    )}
                    <div className="oc-operator-edit-actions">
                      <Button
                        variant="outline"
                        type="button"
                        className="oc-secondary"
                        disabled={store.saving}
                        onClick={cancelEditOperator}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        className="oc-primary"
                        disabled={store.saving}
                        onClick={() => void saveEditOperator(op.id)}
                      >
                        {store.saving ? "Guardando…" : "Guardar cambios"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="oc-record-meta">
                      <strong>{op.name}</strong>
                      <span className="oc-record-sub">{op.email}</span>
                      {op.phone && <span className="oc-record-sub">{op.phone}</span>}
                      {renderOperatorStages(op.stages)}
                    </div>
                    <div className="oc-record-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={store.saving}
                        onClick={() => setAccessDialogOperator(op)}
                      >
                        Ver acceso
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={store.saving}
                        onClick={() => startEditOperator(op)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="oc-delete-btn"
                        disabled={store.saving}
                        onClick={() => void store.removeOperator(op.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    <OperatorAccessDialog
      operator={accessDialogOperator}
      onClose={() => setAccessDialogOperator(null)}
    />
    </>
  );
});

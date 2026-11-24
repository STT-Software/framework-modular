import { useEffect, useState } from "react";
import { AppDialog, Field, InfoBox, toastStore } from "@/modules/business-dashboard";
import { turnosApi } from "../../api/turnosApi";
import { operationErrorMessage } from "../messages";
import { operationStore } from "../stores/operation.store";
/**
 * Eliminar una fila. Quien se quedaría sin ninguna elige a cuál pasa, y el servidor cambia fila y operadores en una sola escritura.
 * Una fila con turnos esperando o en atención no se puede eliminar (el servidor lo dice).
 */
export function DeleteQueueDialog({ queueId, onClose }: { queueId: string | null; onClose: () => void }) {
  const config = operationStore.config;
  const queue = config?.queues.find((item) => item.id === queueId);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTargets({});
    setError(null);
  }, [queueId]);
  if (!config || !queue) return <AppDialog open={false} title="" onClose={onClose}>{null}</AppDialog>;
  const stranded = config.operators.filter((person) => person.queueIds.length === 1 && person.queueIds[0] === queue.id);
  const alternatives = config.queues.filter((item) => item.id !== queue.id);
  const submit = async () => {
    const missing = stranded.find((person) => !targets[person.id]);
    if (missing) return setError("Selecciona una nueva fila para cada operador.");
    setBusy(true);
    try {
      const state = await operationStore.run((token) =>
        turnosApi.deleteQueue(token, operationStore.businessId, queue.id, stranded.map((person) => ({ operatorId: person.id, queueId: targets[person.id] }))),
      );
      operationStore.applyConfig(state);
      operationStore.bump();
      toastStore.announce("Fila eliminada sin dejar operadores sin asignación.");
      onClose();
    } catch (reason) {
      setError(operationErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppDialog open title={`Eliminar ${queue.name}`} submitLabel="Eliminar fila" danger busy={busy} error={error} onClose={onClose} onSubmit={submit}>
      <p className="nd-muted">Se quitará esta fila de las asignaciones de sus operadores. Los operadores que se quedarían sin filas necesitan una nueva asignación.</p>
      {stranded.map((person) => (
        <div key={person.id} style={{ marginTop: 20 }}>
          <Field id={`nd-reassign-${person.id}`} label={`${person.name} · nueva fila`}>
            <select id={`nd-reassign-${person.id}`} value={targets[person.id] ?? ""} onChange={(event) => setTargets((current) => ({ ...current, [person.id]: event.target.value }))}>
              <option value="">Selecciona una fila</option>
              {alternatives.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ))}
      {stranded.length > 0 && alternatives.length === 0 ? <InfoBox>No quedan filas alternativas. Crea otra fila o retira a los operadores antes de eliminar esta.</InfoBox> : null}
    </AppDialog>
  );
}

import { observer } from "mobx-react-lite";
import { BoardArt, DirectoryArt, GuideFigure, HubArt, QueueArt } from "@/components/configuration/GuideFigure";
import { turnosStore } from "../stores/turnos.store";
import type { TurnosState, TurnosStep } from "../types";

export const TurnosGuide = observer(({ step, state }: { step: Exclude<TurnosStep, "rules">; state: TurnosState }) => {
  const profile = state.catalog.profiles.find((item) => item.id === state.profile.id);
  const queue = state.queues.find((item) => item.id === turnosStore.previewQueueId) ?? state.queues[0];
  switch (step) {
    case "profile": {
      const suggested = profile?.suggestedQueues ?? [];
      return <GuideFigure title="Del perfil a las filas sugeridas"
        description={suggested.length ? `El perfil «${profile?.name}» sugiere servicios como ${suggested.slice(0, 2).map((q) => q.name).join(" y ")}. En el paso de filas puedes ajustar cada servicio.` : "Este perfil parte sin sugerencias. En el siguiente paso podrás crear una fila para cada servicio que quieras atender."}
        alternative={`El perfil elegido tiene ${suggested.length} filas sugeridas.`}>
        <DirectoryArt title={profile?.name ?? "Personalizado"} entries={suggested.map((q) => q.name)} icon="store" />
      </GuideFigure>;
    }
    case "queues":
      return <GuideFigure title={queue ? "Cada fila organiza un servicio" : "Crea la primera fila de atención"}
        description={queue ? `En «${queue.name}», un turno se identifica como ${queue.ticketExample}. Su tiempo medio de atención es de ${queue.averageMinutes} min.` : "Define el nombre del servicio y los minutos que suele tomar la atención. Aquí aparecerá un ejemplo de su turno."}
        alternative={queue ? `Tiquete de ejemplo: ${queue.ticketExample}.` : "Tiquete pendiente de configurar."}>
        <QueueArt code={queue?.ticketExample ?? "—"} name={queue?.name ?? "Sin filas"} minutes={queue?.averageMinutes} />
      </GuideFigure>;
    case "operators": {
      const operator = state.operators.find((item) => item.id === turnosStore.previewOperatorId) ?? state.operators[0];
      const assigned = operator ? state.queues.filter((q) => operator.queueIds.includes(q.id)) : [];
      const examples = operator ? assigned.slice(0,2).map((q)=>q.name) : ["Recepción","Consulta"];
      return <GuideFigure title={operator ? "El acceso sigue la asignación" : "Una persona puede atender varias filas"}
        description={operator ? `${operator.name} tiene acceso a ${assigned.length} ${assigned.length === 1 ? "fila" : "filas"} de este negocio. Edita su asignación para cambiar los servicios que puede atender.` : "En este ejemplo, una operadora atiende recepción y consulta. Al agregar a tu equipo, eliges las filas de cada persona."}
        alternative={`Una credencial de ${operator?.name ?? "ejemplo"} conectada con ${examples.join(" y ") || "ninguna fila"}.`}>
        <HubArt icon="key" items={[
          { label: operator?.name ?? "Operadora", value: operator ? "OPERADOR ASIGNADO" : "EJEMPLO", icon: "key" },
          ...examples.map((name) => ({ label: name, value: "FILA DE ATENCIÓN", icon: "ticket" as const, active: true })),
        ]} />
      </GuideFigure>;
    }
    case "review":
      return <GuideFigure title="La configuración que vas a confirmar"
        description={`Tu revisión reúne el perfil «${profile?.name ?? "Personalizado"}», las filas, sus reglas y el equipo asignado. Puedes volver a editar cada apartado antes de guardar.`}
        alternative={`Un expediente de Turnos reúne ${state.queues.length} filas y ${state.operators.length} operadores.`}>
        <BoardArt label="REVISIÓN DE TURNOS" title="Configuración de atención" icon="file" metric={profile?.name ?? "Personalizado"} items={[
          { label: "Servicios de atención", value: `${state.queues.length} ${state.queues.length === 1 ? "fila" : "filas"}`, icon: "list" },
          { label: "Equipo asignado", value: `${state.operators.length} ${state.operators.length === 1 ? "operador" : "operadores"}`, icon: "key" },
          { label: "Turno de ejemplo", value: queue?.ticketExample ?? "Sin filas", icon: "ticket" },
        ]} />
      </GuideFigure>;
  }
});

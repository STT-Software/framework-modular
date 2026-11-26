import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  FireIcon,
  MapPinIcon,
  NoSymbolIcon,
  ShieldCheckIcon,
  TruckIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/elements/ui/button";
import type { OrderOperatorStage } from "../../types";
import { CARRIERS, carrierByName } from "../domain/carrierDirectory";
import {
  INCIDENT_STATUS_LABELS,
  incidentStatusClass,
  resolutionLabel,
  shortDate,
} from "../domain/incidentDomain";
import {
  canOperatorMoveTo,
  CHANNEL_LABELS,
  formatCOP,
  formatElapsedSLA,
  MODALITY_LABELS,
  nextStageFor,
  PAYMENT_METHOD_LABELS,
  STAGE_COLORS,
  STAGE_LABELS,
  type Order,
  type OrderColumn,
  type OrderStage,
} from "../domain/order";
import { buildPaymentLink, buildPaymentMessage } from "../domain/orderBilling";
import type { OrderNotificationEventType } from "../domain/conversationsDomain";
import type { ConversationsStore } from "../stores/ConversationsStore";
import type { IncidentStore } from "../stores/IncidentStore";
import type { OrdersStore } from "../stores/OrdersStore";
import { CarrierLogo } from "./CarrierLogo";
import { Modal } from "./Dialog";

export interface OrderDetailModalProps {
  open: boolean;
  order: Order | null;
  businessName: string;
  businessId?: string;
  operatorName: string;
  allowedStages: OrderOperatorStage[];
  ordersStore: OrdersStore;
  incidentsStore: IncidentStore;
  conversationsStore?: ConversationsStore;
  onClose: () => void;
  onOpenChat?: (order: Order) => void;
  onOpenDeliveryIncident?: (order: Order) => void;
  onOpenSchedule?: (order: Order) => void;
  onOpenCancel?: (order: Order) => void;
  onOpenDeliver?: (order: Order) => void;
  readOnly?: boolean;
}

type DetailTabId =
  | "summary"
  | "detail"
  | "history"
  | "automations"
  | "incidents"
  | "returns";

const TABS: Array<{ id: DetailTabId; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "detail", label: "Detalle" },
  { id: "history", label: "Historial de Estados" },
  { id: "automations", label: "Automatizaciones" },
  { id: "incidents", label: "Novedades" },
  { id: "returns", label: "Devoluciones" },
];

const AUTOMATION_STATUS_LABELS: Record<"sent" | "delivered" | "read", string> = {
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
};

function resolveStageLabel(stage: OrderStage, columns: OrderColumn[]): string {
  return columns.find((col) => col.id === stage)?.label ?? STAGE_LABELS[stage] ?? stage;
}

function resolveNextStage(order: Order, columns: OrderColumn[]): OrderStage | null {
  let next = nextStageFor(order.stage, columns);
  if (next === "in_transit" && order.modality !== "delivery") {
    next = "delivered";
  }
  return next;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stageToNotificationEvent(stage: OrderStage): OrderNotificationEventType {
  switch (stage) {
    case "confirmed":
      return "confirmed";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "in_transit":
      return "in_transit";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return "advanced";
  }
}

type MilestoneState = "hecho" | "actual" | "pendiente";

export const OrderDetailModal = observer(
  ({
    open,
    order,
    businessName,
    businessId,
    operatorName,
    allowedStages,
    ordersStore,
    incidentsStore,
    conversationsStore,
    onClose,
    onOpenChat,
    onOpenDeliveryIncident,
    onOpenSchedule,
    onOpenCancel,
    onOpenDeliver,
    readOnly = false,
  }: OrderDetailModalProps) => {
    const liveOrder = order ? (ordersStore.byId(order.id) ?? order) : null;

    const [activeTab, setActiveTab] = useState<DetailTabId>("summary");
    const [carrierDraft, setCarrierDraft] = useState("");
    const [trackingDraft, setTrackingDraft] = useState("");
    const [savedLogisticsFlash, setSavedLogisticsFlash] = useState(false);
    const [timelineExpanded, setTimelineExpanded] = useState(false);
    const [expandedAutomations, setExpandedAutomations] = useState<Record<string, boolean>>({});
    const [copyNotice, setCopyNotice] = useState<string | null>(null);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
      if (!open) return;
      const timer = window.setInterval(() => setNow(new Date()), 1000);
      return () => window.clearInterval(timer);
    }, [open]);

    useEffect(() => {
      if (!liveOrder) return;
      setCarrierDraft(liveOrder.carrier ?? "");
      setTrackingDraft(liveOrder.trackingNumber ?? "");
    }, [liveOrder?.id, liveOrder?.carrier, liveOrder?.trackingNumber]);

    useEffect(() => {
      if (open) {
        setActiveTab("summary");
        setTimelineExpanded(false);
        setCopyNotice(null);
      }
    }, [open, liveOrder?.id]);

    if (!open || !liveOrder) return null;

    const isClosed =
      liveOrder.stage === "delivered" || liveOrder.stage === "cancelled";
    const stageColor = STAGE_COLORS[liveOrder.stage] ?? "#FF3F1A";
    const stageLabel = resolveStageLabel(liveOrder.stage, ordersStore.columns);
    const nextStage = resolveNextStage(liveOrder, ordersStore.columns);
    const nextLabel = nextStage
      ? resolveStageLabel(nextStage, ordersStore.columns)
      : null;
    const canAdvance = Boolean(
      !readOnly &&
        !isClosed &&
        !liveOrder.scheduledFor &&
        nextStage &&
        canOperatorMoveTo(nextStage, allowedStages),
    );

    const incidents = incidentsStore.byOrder(liveOrder.code);
    const linkedConversation = conversationsStore?.byPhone(liveOrder.customerPhone);
    const recentChatOutbound = linkedConversation
      ? linkedConversation.messages
          .filter(
            (msg) =>
              (msg.author === "bot" || msg.author === "agent") &&
              !msg.isInternalNote,
          )
          .slice(-8)
          .reverse()
      : [];

    // Computed operational alerts
    const alerts: Array<{ id: string; tone: "error" | "amber"; text: string }> = [];
    if (liveOrder.modality === "delivery" && !liveOrder.address?.street?.trim()) {
      alerts.push({
        id: "missing-address",
        tone: "error",
        text: "Falta la dirección de entrega para este pedido a domicilio.",
      });
    }
    if (!liveOrder.paid && liveOrder.stage !== "cancelled") {
      alerts.push({
        id: "unpaid",
        tone: "amber",
        text:
          liveOrder.paymentMethod === "transfer"
            ? "Transferencia pendiente de validación antes del despacho."
            : "El pago aún está pendiente de verificación.",
      });
    }
    if (
      liveOrder.stage === "in_transit" &&
      liveOrder.modality === "delivery" &&
      !liveOrder.trackingNumber?.trim()
    ) {
      alerts.push({
        id: "missing-tracking",
        tone: "amber",
        text: "El pedido está En camino sin número de guía asignado.",
      });
    }
    if (liveOrder.urgent && !isClosed) {
      alerts.push({
        id: "urgent-sla",
        tone: "error",
        text: "Pedido marcado como SLA urgente. Priorizar gestión.",
      });
    }

    const persistCarrierAndTracking = (
      nextCarrier = carrierDraft,
      nextTracking = trackingDraft,
    ) => {
      if (readOnly) return;
      if (
        nextCarrier.trim() === (liveOrder.carrier ?? "") &&
        nextTracking.trim() === (liveOrder.trackingNumber ?? "")
      ) {
        return;
      }
      ordersStore.updateCarrierAndTracking(
        liveOrder.id,
        nextCarrier,
        nextTracking,
        operatorName,
      );
      setSavedLogisticsFlash(true);
      window.setTimeout(() => setSavedLogisticsFlash(false), 1800);
    };

    const googleMapsQuery = liveOrder.address
      ? [
          liveOrder.address.street,
          liveOrder.address.neighborhood,
          liveOrder.address.city,
          liveOrder.address.department,
          "Colombia",
        ]
          .filter(Boolean)
          .join(", ")
      : "";

    const handleAdvanceClick = () => {
      if (!nextStage) return;
      if (nextStage === "delivered" && onOpenDeliver) {
        onOpenDeliver(liveOrder);
        return;
      }
      const res = ordersStore.advanceOrder(
        liveOrder.id,
        operatorName,
        allowedStages,
      );
      if (res.ok && conversationsStore) {
        const updated = ordersStore.byId(liveOrder.id);
        if (updated) {
          conversationsStore.notifyOrderEvent(
            updated,
            stageToNotificationEvent(updated.stage),
            businessName,
          );
        }
      }
    };

    const handleTogglePaid = () => {
      ordersStore.togglePaid(liveOrder.id, operatorName);
      if (conversationsStore) {
        const updated = ordersStore.byId(liveOrder.id);
        if (updated?.paid) {
          conversationsStore.notifyOrderEvent(updated, "paid", businessName);
        }
      }
    };

    const handleCopy = async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopyNotice(label);
        window.setTimeout(() => setCopyNotice(null), 2400);
      } catch {
        setCopyNotice("No se pudo copiar.");
        window.setTimeout(() => setCopyNotice(null), 2400);
      }
    };

    // Canonical 4 StockFlow milestones with 3 visual states (hecho / actual / pendiente)
    const findMilestoneEvent = (stages: OrderStage[]) =>
      liveOrder.statusHistory.find((ev) => stages.includes(ev.stage));

    const createdEvent = findMilestoneEvent(["new"]);
    const confirmedPrepEvent = findMilestoneEvent(["confirmed", "preparing", "ready"]);
    const guideStageEvent = findMilestoneEvent(["in_transit"]);
    const guideTrailAudit = liveOrder.operatorTrail.find((aud) =>
      aud.action.toLowerCase().includes("guía") ||
      aud.action.toLowerCase().includes("transportadora"),
    );
    const deliveredEvent = findMilestoneEvent(["delivered"]);

    const hasGuideGenerated = Boolean(
      liveOrder.trackingNumber?.trim() ||
        guideStageEvent ||
        liveOrder.stage === "in_transit" ||
        liveOrder.stage === "delivered",
    );

    const rawMilestones = [
      {
        id: "created",
        label: "Creado",
        reached: true,
        at: createdEvent?.at ?? liveOrder.createdAt,
        operator: createdEvent?.operator ?? CHANNEL_LABELS[liveOrder.channel],
        detail: undefined as string | undefined,
      },
      {
        id: "confirmed_prep",
        label: "Confirmado / Preparación",
        reached: Boolean(
          confirmedPrepEvent ||
            ["confirmed", "preparing", "ready", "in_transit", "delivered"].includes(
              liveOrder.stage,
            ),
        ),
        at: confirmedPrepEvent?.at,
        operator: confirmedPrepEvent?.operator,
        detail: undefined as string | undefined,
      },
      {
        id: "guide_generated",
        label: "Pedido con guía generada",
        reached: hasGuideGenerated,
        at: guideStageEvent?.at ?? guideTrailAudit?.at,
        operator: guideStageEvent?.operator ?? guideTrailAudit?.operator,
        detail: liveOrder.trackingNumber
          ? `Guía ${liveOrder.trackingNumber}`
          : liveOrder.carrier || undefined,
      },
      {
        id: "delivered",
        label: "Entregado",
        reached: liveOrder.stage === "delivered" || Boolean(deliveredEvent),
        at: deliveredEvent?.at ?? liveOrder.deliveredAt,
        operator: deliveredEvent?.operator,
        detail: undefined as string | undefined,
      },
    ];

    const highestReachedIdx = rawMilestones.reduce(
      (acc, item, idx) => (item.reached ? idx : acc),
      0,
    );

    const milestones: Array<(typeof rawMilestones)[number] & { state: MilestoneState }> =
      rawMilestones.map((item, idx) => {
        if (liveOrder.stage === "delivered") {
          return { ...item, state: "hecho" };
        }
        if (liveOrder.stage === "cancelled") {
          return { ...item, state: item.reached ? "hecho" : "pendiente" };
        }
        if (!item.reached) {
          return { ...item, state: "pendiente" };
        }
        if (idx === highestReachedIdx) {
          return { ...item, state: "actual" };
        }
        return { ...item, state: "hecho" };
      });

    const availableCarrierOptions = Array.from(
      new Set([
        ...ordersStore.enabledCarriers.map((c) => c.name),
        ...CARRIERS.map((c) => c.name),
        ...(liveOrder.carrier ? [liveOrder.carrier] : []),
      ]),
    );

    const logisticsDirty =
      carrierDraft.trim() !== (liveOrder.carrier ?? "") ||
      trackingDraft.trim() !== (liveOrder.trackingNumber ?? "");

    const datalistId = `necto-carriers-list-${liveOrder.id}`;
    const paymentLink = buildPaymentLink(liveOrder, undefined, businessId);
    const paymentMessage = buildPaymentMessage(
      liveOrder,
      businessName,
      undefined,
      businessId,
    );

    return (
      <Modal
        isOpen
        onClose={onClose}
        label={`Detalle del pedido ${liveOrder.code}`}
        className="w-[min(96vw,58rem)] overflow-hidden p-0"
      >
        <div className="flex max-h-[90dvh] flex-col">
          {/* Header */}
          <header className="border-b border-gray-100 px-6 pt-4 dark:border-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-mono text-lg font-bold text-ink-title dark:text-white">
                    {liveOrder.code}
                  </h2>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                    style={{
                      backgroundColor: `${stageColor}18`,
                      color: stageColor,
                    }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: stageColor }}
                    />
                    {liveOrder.scheduledFor && !isClosed ? "Programado" : stageLabel}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {MODALITY_LABELS[liveOrder.modality]}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {CHANNEL_LABELS[liveOrder.channel]}
                  </span>
                  {liveOrder.urgent && !isClosed && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-error-50 px-2 py-0.5 text-[11px] font-bold text-error-600 dark:bg-error-500/15 dark:text-error-400">
                      <FireIcon className="size-3" />
                      Urgente
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <strong className="font-semibold text-ink-body dark:text-gray-200">
                    {liveOrder.customerName}
                  </strong>{" "}
                  · {liveOrder.customerPhone}
                  {!isClosed && !liveOrder.scheduledFor && (
                    <span className="ml-2 font-mono text-[11px] text-gray-400">
                      · SLA {formatElapsedSLA(liveOrder.createdAt, now)}
                    </span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <XMarkIcon className="size-4" />
              </button>
            </div>

            {/* 6 Tabs Navigation */}
            <nav
              aria-label="Secciones del pedido"
              className="-mb-px mt-4 flex gap-1 overflow-x-auto"
            >
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                const badgeCount =
                  tab.id === "automations"
                    ? liveOrder.automations.length + recentChatOutbound.length
                    : tab.id === "incidents"
                      ? incidents.length
                      : 0;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? "border-brand-500 text-brand-600 dark:text-brand-400"
                        : "border-transparent text-gray-500 hover:text-ink-body dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {badgeCount > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          active
                            ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </header>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {/* TAB 1: RESUMEN (StockFlow BloqueDato 4-card grid + 2-col Destino | Alertas) */}
            {activeTab === "summary" && (
              <div className="space-y-5">
                {/* 4 Centered BloqueDato Icon Cards */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {/* BloqueDato 1: Confirmación */}
                  <div className="flex flex-col items-center rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 text-center dark:border-gray-800 dark:bg-gray-950/50">
                    <span
                      className={`flex size-12 items-center justify-center rounded-2xl ${
                        liveOrder.stage === "new"
                          ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                          : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                      }`}
                    >
                      {liveOrder.stage === "new" ? (
                        <ClockIcon className="size-8" />
                      ) : (
                        <CheckCircleIcon className="size-8" />
                      )}
                    </span>
                    <div className="mt-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Confirmación
                    </div>
                    <div className="mt-1 text-xs font-bold text-ink-body dark:text-white">
                      {liveOrder.stage === "new"
                        ? "Pendiente confirmar"
                        : "Pedido confirmado"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      Origen: {CHANNEL_LABELS[liveOrder.channel]}
                    </div>
                  </div>

                  {/* BloqueDato 2: Pago */}
                  <div className="flex flex-col items-center rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 text-center dark:border-gray-800 dark:bg-gray-950/50">
                    <span
                      className={`flex size-12 items-center justify-center rounded-2xl ${
                        liveOrder.paid
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                      }`}
                    >
                      {liveOrder.paymentMethod === "cash" ||
                      liveOrder.paymentMethod === "cod" ? (
                        <BanknotesIcon className="size-8" />
                      ) : (
                        <CreditCardIcon className="size-8" />
                      )}
                    </span>
                    <div className="mt-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Pago
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                      <span className="text-xs font-bold text-ink-body dark:text-white">
                        {PAYMENT_METHOD_LABELS[liveOrder.paymentMethod]}
                      </span>
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={handleTogglePaid}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                          readOnly ? "cursor-default" : "cursor-pointer"
                        } ${
                          liveOrder.paid
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300"
                        }`}
                      >
                        {liveOrder.paid ? "Pagado" : "Pendiente"}
                      </button>
                    </div>
                    <div className="mt-0.5 text-[11px] font-bold tabular-nums text-brand-600 dark:text-brand-400">
                      {formatCOP(liveOrder.total)}
                    </div>
                  </div>

                  {/* BloqueDato 3: Fecha / Programación */}
                  <div className="flex flex-col items-center rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 text-center dark:border-gray-800 dark:bg-gray-950/50">
                    <span
                      className={`flex size-12 items-center justify-center rounded-2xl ${
                        liveOrder.scheduledFor
                          ? "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
                          : "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"
                      }`}
                    >
                      <CalendarDaysIcon className="size-8" />
                    </span>
                    <div className="mt-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {liveOrder.scheduledFor ? "Programación" : "Fecha de pedido"}
                    </div>
                    <div className="mt-1 text-xs font-bold text-ink-body dark:text-white">
                      {liveOrder.scheduledFor
                        ? formatDateTime(liveOrder.scheduledFor)
                        : formatDateTime(liveOrder.createdAt)}
                    </div>
                    <div className="mt-0.5 flex items-center justify-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      {!readOnly && !isClosed && onOpenSchedule ? (
                        <button
                          type="button"
                          onClick={() => onOpenSchedule(liveOrder)}
                          className="font-semibold text-brand-600 hover:underline cursor-pointer dark:text-brand-400"
                        >
                          {liveOrder.scheduledFor ? "Reprogramar" : "Programar"}
                        </button>
                      ) : (
                        <span>{liveOrder.scheduledFor ? "Programado" : "Creación"}</span>
                      )}
                    </div>
                  </div>

                  {/* BloqueDato 4: Transportadora */}
                  <div className="flex flex-col items-center rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 text-center dark:border-gray-800 dark:bg-gray-950/50">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                      {liveOrder.modality === "delivery" && liveOrder.carrier ? (
                        <CarrierLogo
                          carrier={carrierByName(liveOrder.carrier)}
                          name={liveOrder.carrier}
                          size="md"
                        />
                      ) : (
                        <TruckIcon className="size-8" />
                      )}
                    </span>
                    <div className="mt-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Transportadora
                    </div>
                    <div className="mt-1 max-w-full truncate text-xs font-bold text-ink-body dark:text-white">
                      {liveOrder.modality === "delivery"
                        ? liveOrder.carrier || "Sin asignar"
                        : MODALITY_LABELS[liveOrder.modality]}
                    </div>
                    <div className="mt-0.5 max-w-full truncate text-[11px] text-gray-500 dark:text-gray-400">
                      {liveOrder.modality === "delivery"
                        ? liveOrder.courierName
                          ? `Mensajero: ${liveOrder.courierName}`
                          : liveOrder.trackingNumber
                            ? `Guía ${liveOrder.trackingNumber}`
                            : "Sin guía aún"
                        : liveOrder.modality === "onsite"
                          ? liveOrder.table || "Consumo en sitio"
                          : "Retiro en tienda"}
                    </div>
                  </div>
                </div>

                {/* 2-Column Destino | Alertas Grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Left: Destino de entrega */}
                  <div className="flex flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                        <MapPinIcon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-bold text-ink-body dark:text-white">
                          Destino de entrega
                        </h3>
                        {liveOrder.modality === "delivery" ? (
                          liveOrder.address?.street ? (
                            <div className="mt-1.5 space-y-0.5 text-xs text-gray-600 dark:text-gray-300">
                              <p className="font-semibold text-ink-body dark:text-white">
                                {liveOrder.address.street}
                              </p>
                              <p>
                                {[
                                  liveOrder.address.neighborhood,
                                  liveOrder.address.city,
                                  liveOrder.address.department,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              {liveOrder.address.reference && (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                  Referencia: {liveOrder.address.reference}
                                </p>
                              )}
                              {liveOrder.address.notes && (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                  Indicaciones: {liveOrder.address.notes}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-xs text-error-600 dark:text-error-400">
                              Sin dirección registrada.
                            </p>
                          )
                        ) : liveOrder.modality === "onsite" ? (
                          <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                            Atención en sitio · {liveOrder.table || "Sin mesa asignada"}
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                            El cliente retira el pedido directamente en tienda.
                          </p>
                        )}
                      </div>
                    </div>

                    {liveOrder.modality === "delivery" && googleMapsQuery && (
                      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleMapsQuery)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-ink-body transition-colors hover:border-brand-300 hover:bg-brand-25 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        >
                          Abrir en Google Maps
                          <ArrowTopRightOnSquareIcon className="size-3.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Right: Alertas */}
                  <div className="rounded-2xl border border-gray-200/90 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            alerts.length > 0
                              ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                          }`}
                        >
                          {alerts.length > 0 ? (
                            <ExclamationTriangleIcon className="size-4" />
                          ) : (
                            <ShieldCheckIcon className="size-4" />
                          )}
                        </span>
                        <h3 className="text-xs font-bold text-ink-body dark:text-white">
                          Alertas operativas
                        </h3>
                      </div>
                      {alerts.length > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                          {alerts.length}
                        </span>
                      )}
                    </div>

                    {alerts.length === 0 ? (
                      <div className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-3 py-3 text-xs text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
                        Sin alertas pendientes. Este pedido tiene toda la información en orden.
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {alerts.map((alert) => (
                          <div
                            key={alert.id}
                            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                              alert.tone === "error"
                                ? "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300"
                                : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200"
                            }`}
                          >
                            <ExclamationTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                            <span>{alert.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline editable Free-Text Carrier / Courier & Tracking # */}
                {liveOrder.modality === "delivery" && (
                  <div className="rounded-2xl border border-gray-200/90 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TruckIcon className="size-4 text-brand-500" />
                        <h3 className="text-xs font-bold text-ink-body dark:text-white">
                          Logística y guía de seguimiento
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {logisticsDirty && !readOnly && !isClosed && (
                          <button
                            type="button"
                            onClick={() => persistCarrierAndTracking()}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-brand-600 cursor-pointer"
                          >
                            <CheckIcon className="size-3" />
                            Guardar cambios
                          </button>
                        )}
                        {savedLogisticsFlash && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            <CheckIcon className="size-3" />
                            Guardado
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="detail-carrier-input"
                          className="block text-[11px] font-bold text-gray-600 dark:text-gray-300"
                        >
                          Transportadora o mensajero (elige o escribe libremente)
                        </label>
                        <input
                          id="detail-carrier-input"
                          type="text"
                          list={datalistId}
                          disabled={readOnly || isClosed}
                          value={carrierDraft}
                          onChange={(e) => setCarrierDraft(e.target.value)}
                          onBlur={() => persistCarrierAndTracking()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              persistCarrierAndTracking();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder="Ej. Coordinadora, Envía o Javier Moto 04"
                          className="mt-1 h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-xs text-ink-body outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />
                        <datalist id={datalistId}>
                          {availableCarrierOptions.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label
                          htmlFor="detail-tracking-input"
                          className="block text-[11px] font-bold text-gray-600 dark:text-gray-300"
                        >
                          Número de guía (guarda al salir o presionar Enter)
                        </label>
                        <input
                          id="detail-tracking-input"
                          type="text"
                          disabled={readOnly || isClosed}
                          value={trackingDraft}
                          onChange={(e) => setTrackingDraft(e.target.value)}
                          onBlur={() => persistCarrierAndTracking()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              persistCarrierAndTracking();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder="Ej. 50000112926"
                          className="mt-1 h-10 w-full rounded-xl border border-gray-300 bg-white px-3 font-mono text-xs text-ink-body outline-none placeholder:font-sans placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: DETALLE */}
            {activeTab === "detail" && (
              <div className="space-y-5">
                {/* Origin & Modality strip */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/50">
                    <div className="text-[10px] font-bold uppercase text-gray-400">
                      Modalidad
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-ink-body dark:text-white">
                      {MODALITY_LABELS[liveOrder.modality]}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/50">
                    <div className="text-[10px] font-bold uppercase text-gray-400">
                      Canal de origen
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-ink-body dark:text-white">
                      {CHANNEL_LABELS[liveOrder.channel]}
                    </div>
                  </div>
                  {liveOrder.modality === "onsite" && (
                    <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/50">
                      <div className="text-[10px] font-bold uppercase text-gray-400">
                        Mesa / Zona
                      </div>
                      <div className="mt-0.5 text-xs font-bold text-ink-body dark:text-white">
                        {liveOrder.table || "No especificada"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Itemized Table */}
                <div className="overflow-hidden rounded-2xl border border-gray-200/90 dark:border-gray-800">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/80 text-[10.5px] font-bold uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-400">
                        <th className="px-4 py-2.5">Producto</th>
                        <th className="px-3 py-2.5 text-center">Cant.</th>
                        <th className="px-3 py-2.5 text-right">Unitario</th>
                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {liveOrder.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-ink-body dark:text-white">
                              {item.name}
                            </div>
                            {item.variant && (
                              <div className="text-[11px] text-gray-400">
                                {item.variant}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                            {formatCOP(item.unitPrice)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums text-ink-body dark:text-white">
                            {formatCOP(item.quantity * item.unitPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="space-y-1.5 border-t border-gray-100 bg-gray-50/60 px-4 py-3 text-xs dark:border-gray-800 dark:bg-gray-950/40">
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>Subtotal productos</span>
                      <span className="tabular-nums">
                        {formatCOP(liveOrder.subtotal)}
                      </span>
                    </div>
                    {liveOrder.extraCharges.map((extra) => (
                      <div
                        key={extra.id}
                        className="flex justify-between text-gray-500 dark:text-gray-400"
                      >
                        <span>{extra.label}</span>
                        <span className="tabular-nums">
                          {formatCOP(extra.amount)}
                        </span>
                      </div>
                    ))}
                    {liveOrder.shippingFee > 0 && (
                      <div className="flex justify-between text-gray-500 dark:text-gray-400">
                        <span>Flete / envío</span>
                        <span className="tabular-nums">
                          {formatCOP(liveOrder.shippingFee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-bold text-ink-body dark:border-gray-800 dark:text-white">
                      <span>Total del pedido</span>
                      <span className="tabular-nums text-brand-600 dark:text-brand-400">
                        {formatCOP(liveOrder.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment block */}
                <div className="rounded-2xl border border-gray-200/90 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-ink-body dark:text-white">
                        Información de pago
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        Medio:{" "}
                        <strong>
                          {PAYMENT_METHOD_LABELS[liveOrder.paymentMethod]}
                        </strong>
                        {(liveOrder.paymentMethod === "cash" ||
                          liveOrder.paymentMethod === "cod") &&
                        liveOrder.paidWith ? (
                          <>
                            {" "}
                            · Paga con{" "}
                            <strong>{formatCOP(liveOrder.paidWith)}</strong> ·
                            Vueltas:{" "}
                            <strong>
                              {formatCOP(
                                Math.max(0, liveOrder.paidWith - liveOrder.total),
                              )}
                            </strong>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={handleTogglePaid}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                          readOnly ? "cursor-default" : "cursor-pointer"
                        } ${
                          liveOrder.paid
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300"
                        }`}
                      >
                        {liveOrder.paid ? (
                          <CheckCircleIcon className="size-3.5" />
                        ) : (
                          <ClockIcon className="size-3.5" />
                        )}
                        {liveOrder.paid ? "Pagado" : "Pendiente de pago"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy(paymentLink, "Enlace copiado")
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      >
                        <ClipboardDocumentIcon className="size-3.5" />
                        Enlace
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy(paymentMessage, "Mensaje copiado")
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      >
                        <ClipboardDocumentIcon className="size-3.5" />
                        Cobro WhatsApp
                      </button>
                    </div>
                  </div>
                  {copyNotice && (
                    <p className="mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {copyNotice}
                    </p>
                  )}
                </div>

                {/* Notes & Cancellation Reason */}
                {(liveOrder.notes || liveOrder.cancellationReason) && (
                  <div className="space-y-2 rounded-2xl border border-gray-200/90 bg-gray-50/70 p-4 text-xs dark:border-gray-800 dark:bg-gray-950/50">
                    {liveOrder.notes && (
                      <div>
                        <div className="font-bold text-ink-body dark:text-white">
                          Notas
                        </div>
                        <p className="mt-1 whitespace-pre-line text-gray-600 dark:text-gray-300">
                          {liveOrder.notes}
                        </p>
                      </div>
                    )}
                    {liveOrder.cancellationReason && (
                      <div className="rounded-xl bg-error-50 px-3 py-2 text-error-700 dark:bg-error-500/15 dark:text-error-300">
                        <strong>Motivo de cancelación:</strong>{" "}
                        {liveOrder.cancellationReason}
                      </div>
                    )}
                  </div>
                )}

                {/* Trazabilidad por Operador */}
                <div>
                  <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Trazabilidad por operador ({liveOrder.operatorTrail.length})
                  </h3>
                  <div className="space-y-2">
                    {liveOrder.operatorTrail.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 text-xs dark:border-gray-800 dark:bg-gray-900"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                            <UserIcon className="size-3.5" />
                          </span>
                          <div>
                            <div className="font-semibold text-ink-body dark:text-white">
                              {entry.action}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              Por {entry.operator}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
                          {formatDateTime(entry.at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: HISTORIAL DE ESTADOS (4 Canonical Milestones + Collapsed Timeline) */}
            {activeTab === "history" && (
              <div className="space-y-5">
                {/* 4 Canonical Milestone cards with hecho / actual / pendiente visual states */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {milestones.map((m) => {
                    const cardClass =
                      m.state === "hecho"
                        ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                        : m.state === "actual"
                          ? "border-brand-500 bg-brand-25/80 ring-2 ring-brand-500/25 dark:border-brand-400 dark:bg-brand-500/15 dark:ring-brand-500/30"
                          : "border-gray-200 bg-gray-50/50 opacity-75 dark:border-gray-800 dark:bg-gray-950/40";

                    const badgeClass =
                      m.state === "hecho"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : m.state === "actual"
                          ? "bg-brand-500 text-white"
                          : "bg-gray-200/70 text-gray-500 dark:bg-gray-800 dark:text-gray-400";

                    const stateLabel =
                      m.state === "hecho"
                        ? "Hecho"
                        : m.state === "actual"
                          ? "Actual"
                          : "Pendiente";

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col justify-between rounded-2xl border p-3.5 transition-all ${cardClass}`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`text-xs font-bold leading-snug ${
                                m.state === "pendiente"
                                  ? "text-gray-500 dark:text-gray-400"
                                  : "text-ink-body dark:text-white"
                              }`}
                            >
                              {m.label}
                            </span>
                            {m.state === "hecho" ? (
                              <CheckCircleIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            ) : m.state === "actual" ? (
                              <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-brand-500/20">
                                <span className="size-2 rounded-full bg-brand-500" />
                              </span>
                            ) : (
                              <ClockIcon className="size-4 shrink-0 text-gray-300 dark:text-gray-600" />
                            )}
                          </div>

                          <div className="mt-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}
                            >
                              {stateLabel}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 border-t border-black/5 pt-2 dark:border-white/5">
                          <div className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
                            {m.at ? formatDateTime(m.at) : "Sin registrar"}
                          </div>
                          {m.detail && (
                            <div className="mt-0.5 truncate font-mono text-[10.5px] font-semibold text-ink-body dark:text-gray-200">
                              {m.detail}
                            </div>
                          )}
                          {m.operator && (
                            <div className="mt-0.5 truncate text-[10.5px] text-gray-400">
                              {m.operator}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 6-item metadata strip */}
                <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 text-xs sm:grid-cols-3 dark:border-gray-800 dark:bg-gray-950/40">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-gray-400">
                      Código
                    </div>
                    <div className="mt-0.5 font-mono font-bold text-ink-body dark:text-white">
                      {liveOrder.code}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-gray-400">
                      Canal
                    </div>
                    <div className="mt-0.5 font-semibold text-ink-body dark:text-white">
                      {CHANNEL_LABELS[liveOrder.channel]}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-gray-400">
                      Modalidad
                    </div>
                    <div className="mt-0.5 font-semibold text-ink-body dark:text-white">
                      {MODALITY_LABELS[liveOrder.modality]}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-gray-400">
                      Transportadora
                    </div>
                    <div className="mt-0.5 font-semibold text-ink-body dark:text-white">
                      {liveOrder.carrier || "No aplica"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-gray-400">
                      Guía
                    </div>
                    <div className="mt-0.5 font-mono font-semibold text-ink-body dark:text-white">
                      {liveOrder.trackingNumber || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-gray-400">
                      Última actualización
                    </div>
                    <div className="mt-0.5 font-semibold text-ink-body dark:text-white">
                      {formatDateTime(liveOrder.updatedAt)}
                    </div>
                  </div>
                </div>

                {/* Collapsible chronological timeline (collapsed by default) */}
                <div className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-800 dark:bg-gray-900">
                  <button
                    type="button"
                    aria-expanded={timelineExpanded}
                    onClick={() => setTimelineExpanded((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-bold text-ink-body cursor-pointer dark:text-white"
                  >
                    <span>
                      Línea de tiempo cronológica ({liveOrder.statusHistory.length}{" "}
                      {liveOrder.statusHistory.length === 1 ? "evento" : "eventos"})
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                      {timelineExpanded ? "Ocultar" : "Ver detalle"}
                      {timelineExpanded ? (
                        <ChevronUpIcon className="size-4 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="size-4 text-gray-400" />
                      )}
                    </span>
                  </button>

                  {timelineExpanded && (
                    <div className="border-t border-gray-100 px-4 py-4 dark:border-gray-800">
                      <ol className="relative space-y-4 border-l-2 border-gray-200 pl-5 dark:border-gray-700">
                        {liveOrder.statusHistory.map((ev) => {
                          const dotColor = STAGE_COLORS[ev.stage] ?? "#FF3F1A";
                          return (
                            <li key={ev.id} className="relative">
                              <span
                                className="absolute -left-[25px] top-1 size-3 rounded-full ring-4 ring-white dark:ring-gray-900"
                                style={{ backgroundColor: dotColor }}
                              />
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold text-ink-body dark:text-white">
                                  {ev.label}
                                </span>
                                <span className="text-[11px] tabular-nums text-gray-400">
                                  {formatDateTime(ev.at)}
                                </span>
                              </div>
                              <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                Responsable: {ev.operator}
                              </div>
                              {ev.note && (
                                <p className="mt-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                  {ev.note}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: AUTOMATIZACIONES */}
            {activeTab === "automations" && (
              <div className="space-y-4">
                {onOpenChat && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        Conversación en vivo con {liveOrder.customerName}
                      </p>
                      <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/80">
                        {linkedConversation
                          ? `${linkedConversation.messages.filter((m) => !m.isInternalNote).length} mensajes en el hilo de ${linkedConversation.contact.phone}`
                          : `Abre o inicia el chat de WhatsApp con ${liveOrder.customerPhone}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenChat(liveOrder)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-theme-xs transition-colors hover:bg-emerald-700 cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                      <ChatBubbleLeftRightIcon className="size-3.5" />
                      Abrir chat en vivo
                    </button>
                  </div>
                )}

                {conversationsStore && recentChatOutbound.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Mensajes recientes del chat ({recentChatOutbound.length})
                      </h3>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        Bot y asesores
                      </span>
                    </div>

                    {recentChatOutbound.map((msg) => {
                      const isLinkedToOrder =
                        msg.orderId === liveOrder.id ||
                        msg.traceability?.orderId === liveOrder.id;
                      const isBot = msg.author === "bot";

                      return (
                        <div
                          key={msg.id}
                          className={`rounded-2xl border p-3.5 text-xs ${
                            isLinkedToOrder
                              ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10"
                              : "border-gray-200/90 bg-white dark:border-gray-800 dark:bg-gray-900"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isBot
                                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                                    : "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                                }`}
                              >
                                {isBot ? "Bot IA" : "Asesor"}
                              </span>
                              <span className="font-bold text-ink-body dark:text-white">
                                {msg.authorName || (isBot ? "Bot Inteligente" : "Operador")}
                              </span>
                              {msg.traceability?.flow && (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                  {msg.traceability.flow}
                                </span>
                              )}
                              {isLinkedToOrder && (
                                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {liveOrder.code}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] tabular-nums text-gray-400">
                              {formatDateTime(msg.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-line leading-relaxed text-gray-700 dark:text-gray-200">
                            {msg.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {liveOrder.automations.length === 0 &&
                recentChatOutbound.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-center dark:border-gray-800">
                    <ChatBubbleLeftRightIcon className="size-10 text-gray-300 dark:text-gray-600" />
                    <p className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Sin mensajes automáticos enviados
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Las notificaciones por WhatsApp aparecerán aquí a medida que avance el pedido.
                    </p>
                  </div>
                ) : liveOrder.automations.length > 0 ? (
                  <div className="space-y-2.5">
                    {conversationsStore && recentChatOutbound.length > 0 && (
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Notificaciones registradas del pedido (
                        {liveOrder.automations.length})
                      </h3>
                    )}
                    {liveOrder.automations.map((auto) => {
                      const isOpen = expandedAutomations[auto.id] ?? true;
                      const statusBadgeClass =
                        auto.status === "read"
                          ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                          : auto.status === "delivered"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

                      return (
                        <div
                          key={auto.id}
                          className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-800 dark:bg-gray-900"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAutomations((prev) => ({
                                ...prev,
                                [auto.id]: !isOpen,
                              }))
                            }
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                WhatsApp
                              </span>
                              <span className="text-xs font-bold text-ink-body dark:text-white">
                                {auto.event}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass}`}
                              >
                                {AUTOMATION_STATUS_LABELS[auto.status]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400">
                              <span>{formatDateTime(auto.sentAt)}</span>
                              {isOpen ? (
                                <ChevronUpIcon className="size-4" />
                              ) : (
                                <ChevronDownIcon className="size-4" />
                              )}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-600 dark:border-gray-800 dark:text-gray-300">
                              {auto.message}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}

            {/* TAB 5: NOVEDADES */}
            {activeTab === "incidents" && (
              <div className="space-y-4">
                {!readOnly && !isClosed && onOpenDeliveryIncident && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      startIcon={
                        <ExclamationTriangleIcon className="size-4 text-amber-500" />
                      }
                      onClick={() => onOpenDeliveryIncident(liveOrder)}
                    >
                      Reportar nueva novedad de entrega
                    </Button>
                  </div>
                )}

                {incidents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-center dark:border-gray-800">
                    <ExclamationTriangleIcon className="size-10 text-gray-300 dark:text-gray-600" />
                    <p className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Sin novedades registradas
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Este pedido no tiene incidencias logísticas reportadas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="rounded-2xl border border-gray-200/90 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CarrierLogo
                              carrier={carrierByName(inc.carrier)}
                              name={inc.carrier}
                              size="sm"
                            />
                            <div>
                              <div className="text-xs font-bold text-ink-body dark:text-white">
                                {inc.carrier}
                              </div>
                              <div className="font-mono text-[11px] text-gray-400">
                                Guía {inc.trackingNumber}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${incidentStatusClass(inc.status)}`}
                            >
                              {INCIDENT_STATUS_LABELS[inc.status]}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {shortDate(inc.createdAt)}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-xs font-medium text-ink-body dark:text-gray-200">
                          {inc.reason}
                        </p>

                        {inc.resolution && (
                          <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                            <strong>Solución aplicada:</strong>{" "}
                            {resolutionLabel(inc.resolution)}
                            {inc.notes ? ` — ${inc.notes}` : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: DEVOLUCIONES */}
            {activeTab === "returns" && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-14 text-center dark:border-gray-800">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                  <ArrowUturnLeftIcon className="size-6" />
                </span>
                <h3 className="mt-3 text-sm font-bold text-ink-body dark:text-white">
                  Sin devoluciones registradas para este pedido
                </h3>
                <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
                  Cuando un paquete retorne a origen o el cliente solicite devolución, el seguimiento aparecerá aquí.
                </p>
              </div>
            )}
          </div>

          {/* Footer quick actions */}
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-6 py-3.5 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-2">
              {onOpenChat && (
                <button
                  type="button"
                  onClick={() => onOpenChat(liveOrder)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 cursor-pointer dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                >
                  <ChatBubbleLeftRightIcon className="size-3.5" />
                  WhatsApp / Chat
                </button>
              )}

              {!readOnly && !isClosed && onOpenCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  startIcon={<NoSymbolIcon className="size-3.5 text-error-500" />}
                  onClick={() => onOpenCancel(liveOrder)}
                  className="text-error-600 hover:bg-error-50 dark:text-error-400"
                >
                  Cancelar pedido
                </Button>
              )}

              {!readOnly &&
                !isClosed &&
                liveOrder.modality === "delivery" &&
                onOpenDeliveryIncident && (
                  <Button
                    size="sm"
                    variant="outline"
                    startIcon={
                      <ExclamationTriangleIcon className="size-3.5 text-amber-500" />
                    }
                    onClick={() => onOpenDeliveryIncident(liveOrder)}
                  >
                    Reportar novedad
                  </Button>
                )}

              {!readOnly && !isClosed && liveOrder.scheduledFor && (
                <Button
                  size="sm"
                  variant="primary"
                  startIcon={<CalendarDaysIcon className="size-3.5" />}
                  onClick={() =>
                    ordersStore.activateScheduledOrder(liveOrder.id, operatorName)
                  }
                >
                  Activar en tablero
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cerrar
              </Button>
              {canAdvance && nextLabel && (
                <Button
                  size="sm"
                  variant="primary"
                  endIcon={<ArrowRightIcon className="size-3.5" />}
                  onClick={handleAdvanceClick}
                >
                  Pasar a {nextLabel}
                </Button>
              )}
            </div>
          </footer>
        </div>
      </Modal>
    );
  },
);

export default OrderDetailModal;

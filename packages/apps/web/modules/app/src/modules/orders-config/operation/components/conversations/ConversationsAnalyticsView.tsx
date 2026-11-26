import { useState } from "react";
import { observer } from "mobx-react-lite";
import {
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CpuChipIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { Card } from "@/elements/ui/card";
import { cn } from "@/utils";
import {
  CHANNEL_LABELS,
  classifyIntention,
  computeConversationAnalytics,
  formatRelativeTime,
  getInitials,
  getLastVisibleMessage,
  INTENTION_META,
  matchesDateFilter,
  phonesMatch,
  STATUS_META,
  stripHtmlTags,
  type AnalyticsPeriod,
  type Conversation,
  type ConversationChannel,
  type ConversationIntention,
  type ConversationStatus,
  type DateFilter,
} from "../../domain/conversationsDomain";
import type { Order } from "../../domain/order";
import type { ConversationsStore } from "../../stores/ConversationsStore";
import type { OrdersStore } from "../../stores/OrdersStore";

export interface ConversationsAnalyticsViewProps {
  store: ConversationsStore;
  ordersStore: OrdersStore;
  onOpenConversation: (conversationId: string) => void;
}

const PERIOD_OPTIONS: Array<{ id: AnalyticsPeriod; label: string }> = [
  { id: "today", label: "Hoy" },
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mes" },
];

const CHANNEL_BADGE_STYLES: Record<
  ConversationChannel,
  { badge: string; dot: string }
> = {
  whatsapp: {
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    dot: "bg-[#25D366]",
  },
  instagram: {
    badge:
      "bg-pink-50 text-pink-700 border-pink-200/80 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30",
    dot: "bg-[#E1306C]",
  },
  messenger: {
    badge:
      "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
    dot: "bg-[#0084FF]",
  },
  tiktok: {
    badge:
      "bg-gray-100 text-gray-800 border-gray-200/80 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700",
    dot: "bg-gray-900 dark:bg-white",
  },
  telegram: {
    badge:
      "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
    dot: "bg-[#229ED9]",
  },
};

const STATUS_BADGE_STYLES: Record<ConversationStatus, string> = {
  open: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  waiting: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  attended:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const INTENTION_BADGE_STYLES: Record<ConversationIntention, string> = {
  inquire: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  buy: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  track_order: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  claim: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

function getLinkedOrders(conv: Conversation, orders: Order[]): Order[] {
  return orders.filter(
    (order) =>
      phonesMatch(order.customerPhone, conv.contact.phone) ||
      conv.messages.some((msg) => msg.orderId === order.id),
  );
}

function pctOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

type RowSentiment = "positive" | "neutral" | "negative";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function classifyRowSentiment(
  conv: Conversation,
  linkedOrders: Order[],
): RowSentiment {
  const customerText = conv.messages
    .filter((msg) => msg.author === "customer" && !msg.isInternalNote)
    .map((msg) => normalizeText(msg.text))
    .join(" ");

  if (
    /(reclamo|queja|problema|danado|demora|retraso|cancelar|mal|molesto|nunca llego|no llego|equivocado|error|cancelado)/.test(
      customerText,
    ) ||
    (conv.needsAttention &&
      linkedOrders.some((order) => order.stage === "cancelled"))
  ) {
    return "negative";
  }

  if (
    /(gracias|excelente|perfecto|genial|super|encanto|buenisimo|listo|mil gracias|chevere|delicioso|recomiendo)/.test(
      customerText,
    ) ||
    linkedOrders.some((order) => order.stage === "delivered")
  ) {
    return "positive";
  }

  return "neutral";
}

const SENTIMENT_META: Record<
  RowSentiment,
  { label: string; className: string; dotClass: string }
> = {
  positive: {
    label: "Positivo",
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  neutral: {
    label: "Neutral",
    className: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
    dotClass: "bg-slate-400",
  },
  negative: {
    label: "Negativo",
    className:
      "bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
};

export const ConversationsAnalyticsView = observer(
  ({
    store,
    ordersStore,
    onOpenConversation,
  }: ConversationsAnalyticsViewProps) => {
    const [period, setPeriod] = useState<AnalyticsPeriod>("month");

    const analytics = computeConversationAnalytics(
      store.conversations,
      ordersStore.orders,
      period,
    );

    const dateFilter: DateFilter =
      period === "today" ? "today" : period === "week" ? "7d" : "30d";

    const recentInPeriod = store.conversations
      .filter((conv) => matchesDateFilter(conv.lastActivityAt, dateFilter))
      .slice()
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      .slice(0, 8);

    const totalSentiment =
      analytics.sentiment.positive +
      analytics.sentiment.neutral +
      analytics.sentiment.negative;

    const sentimentRows = [
      {
        id: "positive",
        label: "Positivo",
        count: analytics.sentiment.positive,
        pct: pctOf(analytics.sentiment.positive, totalSentiment),
        dotClass: "bg-emerald-500",
        barClass: "bg-emerald-500",
      },
      {
        id: "neutral",
        label: "Neutral",
        count: analytics.sentiment.neutral,
        pct: pctOf(analytics.sentiment.neutral, totalSentiment),
        dotClass: "bg-slate-400",
        barClass: "bg-slate-400 dark:bg-slate-500",
      },
      {
        id: "negative",
        label: "Negativo / Urgente",
        count: analytics.sentiment.negative,
        pct: pctOf(analytics.sentiment.negative, totalSentiment),
        dotClass: "bg-amber-500",
        barClass: "bg-gradient-to-r from-amber-500 to-red-500",
      },
    ];

    const intentRows: Array<{
      id: ConversationIntention;
      label: string;
      count: number;
      pct: number;
      barClass: string;
      dotClass: string;
    }> = [
      {
        id: "inquire",
        label: "Consulta",
        count: analytics.intents.inquire,
        pct: pctOf(analytics.intents.inquire, analytics.total),
        barClass: "bg-slate-500",
        dotClass: "bg-slate-500",
      },
      {
        id: "buy",
        label: "Venta",
        count: analytics.intents.buy,
        pct: pctOf(analytics.intents.buy, analytics.total),
        barClass: "bg-emerald-500",
        dotClass: "bg-emerald-500",
      },
      {
        id: "track_order",
        label: "Seguimiento",
        count: analytics.intents.track_order,
        pct: pctOf(analytics.intents.track_order, analytics.total),
        barClass: "bg-blue-500",
        dotClass: "bg-blue-500",
      },
      {
        id: "claim",
        label: "Reclamo",
        count: analytics.intents.claim,
        pct: pctOf(analytics.intents.claim, analytics.total),
        barClass: "bg-amber-500",
        dotClass: "bg-amber-500",
      },
    ];

    const healthySentimentPct =
      totalSentiment > 0
        ? pctOf(
            analytics.sentiment.positive + analytics.sentiment.neutral,
            totalSentiment,
          )
        : 0;

    return (
      <div className="space-y-5">
        {/* Top bar: title + period selector pills */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Analítica de conversaciones
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Rendimiento del asistente IA, sentimiento heurístico e intenciones de compra en tiempo real
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Periodo de analítica"
            className="inline-flex self-start rounded-xl border border-gray-200 bg-white p-1 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          >
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPeriod(opt.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    active
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* KPI 1 */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Total conversaciones
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                <ChatBubbleLeftRightIcon className="h-4.5 w-4.5" />
              </span>
            </div>
            <p className="mt-2.5 text-3xl font-bold text-gray-900 dark:text-white">
              {analytics.total}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Hilos activos en el periodo seleccionado
            </p>
          </Card>

          {/* KPI 2 */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Resolución automática (Bot)
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <CpuChipIcon className="h-4.5 w-4.5" />
              </span>
            </div>
            <p className="mt-2.5 text-3xl font-bold text-gray-900 dark:text-white">
              {analytics.botResolutionRate}%
            </p>
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              {analytics.botResolvedCount}{" "}
              {analytics.botResolvedCount === 1
                ? "conversación resuelta"
                : "conversaciones resueltas"}{" "}
              por Bot IA
            </p>
          </Card>

          {/* KPI 3 */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Tiempo promedio de respuesta
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                <BoltIcon className="h-4.5 w-4.5" />
              </span>
            </div>
            <p className="mt-2.5 text-3xl font-bold text-gray-900 dark:text-white">
              {analytics.avgResponseMinutes} min
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Promedio entre mensaje del cliente y respuesta
            </p>
          </Card>

          {/* KPI 4 */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Conversión a pedidos
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <ShoppingBagIcon className="h-4.5 w-4.5" />
              </span>
            </div>
            <p className="mt-2.5 text-3xl font-bold text-gray-900 dark:text-white">
              {analytics.orderConversionRate}%
            </p>
            <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">
              {analytics.orderConversionCount}{" "}
              {analytics.orderConversionCount === 1
                ? "chat con pedido"
                : "chats con pedido"}{" "}
              confirmado
            </p>
          </Card>
        </div>

        {/* 2-Column Analytical Cards */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Card 1: Heuristic Sentiment */}
          <Card className="flex flex-col justify-between p-5">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Sentimiento heurístico
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Clasificación automática del tono detectado en mensajes del cliente
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {totalSentiment} evaluadas
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {sentimentRows.map((row) => (
                  <div key={row.id}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-200">
                        <span
                          className={cn("h-2.5 w-2.5 rounded-full", row.dotClass)}
                        />
                        {row.label}
                      </span>
                      <span className="flex items-center gap-2">
                        <strong className="font-bold text-gray-900 dark:text-white">
                          {row.count}
                        </strong>
                        <span className="w-10 text-right font-semibold text-gray-500 dark:text-gray-400">
                          {row.pct}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          row.barClass,
                        )}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-white/[0.03] dark:text-gray-400">
              <SparklesIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <p>
                <strong className="text-gray-800 dark:text-gray-200">
                  Resumen IA:
                </strong>{" "}
                {totalSentiment > 0
                  ? `El ${healthySentimentPct}% de las conversaciones del periodo mantienen un tono positivo o neutral.`
                  : "Aún no hay conversaciones suficientes en este periodo para calcular tendencia."}
              </p>
            </div>
          </Card>

          {/* Card 2: Intent Matrix */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Matriz de intenciones
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Distribución por motivo principal de contacto en el periodo
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                4 categorías
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {intentRows.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-white/[0.02]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
                      <span
                        className={cn("h-2.5 w-2.5 rounded-full", item.dotClass)}
                      />
                      {item.label}
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {item.pct}%
                    </span>
                  </div>
                  <p className="mt-1.5 text-xl font-bold text-gray-900 dark:text-white">
                    {item.count}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-800">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        item.barClass,
                      )}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent Conversations Table */}
        <Card className="overflow-hidden p-0 sm:p-0">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Conversaciones recientes
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Últimas interacciones registradas en el periodo seleccionado
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {recentInPeriod.length} de {analytics.total}
            </span>
          </div>

          {recentInPeriod.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-gray-500 dark:text-gray-400">
              No hay conversaciones registradas en este periodo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-3">Contacto</th>
                    <th className="px-3 py-3">Canal</th>
                    <th className="px-3 py-3">Último mensaje</th>
                    <th className="px-3 py-3">Intención</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Estado Handoff</th>
                    <th className="px-3 py-3">Sentimiento</th>
                    <th className="px-3 py-3">Actividad</th>
                    <th className="px-5 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                  {recentInPeriod.map((conv) => {
                    const linked = getLinkedOrders(conv, ordersStore.orders);
                    const intention = classifyIntention(conv, linked);
                    const channelStyle = CHANNEL_BADGE_STYLES[conv.channel];
                    const lastMsg = getLastVisibleMessage(conv);
                    const lastText = lastMsg
                      ? stripHtmlTags(lastMsg.text)
                      : "Sin mensajes";
                    const sentiment = classifyRowSentiment(conv, linked);
                    const sentimentMeta = SENTIMENT_META[sentiment];
                    const isWaitingHandoff =
                      conv.attentionMode !== "human" &&
                      (conv.status === "waiting" ||
                        (conv.needsAttention && conv.status !== "closed"));

                    return (
                      <tr
                        key={conv.id}
                        className="transition-colors hover:bg-gray-50/80 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                              style={{ backgroundColor: conv.contact.avatarColor }}
                            >
                              {getInitials(conv.contact.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900 dark:text-white">
                                {conv.contact.name}
                              </p>
                              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                                {conv.contact.phone}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                              channelStyle.badge,
                            )}
                          >
                            <span
                              className={cn("h-1.5 w-1.5 rounded-full", channelStyle.dot)}
                            />
                            {CHANNEL_LABELS[conv.channel]}
                          </span>
                        </td>

                        <td className="max-w-[220px] px-3 py-3">
                          <p
                            title={lastText}
                            className="truncate text-xs text-gray-600 dark:text-gray-300"
                          >
                            {lastText}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              INTENTION_BADGE_STYLES[intention],
                            )}
                          >
                            {INTENTION_META[intention].label}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              STATUS_BADGE_STYLES[conv.status],
                            )}
                          >
                            {STATUS_META[conv.status].label}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          {conv.attentionMode === "human" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                              <UserIcon className="h-3 w-3" />
                              Humano
                            </span>
                          ) : isWaitingHandoff ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                              <ClockIcon className="h-3 w-3" />
                              En espera
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                              <CpuChipIcon className="h-3 w-3" />
                              Bot
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              sentimentMeta.className,
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                sentimentMeta.dotClass,
                              )}
                            />
                            {sentimentMeta.label}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3 text-gray-500 dark:text-gray-400">
                          {formatRelativeTime(conv.lastActivityAt)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenConversation(conv.id)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:text-brand-400"
                          >
                            Abrir
                            <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  },
);

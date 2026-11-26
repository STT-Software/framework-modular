import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  CHANNEL_LABELS,
  phonesMatch,
  type Conversation,
  type QuickTemplate,
} from "../../domain/conversationsDomain";
import {
  formatCOP,
  STAGE_COLORS,
  STAGE_LABELS,
  type Order,
} from "../../domain/order";
import type { ConversationsStore } from "../../stores/ConversationsStore";
import type { OrdersStore } from "../../stores/OrdersStore";

export interface OrderContextPanelProps {
  conversation: Conversation;
  store: ConversationsStore;
  ordersStore: OrdersStore;
  onCreateOrder: (conv: Conversation) => void;
  onOpenOrderDetail?: (order: Order) => void;
  onSendTemplate?: (text: string) => void;
  onSwitchToOrdersTab?: () => void;
  onClose?: () => void;
}

const QUICK_TEMPLATE_KEYS: ReadonlyArray<{
  key: QuickTemplate["key"];
  shortLabel: string;
}> = [
  { key: "menu", shortLabel: "Menú" },
  { key: "location", shortLabel: "Ubicación" },
  { key: "payment", shortLabel: "Pago" },
];

export const OrderContextPanel = observer(
  ({
    conversation,
    store,
    ordersStore,
    onCreateOrder,
    onOpenOrderDetail,
    onSendTemplate,
    onSwitchToOrdersTab,
    onClose,
  }: OrderContextPanelProps) => {
    const [notes, setNotes] = useState(conversation.contact.notes ?? "");
    const [notesSaved, setNotesSaved] = useState(false);
    const [sentTemplateKey, setSentTemplateKey] = useState<string | null>(null);
    const [copiedPhone, setCopiedPhone] = useState(false);

    useEffect(() => {
      setNotes(conversation.contact.notes ?? "");
      setNotesSaved(false);
    }, [conversation.id, conversation.contact.notes]);

    const linkedOrders = ordersStore.orders
      .filter(
        (order) =>
          phonesMatch(order.customerPhone, conversation.contact.phone) ||
          conversation.messages.some((msg) => msg.orderId === order.id),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const activeOrder =
      linkedOrders.find(
        (order) => order.stage !== "delivered" && order.stage !== "cancelled",
      ) ?? linkedOrders[0];

    const totalSpent = linkedOrders
      .filter((order) => order.stage !== "cancelled")
      .reduce((sum, order) => sum + order.total, 0);

    const isTrustedCustomer = linkedOrders.length >= 2;

    const addressLines = (() => {
      if (activeOrder?.address?.street) {
        const primary = activeOrder.address.street;
        const secondary = [
          activeOrder.address.neighborhood,
          activeOrder.address.city,
          activeOrder.address.department,
        ]
          .filter(Boolean)
          .join(" · ");
        return {
          primary,
          secondary,
          reference: activeOrder.address.reference,
          query: [
            activeOrder.address.street,
            activeOrder.address.neighborhood,
            activeOrder.address.city,
            "Colombia",
          ]
            .filter(Boolean)
            .join(", "),
        };
      }
      if (conversation.contact.address) {
        return {
          primary: conversation.contact.address,
          secondary: "",
          reference: undefined,
          query: `${conversation.contact.address}, Colombia`,
        };
      }
      return null;
    })();

    const resolveStageLabel = (stage: string): string => {
      const col = ordersStore.columns.find((c) => c.id === stage);
      return col?.label ?? STAGE_LABELS[stage] ?? stage;
    };

    const resolveStageColor = (stage: string): string => {
      const col = ordersStore.columns.find((c) => c.id === stage);
      return col?.color ?? STAGE_COLORS[stage] ?? "#64748B";
    };

    const handleSaveNotes = () => {
      store.saveContactNotes(conversation.id, notes);
      setNotesSaved(true);
      window.setTimeout(() => setNotesSaved(false), 1800);
    };

    const handleCopyPhone = async () => {
      try {
        await navigator.clipboard.writeText(conversation.contact.phone);
        setCopiedPhone(true);
        window.setTimeout(() => setCopiedPhone(false), 1800);
      } catch {
        // Ignore clipboard permission errors
      }
    };

    const templatesDisabled =
      conversation.status === "closed" || !store.channelConfig.whatsappConnected;

    const handleQuickTemplate = (tpl: QuickTemplate) => {
      if (!onSendTemplate || templatesDisabled) return;
      onSendTemplate(tpl.text);
      setSentTemplateKey(tpl.key);
      window.setTimeout(() => setSentTemplateKey(null), 1800);
    };

    return (
      <div className="flex h-full flex-col overflow-hidden bg-white font-sans text-gray-800 dark:bg-gray-900 dark:text-white/90">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <h3 className="truncate text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Contexto del pedido
            </h3>
            <p className="mt-0.5 truncate text-sm font-bold text-gray-900 dark:text-white">
              {conversation.contact.name}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Cerrar panel de contexto"
              aria-label="Cerrar panel de contexto"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white cursor-pointer"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Contact phone & channel */}
          <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
                {conversation.contact.phone}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Canal: {CHANNEL_LABELS[conversation.channel]}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyPhone}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 cursor-pointer"
            >
              {copiedPhone ? "¡Copiado!" : "Copiar"}
            </button>
          </div>

          {/* 1. Active order status */}
          <div>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
              Estado del pedido
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {activeOrder ? (
                <>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-xs"
                    style={{ backgroundColor: resolveStageColor(activeOrder.stage) }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                    <span>{resolveStageLabel(activeOrder.stage)}</span>
                  </span>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                    #{activeOrder.code}
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  Sin pedidos activos
                </span>
              )}
            </div>
          </div>

          <hr className="my-4 border-gray-100 dark:border-gray-800" />

          {/* 2. Destination block */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-white">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-600 dark:text-gray-400"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Destino</span>
              </div>
              {addressLines && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines.query)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#190088] hover:underline dark:text-[#97D6DF]"
                >
                  <span>Google Maps</span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
            </div>

            {addressLines ? (
              <div className="mt-2 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                <p className="font-medium">{addressLines.primary}</p>
                {addressLines.secondary && (
                  <p className="text-gray-500 dark:text-gray-400">
                    {addressLines.secondary}
                  </p>
                )}
                {addressLines.reference && (
                  <p className="mt-0.5 text-[11px] italic text-gray-400 dark:text-gray-500">
                    Ref: {addressLines.reference}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                Sin dirección registrada todavía.
              </p>
            )}
          </div>

          <hr className="my-4 border-gray-100 dark:border-gray-800" />

          {/* 3. Customer trust/risk badge & summary */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-white">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-600 dark:text-gray-400"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Perfil del cliente</span>
            </div>

            <div className="mt-2 space-y-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  isTrustedCustomer
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isTrustedCustomer ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                <span>
                  {isTrustedCustomer
                    ? "Cliente Confiable"
                    : "Cliente Nuevo / En verificación"}
                </span>
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-white/[0.03]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Total acumulado
                  </p>
                  <p className="mt-0.5 text-xs font-bold tabular-nums text-gray-900 dark:text-white">
                    {formatCOP(totalSpent)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-white/[0.03]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Pedidos
                  </p>
                  <p className="mt-0.5 text-xs font-bold tabular-nums text-gray-900 dark:text-white">
                    {linkedOrders.length}{" "}
                    {linkedOrders.length === 1 ? "pedido" : "pedidos"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <hr className="my-4 border-gray-100 dark:border-gray-800" />

          {/* 4. Ordered products */}
          <div>
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-white">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-600 dark:text-gray-400"
                >
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                <span>Productos</span>
              </div>

              {activeOrder && onOpenOrderDetail && (
                <button
                  type="button"
                  onClick={() => onOpenOrderDetail(activeOrder)}
                  className="text-[11px] font-semibold text-[#FF3F1A] hover:underline cursor-pointer"
                >
                  Ver detalle completo
                </button>
              )}
            </div>

            {onSwitchToOrdersTab && (
              <button
                type="button"
                onClick={onSwitchToOrdersTab}
                className="mb-3 inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-1.5 text-[11px] font-semibold text-[#190088] transition-colors hover:border-[#190088]/30 hover:bg-[#190088]/5 dark:border-gray-700 dark:bg-white/[0.03] dark:text-[#97D6DF] dark:hover:border-[#97D6DF]/40"
              >
                <span>Ver historial de pedidos →</span>
              </button>
            )}

            {activeOrder && activeOrder.items.length > 0 ? (
              <div className="space-y-2.5">
                {activeOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-2 dark:border-gray-800 dark:bg-white/[0.02]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      >
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <path d="M16 10a4 4 0 0 1-8 0" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold leading-snug text-gray-800 dark:text-gray-200">
                        {item.name}
                        {item.variant ? ` (${item.variant})` : ""}
                      </p>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <span>
                          {item.quantity}{" "}
                          {item.quantity === 1 ? "unidad" : "unidades"}
                        </span>
                        <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                          {formatCOP(item.quantity * item.unitPrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                Aún no hay productos registrados en un pedido para este contacto.
              </p>
            )}
          </div>

          <hr className="my-4 border-gray-100 dark:border-gray-800" />

          {/* 5. Editable contact notes */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor={`contact-notes-${conversation.id}`}
                className="text-xs font-bold text-gray-800 dark:text-white"
              >
                Notas del contacto
              </label>
              {notesSaved && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Guardado ✓
                </span>
              )}
            </div>
            <textarea
              id={`contact-notes-${conversation.id}`}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Preferencias de entrega, horario, instrucciones especiales..."
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#FF3F1A]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3F1A]/15 dark:border-gray-800 dark:bg-gray-800/70 dark:text-white dark:placeholder:text-gray-500"
            />
            <div className="mt-1.5 flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotes}
                className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
              >
                Guardar nota
              </button>
            </div>
          </div>

          {/* 6. Quick template buttons */}
          {onSendTemplate && (
            <>
              <hr className="my-4 border-gray-100 dark:border-gray-800" />
              <div>
                <p className="mb-2 text-xs font-bold text-gray-800 dark:text-white">
                  Plantillas rápidas
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {QUICK_TEMPLATE_KEYS.map(({ key, shortLabel }) => {
                    const tpl = store.channelConfig.templates.find(
                      (item) => item.key === key,
                    );
                    if (!tpl) return null;
                    const justSent = sentTemplateKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={templatesDisabled}
                        onClick={() => handleQuickTemplate(tpl)}
                        title={
                          conversation.status === "closed"
                            ? "Reabre la conversación para enviar plantillas"
                            : !store.channelConfig.whatsappConnected
                              ? "Conecta WhatsApp para enviar plantillas"
                              : tpl.text
                        }
                        className={`rounded-xl border px-2 py-2 text-center text-[11px] font-semibold transition-all ${
                          templatesDisabled
                            ? "cursor-not-allowed border-gray-200 bg-gray-100/70 text-gray-400 opacity-60 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-500"
                            : justSent
                              ? "cursor-pointer border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "cursor-pointer border-gray-200 bg-gray-50 text-gray-700 hover:border-[#190088]/40 hover:bg-[#190088]/5 hover:text-[#190088] dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:border-[#97D6DF]/40 dark:hover:text-[#97D6DF]"
                        }`}
                      >
                        {justSent ? "Enviada ✓" : shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sticky footer CTA */}
        <div className="shrink-0 border-t border-gray-100 p-3.5 dark:border-gray-800">
          <button
            type="button"
            onClick={() => onCreateOrder(conversation)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3F1A] py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#e5351a] active:scale-[0.99] cursor-pointer"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>Crear nuevo pedido</span>
          </button>
        </div>
      </div>
    );
  },
);

export default OrderContextPanel;

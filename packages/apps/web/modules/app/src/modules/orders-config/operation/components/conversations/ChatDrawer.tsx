import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Cog6ToothIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type { CatalogProduct } from "../../domain/catalogDomain";
import { STATUS_META } from "../../domain/conversationsDomain";
import { formatCOP, type Order } from "../../domain/order";
import type { ConversationsStore } from "../../stores/ConversationsStore";
import type { OrdersStore } from "../../stores/OrdersStore";
import { ChannelAvatar, WhatsAppIcon } from "./ChannelAvatar";
import { ChatComposer } from "./ChatComposer";
import { ChatPanel } from "./ChatPanel";

export interface ChatDrawerProps {
  open: boolean;
  conversationId?: string | null;
  order?: Order | null;
  store: ConversationsStore;
  ordersStore: OrdersStore;
  catalogProducts: CatalogProduct[];
  businessName: string;
  currentOperatorId: string;
  currentOperatorName: string;
  operators: Array<{ id: string; name: string; email?: string }>;
  onClose: () => void;
  onOpenFullConsole?: (conversationId: string) => void;
  onOpenOrderDetail?: (order: Order) => void;
  onOpenConfig?: () => void;
}

const MIN_WIDTH = 340;
const MAX_WIDTH = 960;
const DEFAULT_WIDTH = 448;

const STATUS_BADGE_CLASSES: Record<"blue" | "amber" | "green" | "gray", string> =
  {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    amber:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    green:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
    gray: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  };

export const ChatDrawer = observer(
  ({
    open,
    conversationId = null,
    order = null,
    store,
    ordersStore,
    catalogProducts,
    businessName,
    currentOperatorId,
    currentOperatorName,
    operators,
    onClose,
    onOpenFullConsole,
    onOpenOrderDetail,
    onOpenConfig,
  }: ChatDrawerProps) => {
    const [visible, setVisible] = useState(false);
    const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
    const [dragging, setDragging] = useState(false);

    // Close on Escape only when no top <dialog open> modal is active
    useEffect(() => {
      if (!open) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (document.querySelector("dialog[open]")) return;
          onClose();
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    // Slide-in animation frame trigger
    useEffect(() => {
      if (!open) {
        setVisible(false);
        return;
      }
      const rafId = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(rafId);
    }, [open]);

    // Drag resize on window
    useEffect(() => {
      if (!dragging) return;
      const handleMove = (e: PointerEvent) => {
        if (window.innerWidth < MIN_WIDTH) return;
        const next = window.innerWidth - e.clientX;
        const maxAllowed = Math.min(MAX_WIDTH, window.innerWidth - 24);
        setWidth(Math.min(maxAllowed, Math.max(MIN_WIDTH, next)));
      };
      const handleUp = () => setDragging(false);

      const prevCursor = document.body.style.cursor;
      const prevSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleUp);

      return () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleUp);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevSelect;
      };
    }, [dragging]);

    // Clamp width on viewport resize
    useEffect(() => {
      const handleResize = () => {
        const cap = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth));
        setWidth((prev) => Math.min(prev, cap));
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Reset width when drawer closes
    useEffect(() => {
      if (!open) {
        setWidth(DEFAULT_WIDTH);
      }
    }, [open]);

    if (!open) return null;

    const conversation = conversationId
      ? store.byId(conversationId)
      : order
        ? store.byPhone(order.customerPhone)
        : undefined;

    const displayName =
      conversation?.contact.name ?? order?.customerName ?? "Contacto";
    const displayPhone =
      conversation?.contact.phone ?? order?.customerPhone ?? "";
    const statusMeta = conversation ? STATUS_META[conversation.status] : null;

    const handleOpenFullConsole = () => {
      if (conversation) {
        store.select(conversation.id);
        onOpenFullConsole?.(conversation.id);
      }
      onClose();
    };

    const handleStartWhatsAppConversation = () => {
      if (!order) return;
      const firstName = order.customerName.trim().split(/\s+/)[0] || "cliente";
      const greeting = `Hola ${firstName}, te escribimos desde ${businessName || "nuestro equipo"} respecto a tu pedido ${order.code} por ${formatCOP(order.total)}. ¿En qué podemos ayudarte?`;
      const created = store.sendOrderReceiptToChat(
        order.customerPhone,
        order,
        greeting,
        currentOperatorId,
        currentOperatorName,
      );
      store.select(created.id);
    };

    return (
      <div
        className="fixed inset-0 z-[9999] flex justify-end"
        style={{ pointerEvents: "none" }}
        role="dialog"
        aria-modal="false"
        aria-label={`Chat rápido con ${displayName}`}
      >
        {/* Decorative non-blocking scrim so Kanban drag-and-drop stays active */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-gray-900/15 transition-opacity duration-300 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Slide-over panel */}
        <aside
          className={`relative flex h-full max-w-full flex-col border-l border-gray-200 bg-white font-sans text-gray-800 shadow-2xl transition-transform duration-300 ease-out dark:border-gray-800 dark:bg-gray-900 dark:text-white/90 ${
            visible ? "translate-x-0" : "translate-x-full"
          }`}
          style={{
            pointerEvents: "auto",
            width: `min(100vw, ${width}px)`,
            transitionProperty: "transform",
            cursor: dragging ? "col-resize" : undefined,
          }}
        >
          {/* Left-edge drag resize handle */}
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
            role="separator"
            aria-orientation="vertical"
            aria-label="Arrastra para cambiar el ancho del panel"
            title="Arrastra para cambiar el ancho · doble clic para restablecer"
            className={`absolute top-1/2 -left-3.5 z-20 hidden h-10 w-7 -translate-y-1/2 cursor-col-resize items-center justify-center rounded-md bg-[#FF3F1A] text-white shadow-md transition-transform hover:scale-105 hover:bg-[#e5351a] sm:flex ${
              dragging ? "scale-105" : ""
            }`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 13 13"
              fill="currentColor"
              aria-hidden="true"
              className="opacity-90"
            >
              <circle cx="2.5" cy="2.5" r="1.25" />
              <circle cx="6.5" cy="2.5" r="1.25" />
              <circle cx="10.5" cy="2.5" r="1.25" />
              <circle cx="2.5" cy="6.5" r="1.25" />
              <circle cx="6.5" cy="6.5" r="1.25" />
              <circle cx="10.5" cy="6.5" r="1.25" />
              <circle cx="2.5" cy="10.5" r="1.25" />
              <circle cx="6.5" cy="10.5" r="1.25" />
              <circle cx="10.5" cy="10.5" r="1.25" />
            </svg>
          </div>

          {/* Drawer Header */}
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <div className="flex min-w-0 items-center gap-2.5">
              <ChannelAvatar
                name={displayName}
                channel={conversation?.channel ?? "whatsapp"}
                avatarColor={conversation?.contact.avatarColor}
                size="md"
                online={
                  conversation
                    ? conversation.status === "open" ||
                      conversation.status === "attended"
                    : false
                }
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                    {displayName}
                  </h2>
                  {order && (
                    <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                      #{order.code}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {displayPhone}
                  </p>
                  {statusMeta && (
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_CLASSES[statusMeta.tone]}`}
                    >
                      {statusMeta.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {conversation && onOpenFullConsole && (
                <button
                  type="button"
                  onClick={handleOpenFullConsole}
                  title="Abrir esta conversación en la consola completa"
                  aria-label="Abrir en consola completa"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#FF3F1A] transition-colors hover:bg-[#FF3F1A]/10 dark:text-[#FF7A59] cursor-pointer"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h6v6" />
                    <path d="M10 14 21 3" />
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  </svg>
                  <span className="hidden sm:inline">Consola completa</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                title="Cerrar panel (Esc)"
                aria-label="Cerrar panel"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white cursor-pointer"
              >
                <svg
                  width="16"
                  height="16"
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
            </div>
          </header>

          {/* Drawer Body */}
          {conversation ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ChatPanel
                conversationId={conversation.id}
                store={store}
                ordersStore={ordersStore}
                businessName={businessName}
                currentOperatorId={currentOperatorId}
                currentOperatorName={currentOperatorName}
                operators={operators}
                hideHeader
                onOpenOrderDetail={onOpenOrderDetail}
              />
              <ChatComposer
                conversation={conversation}
                store={store}
                ordersStore={ordersStore}
                catalogProducts={catalogProducts}
                currentOperatorId={currentOperatorId}
                currentOperatorName={currentOperatorName}
                onOpenConfig={onOpenConfig}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              {!store.channelConfig.whatsappConnected && (
                <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/90 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>Canales desconectados · Modo solo lectura</span>
                  </div>
                  {onOpenConfig && (
                    <button
                      type="button"
                      onClick={onOpenConfig}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-amber-400/70 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-900/50 dark:text-amber-100"
                    >
                      <Cog6ToothIcon className="h-3.5 w-3.5" />
                      <span>Configurar</span>
                    </button>
                  )}
                </div>
              )}
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <WhatsAppIcon className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Sin conversación activa
              </h3>
              <p className="max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {displayName} todavía no tiene un hilo de WhatsApp registrado en
                la consola.
              </p>

              {order && (
                <button
                  type="button"
                  disabled={!store.channelConfig.whatsappConnected}
                  onClick={handleStartWhatsAppConversation}
                  className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#1ebe5b] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span>Iniciar conversación por WhatsApp</span>
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    );
  },
);

export default ChatDrawer;

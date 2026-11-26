import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { NectoLogo } from "@/brand/NectoLogo";
import { AiIcon, PanelToggleIcon } from "@/icons";
import {
  formatHour,
  formatRelativeTime,
  getInitials,
  phonesMatch,
  type Conversation,
  type ConversationMessage,
  type MessageTraceability,
} from "../../domain/conversationsDomain";
import {
  formatCOP,
  MODALITY_LABELS,
  STAGE_COLORS,
  STAGE_LABELS,
  type Order,
} from "../../domain/order";
import type { ConversationsStore } from "../../stores/ConversationsStore";
import type { OrdersStore } from "../../stores/OrdersStore";
import { Modal } from "../Dialog";
import {
  BotIcon,
  ChannelAvatar,
  HeadsetIcon,
  UserPlusIcon,
} from "./ChannelAvatar";
import { FormattedMessageText } from "./FormattedMessageText";

export interface ChatPanelProps {
  conversationId: string | null;
  store: ConversationsStore;
  ordersStore: OrdersStore;
  businessName: string;
  currentOperatorId: string;
  currentOperatorName: string;
  operators: Array<{ id: string; name: string; email?: string }>;
  hideHeader?: boolean;
  inboxOpen?: boolean;
  infoOpen?: boolean;
  activeTab?: "conversation" | "orders";
  onActiveTabChange?: (tab: "conversation" | "orders") => void;
  onToggleInbox?: () => void;
  onToggleInfo?: () => void;
  onCreateOrder?: (conv: Conversation) => void;
  onOpenOrderDetail?: (order: Order) => void;
  onOpenInOrders?: (orderId: string) => void;
}

type ChatViewTab = "conversation" | "orders";

const WHATSAPP_BG_PATTERN = `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C9279' fill-opacity='0.075' fill-rule='evenodd'%3E%3Cpath d='M11 11h6v6h-6zm40 0h6v6h-6zm-20 20h6v6h-6zm-20 20h6v6h-6zm40 0h6v6h-6zm-20 20h6v6h-6zM32 14a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm40 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12 34a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm40 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM32 54a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm40 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12 74a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm40 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'/%3E%3C/g%3E%3C/svg%3E")`;

function getScrollBehavior(): ScrollBehavior {
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return "auto";
  }
  return "smooth";
}

function getFallbackTraceability(msg: ConversationMessage): MessageTraceability {
  if (msg.traceability) return msg.traceability;
  return {
    flow: msg.orderId
      ? "Seguimiento y gestión de pedido"
      : "Asistente conversacional Necto IA",
    moduleTag: msg.orderId ? "Pedidos" : "Bot IA",
    suggestedAction: msg.orderId
      ? "Revisar estado del pedido vinculado"
      : "Continuar atención o escalar a asesor",
    confidence: 0.9,
    ...(msg.orderId ? { orderId: msg.orderId } : {}),
  };
}

// ---------------------------------------------------------------------------
// Empty conversation state (StockFlow ConversacionVacia)
// ---------------------------------------------------------------------------

function EmptyConversationCanvas() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-between overflow-hidden bg-[#FAF9F5] font-sans transition-colors dark:bg-[#0E131F]/90">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none opacity-80 dark:opacity-50"
        style={{
          backgroundImage: WHATSAPP_BG_PATTERN,
          backgroundRepeat: "repeat",
        }}
      />

      <div className="z-10 flex w-full justify-center px-4 pt-4 sm:pt-6">
        <div className="flex items-center justify-center rounded-xl border border-amber-200/90 bg-[#FFF7D6] px-5 py-2 text-center text-xs font-normal text-amber-950 shadow-xs dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          Esta empresa usa un servicio seguro de Meta para administrar este chat
        </div>
      </div>

      <div className="z-10 my-auto flex flex-col items-center justify-center px-4 py-8 text-center">
        <div className="mb-4 flex items-center justify-center [&_path[fill='#190088']]:dark:fill-white">
          <NectoLogo width={186} height={27} />
        </div>
        <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white/90 sm:text-xl">
          ¡Aún no has seleccionado una conversación!
        </h2>
        <p className="mt-1.5 max-w-sm text-xs text-gray-500 dark:text-gray-400">
          Elige un chat de la bandeja izquierda para responder mensajes, revisar
          pedidos o tomar el control del Bot IA.
        </p>
      </div>

      <div className="z-10 pb-4 text-[11px] text-gray-400 dark:text-gray-500">
        Mensajería omnicanal conectada con Pedidos
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Embedded Interactive Order Card (inside Bot / Agent bubbles)
// ---------------------------------------------------------------------------

function EmbeddedOrderCard({
  order,
  onViewOrder,
}: {
  order: Order;
  ordersStore: OrdersStore;
  onViewOrder: () => void;
}) {
  const stageLabel = STAGE_LABELS[order.stage] ?? order.stage;
  const stageColor = STAGE_COLORS[order.stage] ?? "#64748B";

  return (
    <div className="mt-3 w-full rounded-xl border border-white/20 bg-white/95 p-3 text-gray-800 shadow-xs dark:border-gray-700 dark:bg-gray-900/95 dark:text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-bold tabular-nums text-gray-900 dark:text-white">
            #{order.code}
          </span>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: stageColor }}
          >
            {stageLabel}
          </span>
          {order.stage !== "cancelled" && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                order.paid
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
              }`}
            >
              {order.paid ? "Pagado" : "Pendiente"}
            </span>
          )}
        </div>
        <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-white">
          {formatCOP(order.total)}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-gray-100 pt-2 dark:border-gray-800">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {order.items.length}{" "}
          {order.items.length === 1 ? "artículo" : "artículos"}
        </span>
        <button
          type="button"
          onClick={onViewOrder}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#FF3F1A] transition-colors hover:text-[#d93212] dark:text-[#FF7A59] cursor-pointer"
        >
          <span>Ver pedido</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assignment Dropdown (SelectorAsignacion)
// ---------------------------------------------------------------------------

function AssignmentDropdown({
  conversation,
  store,
  currentOperatorId,
  currentOperatorName,
  operators,
}: {
  conversation: Conversation;
  store: ConversationsStore;
  currentOperatorId: string;
  currentOperatorName: string;
  operators: Array<{ id: string; name: string; email?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const operatorList = (() => {
    const map = new Map<string, { id: string; name: string; email?: string }>();
    if (currentOperatorId) {
      map.set(currentOperatorId, {
        id: currentOperatorId,
        name: currentOperatorName || "Operador actual",
      });
    }
    for (const op of operators) {
      map.set(op.id, op);
    }
    return Array.from(map.values());
  })();

  const isHumanAssigned = Boolean(
    conversation.assignedOperatorId && conversation.attentionMode === "human",
  );

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold shadow-xs transition-all cursor-pointer ${
          isHumanAssigned
            ? "border-[#97D6DF]/50 bg-[#97D6DF]/20 text-[#190088] hover:bg-[#97D6DF]/30 dark:border-[#190088]/60 dark:bg-[#190088]/40 dark:text-[#97D6DF]"
            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        }`}
        title="Asignar conversación a un operador o al Bot"
        aria-expanded={open}
      >
        {isHumanAssigned ? (
          <HeadsetIcon className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <UserPlusIcon className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
        )}
        <span className="max-w-[130px] truncate">
          {isHumanAssigned
            ? conversation.assignedOperatorName || "Asignado"
            : "Asignar conversación"}
        </span>
        <svg
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-72 origin-top-left rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Asignación de atención
            </p>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                store.assign(conversation.id, null);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                !isHumanAssigned
                  ? "bg-[#97D6DF]/20 font-semibold text-[#190088] dark:bg-[#190088]/40 dark:text-[#97D6DF]"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#97D6DF]/30 text-[#190088] dark:bg-[#190088]/60 dark:text-[#97D6DF]">
                  <BotIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Bot Inteligente
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Atención automática activa
                  </p>
                </div>
              </div>
              {!isHumanAssigned && (
                <span className="text-xs font-bold text-[#FF3F1A]">✓</span>
              )}
            </button>
          </div>

          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

          <div className="px-3 py-1">
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
              Operadores del equipo ({operatorList.length})
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {operatorList.map((op) => {
              const selected =
                isHumanAssigned && conversation.assignedOperatorId === op.id;
              const isMe = op.id === currentOperatorId;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => {
                    store.assign(conversation.id, op.id, op.name);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                    selected
                      ? "bg-[#FF3F1A]/10 font-semibold text-[#FF3F1A] dark:bg-[#FF3F1A]/15 dark:text-[#FF7A59]"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#190088]/10 text-[11px] font-bold text-[#190088] dark:bg-[#97D6DF]/15 dark:text-[#97D6DF]">
                      {getInitials(op.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">
                        {op.name}
                        {isMe ? " (Tú)" : ""}
                      </p>
                      <p className="truncate text-[10px] text-gray-400">
                        {op.email || "Asesor de pedidos"}
                      </p>
                    </div>
                  </div>
                  {selected && (
                    <span className="shrink-0 text-xs font-bold text-[#FF3F1A]">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interaction Options (OpcionesInteraccion)
// ---------------------------------------------------------------------------

function InteractionActions({
  conversation,
  store,
  currentOperatorName,
}: {
  conversation: Conversation;
  store: ConversationsStore;
  currentOperatorName: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const handleCall = () => {
    const cleanPhone = conversation.contact.phone.replace(/[^\d+]/g, "");
    window.open(`tel:${cleanPhone}`, "_self");
  };

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(conversation.contact.phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      setMenuOpen(false);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="flex items-center gap-1" ref={menuRef}>
      {/* Call */}
      <button
        type="button"
        onClick={handleCall}
        title={`Llamar a ${conversation.contact.phone}`}
        aria-label={`Llamar a ${conversation.contact.phone}`}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white cursor-pointer"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </button>

      {/* Star / Favorite */}
      <button
        type="button"
        onClick={() => store.toggleStar(conversation.id)}
        title={
          conversation.starred
            ? "Quitar de destacados"
            : "Marcar conversación como destacada"
        }
        aria-label={
          conversation.starred
            ? "Quitar de destacados"
            : "Marcar conversación como destacada"
        }
        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors cursor-pointer ${
          conversation.starred
            ? "bg-amber-50 text-amber-500 dark:bg-amber-950/40"
            : "text-gray-500 hover:bg-gray-100 hover:text-amber-500 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill={conversation.starred ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>

      {/* 3-dot Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          title="Más opciones de interacción"
          aria-label="Más opciones de interacción"
          aria-expanded={menuOpen}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors cursor-pointer ${
            menuOpen
              ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          }`}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <button
              type="button"
              onClick={handleCopyPhone}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
            >
              <svg
                className="h-3.5 w-3.5 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>
                {copied ? "¡Teléfono copiado!" : "Copiar número de WhatsApp"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                store.markUnread(conversation.id);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
            >
              <svg
                className="h-3.5 w-3.5 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span>Marcar como no leído</span>
            </button>

            <button
              type="button"
              onClick={() => {
                store.returnToBot(conversation.id);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-[#190088] transition-colors hover:bg-[#190088]/5 dark:text-[#97D6DF] dark:hover:bg-[#190088]/30 cursor-pointer"
            >
              <BotIcon className="h-3.5 w-3.5" />
              <span>Reactivar Bot en este chat</span>
            </button>

            <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

            {conversation.status === "closed" ? (
              <button
                type="button"
                onClick={() => {
                  store.reopenConversation(conversation.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30 cursor-pointer"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span>Reabrir conversación</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  store.closeConversation(conversation.id, currentOperatorName);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span>Cerrar conversación</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ChatPanel Component
// ---------------------------------------------------------------------------

export const ChatPanel = observer(
  ({
    conversationId,
    store,
    ordersStore,
    businessName,
    currentOperatorId,
    currentOperatorName,
    operators,
    hideHeader = false,
    inboxOpen = true,
    infoOpen = false,
    activeTab: controlledTab,
    onActiveTabChange,
    onToggleInbox,
    onToggleInfo,
    onCreateOrder,
    onOpenOrderDetail,
    onOpenInOrders,
  }: ChatPanelProps) => {
    const [internalTab, setInternalTab] = useState<ChatViewTab>("conversation");
    const activeTab = controlledTab ?? internalTab;
    const setActiveTab = (next: ChatViewTab) => {
      setInternalTab(next);
      onActiveTabChange?.(next);
    };
    const [messageLimit, setMessageLimit] = useState(25);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [selectedTrace, setSelectedTrace] = useState<{
      message: ConversationMessage;
      traceability: MessageTraceability;
    } | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const conversation = conversationId ? store.byId(conversationId) : undefined;
    const timeline = conversation ? store.timelineOf(conversation.id) : [];

    // Reset tab and pagination when switching conversations
    useEffect(() => {
      setActiveTab("conversation");
      setMessageLimit(25);
      setShowScrollBottom(false);
      setSelectedTrace(null);
    }, [conversationId]);

    // Auto-scroll to bottom on new message or conversation change
    useEffect(() => {
      if (activeTab !== "conversation") return;
      messagesEndRef.current?.scrollIntoView({ behavior: getScrollBehavior() });
    }, [conversationId, timeline.length, activeTab]);

    if (!conversation) {
      return <EmptyConversationCanvas />;
    }

    const contactOrders = ordersStore.orders
      .filter(
        (order) =>
          phonesMatch(order.customerPhone, conversation.contact.phone) ||
          conversation.messages.some((msg) => msg.orderId === order.id),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const activeOrder = contactOrders.find(
      (o) => o.stage !== "delivered" && o.stage !== "cancelled",
    );

    const visibleItems = timeline.slice(-messageLimit);
    const hiddenCount = Math.max(0, timeline.length - messageLimit);

    const handleScroll = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBottom(distanceFromBottom > 150);
    };

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: getScrollBehavior() });
    };

    const resolveStageLabel = (stage: string): string => {
      const col = ordersStore.columns.find((c) => c.id === stage);
      return col?.label ?? STAGE_LABELS[stage] ?? stage;
    };

    const resolveStageColor = (stage: string): string => {
      const col = ordersStore.columns.find((c) => c.id === stage);
      return col?.color ?? STAGE_COLORS[stage] ?? "#64748B";
    };

    const handleConfirmOrderPayment = (order: Order) => {
      if (order.paid) return;
      ordersStore.togglePaid(order.id, currentOperatorName);
      store.notifyOrderEvent(order, "paid", businessName);
    };

    const traceLinkedOrder = selectedTrace?.traceability.orderId
      ? ordersStore.byId(selectedTrace.traceability.orderId) ??
        ordersStore.byCode(selectedTrace.traceability.orderId)
      : undefined;

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white font-sans text-gray-800 dark:bg-gray-900 dark:text-white/90">
        {/* Sticky Header (hidden inside ChatDrawer) */}
        {!hideHeader && (
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              {onToggleInbox && (
                <button
                  type="button"
                  onClick={onToggleInbox}
                  title={
                    inboxOpen
                      ? "Ocultar panel de chats"
                      : "Mostrar panel de chats"
                  }
                  aria-label={
                    inboxOpen
                      ? "Ocultar panel de chats"
                      : "Mostrar panel de chats"
                  }
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                    inboxOpen
                      ? "border-[#190088]/30 bg-[#190088]/10 text-[#190088] dark:border-[#97D6DF]/30 dark:bg-[#97D6DF]/15 dark:text-[#97D6DF]"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  <PanelToggleIcon filled={inboxOpen} size={18} />
                </button>
              )}

              <ChannelAvatar
                name={conversation.contact.name}
                channel={conversation.channel}
                avatarColor={conversation.contact.avatarColor}
                size="lg"
                online={
                  conversation.status === "open" ||
                  conversation.status === "attended"
                }
              />

              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                  {conversation.contact.name}
                </h4>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {activeOrder ? `#${activeOrder.code} · ` : ""}
                  {conversation.contact.phone}
                </span>
              </div>

              <div className="ml-1 hidden md:block">
                <AssignmentDropdown
                  conversation={conversation}
                  store={store}
                  currentOperatorId={currentOperatorId}
                  currentOperatorName={currentOperatorName}
                  operators={operators}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <div className="md:hidden">
                <AssignmentDropdown
                  conversation={conversation}
                  store={store}
                  currentOperatorId={currentOperatorId}
                  currentOperatorName={currentOperatorName}
                  operators={operators}
                />
              </div>

              <InteractionActions
                conversation={conversation}
                store={store}
                currentOperatorName={currentOperatorName}
              />

              {onCreateOrder && (
                <button
                  type="button"
                  onClick={() => onCreateOrder(conversation)}
                  title="Crear un nuevo pedido para este contacto"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#FF3F1A] px-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#e5351a] active:scale-95 cursor-pointer"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className="hidden lg:inline">Crear pedido</span>
                </button>
              )}

              {onToggleInfo && (
                <button
                  type="button"
                  onClick={onToggleInfo}
                  title={
                    infoOpen
                      ? "Ocultar panel de información"
                      : "Mostrar panel de información"
                  }
                  aria-label={
                    infoOpen
                      ? "Ocultar panel de información"
                      : "Mostrar panel de información"
                  }
                  className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                    infoOpen
                      ? "border-[#190088] bg-[#190088]/10 text-[#190088] dark:border-[#97D6DF]/40 dark:bg-[#97D6DF]/15 dark:text-[#97D6DF]"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <PanelToggleIcon filled={infoOpen} size={15} />
                  <span className="hidden xl:inline">Info</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Context Tabs: Conversación | Historial de pedidos */}
        <div
          role="tablist"
          aria-label="Vistas de la conversación"
          className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-gray-200 px-3 py-2 dark:border-gray-800 sm:px-5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "conversation"}
            onClick={() => setActiveTab("conversation")}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors cursor-pointer ${
              activeTab === "conversation"
                ? "bg-[#FF3F1A] font-semibold text-white shadow-xs"
                : "font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            Conversación
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "orders"}
            onClick={() => setActiveTab("orders")}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors cursor-pointer ${
              activeTab === "orders"
                ? "bg-[#FF3F1A] font-semibold text-white shadow-xs"
                : "font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            <span>Historial de pedidos</span>
            {contactOrders.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  activeTab === "orders"
                    ? "bg-white text-[#FF3F1A]"
                    : "bg-gray-200/80 text-gray-700 dark:bg-white/10 dark:text-gray-300"
                }`}
              >
                {contactOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Body: Conversation vs Orders History */}
        {activeTab === "conversation" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Bot / Human / Closed Status Banner */}
            {conversation.status === "closed" ? (
              <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2 border-b border-gray-200 bg-gray-100 px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-800/80 dark:text-gray-300">
                <span>Conversación resuelta</span>
                <button
                  type="button"
                  onClick={() => store.reopenConversation(conversation.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#190088] px-2.5 py-0.5 text-[11px] font-bold text-white transition-colors hover:bg-[#190088]/90 cursor-pointer"
                >
                  Reabrir
                </button>
              </div>
            ) : conversation.attentionMode === "bot" ? (
              <div
                className={`flex w-full shrink-0 flex-wrap items-center justify-center gap-2 border-b px-4 py-2 text-center text-xs font-semibold ${
                  store.channelConfig.masterAutoReply
                    ? "border-[#97D6DF]/40 bg-[#97D6DF]/20 text-[#190088] dark:border-[#190088]/60 dark:bg-[#190088]/30 dark:text-[#97D6DF]"
                    : "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200"
                }`}
              >
                <BotIcon className="h-4 w-4 shrink-0" />
                <span>
                  {store.channelConfig.masterAutoReply
                    ? "El bot está activo · Responde automáticamente"
                    : "Bot pausado globalmente · Respuestas automáticas desactivadas"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    store.takeOver(
                      conversation.id,
                      currentOperatorId,
                      currentOperatorName,
                    )
                  }
                  className="ml-1 inline-flex cursor-pointer items-center gap-1 rounded-full bg-[#FF3F1A] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs transition-colors hover:bg-[#e5351a]"
                >
                  <HeadsetIcon className="h-3 w-3" />
                  <span>Tomar conversación</span>
                </button>
              </div>
            ) : (
              <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2 border-b border-amber-200 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                <HeadsetIcon className="h-4 w-4 shrink-0 text-amber-800 dark:text-amber-300" />
                <span>
                  Atendido por{" "}
                  {conversation.assignedOperatorName || "un asesor humano"} ·{" "}
                  <span className="font-normal opacity-85">Bot pausado</span>
                </span>
                <button
                  type="button"
                  onClick={() => store.returnToBot(conversation.id)}
                  className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#FF3F1A] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs transition-colors hover:bg-[#e5351a] cursor-pointer"
                >
                  <span>Reactivar bot</span>
                  <BotIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Message Canvas */}
            <div
              role="tabpanel"
              aria-label="Conversación"
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{
                backgroundImage: WHATSAPP_BG_PATTERN,
                backgroundRepeat: "repeat",
              }}
              className="conv-chat-canvas relative flex-1 space-y-5 overflow-y-auto bg-[#efeae2]/50 px-4 py-5 dark:bg-[#0b141a] sm:px-6 sm:py-6"
            >
              {hiddenCount > 0 && (
                <div className="flex justify-center py-1">
                  <button
                    type="button"
                    onClick={() => setMessageLimit((prev) => prev + 25)}
                    className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 shadow-xs transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    ↑ Cargar {hiddenCount} mensajes anteriores
                  </button>
                </div>
              )}

              {timeline.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="rounded-full bg-gray-200/80 px-4 py-1.5 text-center text-xs text-gray-500 dark:bg-white/10 dark:text-gray-400">
                    Esta conversación aún no tiene mensajes.
                  </p>
                </div>
              ) : (
                visibleItems.map((item) => {
                  // 1. System Event
                  if (item.kind === "event") {
                    return (
                      <div key={item.id} className="my-2 flex justify-center">
                        <span
                          className="rounded-full bg-gray-200/80 px-3 py-1 text-center text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300"
                          title={formatHour(item.createdAt)}
                        >
                          • {item.text} · {formatHour(item.createdAt)}
                        </span>
                      </div>
                    );
                  }

                  // 2. Customer message (left, dark slate #1e293b)
                  if (item.author === "customer") {
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-2.5 sm:gap-3"
                      >
                        <div className="shrink-0">
                          <ChannelAvatar
                            name={conversation.contact.name}
                            channel={conversation.channel}
                            avatarColor={conversation.contact.avatarColor}
                            size="sm"
                          />
                        </div>
                        <div className="flex max-w-[84%] flex-col items-start sm:max-w-lg lg:max-w-xl">
                          <div className="w-fit max-w-full rounded-2xl rounded-tl-xs bg-[#1e293b] px-4 py-3 text-sm leading-relaxed text-white shadow-xs">
                            <p className="mb-1 text-xs font-semibold text-blue-400">
                              {item.authorName || conversation.contact.name}
                            </p>
                            <FormattedMessageText text={item.text} inverted />
                          </div>
                          <div className="mt-1 pl-1 text-[11px] text-gray-400 dark:text-gray-500">
                            {formatHour(item.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 3. Internal Team Note (centered amber card)
                  if (item.isInternalNote) {
                    return (
                      <div key={item.id} className="my-2 flex justify-center">
                        <div className="w-full max-w-xl rounded-xl border border-amber-300/80 bg-amber-50/95 p-3.5 shadow-xs dark:border-amber-500/30 dark:bg-amber-950/30">
                          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-1 text-xs dark:border-amber-500/20">
                            <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
                              <svg
                                className="h-3.5 w-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect
                                  x="3"
                                  y="11"
                                  width="18"
                                  height="11"
                                  rx="2"
                                  ry="2"
                                />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                              <span>Nota interna del equipo</span>
                              {item.authorName && (
                                <span className="font-normal text-amber-800/80 dark:text-amber-300/80">
                                  · {item.authorName}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-normal text-amber-700/85 dark:text-amber-400/85">
                              Solo visible para operadores ·{" "}
                              {formatHour(item.createdAt)}
                            </span>
                          </div>
                          <div className="text-sm leading-relaxed text-amber-950 dark:text-amber-100">
                            <FormattedMessageText text={item.text} />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 4. Bot IA message (right, deep navy #190088)
                  if (item.author === "bot") {
                    const traceability = getFallbackTraceability(item);
                    const linkedOrder = item.orderId
                      ? ordersStore.byId(item.orderId) ??
                        ordersStore.byCode(item.orderId)
                      : undefined;

                    return (
                      <div
                        key={item.id}
                        className="flex items-start justify-end gap-2.5 sm:gap-3"
                      >
                        <div className="flex max-w-[82%] flex-col items-end sm:max-w-lg lg:max-w-xl">
                          <div className="w-fit min-w-0 max-w-full rounded-2xl rounded-tr-xs bg-[#190088] px-4 py-3 text-sm leading-relaxed text-white shadow-xs">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[#97D6DF]/30 pb-1.5 text-white/95">
                              <div className="flex shrink-0 items-center gap-1.5">
                                <span
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-white/20 text-white"
                                  title="Respuesta automática del Bot IA"
                                >
                                  <BotIcon className="h-3.5 w-3.5" />
                                </span>
                                <span className="text-xs font-semibold">
                                  Chatbot Necto
                                </span>
                                <span className="inline-flex items-center rounded-full border border-white/30 bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                  BOT · IA
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedTrace({
                                    message: item,
                                    traceability,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-white/85 transition-colors hover:bg-white/20 hover:text-white cursor-pointer"
                                title="Inspeccionar trazabilidad técnica IA"
                              >
                                <AiIcon className="h-3 w-3" />
                                <span>Trazabilidad</span>
                              </button>
                            </div>

                            <FormattedMessageText text={item.text} inverted />

                            {linkedOrder && (
                              <EmbeddedOrderCard
                                order={linkedOrder}
                                ordersStore={ordersStore}
                                onViewOrder={() => {
                                  if (onOpenOrderDetail) {
                                    onOpenOrderDetail(linkedOrder);
                                  } else {
                                    setActiveTab("orders");
                                  }
                                }}
                              />
                            )}

                            <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-white/80">
                              <span
                                className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px]"
                                title={item.wamid || "Identificador WhatsApp API"}
                              >
                                wamid
                              </span>
                              <span>{formatHour(item.createdAt)}</span>
                            </div>
                          </div>

                          <div className="mt-1 flex items-center justify-end gap-1 pr-1 text-[11px] text-gray-400 dark:text-gray-500">
                            <svg
                              className="h-3.5 w-3.5 opacity-80"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span className="font-medium">Visto</span>
                          </div>
                        </div>

                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#190088] text-white shadow-xs ring-2 ring-white dark:ring-gray-900"
                          title="Bot Inteligente Necto"
                        >
                          <BotIcon className="h-4 w-4" />
                        </div>
                      </div>
                    );
                  }

                  // 5. Human Operator message (right, orange brand #FF3F1A)
                  const agentOrder = item.orderId
                    ? ordersStore.byId(item.orderId) ??
                      ordersStore.byCode(item.orderId)
                    : undefined;

                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-end gap-2.5 sm:gap-3"
                    >
                      <div className="flex max-w-[82%] flex-col items-end sm:max-w-lg lg:max-w-xl">
                        <div className="w-fit max-w-full rounded-2xl rounded-tr-xs bg-[#FF3F1A] px-4 py-3 text-left text-sm leading-relaxed text-white shadow-xs">
                          <div className="mb-2 flex items-center justify-between gap-3 border-b border-white/25 pb-1.5 text-xs font-semibold text-white">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-white/20 text-white"
                                title="Atendido por un operador humano"
                              >
                                <HeadsetIcon className="h-3.5 w-3.5" />
                              </span>
                              <span>{item.authorName || "Operador"}</span>
                            </div>
                            <span className="inline-flex items-center rounded-full border border-white/30 bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                              HUMANO
                            </span>
                          </div>

                          <FormattedMessageText text={item.text} inverted />

                          {agentOrder && (
                            <EmbeddedOrderCard
                              order={agentOrder}
                              ordersStore={ordersStore}
                              onViewOrder={() => {
                                if (onOpenOrderDetail) {
                                  onOpenOrderDetail(agentOrder);
                                } else {
                                  setActiveTab("orders");
                                }
                              }}
                            />
                          )}
                        </div>
                        <p className="mt-1 pr-1 text-right text-[11px] text-gray-400 dark:text-gray-500">
                          {formatHour(item.createdAt)}
                        </p>
                      </div>

                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF3F1A] text-white shadow-xs ring-2 ring-white dark:ring-gray-900"
                        title={item.authorName || "Operador"}
                      >
                        <HeadsetIcon className="h-4 w-4" />
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={messagesEndRef} />

              {/* Floating Scroll-to-Bottom Pill */}
              {showScrollBottom && (
                <div className="pointer-events-none sticky bottom-12 z-20 flex justify-center">
                  <button
                    type="button"
                    onClick={scrollToBottom}
                    className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[#FF3F1A] px-4 py-1.5 text-xs font-semibold text-white shadow-lg transition-all hover:scale-105 hover:bg-[#e5351a] active:scale-95 cursor-pointer"
                  >
                    ↓ Nuevos mensajes
                  </button>
                </div>
              )}

              {/* Floating Bottom-Right "Detalle del Pedido" button */}
              {!hideHeader && onToggleInfo && (
                <div className="pointer-events-none sticky bottom-1 z-10 flex justify-end pr-1">
                  <button
                    type="button"
                    onClick={onToggleInfo}
                    title={
                      infoOpen
                        ? "Ocultar detalle del pedido"
                        : "Ver detalle del pedido"
                    }
                    className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur-xs transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-95 dark:border-gray-700/80 dark:bg-gray-800/95 dark:text-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-500 dark:text-gray-400"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span>Detalle del Pedido</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Context Tab: Historial de pedidos */
          <div
            role="tabpanel"
            aria-label="Historial de pedidos"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  Pedidos de {conversation.contact.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {contactOrders.length === 0
                    ? "Sin pedidos registrados"
                    : `${contactOrders.length} ${contactOrders.length === 1 ? "pedido" : "pedidos"} · el más reciente primero`}
                </p>
              </div>

              {onCreateOrder && (
                <button
                  type="button"
                  onClick={() => onCreateOrder(conversation)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF3F1A] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#e5351a] cursor-pointer"
                >
                  <span>+ Crear pedido</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {contactOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {conversation.contact.name} todavía no tiene pedidos asociados
                  a este número ({conversation.contact.phone}).
                </div>
              ) : (
                <ul className="space-y-3">
                  {contactOrders.map((order) => {
                    const isCancelled = order.stage === "cancelled";
                    const isTerminal =
                      order.stage === "cancelled" ||
                      order.stage === "delivered";
                    const needsPayment = !order.paid && !isTerminal;

                    return (
                      <li
                        key={order.id}
                        className={`rounded-xl border p-3.5 transition-all ${
                          isCancelled
                            ? "border-gray-200/70 bg-gray-50/50 opacity-70 dark:border-gray-800/50 dark:bg-white/[0.01]"
                            : "border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900/70"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                              #{order.code}
                            </span>

                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                              style={{
                                backgroundColor: resolveStageColor(order.stage),
                              }}
                            >
                              {resolveStageLabel(order.stage)}
                            </span>

                            {!isCancelled && (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  order.paid
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                                }`}
                              >
                                {order.paid ? "Pagado" : "Sin pagar"}
                              </span>
                            )}

                            {order.urgent && !isTerminal && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300">
                                Urgente
                              </span>
                            )}
                          </div>

                          <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                            {formatCOP(order.total)}
                          </span>
                        </div>

                        <p className="mt-2 truncate text-xs text-gray-600 dark:text-gray-300">
                          {order.items
                            .map((it) => `${it.quantity}× ${it.name}`)
                            .join(", ")}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5 dark:border-gray-800">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500">
                            <span>{MODALITY_LABELS[order.modality]}</span>
                            <span>·</span>
                            <span>
                              {order.channel === "whatsapp"
                                ? "Entró por WhatsApp"
                                : "Creado por operador"}
                            </span>
                            <span>·</span>
                            <span>{formatRelativeTime(order.createdAt)}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {needsPayment && (
                              <button
                                type="button"
                                onClick={() => handleConfirmOrderPayment(order)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white cursor-pointer"
                              >
                                <span>✓ Confirmar pago</span>
                              </button>
                            )}

                            {onOpenOrderDetail && (
                              <button
                                type="button"
                                onClick={() => onOpenOrderDetail(order)}
                                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                              >
                                Ver detalle
                              </button>
                            )}

                            {onOpenInOrders && (
                              <button
                                type="button"
                                onClick={() => onOpenInOrders(order.id)}
                                className="rounded-lg border border-[#190088]/25 bg-[#190088]/5 px-2.5 py-1 text-[11px] font-semibold text-[#190088] transition-colors hover:bg-[#190088] hover:text-white dark:border-[#97D6DF]/30 dark:bg-[#97D6DF]/10 dark:text-[#97D6DF] dark:hover:bg-[#97D6DF] dark:hover:text-gray-900 cursor-pointer"
                              >
                                Abrir en Pedidos
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* AI Traceability Modal */}
        <Modal
          isOpen={Boolean(selectedTrace)}
          onClose={() => setSelectedTrace(null)}
          label="Trazabilidad de Inteligencia Artificial"
          className="max-w-md p-6 font-sans"
        >
          {selectedTrace && (
            <div>
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3.5 dark:border-gray-800">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#190088]/10 text-[#190088] dark:bg-[#97D6DF]/15 dark:text-[#97D6DF]">
                  <AiIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Trazabilidad de Inteligencia Artificial
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Chatbot Necto ·{" "}
                    {formatHour(selectedTrace.message.createdAt)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3.5 text-xs">
                <div>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    Flujo de ejecución e intención
                  </span>
                  <p className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 p-2.5 leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {selectedTrace.traceability.flow}
                  </p>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-500 dark:text-gray-400">
                    Módulo de contexto
                  </span>
                  <span className="inline-flex items-center rounded-md border border-[#FF3F1A]/30 bg-[#FF3F1A]/10 px-2 py-0.5 text-xs font-semibold text-[#FF3F1A] dark:text-[#FF7A59]">
                    {selectedTrace.traceability.moduleTag}
                  </span>
                </div>

                <div className="space-y-1.5 py-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Confianza del modelo
                    </span>
                    <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {Math.round(selectedTrace.traceability.confidence * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            Math.round(
                              selectedTrace.traceability.confidence * 100,
                            ),
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 py-1">
                  <span className="shrink-0 text-gray-500 dark:text-gray-400">
                    Acción sugerida
                  </span>
                  <span className="text-right font-semibold text-[#190088] dark:text-[#97D6DF]">
                    {selectedTrace.traceability.suggestedAction}
                  </span>
                </div>

                {traceLinkedOrder && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-500 dark:text-gray-400">
                      Pedido vinculado
                    </span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      #{traceLinkedOrder.code} ·{" "}
                      {formatCOP(traceLinkedOrder.total)}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-gray-100 pt-3.5 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTrace(null);
                    setActiveTab("orders");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF3F1A] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#e5351a] cursor-pointer"
                >
                  <span>Ver historial de pedidos</span>
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTrace(null)}
                  className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  },
);

export default ChatPanel;

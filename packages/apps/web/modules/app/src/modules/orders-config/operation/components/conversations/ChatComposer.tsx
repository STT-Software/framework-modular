import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { observer } from "mobx-react-lite";
import {
  Cog6ToothIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  PaperClipIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AiIcon } from "@/icons";
import type { CatalogProduct } from "../../domain/catalogDomain";
import {
  generateAgentSuggestion,
  phonesMatch,
  type Conversation,
  type QuickTemplate,
} from "../../domain/conversationsDomain";
import type { ConversationsStore } from "../../stores/ConversationsStore";
import type { OrdersStore } from "../../stores/OrdersStore";
import { BotIcon, WhatsAppIcon } from "./ChannelAvatar";

export interface ChatComposerProps {
  conversation: Conversation;
  store: ConversationsStore;
  ordersStore: OrdersStore;
  catalogProducts: CatalogProduct[];
  currentOperatorId: string;
  currentOperatorName: string;
  onOpenConfig?: () => void;
}

type ComposerMode = "client" | "note" | "simulate";

interface PendingAttachment {
  name: string;
  sizeLabel: string;
  isImage: boolean;
  previewUrl?: string;
}

const MAX_LENGTH = 4096;

const QUICK_SIMULATION_PROMPTS: ReadonlyArray<string> = [
  "¿Dónde va mi pedido?",
  "¿Qué productos y precios tienen disponibles?",
  "Ya transferí por Nequi, quiero confirmar mi pago",
  "Necesito hablar con un asesor humano por favor",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ChatComposer = observer(
  ({
    conversation,
    store,
    ordersStore,
    catalogProducts,
    currentOperatorId,
    currentOperatorName,
    onOpenConfig,
  }: ChatComposerProps) => {
    const [text, setText] = useState("");
    const [mode, setMode] = useState<ComposerMode>("client");
    const [suggestingAi, setSuggestingAi] = useState(false);
    const [templatesOpen, setTemplatesOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [attachment, setAttachment] = useState<PendingAttachment | null>(null);

    const templatesRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachmentUrlRef = useRef<string | undefined>(undefined);

    const clearAttachment = () => {
      if (attachmentUrlRef.current) {
        URL.revokeObjectURL(attachmentUrlRef.current);
        attachmentUrlRef.current = undefined;
      }
      setAttachment(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    useEffect(() => {
      setErrorMessage(null);
      setTemplatesOpen(false);
      clearAttachment();
    }, [conversation.id]);

    useEffect(() => {
      return () => {
        if (attachmentUrlRef.current) {
          URL.revokeObjectURL(attachmentUrlRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (!templatesOpen) return;
      const handleOutside = (e: MouseEvent) => {
        if (
          templatesRef.current &&
          !templatesRef.current.contains(e.target as Node)
        ) {
          setTemplatesOpen(false);
        }
      };
      const handleKey = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
        if (e.key === "Escape") setTemplatesOpen(false);
      };
      document.addEventListener("mousedown", handleOutside);
      window.addEventListener("keydown", handleKey);
      return () => {
        document.removeEventListener("mousedown", handleOutside);
        window.removeEventListener("keydown", handleKey);
      };
    }, [templatesOpen]);

    const linkedOrders = ordersStore.orders
      .filter(
        (order) =>
          phonesMatch(order.customerPhone, conversation.contact.phone) ||
          conversation.messages.some((msg) => msg.orderId === order.id),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (conversation.status === "closed") {
      return (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 font-sans text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gray-400" />
            <span>
              Esta conversación está cerrada. Reábrela para enviar nuevos
              mensajes o notas.
            </span>
          </div>
          <button
            type="button"
            onClick={() => store.reopenConversation(conversation.id)}
            className="cursor-pointer rounded-lg bg-[#FF3F1A] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#e5351a]"
          >
            Reabrir conversación
          </button>
        </div>
      );
    }

    const isChannelDisconnected = !store.channelConfig.whatsappConnected;
    const isReadOnlyClientMode = isChannelDisconnected && mode === "client";
    const isBotMode = conversation.attentionMode === "bot";
    const isExceeded = text.length > MAX_LENGTH;
    const isEmpty = text.trim().length === 0 && !attachment;
    const canSend =
      !isEmpty && !isExceeded && !store.sending && !isReadOnlyClientMode;

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (attachmentUrlRef.current) {
        URL.revokeObjectURL(attachmentUrlRef.current);
        attachmentUrlRef.current = undefined;
      }
      const isImage = file.type.startsWith("image/");
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      attachmentUrlRef.current = previewUrl;
      setAttachment({
        name: file.name,
        sizeLabel: formatBytes(file.size),
        isImage,
        previewUrl,
      });
      textareaRef.current?.focus();
    };

    const composeFinalText = (): string => {
      const trimmed = text.trim();
      if (!attachment) return trimmed;
      const prefix = attachment.isImage
        ? `[Imagen adjunta: ${attachment.name} (${attachment.sizeLabel})]`
        : `[Archivo adjunto: ${attachment.name} (${attachment.sizeLabel})]`;
      return trimmed ? `${prefix}\n${trimmed}` : prefix;
    };

    const handleSend = () => {
      if (!canSend) return;
      setErrorMessage(null);
      const payload = composeFinalText();

      if (mode === "note") {
        const result = store.addInternalNote(
          conversation.id,
          payload,
          currentOperatorName,
        );
        if (!result.ok) {
          setErrorMessage(result.error ?? "No se pudo guardar la nota interna.");
          return;
        }
        setText("");
        clearAttachment();
        return;
      }

      if (mode === "simulate") {
        store.sendCustomerMessage(
          conversation.id,
          payload,
          linkedOrders,
          catalogProducts,
        );
        setText("");
        clearAttachment();
        return;
      }

      const result = store.sendAgentMessage(
        conversation.id,
        payload,
        currentOperatorId,
        currentOperatorName,
      );
      if (!result.ok) {
        setErrorMessage(result.error ?? "No se pudo enviar el mensaje.");
        return;
      }
      setText("");
      clearAttachment();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const handleSuggestAi = () => {
      if (isReadOnlyClientMode) return;
      setSuggestingAi(true);
      window.setTimeout(() => {
        const suggestion = generateAgentSuggestion(conversation, linkedOrders);
        setText(suggestion);
        setSuggestingAi(false);
        textareaRef.current?.focus();
      }, 300);
    };

    const handleInsertTemplate = (tpl: QuickTemplate) => {
      if (isReadOnlyClientMode) return;
      setText(tpl.text);
      setTemplatesOpen(false);
      textareaRef.current?.focus();
    };

    const handleSendTemplateNow = (tpl: QuickTemplate) => {
      if (isReadOnlyClientMode) return;
      setTemplatesOpen(false);
      const result = store.sendAgentMessage(
        conversation.id,
        tpl.text,
        currentOperatorId,
        currentOperatorName,
      );
      if (!result.ok) {
        setErrorMessage(result.error ?? "No se pudo enviar la plantilla.");
      }
    };

    const containerTone =
      mode === "note"
        ? "border-amber-300/80 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/20"
        : mode === "simulate"
          ? "border-emerald-300/70 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-950/15"
          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";

    const sendButtonTone =
      mode === "note"
        ? "bg-amber-600 hover:bg-amber-700"
        : mode === "simulate"
          ? "bg-emerald-600 hover:bg-emerald-700"
          : "bg-[#FF3F1A] hover:bg-[#e5351a]";

    return (
      <div
        className={`shrink-0 border-t px-4 py-3 font-sans text-gray-800 transition-colors dark:text-white/90 sm:px-5 ${containerTone}`}
      >
        {/* Disconnected channels read-only banner (StockFlow parity) */}
        {isChannelDisconnected && (
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/90 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Canales desconectados · Modo solo lectura</span>
              <span className="hidden font-normal text-amber-800/80 dark:text-amber-300/80 sm:inline">
                (aún puedes dejar notas internas)
              </span>
            </div>
            {onOpenConfig && (
              <button
                type="button"
                onClick={onOpenConfig}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-amber-400/70 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900"
              >
                <Cog6ToothIcon className="h-3.5 w-3.5" />
                <span>Configurar</span>
              </button>
            )}
          </div>
        )}

        {/* Top row: mode selector pills + hints */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-0.5 text-xs dark:bg-white/5">
            <button
              type="button"
              onClick={() => setMode("client")}
              className={`cursor-pointer rounded-md px-2.5 py-1 font-medium transition-all ${
                mode === "client"
                  ? "bg-white font-semibold text-gray-900 shadow-xs dark:bg-gray-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Mensaje al cliente
            </button>

            <button
              type="button"
              onClick={() => setMode("note")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
                mode === "note"
                  ? "bg-amber-500 font-semibold text-white shadow-xs"
                  : "text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200"
              }`}
            >
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Nota interna (equipo)</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("simulate")}
              title="Envía un mensaje como si fuera el cliente para probar las respuestas del Bot IA"
              className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-all ${
                mode === "simulate"
                  ? "bg-emerald-600 font-semibold text-white shadow-xs"
                  : "text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
              }`}
            >
              <span>Simular cliente</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {isBotMode && mode === "client" && !isReadOnlyClientMode && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#190088] dark:text-[#97D6DF]">
                <BotIcon className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {store.channelConfig.masterAutoReply
                    ? "Bot activo · Al enviar tomarás el chat"
                    : "Bot pausado · Al enviar tomarás el chat"}
                </span>
              </span>
            )}
            {mode === "simulate" && (
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                {isBotMode && store.channelConfig.masterAutoReply
                  ? "Modo prueba · El Bot IA responderá automáticamente"
                  : "Modo prueba · Llegará como mensaje entrante"}
              </span>
            )}
            {(text.length > 3000 || isExceeded) && (
              <span
                className={`text-[11px] font-semibold tabular-nums ${
                  isExceeded
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {text.length} / {MAX_LENGTH}
              </span>
            )}
          </div>
        </div>

        {/* Simulation quick prompts */}
        {mode === "simulate" && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {QUICK_SIMULATION_PROMPTS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() =>
                  store.sendCustomerMessage(
                    conversation.id,
                    sample,
                    linkedOrders,
                    catalogProducts,
                  )
                }
                className="cursor-pointer rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-800 transition-colors hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-gray-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                “{sample}”
              </button>
            ))}
          </div>
        )}

        {/* Attachment preview chip */}
        {attachment && (
          <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800">
            {attachment.isImage && attachment.previewUrl ? (
              <img
                src={attachment.previewUrl}
                alt={attachment.name}
                className="h-8 w-8 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <DocumentIcon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <p className="max-w-[200px] truncate font-semibold text-gray-800 dark:text-gray-100">
                {attachment.name}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {attachment.sizeLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={clearAttachment}
              title="Quitar adjunto"
              aria-label="Quitar adjunto"
              className="ml-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Validation / Error banner */}
        {(isExceeded || errorMessage) && (
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300">
            {isExceeded
              ? `El mensaje supera el límite permitido de ${MAX_LENGTH} caracteres (${text.length}/${MAX_LENGTH}).`
              : errorMessage}
          </div>
        )}

        {/* Hidden file input for attachments */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />

        {/* Composer Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2.5"
        >
          <div
            className={`flex flex-1 items-center gap-2 rounded-2xl border px-3 py-1.5 transition-all ${
              isReadOnlyClientMode
                ? "border-gray-200 bg-gray-100/80 opacity-65 dark:border-gray-800 dark:bg-gray-800/40"
                : "border-gray-200 bg-gray-50/90 focus-within:border-[#FF3F1A] focus-within:ring-2 focus-within:ring-[#FF3F1A]/20 dark:border-gray-700/80 dark:bg-gray-800/80"
            }`}
          >
            <div
              className="shrink-0 text-[#25D366]"
              title="Canal de mensajería activo"
            >
              <WhatsAppIcon className="h-4.5 w-4.5" />
            </div>

            {/* Attachment button */}
            {mode !== "simulate" && (
              <button
                type="button"
                disabled={isReadOnlyClientMode}
                onClick={() => fileInputRef.current?.click()}
                title="Adjuntar imagen o archivo"
                aria-label="Adjuntar imagen o archivo"
                className="shrink-0 cursor-pointer rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <PaperClipIcon className="h-4 w-4" />
              </button>
            )}

            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              disabled={isReadOnlyClientMode}
              onChange={(e) => {
                setText(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                isReadOnlyClientMode
                  ? "Conecta WhatsApp en Configuración para enviar mensajes al cliente..."
                  : mode === "note"
                    ? "Escribe una nota interna para el equipo... (Shift+Enter nueva línea)"
                    : mode === "simulate"
                      ? "Escribe un mensaje como si fueras el cliente..."
                      : attachment
                        ? "Agrega un comentario opcional para el adjunto..."
                        : "Escribe un mensaje... (Enter para enviar, Shift+Enter salto de línea)"
              }
              className="max-h-28 min-h-[34px] w-full resize-none border-0 bg-transparent py-1.5 text-sm font-normal text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed dark:text-white dark:placeholder:text-gray-500"
            />

            {/* Client mode actions: Templates popover + AI Suggestion */}
            {mode === "client" && (
              <div className="flex shrink-0 items-center gap-1">
                {/* Templates Popover */}
                <div className="relative" ref={templatesRef}>
                  <button
                    type="button"
                    disabled={isReadOnlyClientMode}
                    onClick={() => setTemplatesOpen((prev) => !prev)}
                    title="Plantillas rápidas"
                    aria-label="Plantillas rápidas"
                    aria-expanded={templatesOpen}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      templatesOpen
                        ? "bg-[#190088]/10 text-[#190088] dark:bg-[#97D6DF]/15 dark:text-[#97D6DF]"
                        : "text-gray-500 hover:bg-gray-200/70 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className="hidden sm:inline">Plantillas</span>
                  </button>

                  {templatesOpen && !isReadOnlyClientMode && (
                    <div className="absolute bottom-full right-0 z-50 mb-2 w-80 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-800 dark:bg-gray-900">
                      <div className="border-b border-gray-100 px-2.5 pb-2 pt-1 dark:border-gray-800">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Plantillas rápidas
                        </p>
                      </div>
                      <div className="mt-1 max-h-64 space-y-1 overflow-y-auto">
                        {store.channelConfig.templates.map((tpl) => (
                          <div
                            key={tpl.id}
                            className="group rounded-xl border border-transparent p-2 transition-colors hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-700 dark:hover:bg-gray-800/70"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => handleInsertTemplate(tpl)}
                                className="flex-1 cursor-pointer text-left text-xs font-semibold text-gray-900 dark:text-white"
                              >
                                {tpl.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendTemplateNow(tpl)}
                                title="Enviar plantilla inmediatamente"
                                className="cursor-pointer rounded-md bg-[#FF3F1A]/10 px-2 py-0.5 text-[10px] font-bold text-[#FF3F1A] transition-colors hover:bg-[#FF3F1A] hover:text-white"
                              >
                                Enviar
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleInsertTemplate(tpl)}
                              className="mt-1 block w-full cursor-pointer text-left text-[11px] leading-snug text-gray-500 line-clamp-2 dark:text-gray-400"
                            >
                              {tpl.text}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Suggestion button */}
                <button
                  type="button"
                  onClick={handleSuggestAi}
                  disabled={suggestingAi || isReadOnlyClientMode}
                  title="Sugerir respuesta con IA"
                  aria-label="Sugerir respuesta con IA"
                  className={`cursor-pointer rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    suggestingAi
                      ? "animate-pulse bg-[#190088]/15 text-[#190088] dark:bg-[#97D6DF]/20 dark:text-[#97D6DF]"
                      : "text-gray-400 hover:bg-[#190088]/10 hover:text-[#190088] dark:text-gray-400 dark:hover:bg-[#97D6DF]/15 dark:hover:text-[#97D6DF]"
                  }`}
                >
                  <AiIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Circular Send Button */}
          <button
            type="submit"
            disabled={!canSend}
            title={
              mode === "note"
                ? "Guardar nota interna"
                : mode === "simulate"
                  ? "Enviar como cliente"
                  : isReadOnlyClientMode
                    ? "Conecta WhatsApp para enviar mensajes"
                    : "Enviar mensaje"
            }
            aria-label={
              mode === "note"
                ? "Guardar nota interna"
                : mode === "simulate"
                  ? "Enviar como cliente"
                  : "Enviar mensaje"
            }
            aria-busy={store.sending}
            className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-white shadow-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${sendButtonTone}`}
          >
            {store.sending ? (
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            ) : (
              <svg
                className="ml-0.5 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
      </div>
    );
  },
);

export default ChatComposer;

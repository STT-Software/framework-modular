import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BeakerIcon,
  BoltIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  ClockIcon,
  CpuChipIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  FaceSmileIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlusIcon,
  QrCodeIcon,
  SparklesIcon,
  Squares2X2Icon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Alert } from "@/elements/ui/alert";
import { Button } from "@/elements/ui/button";
import { Card } from "@/elements/ui/card";
import { cn } from "@/utils";
import type { CatalogProduct } from "../../domain/catalogDomain";
import {
  DEFAULT_CHANNEL_CONFIG,
  generateLocalBotReply,
  OPENROUTER_MODELS,
  type ChannelConfigState,
  type ChannelFaqItem,
  type Conversation,
  type MessageTraceability,
  type QuickTemplate,
} from "../../domain/conversationsDomain";
import { generateQrSvgDataUrl } from "../../domain/orderBilling";
import type { ConversationsStore } from "../../stores/ConversationsStore";
import type { OrdersStore } from "../../stores/OrdersStore";

export interface ChannelConfigViewProps {
  store: ConversationsStore;
  ordersStore: OrdersStore;
  catalogProducts: CatalogProduct[];
  businessName?: string;
}

type ConfigSectionId =
  | "interruptor"
  | "qr"
  | "modelo"
  | "personalidad"
  | "instrucciones"
  | "servicios"
  | "horario"
  | "conocimiento"
  | "probar";

type ActiveConfigView = "hub" | ConfigSectionId;

interface SectionMeta {
  id: ConfigSectionId;
  label: string;
  shortDescription: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  accentClass: string;
}

const CONFIG_SECTIONS: SectionMeta[] = [
  {
    id: "interruptor",
    label: "Interruptor maestro",
    shortDescription: "Activa o pausa el bot globalmente",
    description: "Control global de respuestas automáticas del asistente IA.",
    icon: BoltIcon,
    accentClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  {
    id: "qr",
    label: "Conexión WhatsApp",
    shortDescription: "Sesión activa, número y código QR",
    description: "Estado de sesión, número vinculado y escaneo de código QR.",
    icon: QrCodeIcon,
    accentClass: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
  },
  {
    id: "modelo",
    label: "Modelo IA",
    shortDescription: "OpenRouter, API Key, temperatura y tokens",
    description: "Selecciona el modelo de lenguaje, credenciales y parámetros de generación.",
    icon: CpuChipIcon,
    accentClass: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400",
  },
  {
    id: "personalidad",
    label: "Personalidad",
    shortDescription: "Nombre, trato, estilo, emojis y bienvenida",
    description: "Define identidad, tono de comunicación y mensaje de bienvenida con vista previa.",
    icon: FaceSmileIcon,
    accentClass: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  },
  {
    id: "instrucciones",
    label: "Instrucciones",
    shortDescription: "Prompt del sistema, handoff y guardrails",
    description: "Instrucciones base, reglas de derivación a humanos y restricciones operativas.",
    icon: DocumentTextIcon,
    accentClass: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  },
  {
    id: "servicios",
    label: "Catálogo y servicios",
    shortDescription: "Cotización automática y notas comerciales",
    description: "Controla cómo el asistente cotiza productos del catálogo y servicios de entrega.",
    icon: BriefcaseIcon,
    accentClass: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
  },
  {
    id: "horario",
    label: "Horario comercial",
    shortDescription: "Días laborables, franja y fuera de horario",
    description: "Días operativos, horario de atención y respuesta automática fuera de horario.",
    icon: ClockIcon,
    accentClass: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
  },
  {
    id: "conocimiento",
    label: "Conocimiento y FAQ",
    shortDescription: "Preguntas frecuentes y políticas del negocio",
    description: "Gestiona preguntas frecuentes estructuradas (FAQ) y notas de referencia para el bot.",
    icon: BookOpenIcon,
    accentClass: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
  },
  {
    id: "probar",
    label: "Probar y plantillas",
    shortDescription: "Sandbox en vivo y plantillas rápidas",
    description: "Prueba el asistente con tu borrador en vivo y edita las plantillas rápidas del chat.",
    icon: BeakerIcon,
    accentClass: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  },
];

const PERSONALITY_CARDS: Array<{
  id: ChannelConfigState["personality"];
  title: string;
  subtitle: string;
}> = [
  {
    id: "friendly",
    title: "Cercano y amigable",
    subtitle: "Cálido, cordial y conversacional para marcas cercanas.",
  },
  {
    id: "professional",
    title: "Profesional y formal",
    subtitle: "Trato respetuoso, estructurado y orientado a confianza.",
  },
  {
    id: "concise",
    title: "Directo y conciso",
    subtitle: "Respuestas breves al grano sin rodeos.",
  },
];

const WEEKDAY_OPTIONS: Array<{ short: string; full: string }> = [
  { short: "Lun", full: "Lunes" },
  { short: "Mar", full: "Martes" },
  { short: "Mié", full: "Miércoles" },
  { short: "Jue", full: "Jueves" },
  { short: "Vie", full: "Viernes" },
  { short: "Sáb", full: "Sábado" },
  { short: "Dom", full: "Domingo" },
];

const TEMPLATE_KEY_TITLES: Record<QuickTemplate["key"], string> = {
  menu: "Menú",
  location: "Ubicación",
  payment: "Pago",
  tracking: "Seguimiento",
};

const QUICK_SANDBOX_PROMPTS = [
  "Hola, quiero ver el menú",
  "¿Dónde está mi pedido?",
  "¿Qué medios de pago aceptan?",
  "Quiero hablar con un asesor",
];

interface SandboxMessage {
  id: string;
  sender: "customer" | "bot";
  text: string;
  time: string;
  traceability?: MessageTraceability;
  requestHuman?: boolean;
}

function cloneConfig(cfg: ChannelConfigState): ChannelConfigState {
  return {
    ...cfg,
    workDays: [...cfg.workDays],
    templates: cfg.templates.map((tpl) => ({ ...tpl })),
    faqs: cfg.faqs.map((faq) => ({ ...faq })),
  };
}

function currentTimeLabel(): string {
  return new Date().toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function maskApiKey(key: string): string {
  const clean = key.trim();
  if (!clean) return "";
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••`;
  return `${clean.slice(0, 6)}••••${clean.slice(-4)}`;
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40",
        checked ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700",
      )}
    >
      <span
        className={cn(
          "inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition-transform",
          checked ? "translate-x-5.5" : "translate-x-1",
        )}
      />
    </button>
  );
}

export const ChannelConfigView = observer(
  ({
    store,
    ordersStore,
    catalogProducts,
    businessName = "Tu tienda",
  }: ChannelConfigViewProps) => {
    const [activeView, setActiveView] = useState<ActiveConfigView>("hub");
    // Initialize draft ONCE on mount — NEVER overwrite unsaved form edits when masterAutoReply / whatsappConnected toggle!
    const [draft, setDraft] = useState<ChannelConfigState>(() =>
      cloneConfig(store.channelConfig),
    );
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // QR refresh nonce so "Actualizar código QR" produces a new scannable SVG
    const [qrNonce, setQrNonce] = useState(1);

    // Model API key visibility
    const [showApiKey, setShowApiKey] = useState(false);

    // FAQ CRUD local editor state
    const [newFaqQuestion, setNewFaqQuestion] = useState("");
    const [newFaqAnswer, setNewFaqAnswer] = useState("");
    const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
    const [editingFaqQuestion, setEditingFaqQuestion] = useState("");
    const [editingFaqAnswer, setEditingFaqAnswer] = useState("");

    // Probar sub-tab: sandbox vs templates
    const [probarSubTab, setProbarSubTab] = useState<"sandbox" | "templates">(
      "sandbox",
    );

    // Sandbox chat state
    const [sandboxInput, setSandboxInput] = useState("");
    const [sandboxMessages, setSandboxMessages] = useState<SandboxMessage[]>(
      () => [
        {
          id: "sb-welcome",
          sender: "bot",
          text: "Hola, soy tu asistente en modo prueba. Escribe un mensaje como si fueras un cliente para verificar mis respuestas y trazabilidad.",
          time: currentTimeLabel(),
        },
      ],
    );
    const sandboxEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      return () => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      };
    }, []);

    useEffect(() => {
      sandboxEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [sandboxMessages]);

    const showSavedToast = (
      message = "Configuración guardada correctamente",
    ) => {
      setToastMessage(message);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    };

    const handleSaveDraft = () => {
      // Preserve live connection/master flags from store while persisting all edited draft fields
      store.updateChannelConfig({
        ...draft,
        masterAutoReply: store.channelConfig.masterAutoReply,
        whatsappConnected: store.channelConfig.whatsappConnected,
      });
      showSavedToast("Configuración guardada correctamente");
    };

    const handleDiscardDraft = () => {
      setDraft(cloneConfig(store.channelConfig));
      setEditingFaqId(null);
      showSavedToast("Cambios descartados");
    };

    // Toggling masterAutoReply or whatsappConnected does NOT overwrite unsaved draft fields
    const handleToggleMaster = () => {
      store.toggleMasterAutoReply();
      showSavedToast(
        store.channelConfig.masterAutoReply
          ? "Asistente IA activado globalmente"
          : "Asistente IA pausado globalmente",
      );
    };

    const handleToggleWhatsappConnection = (connected: boolean) => {
      store.updateChannelConfig({
        whatsappConnected: connected,
        whatsappNumber:
          draft.whatsappNumber.trim() || DEFAULT_CHANNEL_CONFIG.whatsappNumber,
      });
      showSavedToast(
        connected
          ? "WhatsApp conectado correctamente"
          : "Sesión de WhatsApp desconectada",
      );
    };

    const handleReconnectWhatsapp = () => {
      setQrNonce((n) => n + 1);
      store.updateChannelConfig({
        whatsappConnected: true,
        whatsappNumber:
          draft.whatsappNumber.trim() || DEFAULT_CHANNEL_CONFIG.whatsappNumber,
      });
      showSavedToast("Sesión de WhatsApp reconectada");
    };

    const handleRefreshQr = () => {
      setQrNonce((n) => n + 1);
      showSavedToast("Código QR actualizado");
    };

    const toggleWorkDay = (dayFull: string) => {
      setDraft((prev) => {
        const exists = prev.workDays.includes(dayFull);
        return {
          ...prev,
          workDays: exists
            ? prev.workDays.filter((d) => d !== dayFull)
            : [...prev.workDays, dayFull],
        };
      });
    };

    const updateTemplate = (
      key: QuickTemplate["key"],
      patch: Partial<Pick<QuickTemplate, "label" | "text">>,
    ) => {
      setDraft((prev) => ({
        ...prev,
        templates: prev.templates.map((tpl) =>
          tpl.key === key ? { ...tpl, ...patch } : tpl,
        ),
      }));
    };

    const insertWelcomeToken = (token: "{cliente}" | "{empresa}") => {
      setDraft((prev) => ({
        ...prev,
        welcomeMessage: prev.welcomeMessage
          ? `${prev.welcomeMessage.trimEnd()} ${token}`
          : token,
      }));
    };

    // FAQ CRUD handlers
    const handleAddFaq = () => {
      const q = newFaqQuestion.trim();
      const a = newFaqAnswer.trim();
      if (!q || !a) return;
      const item: ChannelFaqItem = {
        id: `faq-${Date.now()}`,
        question: q,
        answer: a,
      };
      setDraft((prev) => ({
        ...prev,
        faqs: [...prev.faqs, item],
      }));
      setNewFaqQuestion("");
      setNewFaqAnswer("");
    };

    const startEditFaq = (faq: ChannelFaqItem) => {
      setEditingFaqId(faq.id);
      setEditingFaqQuestion(faq.question);
      setEditingFaqAnswer(faq.answer);
    };

    const saveEditFaq = () => {
      if (!editingFaqId) return;
      const q = editingFaqQuestion.trim();
      const a = editingFaqAnswer.trim();
      if (!q || !a) return;
      setDraft((prev) => ({
        ...prev,
        faqs: prev.faqs.map((item) =>
          item.id === editingFaqId
            ? { ...item, question: q, answer: a }
            : item,
        ),
      }));
      setEditingFaqId(null);
    };

    const deleteFaq = (id: string) => {
      setDraft((prev) => ({
        ...prev,
        faqs: prev.faqs.filter((item) => item.id !== id),
      }));
      if (editingFaqId === id) setEditingFaqId(null);
    };

    const qrDataUrl = useMemo(
      () =>
        generateQrSvgDataUrl(
          `necto-wa-session:${draft.whatsappNumber.trim() || DEFAULT_CHANNEL_CONFIG.whatsappNumber}:v${qrNonce}`,
        ),
      [draft.whatsappNumber, qrNonce],
    );

    const handleSendSandbox = (overrideText?: string) => {
      const clean = (overrideText ?? sandboxInput).trim();
      if (!clean) return;

      const nowIso = new Date().toISOString();
      const time = currentTimeLabel();

      const sampleOrder = ordersStore.orders[0];
      const sandboxConv: Conversation = {
        id: "conv-sandbox",
        channel: "whatsapp",
        contact: {
          name: sampleOrder?.customerName ?? "Cliente Prueba",
          phone: sampleOrder?.customerPhone ?? "+57 300 000 0000",
          avatarColor: "#0F766E",
        },
        status: "open",
        attentionMode: "bot",
        assignedOperatorId: null,
        assignedOperatorName: null,
        needsAttention: false,
        aiActive: true,
        unreadCount: 0,
        starred: false,
        createdAt: nowIso,
        lastActivityAt: nowIso,
        messages: [],
        events: [],
      };

      const linkedOrders = sampleOrder ? [sampleOrder] : [];
      const botResult = generateLocalBotReply(
        clean,
        sandboxConv,
        linkedOrders,
        catalogProducts,
        draft,
      );

      setSandboxInput("");
      setSandboxMessages((prev) => [
        ...prev,
        {
          id: `sb-u-${Date.now()}`,
          sender: "customer",
          text: clean,
          time,
        },
        {
          id: `sb-b-${Date.now() + 1}`,
          sender: "bot",
          text: botResult.text,
          time: currentTimeLabel(),
          traceability: botResult.traceability,
          requestHuman: botResult.requestHuman,
        },
      ]);
    };

    const welcomePreviewText = (() => {
      const base =
        draft.welcomeMessage.trim() || DEFAULT_CHANNEL_CONFIG.welcomeMessage;
      const replaced = base
        .replace(/\{cliente\}/gi, "Laura")
        .replace(/\{empresa\}/gi, businessName || "Necto");
      return draft.useEmojis ? replaced : replaced.replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();
    })();

    const selectedModelMeta = OPENROUTER_MODELS.find(
      (m) => m.id === draft.modelName,
    );
    const availableCatalogCount = catalogProducts.filter(
      (p) => p.available,
    ).length;

    const currentSectionMeta =
      activeView === "hub"
        ? null
        : CONFIG_SECTIONS.find((s) => s.id === activeView) ?? CONFIG_SECTIONS[0];

    const sectionHasSaveFooter =
      activeView === "modelo" ||
      activeView === "personalidad" ||
      activeView === "instrucciones" ||
      activeView === "servicios" ||
      activeView === "horario" ||
      activeView === "conocimiento" ||
      (activeView === "probar" && probarSubTab === "templates");

    const getHubStatusBadge = (sectionId: ConfigSectionId): { text: string; className: string } => {
      switch (sectionId) {
        case "interruptor":
          return store.channelConfig.masterAutoReply
            ? {
                text: "Activo",
                className:
                  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
              }
            : {
                text: "Pausado",
                className:
                  "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
              };
        case "qr":
          return store.channelConfig.whatsappConnected
            ? {
                text: "Conectado",
                className:
                  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
              }
            : {
                text: "Desconectado",
                className:
                  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
              };
        case "modelo":
          return {
            text: selectedModelMeta?.label ?? draft.modelName,
            className:
              "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
          };
        case "personalidad":
          return {
            text: draft.assistantName || "Asistente",
            className:
              "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
          };
        case "instrucciones":
          return {
            text: `${draft.instructions.length} car.`,
            className:
              "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
          };
        case "servicios":
          return {
            text: draft.autoQuoteServices
              ? `Auto · ${availableCatalogCount} prod.`
              : "Manual",
            className:
              "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
          };
        case "horario":
          return {
            text: draft.businessHoursEnabled
              ? `${draft.openTime}–${draft.closeTime}`
              : "Desactivado",
            className:
              "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
          };
        case "conocimiento":
          return {
            text: `${draft.faqs.length} FAQ`,
            className:
              "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
          };
        case "probar":
          return {
            text: `${draft.templates.length} plantillas`,
            className:
              "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
          };
      }
    };

    return (
      <div className="relative space-y-4">
        {/* Toast feedback */}
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 shadow-lg dark:border-emerald-500/40 dark:bg-emerald-950/90 dark:text-emerald-200"
          >
            <CheckCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 2-Column Configuration Workspace */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left Section Menu */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <Card className="p-2.5 sm:p-3">
              <div className="px-2.5 pb-2 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Canal y asistente IA
                </p>
              </div>
              <nav
                aria-label="Secciones de configuración"
                className="space-y-1"
              >
                <button
                  type="button"
                  onClick={() => setActiveView("hub")}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors",
                    activeView === "hub"
                      ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Squares2X2Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        activeView === "hub"
                          ? "text-brand-600 dark:text-brand-400"
                          : "text-gray-400 dark:text-gray-500",
                      )}
                    />
                    <span className="truncate">Resumen general</span>
                  </span>
                </button>

                <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

                {CONFIG_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const active = activeView === section.id;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveView(section.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors",
                        active
                          ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active
                              ? "text-brand-600 dark:text-brand-400"
                              : "text-gray-400 dark:text-gray-500",
                          )}
                        />
                        <span className="truncate">{section.label}</span>
                      </span>

                      {section.id === "interruptor" && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            store.channelConfig.masterAutoReply
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                              : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                          )}
                        >
                          {store.channelConfig.masterAutoReply
                            ? "Activo"
                            : "Pausado"}
                        </span>
                      )}

                      {section.id === "qr" && (
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            store.channelConfig.whatsappConnected
                              ? "bg-emerald-500"
                              : "bg-amber-500",
                          )}
                          title={
                            store.channelConfig.whatsappConnected
                              ? "Conectado"
                              : "Desconectado"
                          }
                        />
                      )}
                    </button>
                  );
                })}
              </nav>
            </Card>
          </aside>

          {/* Right Active Panel */}
          <div className="lg:col-span-8 xl:col-span-9">
            {/* CONFIG HUB OVERVIEW */}
            {activeView === "hub" ? (
              <Card className="p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-800">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">
                      Centro de configuración del asistente
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Administra conexión de WhatsApp, motor OpenRouter, personalidad, reglas y pruebas en vivo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                        store.channelConfig.whatsappConnected
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          store.channelConfig.whatsappConnected
                            ? "bg-emerald-500"
                            : "bg-amber-500",
                        )}
                      />
                      {store.channelConfig.whatsappConnected
                        ? "WhatsApp conectado"
                        : "WhatsApp desconectado"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                  {CONFIG_SECTIONS.map((section) => {
                    const Icon = section.icon;
                    const badge = getHubStatusBadge(section.id);
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveView(section.id)}
                        className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-500/40"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl",
                                section.accentClass,
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                            <span
                              className={cn(
                                "max-w-[130px] truncate rounded-full px-2 py-0.5 text-[10px] font-bold",
                                badge.className,
                              )}
                            >
                              {badge.text}
                            </span>
                          </div>
                          <h3 className="mt-3 text-sm font-bold text-gray-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                            {section.label}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                            {section.shortDescription}
                          </p>
                        </div>
                        <span className="mt-3 inline-flex items-center text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                          Configurar →
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            ) : (
              <Card className="p-5 sm:p-6">
                {/* Section Header */}
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-800">
                  <div>
                    <button
                      type="button"
                      onClick={() => setActiveView("hub")}
                      className="mb-1.5 inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
                    >
                      <ArrowLeftIcon className="h-3 w-3" />
                      <span>Volver al resumen</span>
                    </button>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">
                      {currentSectionMeta?.label}
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {currentSectionMeta?.description}
                    </p>
                  </div>
                </div>

                {/* 1. INTERRUPTOR MAESTRO */}
                {activeView === "interruptor" && (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-white/[0.02]">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              store.channelConfig.masterAutoReply
                                ? "bg-emerald-500"
                                : "bg-gray-400",
                            )}
                          />
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            Respuestas automáticas del asistente IA
                          </h3>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                              store.channelConfig.masterAutoReply
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                                : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                            )}
                          >
                            {store.channelConfig.masterAutoReply
                              ? "Activo"
                              : "Pausado"}
                          </span>
                        </div>
                        <p className="max-w-xl text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                          {store.channelConfig.masterAutoReply
                            ? "El asistente responderá automáticamente consultas de catálogo, seguimiento de pedidos y pagos en todos los hilos activos."
                            : "Las respuestas automáticas están pausadas en todo el canal. Todos los mensajes entrantes serán atendidos únicamente por asesores humanos."}
                        </p>
                      </div>

                      <ToggleSwitch
                        checked={store.channelConfig.masterAutoReply}
                        onChange={handleToggleMaster}
                        label="Respuestas automáticas del asistente IA"
                      />
                    </div>

                    <Alert
                      variant="info"
                      title="Pausa inteligente al intervenir un asesor"
                      message="Cuando un operador toma una conversación o responde manualmente desde el chat, el asistente IA se pausa solo para ese hilo hasta que lo devuelvas al bot."
                    />
                  </div>
                )}

                {/* 2. CONEXIÓN WHATSAPP (QR) */}
                {activeView === "qr" && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "h-3 w-3 rounded-full",
                            store.channelConfig.whatsappConnected
                              ? "bg-emerald-500"
                              : "bg-amber-500",
                          )}
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            Estado de la línea WhatsApp
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {store.channelConfig.whatsappConnected
                              ? "Sesión sincronizada y lista para recibir pedidos."
                              : "Escanea el código QR desde tu teléfono para vincular la sesión."}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-bold",
                          store.channelConfig.whatsappConnected
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
                        )}
                      >
                        {store.channelConfig.whatsappConnected
                          ? "Conectado"
                          : "Desconectado"}
                      </span>
                    </div>

                    {/* Phone number input */}
                    <div className="max-w-md space-y-1.5">
                      <label
                        htmlFor="wa-phone-input"
                        className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                      >
                        Número de WhatsApp comercial
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="wa-phone-input"
                          type="text"
                          value={draft.whatsappNumber}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              whatsappNumber: e.target.value,
                            }))
                          }
                          placeholder="+57 300 410 8820"
                          className="h-10 flex-1 rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            store.updateChannelConfig({
                              whatsappNumber: draft.whatsappNumber.trim(),
                            });
                            showSavedToast("Número guardado correctamente");
                          }}
                        >
                          Guardar
                        </Button>
                      </div>
                    </div>

                    {store.channelConfig.whatsappConnected ? (
                      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 sm:flex-row sm:items-center dark:border-emerald-500/30 dark:bg-emerald-950/20">
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white">
                            <CheckCircleIcon className="h-7 w-7" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              WhatsApp conectado ({store.channelConfig.whatsappNumber})
                            </p>
                            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                              Los mensajes entrantes y notificaciones de pedido se envían por esta línea.
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            startIcon={<ArrowPathIcon className="h-3.5 w-3.5" />}
                            onClick={handleReconnectWhatsapp}
                          >
                            Reconectar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleToggleWhatsappConnection(false)}
                          >
                            Desconectar sesión
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 items-center gap-6 rounded-2xl border border-gray-200 bg-gray-50/50 p-5 md:grid-cols-12 dark:border-gray-800 dark:bg-white/[0.02]">
                        <div className="flex flex-col items-center md:col-span-5">
                          <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-700">
                            <img
                              src={qrDataUrl}
                              alt="Código QR de vinculación WhatsApp"
                              className="h-48 w-48 object-contain"
                            />
                          </div>
                          <span className="mt-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            Sesión: {draft.whatsappNumber || "Sin número"}
                          </span>
                          <button
                            type="button"
                            onClick={handleRefreshQr}
                            className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            <ArrowPathIcon className="h-3.5 w-3.5" />
                            <span>Actualizar código QR</span>
                          </button>
                        </div>

                        <div className="space-y-4 md:col-span-7">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Pasos para vincular
                          </h4>
                          <ol className="space-y-2.5 text-xs text-gray-700 dark:text-gray-300">
                            <li className="flex items-start gap-2.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[11px] font-bold text-brand-600 dark:text-brand-400">
                                1
                              </span>
                              <span>
                                Abre <strong>WhatsApp</strong> en el celular de tu negocio.
                              </span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[11px] font-bold text-brand-600 dark:text-brand-400">
                                2
                              </span>
                              <span>
                                Entra a <strong>Dispositivos vinculados</strong> y toca{" "}
                                <strong>Vincular un dispositivo</strong>.
                              </span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[11px] font-bold text-brand-600 dark:text-brand-400">
                                3
                              </span>
                              <span>
                                Escanea este código QR o reconecta la sesión de demostración.
                              </span>
                            </li>
                          </ol>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              onClick={handleReconnectWhatsapp}
                            >
                              Reconectar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              startIcon={<ArrowPathIcon className="h-3.5 w-3.5" />}
                              onClick={handleRefreshQr}
                            >
                              Actualizar código QR
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. MODELO IA (OPENROUTER + API KEY + TEMPERATURE + MAX TOKENS) */}
                {activeView === "modelo" && (
                  <div className="space-y-6">
                    {/* OpenRouter Models */}
                    <div className="space-y-2.5">
                      <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Modelo de lenguaje (OpenRouter)
                      </span>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {OPENROUTER_MODELS.map((model) => {
                          const selected = draft.modelName === model.id;
                          return (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  modelName: model.id,
                                }))
                              }
                              className={cn(
                                "flex cursor-pointer items-start justify-between gap-2 rounded-2xl border p-3.5 text-left transition-all",
                                selected
                                  ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-brand-950/25"
                                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700",
                              )}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    {model.label}
                                  </span>
                                  {model.recommended && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                      Recomendado
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                  {model.provider} ·{" "}
                                  <span className="font-mono text-[10px]">
                                    {model.id}
                                  </span>
                                </p>
                              </div>
                              {selected && (
                                <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-500" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* API Key with toggle + masked badge + clear */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor="openrouter-api-key"
                          className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                        >
                          API Key de OpenRouter
                        </label>
                        {draft.apiKey.trim() && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            <span>Activa: {maskApiKey(draft.apiKey)}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            id="openrouter-api-key"
                            type={showApiKey ? "text" : "password"}
                            value={draft.apiKey}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                apiKey: e.target.value,
                              }))
                            }
                            placeholder="sk-or-v1-..."
                            autoComplete="off"
                            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-3.5 pr-10 font-mono text-xs text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey((prev) => !prev)}
                            aria-label={
                              showApiKey ? "Ocultar API Key" : "Mostrar API Key"
                            }
                            title={
                              showApiKey ? "Ocultar API Key" : "Mostrar API Key"
                            }
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                          >
                            {showApiKey ? (
                              <EyeSlashIcon className="h-4 w-4" />
                            ) : (
                              <EyeIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {draft.apiKey && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setDraft((prev) => ({ ...prev, apiKey: "" }))
                            }
                          >
                            Limpiar
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        Si se deja vacía, el asistente funcionará con el motor local de demostración.
                      </p>
                    </div>

                    {/* Temperature slider (0.00 - 1.00) & Max tokens (100 - 8192) */}
                    <div className="grid grid-cols-1 gap-5 rounded-2xl border border-gray-200 bg-gray-50/60 p-4 sm:grid-cols-2 dark:border-gray-800 dark:bg-white/[0.02]">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="temperature-slider"
                            className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                          >
                            Temperatura
                          </label>
                          <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs font-bold text-brand-600 shadow-2xs dark:bg-gray-800 dark:text-brand-400">
                            {draft.temperature.toFixed(2)}
                          </span>
                        </div>
                        <input
                          id="temperature-slider"
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={draft.temperature}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              temperature: Number(e.target.value),
                            }))
                          }
                          className="h-2 w-full cursor-pointer accent-brand-500"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>0.00 · Preciso</span>
                          <span>0.50 · Equilibrado</span>
                          <span>1.00 · Creativo</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="max-tokens-input"
                            className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                          >
                            Máximo de tokens
                          </label>
                          <span className="text-[11px] text-gray-400">
                            100 – 8192
                          </span>
                        </div>
                        <input
                          id="max-tokens-input"
                          type="number"
                          min={100}
                          max={8192}
                          step={64}
                          value={draft.maxTokens}
                          onChange={(e) => {
                            const raw = Number(e.target.value);
                            if (Number.isNaN(raw)) return;
                            setDraft((prev) => ({
                              ...prev,
                              maxTokens: Math.min(8192, Math.max(100, Math.round(raw))),
                            }));
                          }}
                          className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold tabular-nums text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                        <p className="text-[10px] text-gray-400">
                          Controla la longitud máxima de cada respuesta generada.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. PERSONALIDAD */}
                {activeView === "personalidad" && (
                  <div className="space-y-6">
                    {/* Assistant Name + Treatment + Style */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="assistant-name"
                          className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                        >
                          Nombre del asistente
                        </label>
                        <input
                          id="assistant-name"
                          type="text"
                          value={draft.assistantName}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              assistantName: e.target.value,
                            }))
                          }
                          placeholder="Asistente Necto"
                          className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Trato al cliente
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                          {(
                            [
                              { id: "tu", label: "Tú" },
                              { id: "usted", label: "Usted" },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  treatment: opt.id,
                                }))
                              }
                              className={cn(
                                "cursor-pointer rounded-lg py-1.5 text-xs font-semibold transition-all",
                                draft.treatment === opt.id
                                  ? "bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white"
                                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Estilo de respuesta
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                          {(
                            [
                              { id: "guided", label: "Amable y guiado" },
                              { id: "direct", label: "Rápido y directo" },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  responseStyle: opt.id,
                                }))
                              }
                              className={cn(
                                "cursor-pointer rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all",
                                draft.responseStyle === opt.id
                                  ? "bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white"
                                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Tone Cards */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {PERSONALITY_CARDS.map((card) => {
                        const selected = draft.personality === card.id;
                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                personality: card.id,
                              }))
                            }
                            className={cn(
                              "flex cursor-pointer flex-col justify-between rounded-2xl border p-3.5 text-left transition-all",
                              selected
                                ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-brand-950/25"
                                : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                {card.title}
                              </h4>
                              {selected && (
                                <CheckCircleIcon className="h-4 w-4 shrink-0 text-brand-500" />
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                              {card.subtitle}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Toggles: Emojis & Auto-escalate claims */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 dark:border-gray-800 dark:bg-white/[0.02]">
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">
                            Uso de emojis
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                            Agrega cercanía visual en saludos y confirmaciones.
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={draft.useEmojis}
                          onChange={(checked) =>
                            setDraft((prev) => ({
                              ...prev,
                              useEmojis: checked,
                            }))
                          }
                          label="Activar uso de emojis"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 dark:border-gray-800 dark:bg-white/[0.02]">
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">
                            Derivar reclamos a humano
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                            Escala automáticamente quejas, devoluciones o demoras.
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={draft.autoEscalateClaims}
                          onChange={(checked) =>
                            setDraft((prev) => ({
                              ...prev,
                              autoEscalateClaims: checked,
                            }))
                          }
                          label="Derivar reclamos automáticamente"
                        />
                      </div>
                    </div>

                    {/* Welcome message + variable chips + Live WhatsApp bubble preview */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                      <div className="space-y-2 lg:col-span-7">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label
                            htmlFor="welcome-message"
                            className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                          >
                            Mensaje de bienvenida
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => insertWelcomeToken("{cliente}")}
                              className="cursor-pointer rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                            >
                              + {"{cliente}"}
                            </button>
                            <button
                              type="button"
                              onClick={() => insertWelcomeToken("{empresa}")}
                              className="cursor-pointer rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                            >
                              + {"{empresa}"}
                            </button>
                          </div>
                        </div>
                        <textarea
                          id="welcome-message"
                          rows={4}
                          value={draft.welcomeMessage}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              welcomeMessage: e.target.value,
                            }))
                          }
                          placeholder="¡Hola {cliente}! Bienvenido a {empresa}..."
                          className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Live WhatsApp Bubble Preview */}
                      <div className="lg:col-span-5">
                        <span className="mb-2 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Vista previa WhatsApp
                        </span>
                        <div className="rounded-2xl border border-gray-200 bg-[#efeae2] p-4 dark:border-gray-800 dark:bg-[#0b141a]">
                          <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-xs bg-[#d9fdd3] px-3.5 py-2.5 text-xs text-gray-900 shadow-xs dark:bg-[#005c4b] dark:text-white">
                            <p className="mb-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-200">
                              {draft.assistantName || "Asistente Necto"}
                            </p>
                            <p className="whitespace-pre-line leading-relaxed">
                              {welcomePreviewText}
                            </p>
                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500 dark:text-white/70">
                              <span>{currentTimeLabel()}</span>
                              <span className="text-sky-600 dark:text-sky-300">
                                ✓✓
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. INSTRUCCIONES + REGLAS DE DERIVACIÓN (HANDOFF) + GUARDRAILS */}
                {activeView === "instrucciones" && (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="system-instructions"
                          className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                        >
                          Instrucciones del sistema
                        </label>
                        <span className="text-[11px] text-gray-400">
                          {draft.instructions.length} caracteres
                        </span>
                      </div>
                      <textarea
                        id="system-instructions"
                        rows={4}
                        value={draft.instructions}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            instructions: e.target.value,
                          }))
                        }
                        placeholder="Define cómo debe saludar, cotizar y guiar el asistente..."
                        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="handoff-rules"
                          className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                        >
                          Reglas de Derivación (Handoff)
                        </label>
                        <span className="text-[11px] text-gray-400">
                          {draft.handoffRules.length} caracteres
                        </span>
                      </div>
                      <textarea
                        id="handoff-rules"
                        rows={3}
                        value={draft.handoffRules}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            handoffRules: e.target.value,
                          }))
                        }
                        placeholder="Cuándo transferir la conversación a un asesor humano..."
                        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="guardrails-rules"
                          className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                        >
                          Restricciones y Guardrails
                        </label>
                        <span className="text-[11px] text-gray-400">
                          {draft.guardrails.length} caracteres
                        </span>
                      </div>
                      <textarea
                        id="guardrails-rules"
                        rows={3}
                        value={draft.guardrails}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            guardrails: e.target.value,
                          }))
                        }
                        placeholder="Límites estrictos que el asistente nunca debe incumplir..."
                        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {/* 6. SERVICIOS Y CATÁLOGO */}
                {activeView === "servicios" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          Cotización automática de catálogo y servicios
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          Permite que el asistente comparta precios vigentes y arme cotizaciones con los{" "}
                          <strong>{availableCatalogCount}</strong> productos disponibles del catálogo.
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={draft.autoQuoteServices}
                        onChange={(checked) =>
                          setDraft((prev) => ({
                            ...prev,
                            autoQuoteServices: checked,
                          }))
                        }
                        label="Activar cotización automática de catálogo y servicios"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="services-note"
                        className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                      >
                        Notas comerciales, envíos y tarifas de servicio
                      </label>
                      <textarea
                        id="services-note"
                        rows={4}
                        value={draft.servicesNote}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            servicesNote: e.target.value,
                          }))
                        }
                        placeholder="Tarifas de domicilio, zonas de cobertura, mínimos de pedido o descuentos por volumen..."
                        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {/* 7. HORARIO COMERCIAL */}
                {activeView === "horario" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          Respuesta automática fuera de horario
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          Envía un mensaje informativo cuando un cliente escriba fuera de tu franja laboral.
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={draft.businessHoursEnabled}
                        onChange={(checked) =>
                          setDraft((prev) => ({
                            ...prev,
                            businessHoursEnabled: checked,
                          }))
                        }
                        label="Activar respuesta fuera de horario"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="open-time"
                          className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                        >
                          Hora de apertura
                        </label>
                        <input
                          id="open-time"
                          type="time"
                          value={draft.openTime}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              openTime: e.target.value,
                            }))
                          }
                          className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="close-time"
                          className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                        >
                          Hora de cierre
                        </label>
                        <input
                          id="close-time"
                          type="time"
                          value={draft.closeTime}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              closeTime: e.target.value,
                            }))
                          }
                          className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Días de atención
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_OPTIONS.map((day) => {
                          const active = draft.workDays.includes(day.full);
                          return (
                            <button
                              key={day.full}
                              type="button"
                              onClick={() => toggleWorkDay(day.full)}
                              aria-pressed={active}
                              title={day.full}
                              className={cn(
                                "cursor-pointer rounded-xl px-3.5 py-2 text-xs font-semibold transition-all",
                                active
                                  ? "bg-brand-500 text-white shadow-xs"
                                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800",
                              )}
                            >
                              {day.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="out-of-hours-message"
                        className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                      >
                        Mensaje fuera de horario
                      </label>
                      <textarea
                        id="out-of-hours-message"
                        rows={4}
                        value={draft.outOfHoursMessage}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            outOfHoursMessage: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {/* 8. CONOCIMIENTO (FAQ CRUD + NOTAS GENERALES) */}
                {activeView === "conocimiento" && (
                  <div className="space-y-6">
                    {/* Structured FAQ CRUD */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Preguntas frecuentes ({draft.faqs.length})
                        </span>
                      </div>

                      {draft.faqs.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400 dark:border-gray-800">
                          No hay preguntas frecuentes registradas todavía. Agrega la primera abajo.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {draft.faqs.map((faq) => {
                            const isEditing = editingFaqId === faq.id;
                            return (
                              <div
                                key={faq.id}
                                className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 dark:border-gray-800 dark:bg-white/[0.02]"
                              >
                                {isEditing ? (
                                  <div className="space-y-2.5">
                                    <input
                                      type="text"
                                      value={editingFaqQuestion}
                                      onChange={(e) =>
                                        setEditingFaqQuestion(e.target.value)
                                      }
                                      placeholder="Pregunta frecuente"
                                      className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                    />
                                    <textarea
                                      rows={3}
                                      value={editingFaqAnswer}
                                      onChange={(e) =>
                                        setEditingFaqAnswer(e.target.value)
                                      }
                                      placeholder="Respuesta oficial"
                                      className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingFaqId(null)}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={saveEditFaq}
                                        disabled={
                                          !editingFaqQuestion.trim() ||
                                          !editingFaqAnswer.trim()
                                        }
                                      >
                                        Actualizar FAQ
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                                        {faq.question}
                                      </p>
                                      <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                                        {faq.answer}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => startEditFaq(faq)}
                                        title="Editar FAQ"
                                        aria-label={`Editar ${faq.question}`}
                                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-white"
                                      >
                                        <PencilSquareIcon className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteFaq(faq.id)}
                                        title="Eliminar FAQ"
                                        aria-label={`Eliminar ${faq.question}`}
                                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                      >
                                        <TrashIcon className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add new FAQ form */}
                      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-3.5 dark:border-gray-700 dark:bg-gray-900/50">
                        <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                          Agregar nueva pregunta frecuente
                        </p>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newFaqQuestion}
                            onChange={(e) => setNewFaqQuestion(e.target.value)}
                            placeholder="Ej. ¿Cuánto tarda el envío a Medellín?"
                            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50/70 px-3 text-xs text-gray-900 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                          <textarea
                            rows={2}
                            value={newFaqAnswer}
                            onChange={(e) => setNewFaqAnswer(e.target.value)}
                            placeholder="Respuesta clara y concreta que usará el asistente..."
                            className="w-full rounded-lg border border-gray-200 bg-gray-50/70 p-2.5 text-xs text-gray-900 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              startIcon={<PlusIcon className="h-3.5 w-3.5" />}
                              onClick={handleAddFaq}
                              disabled={
                                !newFaqQuestion.trim() || !newFaqAnswer.trim()
                              }
                            >
                              Agregar FAQ
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* General knowledge notes */}
                    <div className="space-y-1.5 border-t border-gray-100 pt-4 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="knowledge-notes"
                          className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                        >
                          Notas generales del negocio (envíos, promociones, contexto adicional)
                        </label>
                        <span className="text-[11px] text-gray-400">
                          {draft.knowledgeNotes.length} caracteres
                        </span>
                      </div>
                      <textarea
                        id="knowledge-notes"
                        rows={4}
                        value={draft.knowledgeNotes}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            knowledgeNotes: e.target.value,
                          }))
                        }
                        placeholder="Políticas de envío, tiempos estimados, garantías y promociones vigentes..."
                        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {/* 9. PROBAR ASISTENTE (SANDBOX EN VIVO + PLANTILLAS RÁPIDAS EDITABLES) */}
                {activeView === "probar" && (
                  <div className="space-y-4">
                    <div
                      role="tablist"
                      aria-label="Herramientas de prueba y plantillas"
                      className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={probarSubTab === "sandbox"}
                        onClick={() => setProbarSubTab("sandbox")}
                        className={cn(
                          "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                          probarSubTab === "sandbox"
                            ? "bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white"
                            : "text-gray-500 hover:text-gray-800 dark:text-gray-400",
                        )}
                      >
                        Sandbox en vivo
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={probarSubTab === "templates"}
                        onClick={() => setProbarSubTab("templates")}
                        className={cn(
                          "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                          probarSubTab === "templates"
                            ? "bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white"
                            : "text-gray-500 hover:text-gray-800 dark:text-gray-400",
                        )}
                      >
                        Plantillas rápidas ({draft.templates.length})
                      </button>
                    </div>

                    {probarSubTab === "sandbox" ? (
                      <div className="space-y-4">
                        <div className="flex h-[430px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/60">
                          {/* Sandbox header */}
                          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                                <SparklesIcon className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-xs font-bold text-gray-900 dark:text-white">
                                  {draft.assistantName || "Asistente Necto"} ·{" "}
                                  {selectedModelMeta?.label ?? draft.modelName}
                                </p>
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                  Sandbox en vivo · Sin envío a clientes reales
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setSandboxMessages([
                                  {
                                    id: `sb-reset-${Date.now()}`,
                                    sender: "bot",
                                    text: "Simulación reiniciada. Escribe cualquier consulta de cliente para probar la respuesta del asistente.",
                                    time: currentTimeLabel(),
                                  },
                                ])
                              }
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            >
                              <ArrowPathIcon className="h-3.5 w-3.5" />
                              Reiniciar
                            </button>
                          </div>

                          {/* Messages */}
                          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50/40 p-4 dark:bg-transparent">
                            {sandboxMessages.map((msg) => {
                              const isCustomer = msg.sender === "customer";
                              return (
                                <div
                                  key={msg.id}
                                  className={cn(
                                    "flex max-w-[88%] flex-col",
                                    isCustomer
                                      ? "ml-auto items-end"
                                      : "mr-auto items-start",
                                  )}
                                >
                                  {msg.traceability && (
                                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
                                        <span>{msg.traceability.flow}</span>
                                        <span>·</span>
                                        <span>
                                          {msg.traceability.moduleTag}
                                        </span>
                                        <span>·</span>
                                        <span>
                                          {Math.round(
                                            msg.traceability.confidence * 100,
                                          )}
                                          %
                                        </span>
                                      </span>
                                      {msg.requestHuman && (
                                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
                                          <ExclamationTriangleIcon className="h-3 w-3" />
                                          Escala a asesor humano
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  <div
                                    className={cn(
                                      "whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                                      isCustomer
                                        ? "rounded-br-sm bg-brand-500 text-white"
                                        : "rounded-bl-sm border border-gray-200 bg-white text-gray-800 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100",
                                    )}
                                  >
                                    {msg.text}
                                  </div>
                                  <span className="mt-1 px-1 text-[10px] text-gray-400">
                                    {msg.time}
                                  </span>
                                </div>
                              );
                            })}
                            <div ref={sandboxEndRef} />
                          </div>

                          {/* Input bar */}
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSendSandbox();
                            }}
                            className="flex items-center gap-2 border-t border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                          >
                            <input
                              type="text"
                              value={sandboxInput}
                              onChange={(e) => setSandboxInput(e.target.value)}
                              placeholder="Escribe un mensaje de cliente (ej. Hola, quiero ver el menú)..."
                              className="h-9 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-xs text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={!sandboxInput.trim()}
                              endIcon={
                                <PaperAirplaneIcon className="h-3.5 w-3.5" />
                              }
                            >
                              Probar
                            </Button>
                          </form>
                        </div>

                        {/* Quick test prompt chips */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                            Pruebas rápidas:
                          </span>
                          {QUICK_SANDBOX_PROMPTS.map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              onClick={() => handleSendSandbox(prompt)}
                              className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Estas plantillas aparecen como atajos rápidos en el compositor de mensajes y en el panel de contexto.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                templates:
                                  DEFAULT_CHANNEL_CONFIG.templates.map((t) => ({
                                    ...t,
                                  })),
                              }))
                            }
                            className="shrink-0 cursor-pointer text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                          >
                            Restaurar predeterminadas
                          </button>
                        </div>

                        <div className="space-y-3.5">
                          {draft.templates.map((tpl) => (
                            <div
                              key={tpl.id}
                              className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-white/[0.02]"
                            >
                              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                                  {TEMPLATE_KEY_TITLES[tpl.key]}
                                </span>
                                <input
                                  type="text"
                                  value={tpl.label}
                                  onChange={(e) =>
                                    updateTemplate(tpl.key, {
                                      label: e.target.value,
                                    })
                                  }
                                  aria-label={`Nombre de plantilla ${TEMPLATE_KEY_TITLES[tpl.key]}`}
                                  className="h-8 w-56 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                              </div>
                              <textarea
                                rows={3}
                                value={tpl.text}
                                onChange={(e) =>
                                  updateTemplate(tpl.key, {
                                    text: e.target.value,
                                  })
                                }
                                aria-label={`Contenido de plantilla ${TEMPLATE_KEY_TITLES[tpl.key]}`}
                                className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs leading-relaxed text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Save Actions */}
                {sectionHasSaveFooter && (
                  <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-gray-200 pt-4 dark:border-gray-800">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDiscardDraft}
                    >
                      Descartar
                    </Button>
                    <Button size="sm" onClick={handleSaveDraft}>
                      Guardar cambios
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  },
);

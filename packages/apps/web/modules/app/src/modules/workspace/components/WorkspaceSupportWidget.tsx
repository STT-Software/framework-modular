import "../styles/support-widget.css";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent } from "react";
import { NectoLogo } from "@/brand/NectoLogo";
import { cn } from "@/utils";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_QUICK_TOPICS,
  filterSupportFaqs,
  replyToSupportQuestion,
  type SupportCategory,
  type SupportFaqItem,
} from "../support/supportKnowledge";

export type SupportWidgetTab = "home" | "chat";

const SUPPORT_WIDGET_EVENT = "necto:open-support-widget";
const WHATSAPP_SUPPORT_URL =
  "https://api.whatsapp.com/send?phone=573145793333&text=Hola!%20Necesito%20ayuda%20con%20Necto";
const SUPPORT_EMAIL_HREF = "mailto:soporte@necto.co";

const AGENT_AVATARS = [
  "/images/support/agent-01.jpg",
  "/images/support/agent-02.jpg",
  "/images/support/agent-03.jpg",
] as const;

const LAUNCHER_SIZE = 60;
const VIEWPORT_MARGIN = 12;
const PANEL_EDGE_MARGIN = 16;
const PANEL_GAP = 12;
const PANEL_MAX_WIDTH = 360;
const DRAG_THRESHOLD_PX = 4;

const PANEL_CLOSE_MS = 200;
const LAUNCHER_INTRO_MS = 1100;
const DRAG_CLICK_GUARD_MS = 100;
const ASSISTANT_REPLY_DELAY_MS = 420;
const ATTACH_HINT_DURATION_MS = 4500;

type SlideDirection = "" | "forward" | "backward";

interface SupportChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface WidgetPosition {
  x: number;
  y: number;
}

interface DragState {
  isPointerDown: boolean;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  hasDragged: boolean;
  pointerId: number | null;
}

/** Global trigger to open the floating support widget from any workspace control. */
export function openSupportWidget(tab: SupportWidgetTab = "home"): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<{ tab: SupportWidgetTab }>(SUPPORT_WIDGET_EVENT, { detail: { tab } }));
  }
}

function clampPosition(x: number, y: number): WidgetPosition {
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - LAUNCHER_SIZE - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - LAUNCHER_SIZE - VIEWPORT_MARGIN);
  return {
    x: Math.max(VIEWPORT_MARGIN, Math.min(x, maxX)),
    y: Math.max(VIEWPORT_MARGIN, Math.min(y, maxY)),
  };
}

/**
 * Floating draggable support widget and local live chat window for the Necto workspace.
 * Chat history lives in component state scoped to the mounted WorkspaceLayout so it resets
 * automatically on SuperAdmin sign-out with zero cross-account persistence.
 */
export function WorkspaceSupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<SupportWidgetTab>("home");
  const [openArticle, setOpenArticle] = useState<SupportFaqItem | null>(null);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory | null>(null);

  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [animatedFromIndex, setAnimatedFromIndex] = useState(0);
  const [isReplying, setIsReplying] = useState(false);
  const [inputText, setInputText] = useState("");
  const [attachHint, setAttachHint] = useState<string | null>(null);

  const [position, setPosition] = useState<WidgetPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  const launcherRef = useRef<HTMLButtonElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const justDraggedRef = useRef(false);
  const messageSeqRef = useRef(0);

  const closeTimerRef = useRef<number | undefined>(undefined);
  const introTimerRef = useRef<number | undefined>(undefined);
  const dragResetTimerRef = useRef<number | undefined>(undefined);
  const replyTimerRef = useRef<number | undefined>(undefined);
  const attachHintTimerRef = useRef<number | undefined>(undefined);

  const dragInfoRef = useRef<DragState>({
    isPointerDown: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasDragged: false,
    pointerId: null,
  });

  const latestViewStateRef = useRef({
    isOpen: false,
    activeTab: "home" as SupportWidgetTab,
    hasOpenArticle: false,
    messageCount: 0,
  });
  latestViewStateRef.current = {
    isOpen,
    activeTab,
    hasOpenArticle: openArticle !== null,
    messageCount: messages.length,
  };

  // Clear all pending timers on unmount.
  useEffect(() => {
    return () => {
      window.clearTimeout(closeTimerRef.current);
      window.clearTimeout(introTimerRef.current);
      window.clearTimeout(dragResetTimerRef.current);
      window.clearTimeout(replyTimerRef.current);
      window.clearTimeout(attachHintTimerRef.current);
    };
  }, []);

  // Permanently mark launcher entrance as completed after initial animation window.
  useEffect(() => {
    introTimerRef.current = window.setTimeout(() => setHasEntered(true), LAUNCHER_INTRO_MS);
    return () => window.clearTimeout(introTimerRef.current);
  }, []);

  // Keep dragged launcher clamped inside viewport bounds when resizing.
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : null));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keep panel mounted during its exit transition, then unmount cleanly.
  useEffect(() => {
    window.clearTimeout(closeTimerRef.current);
    if (isOpen) {
      setIsMounted(true);
      return;
    }
    closeTimerRef.current = window.setTimeout(() => setIsMounted(false), PANEL_CLOSE_MS);
    return () => window.clearTimeout(closeTimerRef.current);
  }, [isOpen]);

  // Listen for global open requests (e.g., from WorkspaceSupportDropdown).
  useEffect(() => {
    const handleOpenEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: SupportWidgetTab }>;
      const requestedTab: SupportWidgetTab = customEvent.detail?.tab ?? "home";
      const current = latestViewStateRef.current;

      if (!current.isOpen) {
        setSlideDirection("");
        setAnimatedFromIndex(current.messageCount);
        setActiveTab(requestedTab);
        setOpenArticle(null);
        setIsOpen(true);
        return;
      }

      const currentView = current.hasOpenArticle ? "article" : current.activeTab;
      if (currentView !== requestedTab) {
        setSlideDirection(requestedTab === "home" ? "backward" : "forward");
        setAnimatedFromIndex(current.messageCount);
      }
      setActiveTab(requestedTab);
      setOpenArticle(null);
    };

    window.addEventListener(SUPPORT_WIDGET_EVENT, handleOpenEvent);
    return () => window.removeEventListener(SUPPORT_WIDGET_EVENT, handleOpenEvent);
  }, []);

  // Attach Escape dismissal listener only while the panel is open.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Auto-scroll to the newest chat message when active.
  useEffect(() => {
    if (activeTab === "chat" && !openArticle && isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isReplying, activeTab, openArticle, isOpen]);

  const navigateToChat = () => {
    setSlideDirection("forward");
    setAnimatedFromIndex(messages.length);
    setActiveTab("chat");
    setOpenArticle(null);
  };

  const navigateToHome = () => {
    setSlideDirection("backward");
    setActiveTab("home");
    setOpenArticle(null);
  };

  const handleOpenArticle = (item: SupportFaqItem) => {
    setSlideDirection("forward");
    setOpenArticle(item);
  };

  const handleCloseArticle = () => {
    setSlideDirection("backward");
    setOpenArticle(null);
  };

  const dispatchQuestion = (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isReplying) return;

    const nextId = () => {
      messageSeqRef.current += 1;
      return `ws-msg-${messageSeqRef.current}`;
    };

    setMessages((prev) => [...prev, { id: nextId(), role: "user", text: trimmed }]);
    setIsReplying(true);
    setAttachHint(null);

    window.clearTimeout(replyTimerRef.current);
    replyTimerRef.current = window.setTimeout(() => {
      const answer = replyToSupportQuestion(trimmed);
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text: answer }]);
      setIsReplying(false);
    }, ASSISTANT_REPLY_DELAY_MS);
  };

  const handleSubmitChat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isReplying) return;
    setInputText("");
    dispatchQuestion(trimmed);
  };

  const handleAskQuickQuestion = (question: string) => {
    if (activeTab !== "chat" || openArticle !== null) {
      setSlideDirection("forward");
      setAnimatedFromIndex(messages.length);
      setActiveTab("chat");
      setOpenArticle(null);
    }
    dispatchQuestion(question);
  };

  const handleAttachClick = () => {
    setAttachHint("Para enviar archivos o capturas, escríbenos por WhatsApp o a soporte@necto.co.");
    window.clearTimeout(attachHintTimerRef.current);
    attachHintTimerRef.current = window.setTimeout(() => {
      setAttachHint(null);
    }, ATTACH_HINT_DURATION_MS);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    setHasEntered(true);
    if (event.button !== 0) return;

    const button = launcherRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    dragInfoRef.current = {
      isPointerDown: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: rect.left,
      initialY: rect.top,
      hasDragged: false,
      pointerId: event.pointerId,
    };

    button.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragInfoRef.current;
    if (!drag.isPointerDown || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.hasDragged && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      drag.hasDragged = true;
      setIsDragging(true);
    }

    if (drag.hasDragged) {
      setPosition(clampPosition(drag.initialX + dx, drag.initialY + dy));
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragInfoRef.current;
    if (drag.pointerId !== event.pointerId) return;

    const button = launcherRef.current;
    if (button && button.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }

    if (drag.hasDragged) {
      justDraggedRef.current = true;
      setIsDragging(false);
      window.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = window.setTimeout(() => {
        justDraggedRef.current = false;
      }, DRAG_CLICK_GUARD_MS);
    }

    drag.isPointerDown = false;
    drag.hasDragged = false;
    drag.pointerId = null;
  };

  const handleToggleLauncher = () => {
    if (justDraggedRef.current) return;
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setSlideDirection("");
    setAnimatedFromIndex(messages.length);
    setIsOpen(true);
  };

  const getPanelStyle = (): CSSProperties => {
    if (!position) return {};

    const isBottomHalf = position.y >= window.innerHeight / 2;
    const isRightHalf = position.x >= window.innerWidth / 2;
    const panelWidth = Math.min(PANEL_MAX_WIDTH, window.innerWidth - PANEL_EDGE_MARGIN * 2);

    const style: CSSProperties = {
      transformOrigin: `${isBottomHalf ? "bottom" : "top"} ${isRightHalf ? "right" : "left"}`,
    };

    if (isBottomHalf) {
      style.bottom = `${window.innerHeight - position.y + PANEL_GAP}px`;
      style.top = "auto";
    } else {
      style.top = `${position.y + LAUNCHER_SIZE + PANEL_GAP}px`;
      style.bottom = "auto";
    }

    if (isRightHalf) {
      const rightDistance = window.innerWidth - (position.x + LAUNCHER_SIZE);
      const clampedRight = Math.max(
        PANEL_EDGE_MARGIN,
        Math.min(rightDistance, window.innerWidth - panelWidth - PANEL_EDGE_MARGIN),
      );
      style.right = `${clampedRight}px`;
      style.left = "auto";
    } else {
      const clampedLeft = Math.max(
        PANEL_EDGE_MARGIN,
        Math.min(position.x, window.innerWidth - panelWidth - PANEL_EDGE_MARGIN),
      );
      style.left = `${clampedLeft}px`;
      style.right = "auto";
    }

    return style;
  };

  const filteredArticles = useMemo(
    () => filterSupportFaqs(searchQuery, selectedCategory),
    [searchQuery, selectedCategory],
  );

  const viewTransitionClass = slideDirection ? `ws-support-view--${slideDirection}` : "";

  return (
    <div className="font-['DM_Sans',sans-serif] antialiased">
      {/* Floating support window */}
      {isMounted && (
        <div
          aria-label="Plataforma de soporte y asistencia Necto"
          aria-hidden={!isOpen}
          data-state={isOpen ? "open" : "closed"}
          style={getPanelStyle()}
          className={cn(
            "ws-support-panel fixed z-50 flex w-[calc(100vw-2rem)] sm:w-[360px] max-h-[88vh] flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl border border-gray-100 dark:bg-[#181818] dark:border-white/10 font-['DM_Sans',sans-serif]",
            activeTab === "chat" && !openArticle ? "h-[580px]" : "h-auto",
            !position && "bottom-[112px] right-4 sm:right-8",
          )}
        >
          {/* ── HOME VIEW ── */}
          {activeTab === "home" && !openArticle && (
            <div className={cn("flex flex-col overflow-hidden bg-white dark:bg-[#181818]", viewTransitionClass)}>
              {/* Top hero card in Necto deep indigo */}
              <div className="relative shrink-0 bg-[#190088] bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:12px_12px] px-6 pt-5 pb-5 text-white rounded-b-[30px] shadow-sm ws-support-hero">
                {/* Top row: overlapping avatar cluster + close button */}
                <div className="flex items-center justify-between">
                  <div className="ws-support-avatars flex items-center -space-x-2">
                    {AGENT_AVATARS.map((src, index) => (
                      <img
                        key={src}
                        src={src}
                        alt={`Agente de soporte ${index + 1}`}
                        className="h-8 w-8 rounded-full object-cover ring-2 ring-[#190088] shadow-xs"
                      />
                    ))}
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-[#190088] shadow-xs">
                      <NectoLogo variant="mark" width={18} height={18} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                    title="Cerrar soporte"
                    aria-label="Cerrar soporte"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Subheader: brand support title + availability status */}
                <div className="mt-3">
                  <div className="text-[14px] font-bold text-white tracking-tight leading-tight">
                    Plataforma de soporte Necto
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-medium text-[#97D6DF]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse motion-reduce:animate-none" />
                    <span>Disponible 24/7</span>
                  </div>
                </div>

                {/* Greeting */}
                <div className="mt-3.5">
                  <h3 className="text-[22px] font-bold text-white tracking-tight leading-tight">
                    ¡Hola!
                  </h3>
                  <p className="mt-1 text-[14px] font-medium text-white/90">
                    ¿Cómo podemos ayudarte hoy?
                  </p>
                </div>

                {/* Primary CTA button */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={navigateToChat}
                    className="group flex w-full h-[52px] items-center justify-between rounded-[20px] bg-[#FF3F1A] hover:bg-[#e03512] p-1.5 pl-6 text-white shadow-md transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <span className="flex-1 text-center text-[13px] font-bold tracking-wider uppercase text-white pr-2">
                      INICIAR CONVERSACIÓN
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-white text-[#FF3F1A] shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                  </button>
                </div>
              </div>

              {/* Compact body: channels, quick search, category pills, results, footer */}
              <div className="ws-support-stagger flex flex-col">
                {/* Middle card: favorite support channels */}
                <div className="mx-4 my-3 p-3.5 rounded-[24px] bg-[#F4F6F9] dark:bg-white/[0.04] border border-gray-100/80 dark:border-white/5 text-center">
                  <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">
                    Hablemos por tus canales favoritos
                  </p>

                  <div className="flex items-center justify-center gap-3.5 mt-3">
                    <button
                      type="button"
                      onClick={navigateToChat}
                      className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white dark:bg-[#252525] shadow-xs border border-gray-100/90 dark:border-white/10 hover:shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="Chat de asistencia"
                      aria-label="Abrir chat de asistencia"
                    >
                      <img
                        src="/images/support/messenger.png"
                        alt="Chat de asistencia"
                        className="h-5 w-5 object-contain dark:invert"
                      />
                    </button>

                    <a
                      href={WHATSAPP_SUPPORT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white dark:bg-[#252525] shadow-xs border border-gray-100/90 dark:border-white/10 hover:shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="Chatear por WhatsApp"
                      aria-label="Chatear por WhatsApp"
                    >
                      <img
                        src="/images/support/whatsapp.png"
                        alt="WhatsApp"
                        className="h-5 w-5 object-contain dark:invert"
                      />
                    </a>

                    <a
                      href={SUPPORT_EMAIL_HREF}
                      className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white dark:bg-[#252525] shadow-xs border border-gray-100/90 dark:border-white/10 hover:shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="Enviar correo electrónico"
                      aria-label="Enviar correo electrónico a soporte"
                    >
                      <img
                        src="/images/support/email.png"
                        alt="Correo electrónico"
                        className="h-5 w-5 object-contain dark:invert"
                      />
                    </a>
                  </div>
                </div>

                {/* Bottom section: quick answers search and categories */}
                <div className="px-4 pt-1 pb-5 flex flex-col">
                  <h4 className="text-[14px] font-bold text-gray-900 dark:text-white mb-2 px-1">
                    Encuentra respuestas rápidas
                  </h4>

                  <div className="h-[48px] rounded-[18px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#252525] p-1 flex items-center shadow-2xs focus-within:border-[#190088] transition-colors">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Buscar en el centro de ayuda..."
                      aria-label="Buscar en el centro de ayuda"
                      className="flex-1 bg-transparent px-3 text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-hidden dark:text-gray-100 dark:placeholder:text-gray-500"
                    />

                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        title="Limpiar búsqueda"
                        aria-label="Limpiar búsqueda"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => searchInputRef.current?.focus()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#190088] text-white shadow-xs hover:bg-[#150070] active:scale-95 transition-all cursor-pointer"
                      title="Buscar"
                      aria-label="Buscar en el centro de ayuda"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Category pills */}
                  <div className="flex items-center gap-2 mt-2.5 overflow-x-auto no-scrollbar pb-0.5">
                    {SUPPORT_CATEGORIES.map((category) => {
                      const isActive = selectedCategory === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setSelectedCategory(isActive ? null : category)}
                          aria-pressed={isActive}
                          className={cn(
                            "shrink-0 rounded-[13px] px-3.5 py-1.5 text-[12px] font-semibold transition-all cursor-pointer",
                            isActive
                              ? "bg-[#190088] text-white shadow-xs"
                              : "bg-[#EEF2F6] dark:bg-white/10 text-[#465FFF] dark:text-[#97D6DF] hover:bg-[#E2E8F0] dark:hover:bg-white/15",
                          )}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>

                  {/* Filtered FAQ list when searching or filtering by category */}
                  {(searchQuery.trim() || selectedCategory) && (
                    <div className="space-y-2 mt-3 pt-2.5 border-t border-gray-100 dark:border-white/5 animate-aparecer max-h-[160px] overflow-y-auto custom-scrollbar">
                      {filteredArticles.length === 0 ? (
                        <div className="py-3 text-center text-[12px] text-gray-400">
                          No se encontraron resultados para esta búsqueda.
                        </div>
                      ) : (
                        filteredArticles.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleOpenArticle(item)}
                            className="group flex w-full items-center justify-between gap-3 rounded-[16px] bg-gray-50/80 hover:bg-gray-100/90 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] border border-gray-200/60 dark:border-white/10 p-2.5 px-3 text-left transition-all active:scale-[0.99] cursor-pointer"
                          >
                            <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
                              {item.question}
                            </span>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                              className="shrink-0 text-gray-400 group-hover:text-[#190088] dark:group-hover:text-[#97D6DF] group-hover:translate-x-0.5 transition-all"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Brand footer */}
                <div className="py-2 text-center text-[11px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-white/5 select-none">
                  Powered by{" "}
                  <span className="font-bold underline text-gray-700 dark:text-gray-300">
                    Necto
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── ARTICLE DETAIL VIEW ── */}
          {openArticle && (
            <div
              className={cn(
                "flex flex-1 min-h-0 flex-col p-5 overflow-y-auto custom-scrollbar bg-white dark:bg-[#181818]",
                viewTransitionClass,
              )}
            >
              <button
                type="button"
                onClick={handleCloseArticle}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#FF3F1A] hover:underline mb-3 cursor-pointer self-start"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>Volver al inicio</span>
              </button>

              <h4 className="text-[16px] font-bold text-[#190088] dark:text-white mb-2 leading-snug">
                {openArticle.question}
              </h4>

              <div className="rounded-2xl bg-gray-50 p-4 text-[13px] text-gray-700 leading-relaxed dark:bg-white/[0.04] dark:text-[#ECECEC] border border-gray-100 dark:border-white/10">
                {openArticle.answer}
              </div>

              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => handleAskQuickQuestion(openArticle.question)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#190088] hover:bg-[#150070] text-white text-[13px] font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>Preguntar al asistente sobre esto</span>
                </button>
              </div>
            </div>
          )}

          {/* ── LIVE CHAT VIEW ── */}
          {activeTab === "chat" && !openArticle && (
            <div className={cn("flex flex-1 min-h-0 flex-col bg-[#212121] text-[#ECECEC]", viewTransitionClass)}>
              {/* Chat header */}
              <div className="relative shrink-0 bg-[#190088] bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:12px_12px] px-5 pt-3.5 pb-4 text-white shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={navigateToHome}
                    className="flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-3 py-1 text-[12px] font-medium text-white transition-all cursor-pointer"
                    title="Volver al inicio"
                    aria-label="Volver al inicio del soporte"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span>Inicio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
                    title="Cerrar soporte"
                    aria-label="Cerrar soporte"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="flex flex-col items-start">
                  <div className="flex items-center -space-x-2 mb-2">
                    {AGENT_AVATARS.map((src, index) => (
                      <img
                        key={src}
                        src={src}
                        alt={`Agente de soporte ${index + 1}`}
                        className="h-8 w-8 rounded-full object-cover ring-2 ring-[#190088] shadow-xs"
                      />
                    ))}
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-[#190088] shadow-xs">
                      <NectoLogo variant="mark" width={18} height={18} />
                    </div>
                  </div>

                  <h3 className="text-[16px] font-bold text-white tracking-tight leading-snug">
                    Plataforma de soporte Necto
                  </h3>

                  <div className="flex items-center gap-1.5 mt-0.5 text-[12px]">
                    <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse motion-reduce:animate-none" />
                    <span className="font-medium text-[#97D6DF]">Disponible 24/7</span>
                  </div>
                </div>
              </div>

              {/* Chat transcript */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar text-[14px]">
                {/* Initial assistant greeting */}
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#190088] text-white shadow-xs ws-support-mark-on-indigo">
                    <NectoLogo variant="mark" width={16} height={16} />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-[#2b2b2b] border border-white/[0.08] px-4 py-2.5 text-[#ECECEC] font-normal leading-relaxed max-w-[85%]">
                    ¡Hola! Soy tu asistente de soporte NECTO.
                  </div>
                </div>

                {/* Quick topic suggestions when conversation is empty */}
                {messages.length === 0 && (
                  <div className="space-y-2.5 pt-1">
                    <div className="rounded-2xl rounded-tl-sm bg-[#2b2b2b] border border-white/[0.08] px-4 py-2.5 text-[#ECECEC] font-normal leading-relaxed max-w-[88%] ml-10">
                      ¿Puedo ayudarte con alguno de estos temas?
                    </div>

                    <div className="ws-support-stagger space-y-2 ml-10 max-w-[88%]">
                      {SUPPORT_QUICK_TOPICS.map((topic) => (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => handleAskQuickQuestion(topic.question)}
                          className="group flex w-full items-center gap-2.5 rounded-2xl bg-[#2b2b2b]/90 hover:bg-[#343434] border border-[#97D6DF]/20 hover:border-[#97D6DF]/60 px-4 py-3 text-left transition-all active:scale-[0.98] cursor-pointer shadow-xs"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="shrink-0 text-[#97D6DF] transition-transform group-hover:translate-x-0.5"
                          >
                            <path d="M4 4v9a4 4 0 0 0 4 4h12" />
                            <polyline points="15 12 20 17 15 22" />
                          </svg>
                          <span className="text-[14px] font-normal text-[#97D6DF] group-hover:text-white leading-snug">
                            {topic.label}
                          </span>
                        </button>
                      ))}

                      {/* Three-dot Necto palette divider */}
                      <div className="flex items-center justify-center gap-2 pt-1 text-gray-500 opacity-60" aria-hidden="true">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#97D6DF]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#ECECEC]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#FF3F1A]" />
                      </div>
                    </div>
                  </div>
                )}

                {/* User and assistant messages */}
                {messages.map((message, index) => {
                  const isUser = message.role === "user";
                  const shouldAnimate = index >= animatedFromIndex;
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex items-start gap-2.5",
                        isUser ? "justify-end" : "justify-start",
                        shouldAnimate &&
                          (isUser ? "ws-support-message--user" : "ws-support-message--assistant"),
                      )}
                    >
                      {!isUser && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#190088] text-white shadow-xs ws-support-mark-on-indigo">
                          <NectoLogo variant="mark" width={16} height={16} />
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-[14px] font-normal leading-relaxed max-w-[85%]",
                          isUser
                            ? "bg-[#190088] text-white rounded-tr-sm shadow-sm"
                            : "bg-[#2b2b2b] border border-white/[0.08] text-[#ECECEC] rounded-tl-sm",
                        )}
                      >
                        {message.text}
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {isReplying && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="ws-support-message--assistant flex items-center gap-2 text-[12px] font-light text-[#97D6DF] pl-10"
                  >
                    <span className="ws-support-typing flex items-center gap-1" aria-hidden="true">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#97D6DF]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[#ECECEC]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FF3F1A]" />
                    </span>
                    <span>Escribiendo respuesta...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Subtle attachment hint when triggered */}
              {attachHint && (
                <div
                  role="status"
                  aria-live="polite"
                  className="shrink-0 flex items-center justify-between gap-2 px-4 py-1.5 bg-[#181818] border-t border-white/[0.06] text-[11px] text-[#97D6DF]"
                >
                  <span>{attachHint}</span>
                  <button
                    type="button"
                    onClick={() => setAttachHint(null)}
                    className="shrink-0 text-gray-400 hover:text-white transition-colors cursor-pointer"
                    aria-label="Cerrar aviso"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Bottom chat input bar */}
              <form
                onSubmit={handleSubmitChat}
                className="shrink-0 p-3 bg-[#181818] border-t border-white/[0.08] flex items-center gap-2.5"
              >
                <div className="flex-1 relative flex items-center rounded-2xl bg-[#262626] border border-white/[0.08] px-4 py-2.5 transition-all focus-within:border-[#97D6DF]/60 focus-within:bg-[#2e2e2e]">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder="Escribe un mensaje..."
                    aria-label="Escribe un mensaje"
                    className="flex-1 bg-transparent text-[14px] font-normal text-[#ECECEC] placeholder:text-gray-500 focus:outline-hidden pr-2"
                  />

                  <div className="flex items-center gap-2.5 shrink-0 text-gray-400">
                    <button
                      type="button"
                      onClick={handleAttachClick}
                      className="hover:text-[#97D6DF] transition-colors cursor-pointer"
                      title="Adjuntar archivo"
                      aria-label="Adjuntar archivo"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                        <path d="M12 12v9" />
                        <path d="m16 16-4-4-4 4" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInputText((prev) => `${prev} 😊`)}
                      className="hover:text-[#97D6DF] transition-colors cursor-pointer"
                      title="Insertar emoji"
                      aria-label="Insertar emoji"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || isReplying}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#190088] hover:bg-[#150070] active:scale-95 text-white shadow-md transition-all disabled:opacity-40 cursor-pointer"
                  title="Enviar (Enter)"
                  aria-label="Enviar mensaje"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 10 4 15 9 20" />
                    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                  </svg>
                </button>
              </form>

              {/* Brand footer */}
              <div className="py-1.5 text-center text-[11px] text-gray-400 dark:text-gray-500 bg-[#181818] border-t border-white/[0.08] select-none">
                Powered by{" "}
                <span className="font-bold underline text-gray-300">
                  Necto
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Draggable floating launcher button */}
      <button
        ref={launcherRef}
        type="button"
        onAnimationEnd={(event) => {
          if (event.target === launcherRef.current) {
            setHasEntered(true);
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={handleToggleLauncher}
        style={{
          ...(position
            ? {
                left: `${position.x}px`,
                top: `${position.y}px`,
                right: "auto",
                bottom: "auto",
              }
            : {}),
          touchAction: "none",
        }}
        className={cn(
          "ws-support-launcher fixed z-50 flex h-[60px] w-[60px] items-center justify-center [border-radius:50%_14px_50%_50%] bg-[#FF3F1A] hover:bg-[#E63815] text-white shadow-[0_10px_25px_-3px_rgba(255,63,26,0.35)] hover:shadow-[0_14px_28px_-3px_rgba(255,63,26,0.45)] border-0 font-['DM_Sans',sans-serif] group select-none",
          !position && "bottom-10 right-8",
          isDragging && "is-dragging",
          hasEntered && "is-entered",
          position && "is-repositioned",
        )}
        title="Arrastra para mover o haz clic para abrir soporte Necto"
        aria-label={isOpen ? "Cerrar soporte y asistencia Necto" : "Abrir soporte y asistencia Necto"}
        aria-expanded={isOpen}
      >
        {/* Tactile 2x3 grip indicator */}
        <span
          className="ws-support-launcher__grip pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-70 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        >
          <svg
            width="10"
            height="16"
            viewBox="0 0 10 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white drop-shadow-sm"
          >
            <circle cx="2.5" cy="2.5" r="1.3" fill="currentColor" />
            <circle cx="2.5" cy="8" r="1.3" fill="currentColor" />
            <circle cx="2.5" cy="13.5" r="1.3" fill="currentColor" />
            <circle cx="7.5" cy="2.5" r="1.3" fill="currentColor" />
            <circle cx="7.5" cy="8" r="1.3" fill="currentColor" />
            <circle cx="7.5" cy="13.5" r="1.3" fill="currentColor" />
          </svg>
        </span>

        {/* Chat bubble icon */}
        <span
          className={cn(
            "ws-support-launcher__icon ws-support-launcher__icon--chat pl-1.5",
            isOpen && "is-hidden",
          )}
          aria-hidden="true"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M4 8.5C4 5.46243 6.46243 3 9.5 3H18.5C21.5376 3 24 5.46243 24 8.5V15.5C24 19.6421 20.6421 23 16.5 23H4V8.5ZM7.75 8.75C7.75 7.92157 8.42157 7.25 9.25 7.25H18.75C19.5784 7.25 20.25 7.92157 20.25 8.75C20.25 9.57843 19.5784 10.25 18.75 10.25H9.25C8.42157 10.25 7.75 9.57843 7.75 8.75ZM7.75 14.75C7.75 13.9216 8.42157 13.25 9.25 13.25H14.75C15.5784 13.25 16.25 13.9216 16.25 14.75C16.25 15.5784 15.5784 16.25 14.75 16.25H9.25C8.42157 16.25 7.75 15.5784 7.75 14.75Z"
              fill="white"
            />
          </svg>
        </span>

        {/* Close X icon */}
        <span
          className={cn(
            "ws-support-launcher__icon ws-support-launcher__icon--close pl-1.5",
            !isOpen && "is-hidden",
          )}
          aria-hidden="true"
        >
          <svg
            width="22"
            height="22"
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
        </span>
      </button>
    </div>
  );
}

export default WorkspaceSupportWidget;

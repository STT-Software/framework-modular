import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { ShellDropdown } from "@/shell";
import { cn } from "@/utils";
import "../styles/workspace.css";
import { TutorialArt } from "./workspaceArt";
import { openSupportWidget } from "./WorkspaceSupportWidget";

const WHATSAPP_SUPPORT_URL =
  "https://api.whatsapp.com/send?phone=573145793333&text=Hola!%20Necesito%20ayuda%20con%20Necto";

function QuestionMarkCircleIcon({ className = "size-5 stroke-[1.8]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-4 h-4 stroke-[2]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function PlayIcon({ className = "w-2.5 h-2.5 fill-current ml-0.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
  );
}

function NewspaperIcon({ className = "w-5 h-5 stroke-[1.8]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
    </svg>
  );
}

function ChatBubbleLeftRightIcon({ className = "w-4 h-4 stroke-[2]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  );
}

function ArrowTopRightOnSquareIcon({
  className = "w-4 h-4 shrink-0 text-gray-500 group-hover:text-gray-800 dark:group-hover:text-gray-200 stroke-[2]",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

interface WorkspaceSupportDropdownProps {
  className?: string;
  triggerClassName?: string;
}

/**
 * Help and support dropdown for the workspace topbar: minimal rows (line icon + label), the tutorials card with the
 * Necto video illustration (`TutorialArt`, colored through the `ws-art-scope` variables) and direct
 * contact (WhatsApp support, live chat).
 */
export function WorkspaceSupportDropdown({
  className,
  triggerClassName,
}: WorkspaceSupportDropdownProps = {}) {
  const { pathname } = useLocation();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const closeDropdown = () => {
    setIsOpen(false);
    setFeedback(null);
  };

  useEffect(() => {
    setIsOpen(false);
    setFeedback(null);
  }, [pathname]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      if (prev) setFeedback(null);
      return !prev;
    });
  };

  const showComingSoon = (label: string) => {
    setFeedback(`${label} estará disponible próximamente.`);
  };

  const handleContactSupport = () => {
    closeDropdown();
    window.open(WHATSAPP_SUPPORT_URL, "_blank", "noopener,noreferrer");
  };

  const handleOpenHelpCenter = () => {
    closeDropdown();
    openSupportWidget("home");
  };

  const handleOpenLiveChat = () => {
    closeDropdown();
    openSupportWidget("chat");
  };

  return (
    <div className={cn("relative inline-block text-left", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          "relative flex items-center justify-center text-gray-600 transition-colors bg-white border border-gray-200/90 rounded-full hover:text-gray-900 h-10 w-10 sm:h-11 sm:w-11 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white cursor-pointer shadow-theme-xs shrink-0",
          triggerClassName
        )}
        title="Centro de ayuda y soporte"
        aria-label="Ayuda y soporte"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <QuestionMarkCircleIcon className="size-5 stroke-[1.8]" />
      </button>

      <ShellDropdown
        id={menuId}
        role="menu"
        aria-label="Ayuda y soporte"
        isOpen={isOpen}
        onClose={closeDropdown}
        triggerRef={triggerRef}
        className="ws-art-scope absolute right-0 mt-2.5 w-[330px] sm:w-[350px] max-w-[calc(100vw-2rem)] rounded-3xl bg-white dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 shadow-2xl z-50 p-5 flex flex-col gap-1 text-left animate-aparecer"
      >
        {/* Centered header icon */}
        <div className="flex justify-center pt-1 pb-1">
          <div className="w-11 h-11 flex items-center justify-center text-gray-900 dark:text-white">
            <svg
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              aria-hidden="true"
              className="w-10 h-10"
            >
              <path
                d="M24 6c-8.8 0-16 6.7-16 15 0 3.8 1.5 7.3 4 10.1L10 39l8.5-2.5c1.7.6 3.6.9 5.5.9 8.8 0 16-6.7 16-15S32.8 6 24 6z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 17.5c.6-1.8 2.4-2.8 4.2-2.2 1.7.5 2.5 2.1 2 3.5-.8 1.8-3.2 2.5-3.2 4.7"
                strokeLinecap="round"
              />
              <circle cx="24" cy="28.5" r="1.2" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Title and subtitle */}
        <div className="text-center px-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
            ¿Necesitas ayuda?
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
            Prueba ver un tutorial o buscar un artículo en la central de ayuda.
          </p>
        </div>

        {/* Tutorials banner card */}
        <button
          type="button"
          role="menuitem"
          onClick={() => showComingSoon("Tutoriales")}
          className="mt-3.5 w-full p-3.5 rounded-2xl bg-[#F6F6F8] dark:bg-gray-800/60 border border-gray-200/60 dark:border-gray-800 flex items-center justify-between text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
        >
          {/* Left column: play badge, label and CTA */}
          <span className="flex flex-col justify-between self-stretch pr-2 min-w-0">
            <span>
              <span className="w-5 h-5 rounded-md bg-white dark:bg-gray-800 border border-black/10 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 mb-1.5 shadow-2xs">
                <PlayIcon className="w-2.5 h-2.5 fill-current ml-0.5" />
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">
                Tutoriales
              </span>
              <span className="mt-0.5 text-xs sm:text-[13px] font-bold text-gray-900 dark:text-white block leading-tight">
                Aprende en video
              </span>
            </span>

            <span className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-[#190088] dark:text-[#97D6DF] group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">
              <span>Ir a Tutoriales</span>
              <ChevronRightIcon className="w-3 h-3 stroke-[2.5]" />
            </span>
          </span>

          {/* Right column: Necto video card illustration */}
          <span className="w-28 shrink-0" aria-hidden="true">
            <TutorialArt />
          </span>
        </button>

        <div role="separator" className="h-px bg-gray-100 dark:bg-gray-800 my-2" />

        {/* Section 1: Self-service resources */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            role="menuitem"
            onClick={handleOpenHelpCenter}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors text-left group cursor-pointer"
          >
            <span className="flex items-center gap-3 min-w-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden="true"
                className="w-5 h-5 shrink-0 text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
              <span className="truncate text-xs sm:text-[13px] font-medium text-gray-800 dark:text-gray-200">
                Central de ayuda
              </span>
            </span>
            <ArrowTopRightOnSquareIcon />
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => showComingSoon("Dejar sugerencias")}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors text-left group cursor-pointer"
          >
            <span className="flex items-center gap-3 min-w-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden="true"
                className="w-5 h-5 shrink-0 text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v5.999z"
                />
              </svg>
              <span className="truncate text-xs sm:text-[13px] font-medium text-gray-800 dark:text-gray-200">
                Dejar sugerencias
              </span>
            </span>
            <ChevronRightIcon className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 stroke-[2]" />
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => showComingSoon("Novedades de la plataforma")}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors text-left group cursor-pointer"
          >
            <span className="flex items-center gap-3 min-w-0">
              <NewspaperIcon className="w-5 h-5 shrink-0 text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white stroke-[1.8]" />
              <span className="truncate text-xs sm:text-[13px] font-medium text-gray-800 dark:text-gray-200">
                Novedades de la plataforma
              </span>
            </span>
            <ChevronRightIcon className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 stroke-[2]" />
          </button>
        </div>

        <div role="separator" className="h-px bg-gray-100 dark:bg-gray-800 my-2" />

        {/* Section 2: Direct contact with dark circular icon badges */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            role="menuitem"
            onClick={handleContactSupport}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors text-left group cursor-pointer"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-full bg-[#242426] dark:bg-gray-800 border border-transparent dark:border-gray-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-4 h-4">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.79 14.07c-.24.67-1.4 1.28-1.93 1.33-.49.05-1.12.08-3.62-.95-3.08-1.28-5.06-4.41-5.21-4.61-.15-.2-1.23-1.64-1.23-3.13 0-1.49.78-2.22 1.06-2.52.28-.3.61-.38.81-.38.2 0 .41 0 .59.01.19.01.44-.07.69.52.25.6.86 2.1.94 2.26.08.16.13.35.03.55-.1.2-.16.32-.31.5-.15.18-.32.4-.46.54-.15.15-.31.31-.13.62.18.31.79 1.3 1.7 2.11 1.17 1.04 2.16 1.36 2.47 1.51.31.15.49.13.67-.08.18-.21.78-.91.99-1.22.21-.31.41-.26.69-.15.28.11 1.78.84 2.09.99.31.15.51.23.59.36.08.14.08.79-.16 1.46z" />
                </svg>
              </span>
              <span className="truncate text-xs sm:text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                Contactar con Soporte
              </span>
            </span>
            <ChevronRightIcon className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 stroke-[2]" />
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={handleOpenLiveChat}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors text-left group cursor-pointer"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-full bg-[#242426] dark:bg-gray-800 border border-transparent dark:border-gray-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ChatBubbleLeftRightIcon className="w-4 h-4 stroke-[2]" />
              </span>
              <span className="truncate text-xs sm:text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                Chatear en Vivo
              </span>
            </span>
            <ChevronRightIcon className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 stroke-[2]" />
          </button>
        </div>

        {/* Inline feedback note for upcoming items */}
        {feedback && (
          <p
            role="status"
            aria-live="polite"
            className="mt-1.5 rounded-xl border border-gray-200/80 bg-[#F6F6F8] px-3 py-2 text-[11px] font-medium text-gray-700 dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-200"
          >
            {feedback}
          </p>
        )}

        {/* Official Necto footer logo */}
        <div className="pt-3 pb-1 flex items-center justify-center">
          <span className="inline-flex items-center ws-brand opacity-90 dark:[&_path[fill='#190088']]:fill-white">
            <NectoLogo width={140} height={20} />
          </span>
        </div>
      </ShellDropdown>
    </div>
  );
}

export default WorkspaceSupportDropdown;

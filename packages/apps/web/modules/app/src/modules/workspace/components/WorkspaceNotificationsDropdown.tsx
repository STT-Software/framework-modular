import { observer } from "mobx-react-lite";
import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { businessesStore, type Business } from "@/modules/businesses";
import { superAdminSessionStore } from "@/modules/super-admin-auth";
import { ShellDropdown } from "@/shell";
import { NEW_BUSINESS_PATH, WORKSPACE_PATH } from "../paths";
import { useOptionalWorkspaceDetail } from "./WorkspaceDetailContext";
import { AnnouncementArt, NoticeToken, NotificationsEmptyArt, type NoticeKind } from "./workspaceArt";

const READ_STORAGE_PREFIX = "necto.workspace.notifications.read:";
const DISMISSED_STORAGE_PREFIX = "necto.workspace.notifications.dismissed:";

function readStoredIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return new Set();
  }
}

function writeStoredIds(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {
    // Persistent storage unavailable.
  }
}

interface WorkspaceNotificationCard {
  id: string;
  kind: NoticeKind;
  category: string;
  date: string;
  title: string;
  detail: string;
  /** Illustration under the text (only the Necto announcement has one). */
  art?: "announcement";
  onSelect: () => void;
}

function BellTriggerIcon({ className = "size-5 stroke-current fill-none" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function CloseIcon({ className = "size-5 stroke-[1.8]" }: { className?: string }) {
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
      <path d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function TrashIcon({ className = "size-4 stroke-[1.7]" }: { className?: string }) {
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
      <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

/**
 * Notifications dropdown for the SuperAdmin workspace topbar.
 * Derives live notices from the workspace business portfolio and persists read/dismissed
 * states per authenticated SuperAdmin account in localStorage.
 */
export const WorkspaceNotificationsDropdown = observer(() => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const workspaceDetail = useOptionalWorkspaceDetail();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const userScope = superAdminSessionStore.superAdmin?.id ?? "anon";
  const readKey = `${READ_STORAGE_PREFIX}${userScope}`;
  const dismissedKey = `${DISMISSED_STORAGE_PREFIX}${userScope}`;

  const [readIds, setReadIds] = useState<Set<string>>(() => readStoredIds(readKey));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => readStoredIds(dismissedKey));

  // Keep read/dismissed sets scoped to the currently signed-in account.
  useEffect(() => {
    setReadIds(readStoredIds(readKey));
    setDismissedIds(readStoredIds(dismissedKey));
  }, [readKey, dismissedKey]);

  // Close the popover on any route transition.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const closeDropdown = () => setIsOpen(false);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) void businessesStore.loadSwitcher();
  };

  const markAsRead = (id: string) => {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    writeStoredIds(readKey, next);
  };

  const dismissNotification = (id: string) => {
    const next = new Set(dismissedIds);
    next.add(id);
    setDismissedIds(next);
    writeStoredIds(dismissedKey, next);
  };

  const restoreNotifications = () => {
    const empty = new Set<string>();
    setDismissedIds(empty);
    writeStoredIds(dismissedKey, empty);
  };

  const sourceBusinesses: Business[] =
    businessesStore.switcherState === "ready" || businessesStore.switcherItems.length > 0
      ? businessesStore.switcherItems
      : businessesStore.items;

  const emptyPortfolioCards: WorkspaceNotificationCard[] =
    businessesStore.count === 0
      ? [
          {
            id: "workspace-first-business",
            kind: "start",
            category: "Primeros pasos",
            date: "Inicio",
            title: "Crea tu primer negocio",
            detail:
              "Configura tu primer negocio y asigna a su administrador para comenzar a operar en Necto.",
            onSelect: () => {
              markAsRead("workspace-first-business");
              closeDropdown();
              navigate(NEW_BUSINESS_PATH);
            },
          },
        ]
      : [];

  const pausedBusinessCards: WorkspaceNotificationCard[] = sourceBusinesses
    .filter((business) => business.status === "paused")
    .map((business) => {
      const id = `business-paused:${business.id}`;
      return {
        id,
        kind: "paused",
        category: "Negocio en pausa",
        date: "En pausa",
        title: business.name,
        detail:
          "Este negocio está pausado y su administrador no puede acceder. Haz clic para ver su ficha y reanudarlo.",
        onSelect: () => {
          markAsRead(id);
          closeDropdown();
          workspaceDetail?.openBusinessDetail(business);
        },
      };
    });

  const announcementCards: WorkspaceNotificationCard[] = [
    {
      id: "necto-announcement-platform",
      kind: "necto",
      category: "Anuncio Necto",
      date: "Novedad",
      title: "Toda tu operación, más conectada",
      detail:
        "Administra tus negocios, activa módulos a la medida y controla el acceso de cada administrador desde un solo lugar.",
      art: "announcement",
      onSelect: () => {
        markAsRead("necto-announcement-platform");
        closeDropdown();
        navigate(WORKSPACE_PATH);
      },
    },
  ];

  const visibleNotifications = [
    ...emptyPortfolioCards,
    ...pausedBusinessCards,
    ...announcementCards,
  ].filter((item) => !dismissedIds.has(item.id));

  const unreadCount = visibleNotifications.filter((item) => !readIds.has(item.id)).length;
  const hasUnread = unreadCount > 0;

  const markAllAsRead = () => {
    if (!hasUnread) return;
    const next = new Set(readIds);
    for (const item of visibleNotifications) {
      next.add(item.id);
    }
    setReadIds(next);
    writeStoredIds(readKey, next);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="relative flex items-center justify-center text-gray-600 transition-colors bg-white border border-gray-200/90 rounded-full hover:text-gray-900 h-11 w-11 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white cursor-pointer shadow-theme-xs shrink-0"
        title="Notificaciones"
        aria-label="Notificaciones"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={panelId}
      >
        {hasUnread && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 z-10 size-2.5 rounded-full bg-[#FF3F1A] ring-2 ring-white dark:ring-gray-900"
          />
        )}
        <BellTriggerIcon className="size-5 stroke-current fill-none" />
      </button>

      <ShellDropdown
        id={panelId}
        role="dialog"
        aria-label="Notificaciones"
        isOpen={isOpen}
        onClose={closeDropdown}
        triggerRef={triggerRef}
        className="ws-art-scope absolute -right-16 sm:right-0 mt-2.5 flex w-[350px] sm:w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-3xl bg-white dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 shadow-2xl p-5 z-50 animate-aparecer"
      >
        <div className="ws-pop-head pb-3">
          <h3 className="ws-pop-title">
            Notificaciones
            {hasUnread && <span className="ws-pop-count">{unreadCount}</span>}
          </h3>
          <div className="flex items-center gap-1">
            {visibleNotifications.length > 0 && (
              <button type="button" onClick={markAllAsRead} disabled={!hasUnread} className="ws-pop-link">
                {hasUnread ? "Marcar leídas" : "Todo leído"}
              </button>
            )}
            <button type="button" onClick={closeDropdown} className="ws-pop-close" aria-label="Cerrar notificaciones">
              <CloseIcon className="size-4 stroke-[1.9]" />
            </button>
          </div>
        </div>

        {visibleNotifications.length === 0 ? (
          <div className="ws-pop-empty">
            <NotificationsEmptyArt />
            <strong>Todo en orden</strong>
            <p>No tienes notificaciones pendientes.</p>
            {dismissedIds.size > 0 && (
              <button type="button" onClick={restoreNotifications} className="ws-pop-link mt-3">
                Restablecer avisos
              </button>
            )}
          </div>
        ) : (
          <div className="flex max-h-[460px] flex-col overflow-y-auto -mx-2 px-2 custom-scrollbar">
            {visibleNotifications.map((item) => {
              const isRead = readIds.has(item.id);
              return (
                <article key={item.id} className="ws-note">
                  <NoticeToken kind={item.kind} />
                  <button type="button" onClick={item.onSelect} className="ws-note-body">
                    <span className="ws-note-eyebrow">
                      <b>{item.category}</b>
                      <span aria-hidden="true">·</span>
                      <span>{item.date}</span>
                    </span>
                    <span className="ws-note-title">
                      {item.title}
                      {!isRead && <span className="ws-sr-only"> (No leída)</span>}
                    </span>
                    <span className="ws-note-detail">{item.detail}</span>
                    {item.art === "announcement" && (
                      <span className="ws-note-art">
                        <AnnouncementArt />
                      </span>
                    )}
                  </button>
                  {!isRead && <span className="ws-note-dot" aria-hidden="true" />}
                  <button
                    type="button"
                    onClick={() => dismissNotification(item.id)}
                    className="ws-note-dismiss"
                    title="Eliminar notificación"
                    aria-label={`Eliminar notificación: ${item.title}`}
                  >
                    <TrashIcon className="size-4 stroke-[1.7]" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </ShellDropdown>
    </div>
  );
});

export default WorkspaceNotificationsDropdown;

import React from "react";
import {
  CHANNEL_LABELS,
  getInitials,
  type ConversationChannel,
} from "../../domain/conversationsDomain";

export const WhatsAppIcon = ({
  className = "h-3.5 w-3.5",
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.16C10.57 20.16 9.12 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.05 20.16ZM16.56 14.39C16.31 14.27 15.1 13.67 14.88 13.59C14.65 13.5 14.49 13.46 14.32 13.71C14.16 13.95 13.69 14.51 13.54 14.67C13.4 14.83 13.25 14.85 13 14.73C12.75 14.6 11.71 14.26 10.48 13.17C9.52 12.31 8.87 11.26 8.75 11.05C8.63 10.84 8.74 10.73 8.86 10.61C8.97 10.5 9.11 10.32 9.23 10.18C9.35 10.04 9.4 9.94 9.48 9.77C9.56 9.61 9.52 9.46 9.46 9.34C9.4 9.22 8.91 8.01 8.7 7.52C8.5 7.04 8.3 7.11 8.15 7.1C8.01 7.1 7.84 7.1 7.68 7.1C7.52 7.1 7.25 7.16 7.03 7.4C6.8 7.65 6.18 8.23 6.18 9.41C6.18 10.59 7.04 11.73 7.16 11.89C7.29 12.05 8.86 14.47 11.26 15.51C11.83 15.76 12.28 15.91 12.62 16.02C13.19 16.2 13.72 16.17 14.13 16.11C14.59 16.04 15.55 15.53 15.75 14.96C15.96 14.39 15.96 13.9 15.9 13.8C15.83 13.69 15.68 13.63 15.43 13.51L16.56 14.39Z" />
  </svg>
);

export const TelegramIcon = ({
  className = "h-3.5 w-3.5",
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
);

export const InstagramIcon = ({
  className = "h-3.5 w-3.5",
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

export const MessengerIcon = ({
  className = "h-3.5 w-3.5",
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.512 3.736 7.205V22l3.411-1.872c.907.251 1.868.388 2.853.388 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.066 12.443l-2.73-2.91-5.327 2.91 5.859-6.22 2.795 2.91 5.263-2.91-5.86 6.22z" />
  </svg>
);

export const TikTokIcon = ({
  className = "h-3.5 w-3.5",
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97v7.54c0 1.85-.54 3.72-1.65 5.2-1.57 2.08-4.14 3.28-6.74 3.21-2.94-.07-5.69-1.66-7.06-4.26-1.38-2.61-1.25-5.84.34-8.32 1.59-2.48 4.41-3.9 7.4-3.71v4.1c-1.39-.24-2.84.18-3.87 1.13-1.04.96-1.52 2.4-1.26 3.79.26 1.39 1.34 2.51 2.75 2.84 1.41.33 2.93-.16 3.84-1.23.63-.74.98-1.69.96-2.66V.02h.65z" />
  </svg>
);

export const BotIcon = ({
  className = "h-4 w-4",
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M12 2v4" />
    <circle cx="12" cy="2" r="1" fill="currentColor" />
    <rect x="4" y="6" width="16" height="14" rx="3" />
    <circle cx="8.5" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
    <path d="M9 16h6" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
  </svg>
);

export const HeadsetIcon = ({
  className = "h-4 w-4",
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

export const UserPlusIcon = ({
  className = "h-4 w-4",
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

export type ChannelAvatarSize = "sm" | "md" | "lg" | "xl";

export interface ChannelAvatarProps {
  name: string;
  channel: ConversationChannel;
  avatarColor?: string;
  size?: ChannelAvatarSize;
  online?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<ChannelAvatarSize, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-11 w-11 text-sm",
  xl: "h-14 w-14 text-base",
};

const BADGE_SIZE_CLASSES: Record<ChannelAvatarSize, string> = {
  sm: "h-4 w-4 -bottom-0.5 -right-0.5 ring-[1.5px]",
  md: "h-[18px] w-[18px] -bottom-0.5 -right-0.5 ring-2",
  lg: "h-5 w-5 -bottom-0.5 -right-0.5 ring-2",
  xl: "h-6 w-6 -bottom-0.5 -right-0.5 ring-2",
};

const BADGE_ICON_CLASSES: Record<ChannelAvatarSize, string> = {
  sm: "h-2.5 w-2.5",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-3.5 w-3.5",
};

const CHANNEL_BADGE_STYLES: Record<
  ConversationChannel,
  { bg: string; renderIcon: (className: string) => React.ReactNode }
> = {
  whatsapp: {
    bg: "bg-[#25D366] text-white",
    renderIcon: (cls) => <WhatsAppIcon className={cls} />,
  },
  instagram: {
    bg: "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white",
    renderIcon: (cls) => <InstagramIcon className={cls} />,
  },
  messenger: {
    bg: "bg-[#0084FF] text-white",
    renderIcon: (cls) => <MessengerIcon className={cls} />,
  },
  tiktok: {
    bg: "bg-black text-white",
    renderIcon: (cls) => <TikTokIcon className={cls} />,
  },
  telegram: {
    bg: "bg-[#229ED9] text-white",
    renderIcon: (cls) => <TelegramIcon className={cls} />,
  },
};

export const ChannelAvatar: React.FC<ChannelAvatarProps> = ({
  name,
  channel = "whatsapp",
  avatarColor,
  size = "md",
  online,
  className = "",
}) => {
  const initials = getInitials(name || "Cliente");
  const channelLabel = CHANNEL_LABELS[channel] ?? "WhatsApp";
  const badge = CHANNEL_BADGE_STYLES[channel] ?? CHANNEL_BADGE_STYLES.whatsapp;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-sans select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      <div
        className="flex h-full w-full items-center justify-center rounded-full font-bold tracking-tight text-white shadow-xs"
        style={{ backgroundColor: avatarColor || "#334155" }}
        title={`${name} (${channelLabel})`}
      >
        <span>{initials}</span>
      </div>

      {online && (
        <span
          className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900"
          title="En línea"
        />
      )}

      <span
        className={`absolute flex items-center justify-center rounded-full shadow-xs ring-white dark:ring-gray-900 ${BADGE_SIZE_CLASSES[size]} ${badge.bg}`}
        title={`Canal: ${channelLabel}`}
      >
        {badge.renderIcon(BADGE_ICON_CLASSES[size])}
      </span>
    </div>
  );
};

export default ChannelAvatar;

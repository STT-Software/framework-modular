import React from "react";

export interface FormattedMessageTextProps {
  text: string;
  inverted?: boolean;
  className?: string;
}

const ExternalLinkIcon: React.FC = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="inline-block shrink-0 opacity-85"
    aria-hidden="true"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\/[^\s<]+$/i.test(url.trim());
}

function parseInlineTokens(
  text: string,
  baseKey: string,
  linkClassName: string,
  codeClassName: string,
): React.ReactNode[] {
  const inlineRegex =
    /(<a\s+[\s\S]*?<\/a>|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|<b>[\s\S]*?<\/b>|<strong>[\s\S]*?<\/strong>|<code>[\s\S]*?<\/code>|<i>[\s\S]*?<\/i>|<em>[\s\S]*?<\/em>|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|https?:\/\/[^\s<]+)/gi;

  const parts = text.split(inlineRegex).filter(Boolean);

  return parts.map((token, idx) => {
    const key = `${baseKey}-in-${idx}`;

    // Safe HTML anchor (<a href="https://...">label</a>)
    if (/^<a\s+/i.test(token)) {
      const hrefMatch = token.match(/href=["']?([^"'\s>]+)["']?/i);
      const contentMatch = token.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
      const href = hrefMatch ? hrefMatch[1] : "";
      const rawContent = contentMatch ? contentMatch[1] : href;
      const label = rawContent.replace(/<\/?[^>]+(>|$)/g, "").trim() || href;

      if (!isSafeHttpUrl(href)) {
        return <React.Fragment key={key}>{label}</React.Fragment>;
      }

      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          onClick={(e) => e.stopPropagation()}
        >
          <span>{label}</span>
          <ExternalLinkIcon />
        </a>
      );
    }

    // Markdown link [label](https://...)
    if (/^\[[^\]]+\]\(https?:\/\/[^\s)]+\)$/.test(token)) {
      const match = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (match) {
        const [, label, url] = match;
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
            onClick={(e) => e.stopPropagation()}
          >
            <span>{label}</span>
            <ExternalLinkIcon />
          </a>
        );
      }
    }

    // HTML bold
    if (/^<(b|strong)[ >]/i.test(token)) {
      const clean = token.replace(/<\/?[^>]+(>|$)/g, "");
      return (
        <strong key={key} className="font-semibold text-inherit">
          {clean}
        </strong>
      );
    }

    // WhatsApp bold (*text*)
    if (/^\*[^*\n]+\*$/.test(token)) {
      return (
        <strong key={key} className="font-semibold text-inherit">
          {token.slice(1, -1)}
        </strong>
      );
    }

    // HTML code
    if (/^<code[ >]/i.test(token)) {
      const clean = token.replace(/<\/?[^>]+(>|$)/g, "");
      return (
        <code key={key} className={codeClassName}>
          {clean}
        </code>
      );
    }

    // Markdown inline code (`text`)
    if (/^`[^`\n]+`$/.test(token)) {
      return (
        <code key={key} className={codeClassName}>
          {token.slice(1, -1)}
        </code>
      );
    }

    // HTML italic
    if (/^<(i|em)[ >]/i.test(token)) {
      const clean = token.replace(/<\/?[^>]+(>|$)/g, "");
      return (
        <em key={key} className="italic text-inherit opacity-90">
          {clean}
        </em>
      );
    }

    // WhatsApp italic (_text_)
    if (/^_[^_\n]+_$/.test(token)) {
      return (
        <em key={key} className="italic text-inherit opacity-90">
          {token.slice(1, -1)}
        </em>
      );
    }

    // Raw http(s):// URL
    if (/^https?:\/\/[^\s<]+$/i.test(token)) {
      let url = token;
      let trailing = "";
      const trailMatch = token.match(/[.,;:!?)]+$/);
      if (trailMatch) {
        trailing = trailMatch[0];
        url = token.slice(0, -trailing.length);
      }

      if (!isSafeHttpUrl(url)) {
        return <React.Fragment key={key}>{token}</React.Fragment>;
      }

      return (
        <React.Fragment key={key}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
            onClick={(e) => e.stopPropagation()}
          >
            <span>{url}</span>
            <ExternalLinkIcon />
          </a>
          {trailing}
        </React.Fragment>
      );
    }

    return <React.Fragment key={key}>{token}</React.Fragment>;
  });
}

export const FormattedMessageText: React.FC<FormattedMessageTextProps> = ({
  text,
  inverted = false,
  className = "",
}) => {
  if (!text) return null;

  const normalized = text.replace(/<br\s*\/?>/gi, "\n");
  const useLightLinks = inverted || className.includes("text-white");

  const linkClassName = useLightLinks
    ? "inline-flex items-center gap-1 font-medium text-white underline decoration-white/75 underline-offset-2 hover:opacity-85 break-all cursor-pointer"
    : "inline-flex items-center gap-1 font-medium text-[#FF3F1A] underline decoration-[#FF3F1A]/50 underline-offset-2 hover:text-[#d93212] dark:text-[#FF7A59] dark:hover:text-[#ff987e] break-all cursor-pointer";

  const codeClassName = useLightLinks
    ? "rounded bg-white/15 px-1.5 py-0.5 font-mono text-xs text-white"
    : "rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs text-[#190088] dark:bg-white/10 dark:text-[#97D6DF]";

  const blockRegex = /(<blockquote>[\s\S]*?<\/blockquote>)/gi;
  const blocks = normalized.split(blockRegex).filter(Boolean);

  return (
    <div
      className={`whitespace-pre-line leading-relaxed break-words [overflow-wrap:anywhere] font-sans ${className}`}
    >
      {blocks.map((block, idx) => {
        const key = `blk-${idx}`;
        if (/^<blockquote[ >]/i.test(block)) {
          const inner = block
            .replace(/^<blockquote[^>]*>/i, "")
            .replace(/<\/blockquote>$/i, "")
            .trim();
          return (
            <blockquote
              key={key}
              className="my-2 rounded-r border-l-2 border-[#FF3F1A] bg-black/[0.04] py-1.5 pl-3 pr-2.5 text-sm font-normal leading-relaxed text-inherit dark:bg-white/[0.06]"
            >
              {parseInlineTokens(inner, key, linkClassName, codeClassName)}
            </blockquote>
          );
        }

        return (
          <span key={key}>
            {parseInlineTokens(block, key, linkClassName, codeClassName)}
          </span>
        );
      })}
    </div>
  );
};

export default FormattedMessageText;

import { useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";

export type AiBuilderChatMessageVariant = "user" | "bot";

interface IAiBuilderChatMessageContentProps {
  content: string;
  variant: AiBuilderChatMessageVariant;
  className?: string;
}

function createMarkdownComponents(
  variant: AiBuilderChatMessageVariant,
): Components {
  const isUser = variant === "user";
  const inlineCodeClass = isUser
    ? "rounded bg-primary-foreground/15 px-1 py-0.5 font-mono text-[0.9em]"
    : "rounded bg-muted/80 px-1 py-0.5 font-mono text-[0.9em] text-foreground";
  const blockCodeClass = isUser
    ? "block overflow-x-auto rounded bg-primary-foreground/10 p-2 font-mono text-[0.85em]"
    : "block overflow-x-auto rounded bg-muted/70 p-2 font-mono text-[0.85em] text-foreground";
  const linkClass = isUser
    ? "underline underline-offset-2 text-primary-foreground"
    : "underline underline-offset-2 text-foreground";

  return {
    p: ({ children }) => (
      <p className="mb-2 last:mb-0">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-snug">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          "mb-2 border-l-2 pl-2 last:mb-0",
          isUser ? "border-primary-foreground/40" : "border-border",
        )}
      >
        {children}
      </blockquote>
    ),
    h1: ({ children }) => (
      <h1 className="mb-2 text-sm font-semibold last:mb-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-2 text-xs font-semibold last:mb-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-1 text-xs font-medium last:mb-0">{children}</h3>
    ),
    hr: () => (
      <hr
        className={cn(
          "my-2 border-0 border-t",
          isUser ? "border-primary-foreground/30" : "border-border",
        )}
      />
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className={linkClass}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ className, children }) => (
      <code className={inlineCodeClass} data-language={className}>
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre
        className={cn(
          blockCodeClass,
          "mb-2 last:mb-0 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit",
        )}
      >
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="mb-2 overflow-x-auto last:mb-0">
        <table className="w-full border-collapse text-left">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className={isUser ? "bg-primary-foreground/10" : "bg-muted/60"}>
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th scope="col" className="border px-2 py-1 font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        className={cn(
          "border px-2 py-1",
          isUser ? "border-primary-foreground/20" : "border-border",
        )}
      >
        {children}
      </td>
    ),
  };
}

/**
 * Renders AI Builder chat message text as GitHub-flavored Markdown.
 * Endpoint-agnostic: all model responses use the same renderer.
 */
function AiBuilderChatMessageContent({
  content,
  variant,
  className,
}: Readonly<IAiBuilderChatMessageContentProps>) {
  const components = useMemo(
    () => createMarkdownComponents(variant),
    [variant],
  );

  if (!content.trim()) {
    return null;
  }

  return (
    <div className={cn("break-words [&>*:first-child]:mt-0", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default AiBuilderChatMessageContent;

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/utils";

interface IAiBuilderMarkdownProps {
  content: string;
  tone: "user" | "assistant";
}

/** Renders chat markdown with tone-aware contrast for user and assistant bubbles. */
function AiBuilderMarkdown({ content, tone }: Readonly<IAiBuilderMarkdownProps>) {
  return (
    <div
      className={cn(
        "ai-builder-markdown text-xs leading-snug",
        "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5",
        "[&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-2",
        "[&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
        "[&_a]:underline",
        tone === "user"
          ? "[&_a]:text-primary-foreground [&_code]:bg-primary-foreground/15 [&_pre]:bg-primary-foreground/10"
          : "[&_a]:text-foreground [&_code]:bg-background/70 [&_pre]:bg-background/70",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default AiBuilderMarkdown;

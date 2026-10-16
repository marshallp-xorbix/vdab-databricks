import type { ReactNode } from "react";

type ManagementPageHeaderProps =
  | {
      id?: string;
      title: string;
      description: string;
      content?: never;
      actions?: ReactNode;
    }
  | {
      id?: string;
      title?: string;
      description?: string;
      content: ReactNode;
      actions?: ReactNode;
    };

export function ManagementPageHeader({
  id,
  title,
  description,
  content,
  actions,
}: Readonly<ManagementPageHeaderProps>) {
  const headerContent =
    content ?? (
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    );

  return (
    <div
      id={id}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between"
    >
      {headerContent}
      {actions ? (
        <div className="flex items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}

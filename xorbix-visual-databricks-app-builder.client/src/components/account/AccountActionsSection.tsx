import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface Props {
  title?: string;
  description?: string;
  layout?: "grid" | "flex";
  children: ReactNode;
}

export function AccountActionsSection({
  title = "Account Actions",
  description,
  layout = "grid",
  children,
}: Readonly<Props>) {
  const containerClass =
    layout === "grid" ? "grid gap-3 sm:grid-cols-2" : "flex flex-wrap gap-3";

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          {title}
        </CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <div className={containerClass}>{children}</div>
      </CardContent>
    </Card>
  );
}

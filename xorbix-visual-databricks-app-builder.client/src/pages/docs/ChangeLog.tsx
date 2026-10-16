import { ScrollText, Sparkles, Wrench, Bug } from "lucide-react";

type ItemType = "feature" | "improvement" | "fix";

interface ReleaseItem {
  type: ItemType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  tag: string | null;
  items: ReleaseItem[];
}

const RELEASES: Release[] = [
  {
    version: "0.9.0",
    date: "March 2026",
    tag: "Latest",
    items: [
      {
        type: "feature",
        text: "New inline settings panel for the app builder canvas",
      },
      {
        type: "feature",
        text: "Workflow editor with explicit action and event system",
      },
      {
        type: "feature",
        text: "Plugin-based component registry for extensible component types",
      },
      {
        type: "improvement",
        text: "Multi-tenant user management with tenant-scoped roles",
      },
      {
        type: "improvement",
        text: "Stripe billing integration for Individual and Team subscription tiers",
      },
    ],
  },
  {
    version: "0.8.0",
    date: "February 2026",
    tag: null,
    items: [
      { type: "feature", text: "AI-assisted app builder chat window" },
      {
        type: "feature",
        text: "Lakebase table selector for Delta table bindings",
      },
      {
        type: "improvement",
        text: "Enhanced chart components: bar, line, pie, and donut renderers",
      },
      {
        type: "fix",
        text: "Fixed Databricks OAuth callback token handling",
      },
    ],
  },
  {
    version: "0.7.0",
    date: "January 2026",
    tag: null,
    items: [
      {
        type: "feature",
        text: "Role-based access control with per-tenant permissions",
      },
      {
        type: "feature",
        text: "Two-factor authentication via email codes",
      },
      {
        type: "improvement",
        text: "Resizable panel layout for the app builder",
      },
      {
        type: "fix",
        text: "Resolved session restore issues after token expiry",
      },
    ],
  },
];

const TYPE_CONFIG: Record<
  ItemType,
  { icon: React.ElementType; label: string; classes: string }
> = {
  feature: {
    icon: Sparkles,
    label: "Feature",
    classes: "bg-primary/10 text-primary border-primary/20",
  },
  improvement: {
    icon: Wrench,
    label: "Improvement",
    classes: "bg-success-subtle text-success-foreground border-success/30",
  },
  fix: {
    icon: Bug,
    label: "Fix",
    classes: "bg-destructive-subtle text-destructive border-destructive/30",
  },
};

export default function ChangeLog() {
  return (
    <div className="flex-1">
      {/* Header */}
      <div className="w-full bg-sidebar border-b border-border">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <ScrollText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Changelog</h1>
              <p className="text-sm text-muted-foreground">
                Release notes and version history for VDAB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-3xl mx-auto px-8 py-12">
        <div className="space-y-8">
          {RELEASES.map((release) => (
            <div key={release.version} className="relative flex gap-6">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shadow">
                  {release.version.split(".")[0]}.{release.version.split(".")[1]}
                </div>
                <div className="mt-2 flex-1 w-0.5 bg-muted" />
              </div>

              {/* Card */}
              <div className="flex-1 pb-8">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-lg font-bold text-foreground">
                    v{release.version}
                  </h2>
                  {release.tag && (
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">
                      {release.tag}
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">{release.date}</span>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
                  {release.items.map((item, idx) => {
                    const { icon: Icon, classes } = TYPE_CONFIG[item.type];
                    return (
                      <div key={idx} className="flex items-start gap-3 px-5 py-3">
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] ${classes}`}
                        >
                          <Icon className="h-3 w-3" />
                        </span>
                        <p className="text-sm text-foreground">{item.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

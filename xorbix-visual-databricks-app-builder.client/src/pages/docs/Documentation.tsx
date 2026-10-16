import { BookOpen, Code2, Layers, Rocket, Settings, Users } from "lucide-react";
import { NavigationTile } from "../../components/NavigationTile";

const DOC_SECTIONS = [
  {
    icon: Rocket,
    title: "Getting Started",
    description:
      "Set up your account, connect your first Databricks workspace, and build your first app in under 10 minutes.",
  },
  {
    icon: Layers,
    title: "Component Library",
    description:
      "Explore every drag-and-drop component: tables, charts, forms, filters, and more — with configuration reference.",
  },
  {
    icon: Code2,
    title: "Data Bindings",
    description:
      "Learn how to bind UI controls to SQL queries, Delta tables, and ML model outputs from your Databricks environment.",
  },
  {
    icon: Rocket,
    title: "Deployment Guide",
    description:
      "Publish apps to Databricks in one click. Understand versioning, rollbacks, and multi-environment deployments.",
  },
  {
    icon: Users,
    title: "User & Role Management",
    description:
      "Manage team members, assign workspace access, and configure role-based permissions across your organization.",
  },
  {
    icon: Settings,
    title: "Organization Settings",
    description:
      "Configure billing, subscription tiers, API keys, and workspace connections for your organization.",
  },
];

export default function Documentation() {
  return (
    <div className="flex-1">
      {/* Header */}
      <div className="w-full bg-sidebar border-b border-border">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Documentation
              </h1>
              <p className="text-sm text-muted-foreground">
                Guides, references, and tutorials for VDAB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-primary">
              Documentation is on the way
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Full step-by-step guides and API references are being written.
              Here's a preview of what's coming.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DOC_SECTIONS.map(({ icon: Icon, title, description }) => (
            <NavigationTile
              key={title}
              title={title}
              description={description}
              icon={Icon}
              iconClassName="bg-primary/10 text-primary"
              disabled
              disabledLabel="Coming soon"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

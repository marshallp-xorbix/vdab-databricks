import { Link } from "react-router-dom";
import {
  LayoutGrid,
  Rocket,
  Link2,
  Shield,
  Layers,
  Zap,
  Wrench,
  Clock,
  ServerCog,
  Lock,
} from "lucide-react";
import DemoImage from "../assets/demo-image.png";
import { NavigationTile } from "../components/NavigationTile";
import { buttonVariants } from "../components/ui/button";
import { cn } from "../lib/utils";
const HOW_IT_WORKS = [
  {
    icon: LayoutGrid,
    title: "Design",
    description:
      "Drag and drop controls — text inputs, dropdowns, tables, date pickers, and more — onto a visual canvas to build your app UI without writing markup.",
  },
  {
    icon: Wrench,
    title: "Build",
    description:
      "Wire controls to Databricks jobs and notebooks through a point-and-click interface. Bind parameters, set workflows, and preview in real time.",
  },
  {
    icon: Rocket,
    title: "Deploy",
    description:
      "Publish your finished app directly to a connected Databricks workspace. Share it with your team in minutes — no DevOps required.",
  },
];

const FEATURES = [
  {
    icon: Link2,
    title: "Multi-workspace connections",
    description:
      "Connect to any number of Databricks workspaces and manage them all from one place.",
  },
  {
    icon: Shield,
    title: "Role-based access control",
    description:
      "Assign per-app permissions so the right people see the right tools.",
  },
  {
    icon: Layers,
    title: "Visual app builder",
    description:
      "A component library purpose-built for data workflows: tables, lookback windows, multi-select, and more.",
  },
  {
    icon: Zap,
    title: "Live job execution",
    description:
      "Trigger Databricks jobs directly from the app and surface outputs to end-users in real time.",
  },
];

const WHY_VDAB = [
  {
    icon: Clock,
    title: "Save development time",
    description:
      "Go from idea to deployed app in hours instead of weeks. No hand-coding React or managing frontend build pipelines.",
  },
  {
    icon: ServerCog,
    title: "No DevOps required",
    description:
      "VDAB handles deployment to Databricks for you. Focus on the data product, not the infrastructure.",
  },
  {
    icon: Lock,
    title: "Enterprise-grade security",
    description:
      "Built-in Unity Catalog governance, role-based access control, and secure OAuth connections keep your data safe.",
  },
];

export default function WelcomePage() {
  return (
    <>
      {/* Hero */}
      <section className="w-full bg-sidebar">
        <div className="max-w-7xl mx-auto px-8 py-16 grid lg:grid-cols-2 gap-12 items-center w-full">
          <div>
            <p
              className="text-2xl md:text-4xl font-extrabold uppercase tracking-wide mb-10 drop-shadow-sm text-primary"
              style={{
                textShadow:
                  "0 2px 8px color-mix(in oklch, var(--primary) 13%, transparent)",
              }}
            >
              Visual Databricks App Builder
            </p>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight text-foreground">
              Build and deploy apps
              <br />
              <span className="inline-block underline decoration-primary decoration-2 underline-offset-4">
                right to Databricks
              </span>
            </h1>
            <p className="mt-5 text-base text-muted-foreground max-w-md leading-relaxed">
              Design apps visually, connect them to your Databricks workspaces,
              and ship internal tools in minutes — all from one place.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Link
                to="/signup"
                className={buttonVariants({
                  variant: "outline",
                  className:
                    "border-white/40 bg-primary text-primary-foreground! text-sm hover:opacity-90",
                })}
              >
                Start Building
              </Link>
              <Link
                to="/pricing"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "border-border text-foreground hover:bg-muted/60",
                )}
              >
                See Pricing
              </Link>
            </div>
          </div>

          <div className="rounded-xs border border-border shadow-sm overflow-hidden">
            <img
              src={DemoImage}
              alt="App builder demo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* How it works + Features */}
      <section className="border-t border-border bg-muted">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="space-y-12">
            {/* How it works */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-6">
                How it works
              </h2>
              <div className="grid md:grid-cols-3 gap-5">
                {HOW_IT_WORKS.map(({ icon: Icon, title, description }) => (
                  <NavigationTile
                    key={title}
                    title={title}
                    description={description}
                    icon={Icon}
                    iconClassName="bg-primary/10 text-primary"
                  />
                ))}
              </div>
            </div>

            {/* Features */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-6">
                Features
              </h2>
              <div className="grid sm:grid-cols-2 gap-5">
                {FEATURES.map(({ icon: Icon, title, description }) => (
                  <NavigationTile
                    key={title}
                    title={title}
                    description={description}
                    icon={Icon}
                    iconClassName="bg-primary/10 text-primary"
                    layout="horizontal"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Teams Choose VDAB */}
      <section className="bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Why Teams Choose VDAB
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-xl">
            Built for data teams who need to ship fast without sacrificing
            control.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {WHY_VDAB.map(({ icon: Icon, title, description }) => (
              <NavigationTile
                key={title}
                title={title}
                description={description}
                icon={Icon}
                iconClassName="bg-primary/10 text-primary"
                className="bg-muted border-border hover:border-primary/40"
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary">
        <div className="max-w-7xl mx-auto px-8 py-14 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            Ready to start building?
          </h2>
          <p className="text-white/70 text-sm mb-8 max-w-md mx-auto">
            Join teams already using VDAB to ship Databricks apps faster.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/signup"
              className={buttonVariants({
                className:
                  "bg-card! text-primary! hover:bg-card/90! shadow-md text-sm font-semibold",
              })}
            >
              Get Started for Free
            </Link>
            <Link
              to="/pricing"
              className={buttonVariants({
                variant: "outline",
                className:
                  "border-white/40 hover:bg-card/10 text-white! bg-transparent text-sm",
              })}
            >
              See Pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

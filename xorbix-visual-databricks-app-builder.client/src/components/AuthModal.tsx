import React, { useEffect, useRef, useState } from "react";
import { useIdentity } from "../context/IdentityContext";
import { useLogger } from "../logger/useLogger";

type Props = {
  open: boolean;
  onClose: () => void;
};

const tabs = ["Login", "Create account"] as const;

const AuthModal: React.FC<Props> = ({ open, onClose }) => {
  const { login, signup } = useIdentity();
  const logger = useLogger("AuthModal");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // keep for future (feature flag)
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Click outside to close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        onClose();
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  if (!open) return null;

  const disabled = submitting || email.trim().length === 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (activeTab === "Login") {
        await login(email, password || undefined);
      } else {
        await signup(email, password || undefined);
      }
      onClose();
    } catch (e) {
      logger.handleError(e, "authModalSubmit");
      // TODO: show toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] transition-opacity" />

      {/* Panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          className="w-full max-w-md rounded-2xl bg-card shadow-2xl ring-1 ring-black/5 animate-[fadeIn_.18s_ease-out] will-change-transform"
          style={{ animationName: "fadeIn" }}
        >
          <div className="px-6 pt-5 pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">Welcome</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-4 grid grid-cols-2 rounded-xl bg-muted p-1">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`rounded-lg py-2 text-sm font-medium transition
                    ${activeTab === t ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Form */}
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Keep password field for future; hide by default or show behind a feature flag */}
              {/* <div>
                <label className="block text-sm font-medium text-foreground">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div> */}

              <button
                onClick={handleSubmit}
                disabled={disabled}
                className="mt-2 w-full rounded-lg bg-primary py-2 text-primary-foreground font-semibold shadow hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? activeTab === "Login"
                    ? "Signing in..."
                    : "Creating account…"
                  : activeTab === "Login"
                    ? "Sign in"
                    : "Create account"}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                By continuing you agree to our Terms and acknowledge the Privacy
                Policy.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* keyframes (Tailwind doesn't ship a default for fadeIn) */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default AuthModal;

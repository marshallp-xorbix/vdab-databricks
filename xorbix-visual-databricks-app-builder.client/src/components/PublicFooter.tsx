import XorbixLogo from "../assets/xorbix-logo.png";
import {
  PRIVACY_POLICY_URL,
  TERMS_AND_CONDITIONS_URL,
} from "../constants/legalLinks";

export default function PublicFooter() {
  return (
    <footer className="shell-header-chrome shrink-0 border-t border-border">
      <div className="flex w-full items-center justify-between gap-6 px-4 py-5 md:px-5">
        <img
          src={XorbixLogo}
          alt="Xorbix logo"
          className="h-6 shrink-0 object-contain"
        />
        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
          <a
            href={TERMS_AND_CONDITIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Terms and Conditions
          </a>
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Privacy Policy
          </a>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Xorbix Technologies, Inc. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

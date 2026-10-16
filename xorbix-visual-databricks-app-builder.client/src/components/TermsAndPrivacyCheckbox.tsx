import { ExternalLink } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { authLinkClassName } from "../constants/authBranding";
import {
  PRIVACY_POLICY_URL,
  TERMS_AND_CONDITIONS_URL,
} from "../constants/legalLinks";
import { cn } from "../lib/utils";

interface ITermsAndPrivacyCheckboxProps {
  checked: boolean;
  onCheckedChange: (accepted: boolean) => void;
  id?: string;
}

/**
 * Required Terms and Conditions + Privacy Policy acceptance control for signup flows.
 */
export default function TermsAndPrivacyCheckbox({
  checked,
  onCheckedChange,
  id = "terms",
}: Readonly<ITermsAndPrivacyCheckboxProps>) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label
        htmlFor={id}
        className="text-xs text-muted-foreground leading-snug cursor-pointer"
      >
        I agree to the{" "}
        <a
          href={TERMS_AND_CONDITIONS_URL}
          className={cn(authLinkClassName, "underline")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms and Conditions{" "}
          <ExternalLink className="inline-block ml-1" size={12} />
        </a>{" "}
        and{" "}
        <a
          href={PRIVACY_POLICY_URL}
          className={cn(authLinkClassName, "underline")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy <ExternalLink className="inline-block ml-1" size={12} />
        </a>
        {"."}
      </Label>
    </div>
  );
}

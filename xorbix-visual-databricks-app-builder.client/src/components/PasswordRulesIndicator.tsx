import { Check, X } from "lucide-react";
import type { PasswordRuleState } from "../utils/authUtils";

const RULES: {
  key: keyof Omit<PasswordRuleState, "isValid">;
  label: string;
}[] = [
  { key: "hasMinLength", label: "At least 8 characters" },
  { key: "hasUppercase", label: "One uppercase letter" },
  { key: "hasLowercase", label: "One lowercase letter" },
  { key: "hasDigit", label: "One digit" },
  { key: "hasSpecialCharacter", label: "One special character" },
];

interface Props {
  ruleState: PasswordRuleState;
}

export function PasswordRulesIndicator({ ruleState }: Readonly<Props>) {
  return (
    <ul className="space-y-1 text-xs">
      {RULES.map(({ key, label }) => {
        const passed = ruleState[key];
        return (
          <li key={key} className="flex items-center gap-1.5">
            {passed ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={passed ? "text-success-foreground" : "text-muted-foreground"}>
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

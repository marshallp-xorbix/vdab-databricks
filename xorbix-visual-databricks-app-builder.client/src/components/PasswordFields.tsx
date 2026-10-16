import { useMemo } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { PasswordRulesIndicator } from "./PasswordRulesIndicator";
import { getPasswordRuleState } from "../utils/authUtils";

interface Props {
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
}

export function PasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
}: Readonly<Props>) {
  const ruleState = useMemo(() => getPasswordRuleState(password), [password]);
  const showMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <>
      <PasswordRulesIndicator ruleState={ruleState} />
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Enter a secure password"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          placeholder="Re-enter your password"
        />
        {showMismatch && (
          <p className="text-xs text-destructive">Passwords do not match.</p>
        )}
      </div>
    </>
  );
}

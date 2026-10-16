export function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export interface PasswordRuleState {
  hasMinLength: boolean;
  hasDigit: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasSpecialCharacter: boolean;
  isValid: boolean;
}

export function getPasswordRuleState(password: string): PasswordRuleState {
  const hasMinLength = password.length >= 8;
  const hasDigit = /\d/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

  return {
    hasMinLength,
    hasDigit,
    hasLowercase,
    hasUppercase,
    hasSpecialCharacter,
    isValid:
      hasMinLength &&
      hasDigit &&
      hasLowercase &&
      hasUppercase &&
      hasSpecialCharacter,
  };
}

export function isPasswordFormValid(password: string, confirmPassword: string): boolean {
  return getPasswordRuleState(password).isValid && password === confirmPassword;
}

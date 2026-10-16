import { Link, useLocation } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { AuthButton } from "../components/AuthButton";
import { AuthPageShell } from "../components/AuthPageShell";
import { authAccentTextClassName } from "../constants/authBranding";
import { Card, CardContent } from "../components/ui/card";

export default function AccountCreatedPage() {
  const location = useLocation();
  const state = location.state as { email?: string; source?: string } | null;
  const email = state?.email;
  const isBetaSignup = state?.source === "beta";

  return (
    <AuthPageShell>
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-10 pb-8">
          <MailCheck className={`h-12 w-12 ${authAccentTextClassName} mx-auto mb-4`} />
          <h2 className="text-xl font-bold text-foreground mb-2">
            Check your email
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            We've sent a confirmation email to{" "}
            {email ? (
              <span className="font-medium text-foreground">{email}</span>
            ) : (
              "your email address"
            )}
            .
            {isBetaSignup
              ? " Once confirmed, set your password and sign in to start your beta trial."
              : " Once confirmed you will be able to complete your account setup."}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            If you don't receive the email, please check your spam folder. If
            you have any questions, please contact our support team.
          </p>
          <AuthButton asChild variant="outline">
            <Link to="/login">Back to Login</Link>
          </AuthButton>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}

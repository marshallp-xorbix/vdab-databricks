import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { AuthButton } from "../components/AuthButton";
import { useLoginWorkflow } from "../hooks/useLoginWorkflow";
import { AuthPageShell } from "../components/AuthPageShell";
import { authAccentTextClassName } from "../constants/authBranding";

interface ICodeStatusProps {
  isCodeLockedOut: boolean;
  timeLeft: number;
  formatTime: (seconds: number) => string;
}

/**
 * Status line under the code inputs. A spent attempt budget and an expired code both dead-end at
 * "request a new code", but they are different situations and are worded differently.
 *
 * The container is a polite live region so a screen reader is told why entry closed when the code is
 * locked out or expires (WCAG 2.2 AA 4.1.3). The countdown branch is `aria-hidden` on purpose: it
 * re-renders every second, and announcing a ticking timer per second is its own accessibility
 * anti-pattern. Hiding it leaves the live region empty during the countdown, so only the two terminal
 * transitions are ever announced.
 */
function renderCodeStatus({
  isCodeLockedOut,
  timeLeft,
  formatTime,
}: Readonly<ICodeStatusProps>) {
  if (isCodeLockedOut) {
    return (
      <p className="text-sm text-destructive font-medium">
        Too many incorrect attempts. Request a new code to continue.
      </p>
    );
  }

  if (timeLeft === 0) {
    return (
      <p className="text-sm text-destructive font-medium">
        Code has expired. Please request a new one.
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground" aria-hidden="true">
      Code expires in{" "}
      <span className={`font-mono ${authAccentTextClassName}`}>
        {formatTime(timeLeft)}
      </span>
    </p>
  );
}

export default function VerifyCodePage() {
  const navigate = useNavigate();
  const {
    codeDigits,
    loading,
    isResending,
    error,
    timeLeft,
    resendCooldownLeft,
    isCodeLockedOut,
    inputRefs,
    loadSession,
    abandonCodeVerification,
    handleCodeChange,
    handleCodeKeyDown,
    handlePaste,
    handleVerify,
    handleResend,
    formatTime,
  } = useLoginWorkflow();

  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      navigate("/login");
      return;
    }
    setEmail(session.email);
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resendDisabled =
    loading || isResending || resendCooldownLeft > 0 || !email;

  // Entry is closed once the code expires or the server reports the attempt budget is spent. In
  // both cases the only way forward is a new code, so the inputs stop accepting one.
  const entryDisabled = loading || isResending || timeLeft === 0 || isCodeLockedOut;

  let resendLabel = "Send again";
  if (resendCooldownLeft > 0) {
    resendLabel = `Resend available in ${formatTime(resendCooldownLeft)}`;
  } else if (timeLeft === 0 || isCodeLockedOut) {
    resendLabel = "Resend code";
  }

  return (
    <AuthPageShell>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">
            Verify Code
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            // Assertive live region: the per-attempt / throttle feedback set via setError is only
            // rendered here, so it must be announced (WCAG 2.2 AA 4.1.3). The countdown status region
            // above stays polite and aria-hidden during the tick, so it never competes with this.
            <div
              role="alert"
              className="mb-4 rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-foreground"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify(email);
            }}
            className="space-y-6"
          >
            <div className="flex justify-center gap-2">
              {codeDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="w-10 h-12 text-center text-xl font-bold rounded-md border border-border bg-card text-foreground focus:border-primary focus:ring-1 focus:ring-primary/25 outline-none transition-all disabled:opacity-50"
                  value={digit}
                  onChange={(e) => handleCodeChange(idx, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                  onPaste={handlePaste}
                  disabled={entryDisabled}
                />
              ))}
            </div>

            <div className="text-center" role="status" aria-live="polite">
              {renderCodeStatus({ isCodeLockedOut, timeLeft, formatTime })}
            </div>

            <AuthButton
              type="submit"
              disabled={entryDisabled}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Login"
              )}
            </AuthButton>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => handleResend(email)}
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground underline disabled:no-underline disabled:text-muted-foreground"
                disabled={resendDisabled}
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  resendLabel
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  // Leaving on purpose abandons the challenge, so the stored state goes with it.
                  abandonCodeVerification();
                  navigate("/login");
                }}
                className="block w-full text-sm text-muted-foreground hover:text-foreground underline"
                disabled={loading || isResending}
              >
                Use a different login method
              </button>
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center border-t border-border pt-6">
          <Link
            to="/login"
            onClick={abandonCodeVerification}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary! border border-transparent px-2 py-0.5 rounded-md transition-colors hover:border-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </CardFooter>
      </Card>
    </AuthPageShell>
  );
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthPageShell } from "../components/AuthPageShell";
import { authSpinnerClassName } from "../constants/authBranding";

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Autoforward to login after a few seconds
    const timer = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <AuthPageShell>
      <div className="flex flex-col items-center justify-center space-y-6">
        <Loader2 className={`h-10 w-10 animate-spin ${authSpinnerClassName}`} />
      </div>
    </AuthPageShell>
  );
}

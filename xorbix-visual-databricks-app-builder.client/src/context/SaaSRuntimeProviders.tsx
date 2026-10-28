import type { ReactNode } from "react";
import { IdentityProvider } from "./IdentityContext";
import { TenantProvider } from "./TenantContext";

interface ISaaSRuntimeProvidersProps {
  children: ReactNode;
}

function SaaSRuntimeProviders({ children }: Readonly<ISaaSRuntimeProvidersProps>) {
  return (
    <IdentityProvider>
      <TenantProvider>{children}</TenantProvider>
    </IdentityProvider>
  );
}

export default SaaSRuntimeProviders;

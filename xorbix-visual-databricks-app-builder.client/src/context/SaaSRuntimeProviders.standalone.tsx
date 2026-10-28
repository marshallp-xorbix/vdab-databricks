import type { ReactNode } from "react";

interface ISaaSRuntimeProvidersProps {
  children: ReactNode;
}

function SaaSRuntimeProviders({ children }: Readonly<ISaaSRuntimeProvidersProps>) {
  return <>{children}</>;
}

export default SaaSRuntimeProviders;

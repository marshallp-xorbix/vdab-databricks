import type React from "react";
import { useState } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IdentityProvider } from "./context/IdentityContext";
import { SettingsProvider } from "./context/SettingsContext";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  ThemeProvider,
} from "./context/ThemeContext";
import { TenantProvider } from "./context/TenantContext";
import { Toaster } from "./components/ui/toaster";
import appStylesHref from "./App.css?url";

// @ts-expect-error - This is a workaround to avoid type errors
import type { Route } from "./+types/root";

/* eslint-disable react-refresh/only-export-components -- React Router requires route metadata and boundaries in this module. */
export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: appStylesHref },
];

/** Resolves the theme before first paint; ThemeProvider reads the result off the class. */
const themeInitScript = `(function(){var k=${JSON.stringify(THEME_STORAGE_KEY)},d=${JSON.stringify(DEFAULT_THEME)},t;try{t=localStorage.getItem(k);}catch(e){}if(t!=="light"&&t!=="dark")t=d;var el=document.documentElement;el.classList.remove("light","dark");el.classList.add(t);el.style.colorScheme=t;})();`;

const queryClientOptions = {
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
};

export function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(() => new QueryClient(queryClientOptions));
  const isStandaloneDatabricksRuntime =
    import.meta.env.VITE_VDAB_RUNTIME === "databricks";

  return (
    <html className={DEFAULT_THEME} lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Visual Databricks App Builder - Xorbix</title>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Meta />
        <Links />
      </head>
      <body className="bg-background text-foreground font-sans">
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            {isStandaloneDatabricksRuntime ? (
              children
            ) : (
              <SettingsProvider>
                <IdentityProvider>
                  <TenantProvider>{children}</TenantProvider>
                </IdentityProvider>
              </SettingsProvider>
            )}
          </ThemeProvider>
        </QueryClientProvider>
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}

// TODO: Fix this behavior for production so that all of ths information is not exposed to the user.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container p-4 pt-16 mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="overflow-x-auto p-4 w-full">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

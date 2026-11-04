import { useEffect, useRef } from "react";

/**
 * Pushes load/API issues to the app-resources row (or clears on unmount) without stale closures.
 */
export function useReportWorkspacePickerIssue(
  issue: string | null,
  onWorkspacePickerIssue?: (message: string | null) => void,
): void {
  const callbackRef = useRef(onWorkspacePickerIssue);
  callbackRef.current = onWorkspacePickerIssue;

  useEffect(
    () => () => {
      callbackRef.current?.(null);
    },
    [],
  );

  useEffect(() => {
    callbackRef.current?.(issue);
  }, [issue]);
}

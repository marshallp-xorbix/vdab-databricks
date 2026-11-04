import { useSearchParams } from "react-router-dom";

/** Opens the selected component workflow and action without discarding editor drafts. */
export function useProjectWorkflowNavigation() {
  const [, setSearchParams] = useSearchParams();
  return (workflowCodeName: string, nodeId?: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("section", "workflows");
      next.set("workflowFocus", workflowCodeName);
      if (nodeId) next.set("actionFocus", nodeId);
      else next.delete("actionFocus");
      next.delete("tool");
      return next;
    });
  };
}

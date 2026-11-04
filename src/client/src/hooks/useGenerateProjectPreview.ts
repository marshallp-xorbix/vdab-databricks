import { useMutation } from "@tanstack/react-query";
import { generateProjectPreview } from "../api/projectComponentsApi";

/** Requests generated source without deploying or mutating the project. */
export function useGenerateProjectPreview() {
  return useMutation({ mutationFn: generateProjectPreview });
}

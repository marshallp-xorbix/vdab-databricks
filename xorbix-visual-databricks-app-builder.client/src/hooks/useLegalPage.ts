import { useQuery } from "@tanstack/react-query";
import { legalPagesApi } from "../api/LegalPagesApi";

/** Client cache window aligned with default backend WordPressConfiguration.CacheSeconds. */
const LEGAL_PAGE_STALE_TIME_MS = 5 * 60 * 1000;

export const legalPageKeys = {
  all: ["legalPage"] as const,
  bySlug: (slug: string) => [...legalPageKeys.all, slug] as const,
};

interface IUseLegalPageOptions {
  /** WordPress page slug (e.g. privacy-policy). */
  slug: string;
  /** When false, the query does not run. Defaults to true. */
  enabled?: boolean;
}

/**
 * Loads sanitized legal page HTML for a WordPress slug.
 */
export function useLegalPage({ slug, enabled = true }: IUseLegalPageOptions) {
  return useQuery({
    queryKey: legalPageKeys.bySlug(slug),
    queryFn: () => legalPagesApi.getLegalPage(slug),
    enabled: enabled && !!slug,
    staleTime: LEGAL_PAGE_STALE_TIME_MS,
  });
}

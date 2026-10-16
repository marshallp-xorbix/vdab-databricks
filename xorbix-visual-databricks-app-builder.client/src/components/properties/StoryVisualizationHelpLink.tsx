import { ExternalLink } from "lucide-react";
import { VISUALIZATION_STORY_COMPONENTS_HELP_URL } from "../../constants/helpLinks";

/**
 * Compact Help Center link for story visualization property panels.
 */
export function StoryVisualizationHelpLink() {
  return (
    <a
      href={VISUALIZATION_STORY_COMPONENTS_HELP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
    >
      Help
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

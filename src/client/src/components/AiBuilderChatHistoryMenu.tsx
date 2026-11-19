import { History } from "lucide-react";
import type { IAiBuilderChat } from "../utils/aiBuilderChatHistory";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface IAiBuilderChatHistoryMenuProps {
  chats: IAiBuilderChat[];
  activeChatId: string | null;
  disabled?: boolean;
  onSelectChat: (chatId: string) => void;
}

/** Local chat picker for switching among project-scoped AI Builder conversations. */
function AiBuilderChatHistoryMenu({
  chats,
  activeChatId,
  disabled = false,
  onSelectChat,
}: Readonly<IAiBuilderChatHistoryMenuProps>) {
  const sortedChats = [...chats].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Chat history"
          aria-label="Chat history"
          disabled={disabled}
        >
          <History className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Chat history</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sortedChats.length === 0 ? (
          <DropdownMenuItem disabled>No saved chats yet</DropdownMenuItem>
        ) : (
          sortedChats.map((chat) => (
            <DropdownMenuItem
              key={chat.id}
              className="flex flex-col items-start gap-0.5"
              onSelect={() => onSelectChat(chat.id)}
            >
              <span className="w-full truncate font-medium">
                {chat.id === activeChatId ? `${chat.title} (current)` : chat.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatChatTimestamp(chat.updatedAt)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatChatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved locally";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default AiBuilderChatHistoryMenu;

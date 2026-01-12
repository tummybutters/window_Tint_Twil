import { ConversationListItem } from "./ConversationListItem";
import { Loader2, MessageSquare } from "lucide-react";
import type { ConversationWithAssessment } from "@shared/schema";

interface ConversationListProps {
  conversations: ConversationWithAssessment[];
  activeConversationPhone: string | null;
  onSelectConversation: (phone: string) => void;
  isLoading?: boolean;
}

export function ConversationList({
  conversations,
  activeConversationPhone,
  onSelectConversation,
  isLoading,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center max-w-xs">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-sm font-semibold mb-1">No conversations</h3>
          <p className="text-xs text-muted-foreground">
            Incoming SMS messages will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full" data-testid="conversation-list">
      {conversations.map((conversation) => (
        <ConversationListItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.phone === activeConversationPhone}
          onClick={() => onSelectConversation(conversation.phone)}
        />
      ))}
    </div>
  );
}

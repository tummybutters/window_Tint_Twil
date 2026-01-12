import { formatDistanceToNow, format } from "date-fns";
import { Phone, CalendarCheck, PhoneCall, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConversationWithAssessment, Sentiment } from "@shared/schema";

interface ConversationListItemProps {
  conversation: ConversationWithAssessment;
  isActive: boolean;
  onClick: () => void;
}

function getSentimentColor(sentiment?: Sentiment): string {
  if (!sentiment) return "bg-muted-foreground";
  
  switch (sentiment) {
    case "Positive":
      return "bg-chart-2";
    case "Negative":
      return "bg-chart-5";
    case "Neutral":
      return "bg-chart-4";
    default:
      return "bg-muted-foreground";
  }
}

function formatPhoneNumber(phone: string): string {
  // Format +18669726177 to +1 (866) 972-6177
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

function formatCallTimestamp(callTimestamp?: string | Date | null): string {
  if (!callTimestamp) return "";
  const date = callTimestamp instanceof Date ? callTimestamp : new Date(callTimestamp);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "eee h:mm a");
}

export function ConversationListItem({
  conversation,
  isActive,
  onClick,
}: ConversationListItemProps) {
  const sentimentColor = getSentimentColor(conversation.assessment?.sentiment as Sentiment);
  const showNeedsReply = conversation.needsReply;
  const showCallBadge = !showNeedsReply && Boolean(
    conversation.callSuppressedAt &&
      !conversation.readyToBook &&
      !conversation.aiEnabled,
  );
  const highlightClass = conversation.readyToBook
    ? "ring-2 ring-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
    : showNeedsReply
        ? "ring-2 ring-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.35)]"
        : showCallBadge
            ? "ring-2 ring-sky-500/50 shadow-[0_0_20px_rgba(56,189,248,0.35)]"
            : "";
  const callTimestamp = formatCallTimestamp(conversation.callSuppressedAt);
  const callBadgeLabel = callTimestamp ? `Was on Call at ${callTimestamp}` : "Was on Call";
  
  return (
    <button
      onClick={onClick}
      data-testid={`conversation-item-${conversation.phone}`}
      className={`
        w-full text-left px-4 py-3 border-b border-border transition-all duration-300
        hover-elevate active-elevate-2
        ${isActive ? "border-l-2 border-l-primary bg-accent" : "border-l-2 border-l-transparent"}
        ${highlightClass}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium text-sm truncate" data-testid={`text-phone-${conversation.phone}`}>
            {conversation.name || formatPhoneNumber(conversation.phone)}
          </span>
          {showNeedsReply && (
            <Badge
              variant="default"
              className="ml-1 flex-shrink-0 gap-1 bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="badge-needs-reply"
              title="Customer replied after the call"
            >
              <MessageCircle className="h-3 w-3" />
              Needs Reply
            </Badge>
          )}
          {conversation.readyToBook && (
            <Badge 
              variant="default" 
              className="ml-1 flex-shrink-0 gap-1 bg-green-600 hover:bg-green-700 text-white"
              data-testid="badge-ready-to-book"
              title={conversation.bookingNotes || "Ian needs to respond personally"}
            >
              <CalendarCheck className="h-3 w-3" />
              Needs Ian
            </Badge>
          )}
          {showCallBadge && (
            <Badge
              variant="default"
              className="ml-1 flex-shrink-0 gap-1 bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="badge-call-complete"
              title={callBadgeLabel}
            >
              <PhoneCall className="h-3 w-3" />
              {callBadgeLabel}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {conversation.assessment?.sentiment && (
            <div
              className={`w-2 h-2 rounded-full ${sentimentColor}`}
              title={`Sentiment: ${conversation.assessment.sentiment}`}
            />
          )}
        </div>
      </div>
      
      {conversation.lastMessage && (
        <p className="text-sm text-muted-foreground truncate mb-1" data-testid="text-last-message">
          {conversation.lastMessage}
        </p>
      )}
      
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground" data-testid="text-last-activity">
          {conversation.lastActivity 
            ? formatDistanceToNow(new Date(conversation.lastActivity), { addSuffix: true })
            : ""}
        </span>
        {conversation.assessment?.probability && (
          <span className="text-xs font-medium text-primary" data-testid="text-probability">
            {conversation.assessment.probability}
          </span>
        )}
      </div>
    </button>
  );
}

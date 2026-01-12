import { format } from "date-fns";
import { Check, CheckCheck, X } from "lucide-react";
import type { Message, MessageStatus } from "@shared/schema";

interface MessageBubbleProps {
  message: Message;
}

function getStatusIcon(status: MessageStatus) {
  switch (status) {
    case "sending":
      return <Check className="h-3 w-3 text-primary-foreground/60" />;
    case "sent":
      return <CheckCheck className="h-3 w-3 text-primary-foreground/80" />;
    case "failed":
      return <X className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const hasMedia = !!message.mediaUrl;
  const hasText = message.text && message.text.trim().length > 0;
  const isImage = hasMedia && message.mediaType?.startsWith('image/');
  
  return (
    <div
      className={`flex ${isOutbound ? "justify-end" : "justify-start"} mb-3`}
      data-testid={`message-${message.id}`}
    >
      <div className={`max-w-[75%] ${isOutbound ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`
            rounded-2xl overflow-hidden
            ${isOutbound 
              ? "bg-primary text-primary-foreground rounded-tr-md" 
              : "bg-card border border-card-border rounded-tl-md"
            }
            ${hasMedia && !hasText ? '' : 'px-4 py-2.5'}
          `}
        >
          {isImage && message.mediaUrl && (
            <a
              href={message.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              data-testid={`image-${message.id}`}
            >
              <img
                src={message.mediaUrl}
                alt="Shared image"
                className={`max-w-full h-auto rounded-lg ${hasText ? 'mb-2' : ''}`}
                style={{ maxHeight: '300px', objectFit: 'contain' }}
                loading="lazy"
              />
            </a>
          )}
          {hasText && (
            <p className={`text-sm whitespace-pre-wrap break-words ${isOutbound ? "" : "text-card-foreground"} ${isImage ? 'mt-2' : ''}`}>
              {message.text}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 px-1">
          <span className="text-xs text-muted-foreground">
            {format(new Date(message.timestamp), "h:mm a")}
          </span>
          {isOutbound && getStatusIcon(message.status as MessageStatus)}
        </div>
      </div>
    </div>
  );
}

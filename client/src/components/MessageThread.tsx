import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { Loader2, MessageSquare } from "lucide-react";
import type { Message } from "@shared/schema";

interface MessageThreadProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageThread({ messages, isLoading }: MessageThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth flex flex-col justify-end">
        <div className="flex items-center justify-center min-h-full">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          </div>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth flex flex-col justify-end">
        <div className="flex items-center justify-center min-h-full">
          <div className="text-center max-w-md px-4">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-sm text-muted-foreground">
              This is the beginning of your conversation. Send a message to get started!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 scroll-smooth"
      data-testid="message-thread"
    >
      <div className="min-h-full flex flex-col justify-end space-y-1">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

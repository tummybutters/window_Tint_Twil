import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ComposeMessageProps {
  onSend: (text: string) => void;
  isSending?: boolean;
  disabled?: boolean;
}

export function ComposeMessage({ onSend, isSending, disabled }: ComposeMessageProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim() && !isSending && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="flex gap-2 items-end">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          className="resize-none min-h-[60px] max-h-[120px]"
          disabled={disabled || isSending}
          data-testid="input-message"
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || isSending || disabled}
          size="default"
          data-testid="button-send"
          className="flex-shrink-0"
        >
          {isSending ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              <span>Sending</span>
            </div>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

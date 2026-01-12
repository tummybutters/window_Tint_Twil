import { env } from "../config/env";
import { triggerAIResponse } from "./ai-workflow";
import type { WorkflowContext } from "./workflow";

const pendingReplies = new Map<string, NodeJS.Timeout>();

export function cancelPendingAIResponse(phone: string): void {
  const existing = pendingReplies.get(phone);
  if (existing) {
    clearTimeout(existing);
    pendingReplies.delete(phone);
  }
}

export function scheduleAIResponse({
  phone,
  conversationSid,
  workflowContext,
  expectedLastInboundId,
}: {
  phone: string;
  conversationSid: string;
  workflowContext?: WorkflowContext;
  expectedLastInboundId?: string;
}): void {
  const delayMs = env.aiReplyDebounceMs;
  if (delayMs <= 0) {
    triggerAIResponse(phone, conversationSid, workflowContext, expectedLastInboundId).catch(
      (err) => console.error("Error triggering AI response:", err),
    );
    return;
  }

  cancelPendingAIResponse(phone);

  const timeout = setTimeout(() => {
    pendingReplies.delete(phone);
    triggerAIResponse(phone, conversationSid, workflowContext, expectedLastInboundId).catch(
      (err) => console.error("Error triggering AI response:", err),
    );
  }, delayMs);

  pendingReplies.set(phone, timeout);
}

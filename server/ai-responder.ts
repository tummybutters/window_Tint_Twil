import OpenAI from "openai";
import type { Message } from "@shared/schema";
import { env } from "./config/env";
import { tintBotSystemPrompt } from "./config/prompts";
import { buildWorkflowSystemPrompt, type WorkflowContext } from "./services/workflow";

const openai = new OpenAI({
  baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL || "",
  apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
});

/**
 * Generate AI response for customer message
 * @param messages - Conversation history (oldest to newest)
 * @returns AI-generated response text
 */
export async function generateAIResponse(
  messages: Message[],
  workflowContext?: WorkflowContext,
): Promise<string> {
  try {
    // Check if OpenAI credentials are configured
    if (!env.AI_INTEGRATIONS_OPENAI_BASE_URL || !env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      throw new Error("OpenAI credentials not configured");
    }

    // Convert our message format to OpenAI format (oldest to newest)
    const chatMessages: OpenAI.ChatCompletionMessageParam[] = messages.map(msg => ({
      role: msg.direction === "inbound" ? "user" : "assistant",
      content: msg.text
    }));

    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const systemMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: tintBotSystemPrompt },
    ];

    if (workflowContext) {
      systemMessages.push({
        role: "system",
        content: buildWorkflowSystemPrompt(workflowContext),
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [...systemMessages, ...chatMessages],
      max_completion_tokens: 2000, // GPT-5 uses reasoning tokens, need higher limit for actual response
    });

    const response = completion.choices[0]?.message?.content?.trim();

    if (!response) {
      console.error('No response - completion object:', JSON.stringify(completion, null, 2));
      throw new Error("No response generated from AI");
    }

    return response;
  } catch (error) {
    console.error("Error generating AI response:", error);
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to generate AI response");
  }
}

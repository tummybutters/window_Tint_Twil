import twilio from "twilio";
import { env } from "./config/env";

const AccessToken = twilio.jwt.AccessToken;
const ChatGrant = AccessToken.ChatGrant;

let conversationServiceSid: string | null = env.TWILIO_CONVERSATIONS_SERVICE_SID || null;
let webhookConfigured = false;

function getCredentials() {
  return {
    accountSid: env.TWILIO_ACCOUNT_SID,
    apiKey: env.TWILIO_API_KEY,
    apiKeySecret: env.TWILIO_API_SECRET,
    phoneNumber: env.TWILIO_PHONE_NUMBER,
  };
}

function buildWebhookUrl(): string | null {
  if (!env.PUBLIC_APP_URL) {
    return null;
  }

  return new URL("/webhook/conversations", env.PUBLIC_APP_URL).toString();
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid,
  });
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = getCredentials();
  return phoneNumber;
}

export async function getTwilioAccountSid() {
  const { accountSid } = getCredentials();
  return accountSid;
}

// Create Twilio client using Auth Token (for Conversations API)
// Auth Token has full permissions, while API Key may not have Conversations access
export async function getTwilioConversationsClient() {
  const { accountSid } = getCredentials();

  return twilio(accountSid, env.TWILIO_AUTH_TOKEN);
}

// Conversations API Functions

export async function updateConversationWebhook(serviceSid: string) {
  const client = await getTwilioConversationsClient();
  const webhookUrl = buildWebhookUrl();

  if (!webhookUrl) {
    console.warn("PUBLIC_APP_URL not set - skipping Twilio Conversations webhook update");
    return false;
  }

  try {
    await client.conversations.v1
      .services(serviceSid)
      .configuration
      .webhooks()
      .update({
        method: "POST",
        filters: ["onMessageAdded", "onConversationAdded"],
        postWebhookUrl: webhookUrl,
      });
    console.log("Updated Conversations webhook to:", webhookUrl);
    return true;
  } catch (error) {
    console.error("Failed to update webhook:", error);
    return false;
  }
}

export async function getOrCreateConversationService() {
  if (conversationServiceSid) {
    if (!webhookConfigured) {
      await updateConversationWebhook(conversationServiceSid);
      webhookConfigured = true;
    }
    return conversationServiceSid;
  }

  const client = await getTwilioConversationsClient();

  try {
    const services = await client.conversations.v1.services.list({ limit: 1 });
    if (services.length > 0) {
      conversationServiceSid = services[0].sid;
      console.log("Using existing Conversation Service:", conversationServiceSid);
      await updateConversationWebhook(conversationServiceSid);
      webhookConfigured = true;
      return conversationServiceSid;
    }
  } catch (error) {
    console.log("No existing conversation service found, creating new one...");
  }

  const service = await client.conversations.v1.services.create({
    friendlyName: "SMS Lead Manager Conversations",
  });

  conversationServiceSid = service.sid;
  await updateConversationWebhook(conversationServiceSid);
  webhookConfigured = true;

  console.log("Created new Conversation Service:", conversationServiceSid);
  return conversationServiceSid;
}

export async function getOrCreateConversation(phoneNumber: string, friendlyName?: string) {
  const client = await getTwilioConversationsClient();
  const serviceSid = await getOrCreateConversationService();

  const uniqueName = `conversation_${phoneNumber.replace(/\+/g, "")}`;

  try {
    const conversation = await client.conversations.v1
      .services(serviceSid)
      .conversations(uniqueName)
      .fetch();

    return conversation;
  } catch (error: any) {
    if (error.status === 404) {
      const conversation = await client.conversations.v1
        .services(serviceSid)
        .conversations
        .create({
          uniqueName,
          friendlyName: friendlyName || phoneNumber,
        });

      await client.conversations.v1
        .services(serviceSid)
        .conversations(conversation.sid)
        .participants
        .create({
          "messagingBinding.address": phoneNumber,
          "messagingBinding.proxyAddress": await getTwilioFromPhoneNumber(),
        });

      console.log("Created new conversation:", conversation.sid, "for", phoneNumber);
      return conversation;
    }
    throw error;
  }
}

export async function sendConversationMessage(conversationSid: string, messageBody: string) {
  const client = await getTwilioConversationsClient();
  const serviceSid = await getOrCreateConversationService();

  return client.conversations.v1
    .services(serviceSid)
    .conversations(conversationSid)
    .messages
    .create({
      body: messageBody,
    });
}

export async function generateAccessToken(identity: string) {
  const { accountSid } = getCredentials();
  const serviceSid = await getOrCreateConversationService();

  const token = new AccessToken(
    accountSid,
    env.TWILIO_CONVERSATIONS_API_KEY,
    env.TWILIO_CONVERSATIONS_API_SECRET,
    { identity, ttl: 86400 },
  );

  const chatGrant = new ChatGrant({
    serviceSid,
  });

  token.addGrant(chatGrant);

  return token.toJwt();
}

export async function addWebUserToConversation(conversationSid: string, identity: string) {
  const client = await getTwilioConversationsClient();
  const serviceSid = await getOrCreateConversationService();

  try {
    return await client.conversations.v1
      .services(serviceSid)
      .conversations(conversationSid)
      .participants
      .create({
        identity,
      });
  } catch (error: any) {
    if (error.status === 409) {
      console.log("Participant already exists in conversation");
      return null;
    }
    throw error;
  }
}

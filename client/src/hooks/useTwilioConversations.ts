import { useState, useEffect, useCallback, useRef } from 'react';
import { Client, Conversation, Message as TwilioMessage } from '@twilio/conversations';
import { apiRequest } from '@/lib/queryClient';

interface UseTwilioConversationsResult {
  client: Client | null;
  conversation: Conversation | null;
  isConnected: boolean;
  isJoining: boolean;
  error: string | null;
  joinConversation: (phone: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  onMessageAdded: ((message: TwilioMessage) => void) | null;
  setOnMessageAdded: (callback: (message: TwilioMessage) => void) => void;
}

interface UseTwilioConversationsOptions {
  enabled?: boolean;
}

const IDENTITY_STORAGE_KEY = "twilioConversationsIdentity";

export function useTwilioConversations(
  options: UseTwilioConversationsOptions = {},
): UseTwilioConversationsResult {
  const { enabled = true } = options;
  const [client, setClient] = useState<Client | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const onMessageAddedRef = useRef<((message: TwilioMessage) => void) | null>(null);
  const identityRef = useRef<string | null>(null);

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);
  // Initialize Twilio Conversations Client
  useEffect(() => {
    let twilioClient: Client | null = null;

    if (!enabled) {
      setClient(null);
      setConversation(null);
      setIsConnected(false);
      setError(null);
      return;
    }

    const initializeClient = async () => {
      try {
        const storedIdentity = localStorage.getItem(IDENTITY_STORAGE_KEY);
        const payload = storedIdentity ? { identity: storedIdentity } : {};

        // Get access token from backend
        const response = await apiRequest('POST', '/api/twilio/token', payload);
        const data = await response.json();

        setIdentity(data.identity);
        identityRef.current = data.identity;
        localStorage.setItem(IDENTITY_STORAGE_KEY, data.identity);

        // Create Twilio Client
        twilioClient = new Client(data.token);

        // Set up event listeners
        twilioClient.on('initialized', () => {
          console.log('Twilio Conversations client initialized');
          setIsConnected(true);
        });

        twilioClient.on('initFailed', ({ error }) => {
          console.error('Twilio client init failed:', error);
          setError('Failed to initialize Twilio client');
          setIsConnected(false);
        });

        twilioClient.on('connectionStateChanged', (state) => {
          console.log('Connection state changed:', state);
          if (state === 'connected') {
            setIsConnected(true);
          } else if (state === 'disconnected' || state === 'denied') {
            setIsConnected(false);
          }
        });

        twilioClient.on('tokenAboutToExpire', async () => {
          console.log('Token about to expire, refreshing...');
          try {
            const currentIdentity =
              identityRef.current || localStorage.getItem(IDENTITY_STORAGE_KEY);
            const refreshPayload = currentIdentity ? { identity: currentIdentity } : {};
            const response = await apiRequest('POST', '/api/twilio/token', refreshPayload);
            const refreshed = await response.json();

            identityRef.current = refreshed.identity;
            setIdentity(refreshed.identity);
            localStorage.setItem(IDENTITY_STORAGE_KEY, refreshed.identity);

            await twilioClient?.updateToken(refreshed.token);
          } catch (err) {
            console.error('Failed to refresh token:', err);
          }
        });

        setClient(twilioClient);
      } catch (err) {
        console.error('Failed to initialize Twilio client:', err);
        setError('Failed to connect to chat service');
        identityRef.current = null;
        setIdentity(null);
        localStorage.removeItem(IDENTITY_STORAGE_KEY);
      }
    };

    initializeClient();

    // Cleanup on unmount
    return () => {
      if (twilioClient) {
        twilioClient.removeAllListeners();
        twilioClient.shutdown();
      }
    };
  }, [enabled]);

  // Join a conversation
  const joinConversation = useCallback(
    async (phone: string) => {
      const currentIdentity = identityRef.current;

      if (!enabled || !client || !currentIdentity) {
        console.error('Client not initialized');
        return;
      }

      setIsJoining(true);
      setError(null);

      try {
        // Clean up previous conversation's event listeners to prevent duplicate handlers
        if (conversation) {
          conversation.removeAllListeners('messageAdded');
        }

        // Call backend to join conversation
        const response = await apiRequest(
          'POST',
          `/api/conversations/${encodeURIComponent(phone)}/join`,
          { identity: currentIdentity }
        );
        const data = await response.json();

        // Get the conversation from Twilio
        const conv = await client.getConversationBySid(data.conversationSid);

        // Set up message listener
        conv.on('messageAdded', (message: TwilioMessage) => {
          console.log('New message added:', message.body?.substring(0, 30) + '...');
          if (onMessageAddedRef.current) {
            onMessageAddedRef.current(message);
          }
        });

        setConversation(conv);
      } catch (err: any) {
        console.error('Failed to join conversation:', err);
        setError(err.message || 'Failed to join conversation');
      } finally {
        setIsJoining(false);
      }
    },
    [client, enabled, conversation]
  );

  // Send a message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversation) {
        throw new Error('No active conversation');
      }

      try {
        await conversation.sendMessage(text);
      } catch (err: any) {
        console.error('Failed to send message:', err);
        throw err;
      }
    },
    [conversation]
  );

  const setOnMessageAdded = useCallback((callback: (message: TwilioMessage) => void) => {
    onMessageAddedRef.current = callback;
  }, []);

  return {
    client,
    conversation,
    isConnected,
    isJoining,
    error,
    joinConversation,
    sendMessage,
    onMessageAdded: onMessageAddedRef.current,
    setOnMessageAdded,
  };
}

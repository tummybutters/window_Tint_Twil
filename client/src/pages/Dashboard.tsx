import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AuthScreen } from "@/components/AuthScreen";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTwilioConversations } from "@/hooks/useTwilioConversations";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { supabase } from "@/lib/supabaseClient";
import type { ConversationWithAssessment, Message, LeadAssessment } from "@shared/schema";

export default function Dashboard() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { session, isLoading: authLoading } = useSupabaseSession();
  const isAuthenticated = !!session;
  const hasActiveConversation = !!selectedPhone && isAuthenticated;

  const { isConnected, joinConversation, setOnMessageAdded, error: twilioError } =
    useTwilioConversations({ enabled: isAuthenticated });

  const { data: conversations = [], isLoading: conversationsLoading } =
    useQuery<ConversationWithAssessment[]>({
      queryKey: ["/api/conversations"],
      refetchInterval: isAuthenticated ? (isConnected ? 15000 : 5000) : false,
      enabled: isAuthenticated,
    });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", selectedPhone, "messages"],
    enabled: hasActiveConversation,
    refetchInterval: hasActiveConversation ? (isConnected ? false : 5000) : false,
  });

  const { data: assessment, isLoading: assessmentLoading } =
    useQuery<LeadAssessment | null>({
      queryKey: ["/api/conversations", selectedPhone, "assessment"],
      enabled: hasActiveConversation,
      refetchInterval: hasActiveConversation ? (isConnected ? 60000 : 10000) : false,
    });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSelectedPhone(null);
  };

  useEffect(() => {
    if (selectedPhone && isConnected) {
      joinConversation(selectedPhone);
    }
  }, [selectedPhone, isConnected, joinConversation]);

  useEffect(() => {
    setOnMessageAdded(() => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedPhone, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    });
  }, [selectedPhone, setOnMessageAdded]);

  useEffect(() => {
    if (twilioError) {
      toast({
        variant: "destructive",
        title: "Chat connection error",
        description: twilioError,
      });
    }
  }, [twilioError, toast]);

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedPhone) throw new Error("No conversation selected");
      return apiRequest(
        "POST",
        `/api/conversations/${encodeURIComponent(selectedPhone)}/messages`,
        { text },
      );
    },
    onMutate: async (text: string) => {
      if (!selectedPhone) return;

      await queryClient.cancelQueries({
        queryKey: ["/api/conversations", selectedPhone, "messages"],
      });

      const previousMessages = queryClient.getQueryData<Message[]>([
        "/api/conversations",
        selectedPhone,
        "messages",
      ]);

      const conversation = conversations.find((c) => c.phone === selectedPhone);
      if (conversation) {
        const tempMessage: Message = {
          id: `temp-${Date.now()}`,
          conversationId: conversation.id,
          text,
          timestamp: new Date(),
          direction: "outbound",
          status: "sending",
          mediaUrl: null,
          mediaType: null,
          externalId: null,
          source: "dashboard",
        };

        queryClient.setQueryData<Message[]>(
          ["/api/conversations", selectedPhone, "messages"],
          (old) => [...(old || []), tempMessage],
        );
      }

      return { previousMessages };
    },
    onError: (error: Error, _text, context) => {
      if (context?.previousMessages && selectedPhone) {
        queryClient.setQueryData(
          ["/api/conversations", selectedPhone, "messages"],
          context.previousMessages,
        );
      }
      toast({
        variant: "destructive",
        title: "Failed to send message",
        description: error.message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedPhone, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    if (selectedPhone) {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedPhone, "messages"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedPhone, "assessment"],
      });
    }
    toast({
      title: "Refreshing...",
      description: "Fetching latest messages",
    });
  };

  const toggleAIMutation = useMutation({
    mutationFn: async ({ phone, enabled }: { phone: string; enabled: boolean }) =>
      apiRequest("POST", `/api/conversations/${encodeURIComponent(phone)}/ai-toggle`, {
        enabled,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: variables.enabled ? "AI Assistant Enabled" : "AI Assistant Disabled",
        description: variables.enabled
          ? "ObsidianBot will now auto-reply to customer messages"
          : "You'll need to reply manually",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to toggle AI",
        description: error.message,
      });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (phone: string) =>
      apiRequest("DELETE", `/api/conversations/${encodeURIComponent(phone)}`),
    onSuccess: () => {
      setSelectedPhone(null);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Conversation Deleted",
        description: "All messages and data have been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete conversation",
        description: error.message,
      });
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const selectedConversation = conversations.find((c) => c.phone === selectedPhone);

  const handleToggleAI = (enabled: boolean) => {
    if (!selectedPhone) return;
    toggleAIMutation.mutate({ phone: selectedPhone, enabled });
  };

  const handleDeleteConversation = () => {
    if (!selectedPhone) return;
    deleteConversationMutation.mutate(selectedPhone);
  };

  return (
    <DashboardLayout
      isMobile={isMobile}
      conversations={conversations}
      conversationsLoading={conversationsLoading}
      selectedPhone={selectedPhone}
      selectedConversation={selectedConversation}
      messages={messages}
      messagesLoading={messagesLoading}
      assessment={assessment}
      assessmentLoading={assessmentLoading}
      onSelectPhone={setSelectedPhone}
      onRefresh={handleRefresh}
      onSendMessage={(text) => sendMessageMutation.mutate(text)}
      isSending={sendMessageMutation.isPending}
      onToggleAI={handleToggleAI}
      isTogglingAI={toggleAIMutation.isPending}
      onDeleteConversation={handleDeleteConversation}
      isDeletingConversation={deleteConversationMutation.isPending}
      onSignOut={handleSignOut}
    />
  );
}

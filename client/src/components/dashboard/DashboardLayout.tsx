import { MessageSquare, RefreshCw, Bot, Trash2, ArrowLeft, LogOut } from "lucide-react";
import { ConversationList } from "@/components/ConversationList";
import { MessageThread } from "@/components/MessageThread";
import { LeadAssessmentCard } from "@/components/LeadAssessmentCard";
import { ComposeMessage } from "@/components/ComposeMessage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { branding } from "@/config/branding";
import type { ConversationWithAssessment, LeadAssessment, Message } from "@shared/schema";

interface DashboardLayoutProps {
  isMobile: boolean;
  conversations: ConversationWithAssessment[];
  conversationsLoading: boolean;
  selectedPhone: string | null;
  selectedConversation?: ConversationWithAssessment;
  messages: Message[];
  messagesLoading: boolean;
  assessment: LeadAssessment | null | undefined;
  assessmentLoading: boolean;
  onSelectPhone: (phone: string | null) => void;
  onRefresh: () => void;
  onSendMessage: (text: string) => void;
  isSending: boolean;
  onToggleAI: (enabled: boolean) => void;
  isTogglingAI: boolean;
  onDeleteConversation: () => void;
  isDeletingConversation: boolean;
  onSignOut: () => void;
}

function ListHeaderActions({ onRefresh, onSignOut }: { onRefresh: () => void; onSignOut: () => void }) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={onRefresh}
        data-testid="button-refresh"
        className="hover-elevate active-elevate-2"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onSignOut}
        data-testid="button-sign-out"
        className="hover-elevate active-elevate-2"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </Button>
      <ThemeToggle />
    </div>
  );
}

function AuthActions({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={onSignOut}
        data-testid="button-sign-out"
        className="hover-elevate active-elevate-2"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </Button>
      <ThemeToggle />
    </div>
  );
}

export function DashboardLayout({
  isMobile,
  conversations,
  conversationsLoading,
  selectedPhone,
  selectedConversation,
  messages,
  messagesLoading,
  assessment,
  assessmentLoading,
  onSelectPhone,
  onRefresh,
  onSendMessage,
  isSending,
  onToggleAI,
  isTogglingAI,
  onDeleteConversation,
  isDeletingConversation,
  onSignOut,
}: DashboardLayoutProps) {
  if (isMobile) {
    if (!selectedPhone) {
      return (
        <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
          <div className="p-4 border-b border-border flex items-center justify-between gap-2 bg-card">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="h-5 w-5 text-primary flex-shrink-0" />
              <h1 className="text-lg font-semibold truncate">{branding.productName}</h1>
            </div>
            <ListHeaderActions onRefresh={onRefresh} onSignOut={onSignOut} />
          </div>
          <div className="flex-1 overflow-hidden">
            <ConversationList
              conversations={conversations}
              activeConversationPhone={selectedPhone}
              onSelectConversation={onSelectPhone}
              isLoading={conversationsLoading}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
        <div className="border-b border-border p-4 bg-background space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSelectPhone(null)}
                className="hover-elevate active-elevate-2"
                data-testid="button-back-to-list"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to conversations</span>
              </Button>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold truncate" data-testid="text-conversation-title">
                  {selectedConversation?.name || selectedPhone}
                </h2>
                <p className="text-sm text-muted-foreground font-mono" data-testid="text-phone-number">
                  {selectedPhone}
                </p>
              </div>
            </div>
            <AuthActions onSignOut={onSignOut} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Label htmlFor="ai-toggle" className="flex items-center gap-2.5 text-base font-medium cursor-pointer">
                <Bot
                  className={`h-5 w-5 ${
                    selectedConversation?.aiEnabled ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span>AI Assistant</span>
              </Label>
              <Switch
                id="ai-toggle"
                checked={selectedConversation?.aiEnabled ?? false}
                onCheckedChange={onToggleAI}
                disabled={isTogglingAI}
                data-testid="switch-ai-assistant"
              />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="button-delete-conversation"
                  className="hover-elevate active-elevate-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all messages, lead assessment data, and conversation history for {selectedPhone}.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDeleteConversation}
                    data-testid="button-confirm-delete"
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeletingConversation}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-border bg-background">
          <LeadAssessmentCard assessment={assessment} isLoading={assessmentLoading} />
        </div>

        <MessageThread messages={messages} isLoading={messagesLoading} />

        <ComposeMessage onSend={onSendMessage} isSending={isSending} disabled={!selectedPhone} />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">
      <div className="w-80 lg:w-96 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="h-5 w-5 text-primary flex-shrink-0" />
            <h1 className="text-lg font-semibold truncate">{branding.productName}</h1>
          </div>
          <ListHeaderActions onRefresh={onRefresh} onSignOut={onSignOut} />
        </div>
        <ConversationList
          conversations={conversations}
          activeConversationPhone={selectedPhone}
          onSelectConversation={onSelectPhone}
          isLoading={conversationsLoading}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedPhone ? (
          <>
            <div className="border-b border-border p-4 bg-background">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold truncate" data-testid="text-conversation-title">
                    {selectedConversation?.name || selectedPhone}
                  </h2>
                  <p className="text-sm text-muted-foreground font-mono" data-testid="text-phone-number">
                    {selectedPhone}
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <Label htmlFor="ai-toggle" className="flex items-center gap-2.5 text-base font-medium cursor-pointer">
                      <Bot
                        className={`h-5 w-5 ${
                          selectedConversation?.aiEnabled ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                      <span>AI Assistant</span>
                    </Label>
                    <Switch
                      id="ai-toggle"
                      checked={selectedConversation?.aiEnabled ?? false}
                      onCheckedChange={onToggleAI}
                      disabled={isTogglingAI}
                      data-testid="switch-ai-assistant"
                    />
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid="button-delete-conversation"
                        className="hover-elevate active-elevate-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all messages, lead assessment data, and conversation history for {selectedPhone}.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={onDeleteConversation}
                          data-testid="button-confirm-delete"
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={isDeletingConversation}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="flex-1 hidden lg:block"></div>
              </div>
            </div>

            <div className="px-4 py-2 border-b border-border bg-background">
              <LeadAssessmentCard assessment={assessment} isLoading={assessmentLoading} />
            </div>

            <MessageThread messages={messages} isLoading={messagesLoading} />

            <ComposeMessage onSend={onSendMessage} isSending={isSending} disabled={!selectedPhone} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <MessageSquare className="h-20 w-20 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-semibold mb-2">Welcome to {branding.productName}</h2>
              <p className="text-muted-foreground mb-6">
                Select a conversation from the sidebar to view messages and send replies.
                AI-powered lead assessment will help you understand your customers better.
              </p>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-chart-2" />
                  Positive sentiment
                </p>
                <p className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-chart-4" />
                  Neutral sentiment
                </p>
                <p className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-chart-5" />
                  Negative sentiment
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

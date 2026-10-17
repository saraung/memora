import { useParams } from "react-router-dom";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useConversations, useRealtime } from "@/features/chat/hooks";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * Messages: a conversation list at /messages that opens a full-screen thread at
 * /messages/:id on every screen size (list → detail), like the mobile flow.
 */
export function MessagesPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { user } = useAuth();
  useRealtime(conversationId);
  const conversations = useConversations();
  const isThread = Boolean(conversationId);

  const active = conversations.data?.pages
    .flatMap((p) => p.items)
    .find((c) => c.id === conversationId);

  const otherName =
    active && user
      ? active.other_user.display_name || active.other_user.username
      : undefined;

  return (
    <div
      className={cn(
        "md:mx-auto md:max-w-2xl",
        // The shell keeps its padding on the list route; cancel it so the list
        // is edge-to-edge. On a thread the shell is already padding-free.
        !isThread && "-mx-4 -mt-6 -mb-24 md:mt-0 md:mb-0",
      )}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden bg-surface md:h-[calc(100dvh-4rem)] md:min-h-[32rem] md:rounded-2xl md:border md:border-line md:shadow-card",
          // Fill the viewport on mobile (thread: full screen; list: above nav).
          isThread
            ? "h-[100dvh]"
            : "h-[calc(100dvh-6.5rem-env(safe-area-inset-bottom))]",
        )}
      >
        {isThread ? (
          <ChatPanel
            conversationId={conversationId!}
            otherName={otherName}
            otherUsername={active?.other_user.username}
            otherAvatarUrl={active?.other_user.avatar_url}
            otherLastSeenAt={active?.other_user.last_seen_at ?? null}
          />
        ) : (
          <ConversationList />
        )}
      </div>
    </div>
  );
}

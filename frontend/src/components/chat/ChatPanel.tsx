import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Phone,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { FormError } from "@/components/ui/FormError";
import { MessageThreadSkeleton } from "@/components/feedback/Skeletons";
import { ErrorState } from "@/components/feedback/StateViews";
import { ApiError } from "@/services/api-client";
import { realtime } from "@/services/realtime";
import {
  useAttachments,
  useDeleteConversation,
  useDeleteMessage,
  useEditMessage,
  useMarkRead,
  useMessages,
  useSendMessage,
} from "@/features/chat/hooks";
import { useCall } from "@/components/call/useCall";
import {
  CallInvite,
  CallActive,
  CallOutgoing,
} from "@/components/call/CallInvite";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MessageItem } from "@/types/chat";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function sameGroup(a: MessageItem, b: MessageItem): boolean {
  if (a.message.sender_id !== b.message.sender_id) return false;
  if (a.message.is_deleted || b.message.is_deleted) return false;
  const delta =
    new Date(b.message.created_at).getTime() -
    new Date(a.message.created_at).getTime();
  return Math.abs(delta) <= GROUP_WINDOW_MS;
}

function MessageBubble({
  item,
  own,
  conversationId,
  showAvatar,
  isGroupEnd,
}: {
  item: MessageItem;
  own: boolean;
  conversationId: string;
  showAvatar: boolean;
  isGroupEnd: boolean;
}) {
  const { message } = item;
  const edit = useEditMessage();
  const remove = useDeleteMessage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (message.is_deleted) {
    return (
      <div className={cn("flex", own ? "justify-end" : "justify-start")}>
        <p className="rounded-2xl bg-muted px-4 py-2 text-sm text-3 italic">
          Message deleted
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-end gap-2",
        own ? "justify-end" : "justify-start",
      )}
    >
      {!own && (
        <div className="w-8 shrink-0">
          {showAvatar && (
            <Link to={`/u/${item.sender.username}`} aria-label={item.sender.username}>
              <Avatar
                name={item.sender.display_name || item.sender.username}
                src={item.sender.avatar_url}
                size="sm"
              />
            </Link>
          )}
        </div>
      )}
      <div className={cn("min-w-0 max-w-[78%]", own ? "items-end" : "items-start")}>
        {item.media.length > 0 && (
          <div className="mb-1.5 grid max-w-64 grid-cols-2 gap-1.5">
            {item.media.map((m) => (
              <a
                key={m.id}
                href={m.secure_url}
                target="_blank"
                rel="noreferrer"
                aria-label="Open attached image"
                className={cn(
                  "block overflow-hidden rounded-xl",
                  item.media.length === 1 && "col-span-2",
                )}
              >
                <img
                  src={m.secure_url}
                  alt=""
                  loading="lazy"
                  className={cn(
                    "w-full object-cover",
                    item.media.length === 1 ? "max-h-80" : "aspect-square",
                  )}
                />
              </a>
            ))}
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm break-words",
            own
              ? "rounded-br-md bg-primary text-on-primary"
              : "rounded-bl-md bg-muted text-1",
            isGroupEnd && (own ? "rounded-br-sm" : "rounded-bl-sm"),
          )}
        >
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) {
                  edit.mutate(
                    { id: message.id, body: draft.trim() },
                    { onSuccess: () => setEditing(false) },
                  );
                }
              }}
              className="space-y-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                autoFocus
                aria-label="Edit message"
                className="w-full rounded-lg bg-surface/20 px-2 py-1 text-sm text-inherit outline-none"
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold opacity-80 hover:opacity-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-md bg-surface/25 px-2 py-1 text-xs font-bold hover:bg-surface/35"
                >
                  Save
                </button>
              </div>
            </form>
          ) : message.body ? (
            <p className="whitespace-pre-line">{message.body}</p>
          ) : item.media.length > 0 ? (
            <p className="text-xs opacity-80 italic">Photo</p>
          ) : null}
        </div>
        {isGroupEnd && (
          <div
            className={cn(
              "mt-0.5 flex items-center gap-1 text-[11px] text-3",
              own && "justify-end",
            )}
          >
            <span>{timeAgo(message.created_at)}</span>
            {message.is_edited && <span>· edited</span>}
            {own &&
              (item.read_count > 0 ? (
                <span
                  className="flex items-center gap-0.5 text-primary"
                  title="Seen"
                >
                  <CheckCheck className="size-3.5" aria-label="Seen" />
                </span>
              ) : (
                <Check className="size-3.5" aria-label="Sent" />
              ))}
            {own && !editing && (
              <span className="hidden gap-0.5 group-hover:flex">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(message.body ?? "");
                    setEditing(true);
                  }}
                  aria-label="Edit message"
                  className="cursor-pointer rounded p-0.5 hover:bg-muted"
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete message"
                  className="cursor-pointer rounded p-0.5 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:text-red-400"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </span>
            )}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          remove.mutate({ conversationId, messageId: message.id });
          setConfirmDelete(false);
        }}
        title="Delete this message?"
        description="It will be removed for everyone."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />
    </div>
  );
}

function groupLabel(iso: string): string | null {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/** Online if seen within the last 5 minutes. */
function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const seen = new Date(lastSeenAt).getTime();
  const now = Date.now();
  return now - seen < 5 * 60 * 1000;
}

export function ChatPanel({
  conversationId,
  otherName,
  otherUsername,
  otherAvatarUrl,
  otherLastSeenAt,
}: {
  conversationId: string;
  otherName?: string;
  otherUsername?: string;
  otherAvatarUrl?: string | null;
  otherLastSeenAt?: string | null;
}) {
  const { user } = useAuth();
  const messages = useMessages(conversationId);
  const send = useSendMessage(conversationId);
  const markRead = useMarkRead(conversationId);
  const removeConversation = useDeleteConversation();
  const attachments = useAttachments();
  const navigate = useNavigate();
  const [confirmDeleteThread, setConfirmDeleteThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [callMode, setCallMode] = useState<"voice" | "video">("video");
  const pickerRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const call = useCall(conversationId);

  const displayName = otherName || otherUsername || "Unknown";

  const chronological = useMemo(
    () => messages.data?.pages.flatMap((p) => p.items).reverse() ?? [],
    [messages.data],
  );

  // Mark incoming messages read when they arrive while viewing.
  const latestId = chronological[chronological.length - 1]?.message.id;
  const latestSender = chronological[chronological.length - 1]?.message.sender_id;
  useEffect(() => {
    if (latestId && user && latestSender !== user.id) {
      markRead.mutate(latestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId]);

  // Realtime typing indicator + online status from the shared socket.
  useEffect(() => {
    const off = realtime.onMessage((msg) => {
      if (msg.type !== "typing" || !msg.conversation_id) return;
      if (msg.conversation_id !== conversationId) return;
      const senderId = msg.sender_id;
      if (!senderId || senderId === user?.id) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.add(senderId);
        return next;
      });
      if (typingTimerRef.current.has(senderId)) {
        window.clearTimeout(typingTimerRef.current.get(senderId)!);
      }
      const timer = window.setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(senderId);
          return next;
        });
        typingTimerRef.current.delete(senderId);
      }, 3000);
      typingTimerRef.current.set(senderId, timer);
    });
    return () => {
      off();
      typingTimerRef.current.forEach((timer) => window.clearTimeout(timer));
      typingTimerRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id]);

  // Debounced typing sender: notify the other participant while typing.
  const sendTypingDebounced = useCallback(() => {
    if (!draft.trim()) return;
    realtime.sendTyping(conversationId);
  }, [draft, conversationId]);
  useEffect(() => {
    if (!draft.trim()) return;
    const timer = window.setTimeout(() => sendTypingDebounced(), 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, sendTypingDebounced]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [chronological.length]);

  const startCall = (mode: "voice" | "video") => {
    setCallMode(mode);
    call.startCall(conversationId, displayName, mode);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if ((!text && attachments.items.length === 0) || send.isPending || attachments.uploading) return;
    setFormError(null);
    setDraft("");
    try {
      const mediaIds = await attachments.uploadAll();
      attachments.clear();
      send.mutate(
        { body: text, mediaIds },
        { onError: () => setDraft(text) },
      );
    } catch (error) {
      setDraft(text);
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Could not send the message. Please try again.",
      );
    }
  };

  if (messages.isPending) {
    return <MessageThreadSkeleton />;
  }
  if (messages.isError) {
    return (
      <div className="flex-1 p-4">
        <ErrorState
          title="Could not load messages"
          onRetry={() => messages.refetch()}
        />
      </div>
    );
  }

  const online = isOnline(otherLastSeenAt);
  const status =
    typingUsers.size > 0
      ? "typing…"
      : online
        ? "Online"
        : otherLastSeenAt
          ? `Last seen ${timeAgo(otherLastSeenAt)}`
          : "";

  let lastDay: string | null = null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface/95 px-2 py-2.5 backdrop-blur md:px-4 md:py-3">
        <button
          type="button"
          onClick={() => navigate("/messages")}
          aria-label="Back to chats"
          className="-ml-1 cursor-pointer rounded-lg p-1.5 text-2 transition-colors hover:bg-muted hover:text-1"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        {otherUsername && (
          <Link
            to={`/u/${otherUsername}`}
            className="relative shrink-0"
            aria-label={`View ${displayName}'s profile`}
          >
            <Avatar
              name={displayName}
              src={otherAvatarUrl}
              size="md"
              className="size-9"
            />
            {online && (
              <span
                aria-label="Online"
                className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface bg-green-500 shadow-sm"
              />
            )}
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <Link
            to={otherUsername ? `/u/${otherUsername}` : "#"}
            className="block truncate text-sm font-bold text-1 hover:underline"
          >
            {displayName}
          </Link>
          <p
            className={cn(
              "truncate text-xs",
              typingUsers.size > 0 ? "font-semibold text-primary" : "text-3",
            )}
          >
            {status || (otherUsername ? `@${otherUsername}` : "")}
          </p>
        </div>
        {call.state === "idle" && (
          <>
            <button
              type="button"
              onClick={() => startCall("voice")}
              aria-label="Voice call"
              className="cursor-pointer rounded-lg p-2 text-2 transition-colors hover:bg-muted hover:text-primary"
            >
              <Phone className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => startCall("video")}
              aria-label="Video call"
              className="cursor-pointer rounded-lg p-2 text-2 transition-colors hover:bg-muted hover:text-primary"
            >
              <Video className="size-5" aria-hidden />
            </button>
          </>
        )}
        <DropdownMenu
          label="Conversation options"
          trigger={
            <button
              type="button"
              aria-label="Conversation options"
              className="cursor-pointer rounded-lg p-2 text-3 transition-colors hover:bg-muted hover:text-2"
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          }
          items={[
            {
              label: "Delete conversation",
              icon: <Trash2 className="size-4" aria-hidden />,
              danger: true,
              onSelect: () => setConfirmDeleteThread(true),
            },
          ]}
        />
        <ConfirmDialog
          open={confirmDeleteThread}
          onClose={() => setConfirmDeleteThread(false)}
          onConfirm={() =>
            removeConversation.mutate(conversationId, {
              onSuccess: () => navigate("/messages"),
            })
          }
          title="Delete this conversation?"
          description="It will disappear from your list. The other person keeps their copy."
          confirmLabel="Delete"
          danger
          loading={removeConversation.isPending}
        />
      </div>

      {/* Outgoing call overlay (calling...) */}
      {call.state === "requesting" && (
        <CallOutgoing
          peerName={displayName}
          peerAvatarUrl={otherAvatarUrl}
          mode={callMode}
          onCancel={call.endCall}
        />
      )}

      {/* Incoming call overlay */}
      {call.state === "incoming" && call.incomingCall && (
        <CallInvite
          call={{
            callId: call.incomingCall.callId,
            conversationId: call.incomingCall.conversationId,
            fromUsername:
              call.incomingCall.fromUsername || displayName,
          }}
          peerName={displayName}
          peerAvatarUrl={otherAvatarUrl}
          onAccept={() => call.acceptCall()}
          onDecline={() => call.declineCall()}
        />
      )}

      {/* Active call overlay */}
      {call.state === "active" && (
        <CallActive
          peerName={displayName}
          peerAvatarUrl={otherAvatarUrl}
          durationSeconds={call.durationSeconds}
          remoteStream={call.remoteStream}
          localStream={call.localStream}
          videoEnabled={call.videoEnabled}
          hasVideo={call.hasVideo}
          isMuted={call.isMuted}
          onToggleMute={call.toggleMute}
          onToggleCamera={call.toggleCamera}
          onEnd={call.endCall}
        />
      )}

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-4 md:px-6">
        {messages.hasNextPage && (
          <div className="flex justify-center py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => messages.fetchNextPage()}
              loading={messages.isFetchingNextPage}
            >
              Load earlier messages
            </Button>
          </div>
        )}
        {chronological.length === 0 ? (
          <p className="py-10 text-center text-sm text-3">
            No messages yet. Say hello!
          </p>
        ) : (
          chronological.map((item, index) => {
            const day = groupLabel(item.message.created_at);
            const showDay = day !== lastDay;
            lastDay = day;
            const prev = chronological[index - 1];
            const next = chronological[index + 1];
            const isGroupEnd = !next || !sameGroup(item, next);
            const showAvatar = isGroupEnd || !prev || !sameGroup(prev, item);
            return (
              <div key={item.message.id}>
                {showDay && day && (
                  <p className="py-3 text-center text-xs font-semibold text-3">
                    {day}
                  </p>
                )}
                <div className={cn(isGroupEnd ? "pt-1.5" : "pt-0.5")}>
                  <MessageBubble
                    item={item}
                    own={user?.id === item.message.sender_id}
                    conversationId={conversationId}
                    showAvatar={showAvatar}
                    isGroupEnd={isGroupEnd}
                  />
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={submit}
        className="shrink-0 border-t border-line bg-surface px-3 pt-2"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {attachments.items.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {attachments.items.map((item) => (
              <div key={item.preview} className="relative shrink-0">
                <img
                  src={item.preview}
                  alt=""
                  className="size-16 rounded-lg border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => attachments.remove(item.preview)}
                  aria-label="Remove image"
                  className="absolute -top-1.5 -right-1.5 cursor-pointer rounded-full bg-ink-900 p-0.5 text-white"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
        <FormError message={formError} />
        <div className="flex items-center gap-2">
          <input
            ref={pickerRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            aria-label="Attach images"
            onChange={(e) => {
              const err = attachments.add(e.target.files);
              if (err) setFormError(err);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            aria-label="Attach images"
            className="cursor-pointer rounded-lg p-2 text-3 transition-colors hover:bg-muted hover:text-2"
          >
            <ImagePlus className="size-5" aria-hidden />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message…"
            aria-label="Message"
            maxLength={2000}
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm text-1 placeholder:text-3 focus:border-primary"
          />
          <Button
            type="submit"
            size="sm"
            loading={send.isPending || attachments.uploading}
            disabled={!draft.trim() && attachments.items.length === 0}
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

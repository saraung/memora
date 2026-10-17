import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ImagePlus, Send, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState, EmptyState } from "@/components/feedback/StateViews";
import {
  useAttachments,
  useStartDirectMessage,
} from "@/features/chat/hooks";
import { useProfile } from "@/features/social/hooks";
import { ApiError } from "@/services/api-client";

/** Draft thread: nothing is persisted until the first message is sent. */
export function NewMessagePage() {
  const { username } = useParams<{ username?: string }>();
  const navigate = useNavigate();
  const profile = useProfile(username);
  const start = useStartDirectMessage();
  const attachments = useAttachments();
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if ((!text && attachments.items.length === 0) || !profile.data || start.isPending) return;
    setFormError(null);
    setDraft("");
    try {
      const mediaIds = await attachments.uploadAll();
      attachments.clear();
      start.mutate(
        { participantId: profile.data.id, body: text, mediaIds },
        {
          onSuccess: (result) => navigate(`/messages/${result.conversation.id}`),
          onError: (error) => {
            setDraft(text);
            setFormError(
              error instanceof ApiError
                ? error.message
                : "Could not send the message. Please try again.",
            );
          },
        },
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

  if (profile.isPending) {
    return (
      <PageContainer aria-label="Loading recipient">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-[50vh] rounded-none" />
        </div>
      </PageContainer>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <PageContainer>
        <ErrorState
          title="Could not load this profile"
          onRetry={() => profile.refetch()}
        />
      </PageContainer>
    );
  }
  const target = profile.data;

  return (
    <div className="mx-auto flex h-[calc(100dvh-6.5rem-env(safe-area-inset-bottom))] w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:h-[calc(100dvh-4rem)] md:max-w-2xl">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Avatar
          name={target.display_name || target.username}
          src={target.avatar_url}
          size="sm"
        />
        <div className="min-w-0">
          <Link
            to={`/u/${target.username}`}
            className="block truncate text-sm font-bold text-1 hover:underline"
          >
            {target.display_name}
          </Link>
          <p className="truncate text-xs text-3">@{target.username}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <EmptyState
          title="Start the conversation"
          message={`Nothing is shared until you send the first message to @${target.username}.`}
          icon={<Send className="size-6 text-primary" aria-hidden />}
        />
      </div>

      <form onSubmit={submit} className="border-t border-line px-3 pt-2 pb-3">
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
        <div className="min-w-0">
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
              placeholder={`Message @${target.username}…`}
              aria-label="Message"
              maxLength={2000}
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm text-1 placeholder:text-3 focus:border-primary"
            />
            <Button
              type="submit"
              size="sm"
              loading={start.isPending || attachments.uploading}
              disabled={!draft.trim() && attachments.items.length === 0}
            >
              Send
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

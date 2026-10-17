import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ComposerTabs } from "@/components/content/ComposerTabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { FormError } from "@/components/ui/FormError";
import { Textarea } from "@/components/ui/Textarea";
import { usePublishStory } from "@/features/ephemeral/hooks";
import { ApiError } from "@/services/api-client";

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";

export function StoryComposerPage() {
  const navigate = useNavigate();
  const publish = usePublishStory();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);

  const pick = (incoming: FileList | null) => {
    const next = incoming?.[0];
    if (!next) return;
    setFormError(null);
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const submit = () => {
    setFormError(null);
    if (!file) {
      setFormError("Choose a photo or short video first.");
      return;
    }
    publish.mutate(
      {
        file,
        caption: caption.trim() || null,
        onProgress: setStage,
      },
      {
        onSuccess: (storyId) => {
          if (preview) URL.revokeObjectURL(preview);
          navigate(`/stories/${storyId}`);
        },
        onError: (error) => {
          setStage(null);
          setFormError(
            error instanceof ApiError
              ? error.message
              : "Could not publish your story. Please try again.",
          );
        },
        onSettled: () => setStage(null),
      },
    );
  };

  return (
    <PageContainer className="space-y-4">
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1">
        New story
      </h1>
      <ComposerTabs />
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <FormError message={formError} />
        <input
          ref={pickerRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          aria-label="Choose a photo or video"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
        {preview && file ? (
          <div className="relative overflow-hidden rounded-xl bg-ink-950">
            {file.type.startsWith("video/") ? (
              <video src={preview} controls playsInline preload="metadata" className="aspect-[9/16] max-h-[50vh] w-full object-contain" />
            ) : (
              <img src={preview} alt="" className="aspect-[9/16] max-h-[50vh] w-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(preview);
                setPreview(null);
                setFile(null);
              }}
              aria-label="Remove media"
              className="absolute top-2 right-2 cursor-pointer rounded-full bg-ink-950/70 p-1.5 text-white transition hover:bg-ink-950"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-6 py-12 transition-colors hover:border-primary hover:bg-muted"
          >
            <ImagePlus className="size-8 text-primary" aria-hidden />
            <span className="text-sm font-semibold text-1">
              Choose a photo or video
            </span>
            <span className="text-xs text-3">
              Visible for 24 hours. Videos must be 60s or shorter.
            </span>
          </button>
        )}

        <div className="mt-4">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={220}
            rows={2}
            placeholder="Add a caption…"
            aria-label="Caption"
          />
        </div>

        {stage && (
          <p role="status" className="mt-3 text-sm font-medium text-primary">
            {stage}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate(-1)} disabled={publish.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={publish.isPending} disabled={!file}>
            Share story
          </Button>
        </div>
      </section>
    </PageContainer>
  );
}

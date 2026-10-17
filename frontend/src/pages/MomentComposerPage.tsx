import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clapperboard, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ComposerTabs } from "@/components/content/ComposerTabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { FormError } from "@/components/ui/FormError";
import { Textarea } from "@/components/ui/Textarea";
import { usePublishReel } from "@/features/ephemeral/hooks";
import { ApiError } from "@/services/api-client";

const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm";
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

function useSingleFile() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const replace = (next: File | null) => {
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    if (!next) {
      setFile(null);
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };
  const clear = () => replace(null);
  return { file, preview, replace, clear };
}

export function MomentComposerPage() {
  const navigate = useNavigate();
  const publish = usePublishReel();
  const videoPicker = useRef<HTMLInputElement>(null);
  const coverPicker = useRef<HTMLInputElement>(null);
  const video = useSingleFile();
  const cover = useSingleFile();
  const [caption, setCaption] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);

  const submit = () => {
    setFormError(null);
    if (!video.file) {
      setFormError("Choose a video first.");
      return;
    }
    publish.mutate(
      {
        video: video.file,
        cover: cover.file,
        caption: caption.trim() || null,
        onProgress: setStage,
      },
      {
        onSuccess: (reelId) => navigate(`/moments#${reelId}`),
        onError: (error) => {
          setStage(null);
          setFormError(
            error instanceof ApiError
              ? error.message
              : "Could not publish your moment. Please try again.",
          );
        },
        onSettled: () => setStage(null),
      },
    );
  };

  return (
    <PageContainer className="space-y-4">
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1">
        New moment
      </h1>
      <ComposerTabs />
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <FormError message={formError} />
        <input
          ref={videoPicker}
          type="file"
          accept={VIDEO_ACCEPT}
          className="hidden"
          aria-label="Choose a video"
          onChange={(e) => {
            if (e.target.files?.[0]) video.replace(e.target.files[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={coverPicker}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          aria-label="Choose a cover image"
          onChange={(e) => {
            if (e.target.files?.[0]) cover.replace(e.target.files[0]);
            e.target.value = "";
          }}
        />

        {video.preview && video.file ? (
          <div className="relative overflow-hidden rounded-xl bg-ink-950">
            <video src={video.preview} controls playsInline preload="metadata" className="aspect-[9/16] max-h-[50vh] w-full object-contain" />
            <button
              type="button"
              onClick={video.clear}
              aria-label="Remove video"
              className="absolute top-2 right-2 cursor-pointer rounded-full bg-ink-950/70 p-1.5 text-white transition hover:bg-ink-950"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoPicker.current?.click()}
            className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-6 py-12 transition-colors hover:border-primary hover:bg-muted"
          >
            <Clapperboard className="size-8 text-primary" aria-hidden />
            <span className="text-sm font-semibold text-1">Choose a video</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => coverPicker.current?.click()}
          className="mt-3 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 text-left transition-colors hover:border-primary"
        >
          {cover.preview ? (
            <img src={cover.preview} alt="" className="size-12 rounded-lg object-cover" />
          ) : (
            <ImagePlus className="size-6 shrink-0 text-3" aria-hidden />
          )}
          <span>
            <span className="block text-sm font-semibold text-1">
              {cover.file ? cover.file.name : "Add a cover image (optional)"}
            </span>
            <span className="block text-xs text-3">
              Shown in grids before playback.
            </span>
          </span>
          {cover.file && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Remove cover"
              onClick={(e) => {
                e.stopPropagation();
                cover.clear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  cover.clear();
                }
              }}
              className="ml-auto cursor-pointer rounded-lg p-1.5 text-3 hover:bg-muted hover:text-2"
            >
              <X className="size-4" aria-hidden />
            </span>
          )}
        </button>

        <div className="mt-4">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2200}
            rows={3}
            placeholder="Write a caption…"
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
          <Button onClick={submit} loading={publish.isPending} disabled={!video.file}>
            Share moment
          </Button>
        </div>
      </section>
    </PageContainer>
  );
}

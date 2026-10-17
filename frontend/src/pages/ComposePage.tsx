import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ComposerTabs } from "@/components/content/ComposerTabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { FormError } from "@/components/ui/FormError";
import { Textarea } from "@/components/ui/Textarea";
import {
  useCreatePost,
  type ComposerFile,
} from "@/features/content/hooks";
import { ApiError } from "@/services/api-client";

const ACCEPT =
  "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";
const MAX_FILES = 10;

export function ComposePage() {
  const navigate = useNavigate();
  const create = useCreatePost();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ComposerFile[]>([]);
  const [caption, setCaption] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setFormError(null);
    setFiles((prev) => {
      const next = [...prev];
      for (const file of Array.from(incoming)) {
        if (next.length >= MAX_FILES) break;
        next.push({
          file,
          preview: URL.createObjectURL(file),
          altText: "",
        });
      }
      return next;
    });
  };

  const removeFile = (preview: string) =>
    setFiles((prev) => {
      const target = prev.find((f) => f.preview === preview);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.preview !== preview);
    });

  const setAlt = (preview: string, altText: string) =>
    setFiles((prev) =>
      prev.map((f) => (f.preview === preview ? { ...f, altText } : f)),
    );

  const publish = () => {
    setFormError(null);
    if (files.length === 0) {
      setFormError("Add at least one photo or video.");
      return;
    }
    setProgress({ done: 0, total: files.length });
    create.mutate(
      {
        caption: caption.trim() || null,
        files,
        onProgress: (done, total) => setProgress({ done, total }),
      },
      {
        onSuccess: (post) => {
          files.forEach((f) => URL.revokeObjectURL(f.preview));
          navigate(`/p/${post.id}`);
        },
        onError: (error) => {
          setProgress(null);
          setFormError(
            error instanceof ApiError
              ? error.message
              : "Could not publish your post. Please try again.",
          );
        },
        onSettled: () => setProgress(null),
      },
    );
  };

  const busy = create.isPending;

  return (
    <PageContainer className="space-y-4">
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1">
        New post
      </h1>
      <ComposerTabs />

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <FormError message={formError} />
        <input
          ref={pickerRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          aria-label="Choose photos or videos"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {files.length === 0 ? (
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-6 py-12 transition-colors hover:border-primary hover:bg-muted"
          >
            <ImagePlus className="size-8 text-primary" aria-hidden />
            <span className="text-sm font-semibold text-1">
              Choose photos or videos
            </span>
            <span className="text-xs text-3">
              Up to {MAX_FILES} items. First item is the cover.
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {files.map((item) => (
              <div
                key={item.preview}
                className="group relative overflow-hidden rounded-xl border border-line bg-muted"
              >
                {item.file.type.startsWith("video/") ? (
                  <video
                    src={item.preview}
                    muted
                    playsInline
                    preload="metadata"
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <img
                    src={item.preview}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeFile(item.preview)}
                  aria-label={`Remove ${item.file.name}`}
                  className="absolute top-2 right-2 cursor-pointer rounded-full bg-ink-950/70 p-1.5 text-white transition hover:bg-ink-950"
                >
                  <X className="size-4" aria-hidden />
                </button>
                <input
                  value={item.altText}
                  onChange={(e) => setAlt(item.preview, e.target.value)}
                  placeholder="Alt text"
                  aria-label={`Alt text for ${item.file.name}`}
                  maxLength={255}
                  className="w-full border-t border-line bg-surface px-2.5 py-1.5 text-xs text-1 placeholder:text-3"
                />
              </div>
            ))}
            {files.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => pickerRef.current?.click()}
                className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-3 transition-colors hover:border-primary hover:text-primary"
              >
                <ImagePlus className="size-6" aria-hidden />
                <span className="text-xs font-semibold">Add more</span>
              </button>
            )}
          </div>
        )}

        <div className="mt-4">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2200}
            rows={3}
            placeholder="Write a caption… #memories @friend"
            aria-label="Caption"
          />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs text-3">
              #tags and @mentions become links
            </p>
            <p className="text-xs text-3">{caption.length}/2200</p>
          </div>
        </div>

        {progress && (
          <p role="status" className="mt-3 text-sm font-medium text-primary">
            Uploading {progress.done} of {progress.total}…
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={publish} loading={busy} disabled={files.length === 0}>
            Share post
          </Button>
        </div>
      </section>
    </PageContainer>
  );
}

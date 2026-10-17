/** Call overlays: outgoing (calling), incoming invite, and active call. */

import { useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

function CallAvatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <div className="story-ring animate-pulse w-fit">
      <div className="story-ring-gap">
        <Avatar name={name} src={src} size="xl" className="size-28" />
      </div>
    </div>
  );
}

interface CallInviteProps {
  call: {
    callId: string;
    conversationId: string;
    fromUsername: string;
  };
  peerName?: string;
  peerAvatarUrl?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

export function CallInvite({
  call,
  peerName,
  peerAvatarUrl,
  onAccept,
  onDecline,
}: CallInviteProps) {
  const name = peerName || call.fromUsername;
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-b from-ink-900 via-ink-950 to-black p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Incoming call"
    >
      <CallAvatar name={name} src={peerAvatarUrl} />
      <h2 className="mt-6 font-display text-2xl font-extrabold text-white">
        {name}
      </h2>
      <p className="mt-1 text-sm text-white/70">Incoming call…</p>

      <div className="mt-12 flex items-center gap-10">
        <button
          type="button"
          onClick={onDecline}
          aria-label="Decline call"
          className="flex size-16 cursor-pointer items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform hover:scale-105"
        >
          <PhoneOff className="size-7" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onAccept}
          aria-label="Accept call"
          className="flex size-16 cursor-pointer items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform hover:scale-105"
        >
          <Phone className="size-7" aria-hidden />
        </button>
      </div>
    </div>
  );
}

interface CallOutgoingProps {
  peerName: string;
  peerAvatarUrl?: string | null;
  mode: "voice" | "video";
  onCancel: () => void;
}

export function CallOutgoing({
  peerName,
  peerAvatarUrl,
  mode,
  onCancel,
}: CallOutgoingProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-b from-ink-900 via-ink-950 to-black p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Calling"
    >
      <CallAvatar name={peerName} src={peerAvatarUrl} />
      <h2 className="mt-6 font-display text-2xl font-extrabold text-white">
        {peerName}
      </h2>
      <p className="mt-1 text-sm text-white/70">
        {mode === "video" ? "Video calling…" : "Calling…"}
      </p>

      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel call"
        className="mt-12 flex size-16 cursor-pointer items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform hover:scale-105"
      >
        <PhoneOff className="size-7" aria-hidden />
      </button>
    </div>
  );
}

interface CallActiveProps {
  peerName: string;
  peerAvatarUrl?: string | null;
  durationSeconds: number;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  videoEnabled: boolean;
  hasVideo: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
}

export function CallActive({
  peerName,
  peerAvatarUrl,
  durationSeconds,
  remoteStream,
  localStream,
  videoEnabled,
  hasVideo,
  isMuted,
  onToggleMute,
  onToggleCamera,
  onEnd,
}: CallActiveProps) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const timer = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, videoEnabled]);

  const showingRemoteVideo = Boolean(remoteStream && hasVideo && videoEnabled);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-ink-950"
      role="dialog"
      aria-modal="true"
      aria-label="Active call"
    >
      {/* Remote media — video when available, gradient fallback otherwise */}
      {showingRemoteVideo ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-ink-900 via-ink-950 to-black">
          <CallAvatar name={peerName} src={peerAvatarUrl} />
          <p className="mt-6 font-display text-2xl font-extrabold text-white">
            {peerName}
          </p>
          {remoteStream && (
            <audio
              ref={(el) => {
                if (el) {
                  el.srcObject = remoteStream;
                  el.play().catch(() => {});
                }
              }}
              className="hidden"
            />
          )}
        </div>
      )}

      {/* Top bar */}
      <div
        className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-5"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
      >
        <div>
          <p className="font-display text-lg font-bold text-white">
            {peerName}
          </p>
          <p className="text-sm text-white/70">
            {durationSeconds > 0 ? timer : "Connecting…"}
          </p>
        </div>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          {hasVideo && videoEnabled ? "Video" : "Voice"}
        </span>
      </div>

      {/* Local PiP */}
      {localStream && videoEnabled && (
        <div className="absolute right-4 bottom-36 z-10 overflow-hidden rounded-2xl border border-white/20 shadow-pop">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-36 w-24 -scale-x-100 object-cover sm:h-44 sm:w-32"
          />
        </div>
      )}

      {/* Controls */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent p-6 sm:gap-5"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={onToggleMute}
          aria-pressed={isMuted}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          className={cn(
            "flex size-14 cursor-pointer items-center justify-center rounded-full transition-colors",
            isMuted
              ? "bg-white text-ink-950"
              : "bg-white/15 text-white backdrop-blur hover:bg-white/25",
          )}
        >
          {isMuted ? (
            <MicOff className="size-6" aria-hidden />
          ) : (
            <Mic className="size-6" aria-hidden />
          )}
        </button>

        {hasVideo && (
          <button
            type="button"
            onClick={onToggleCamera}
            aria-pressed={videoEnabled}
            aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
            className={cn(
              "flex size-14 cursor-pointer items-center justify-center rounded-full transition-colors",
              videoEnabled
                ? "bg-white/15 text-white backdrop-blur hover:bg-white/25"
                : "bg-white text-ink-950",
            )}
          >
            {videoEnabled ? (
              <Video className="size-6" aria-hidden />
            ) : (
              <VideoOff className="size-6" aria-hidden />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onEnd}
          aria-label="End call"
          className="flex size-16 cursor-pointer items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-colors hover:bg-red-700"
        >
          <PhoneOff className="size-7" aria-hidden />
        </button>
      </div>
    </div>
  );
}

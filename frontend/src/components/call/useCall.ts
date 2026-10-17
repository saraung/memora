/** Voice-call hook: WebRTC peer connection + signaling over WebSocket. */

import { useCallback, useEffect, useRef, useState } from "react";
import { realtime } from "@/services/realtime";
import { messagingApi } from "@/services/endpoints/messaging";
import { useAuth } from "@/hooks/useAuth";
import type { CallSignal } from "@/types/call";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type CallRole = "caller" | "callee" | null;

export type CallUIState =
  | "idle"
  | "requesting" // caller waiting for answer
  | "incoming" // callee receiving invite
  | "active" // call connected
  | "ended"; // call finished

export interface IncomingCall {
  callId: string;
  conversationId: string;
  from: string;
  fromUsername: string;
}

interface UseCallReturn {
  state: CallUIState;
  peerUsername: string | null;
  role: CallRole;
  durationSeconds: number;
  isMuted: boolean;
  startCall: (
    conversationId: string,
    peerName: string,
    mode?: "voice" | "video"
  ) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  incomingCall: IncomingCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  hasVideo: boolean; // camera available in this call
  videoEnabled: boolean; // camera currently on
}

export function useCall(conversationId?: string): UseCallReturn {
  const { user: me } = useAuth();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const meIdRef = useRef<string | null>(null);
  meIdRef.current = me?.id ?? null;

  const callIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const remoteOfferSdpRef = useRef<string | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const missedTimerRef = useRef<number | null>(null);
  const pendingResetRef = useRef<number | null>(null);

  const [state, setState] = useState<CallUIState>("idle");
  const [peerUsername, setPeerUsername] = useState<string | null>(null);
  const [role, setRole] = useState<CallRole>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);

  // --- cleanup ---------------------------------------------------------------
  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (missedTimerRef.current !== null) {
      window.clearTimeout(missedTimerRef.current);
      missedTimerRef.current = null;
    }
  }, []);

  const closePeer = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setHasVideo(false);
    setVideoEnabled(false);
    remoteOfferSdpRef.current = null;
    iceCandidateQueueRef.current = [];
    if (pendingResetRef.current !== null) {
      window.clearTimeout(pendingResetRef.current);
      pendingResetRef.current = null;
    }
    stopTimer();
  }, [stopTimer]);

  const flushIceCandidates = useCallback(() => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queue = iceCandidateQueueRef.current;
    iceCandidateQueueRef.current = [];
    for (const candidate of queue) {
      pc.addIceCandidate(candidate).catch(() => {});
    }
  }, []);

  const reset = useCallback(() => {
    closePeer();
    setState("idle");
    setPeerUsername(null);
    setRole(null);
    setDurationSeconds(0);
    setIncomingCall(null);
    callIdRef.current = null;
    conversationIdRef.current = null;
    startTimeRef.current = null;
  }, [closePeer]);

  // --- duration timer --------------------------------------------------------
  useEffect(() => {
    if (state === "active" && startTimeRef.current) {
      timerRef.current = window.setInterval(() => {
        setDurationSeconds(
          Math.floor((Date.now() - startTimeRef.current) / 1000)
        );
      }, 1000);
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [state, stopTimer]);

  // --- realtime connection + subscribe on mount -----------------------------
  useEffect(() => {
    if (!conversationId) return;
    realtime.start();
    realtime.subscribe(conversationId);
    conversationIdRef.current = conversationId;
    return () => {
      realtime.unsubscribe(conversationId);
    };
  }, [conversationId]);

  // --- realtime message handler ---------------------------------------------
  useEffect(() => {
    const off = realtime.onMessage((msg) => {
      if (!msg.conversation_id) return;
      if (
        msg.type !== "call:invite" &&
        msg.type !== "call:answer" &&
        msg.type !== "call:ice-candidate" &&
        msg.type !== "call:decline" &&
        msg.type !== "call:end"
      ) {
        return;
      }

      console.log("[useCall] received", msg.type, "for", msg.conversation_id, "from", msg.from, "myConversation=", conversationIdRef.current);

      const isMyConversation =
        msg.conversation_id === conversationIdRef.current ||
        (!conversationIdRef.current && msg.type === "call:invite");

      // --- incoming invite --------------------------------------------------
      if (msg.type === "call:invite") {
        // Ignore the echo of our own invite (broadcast sends to sender too).
        if (meIdRef.current && msg.from === meIdRef.current) return;
        // Don't let a second incoming call hijack a call already in progress.
        if (state === "requesting" || state === "active") return;
        // Always process an incoming invite: if we were already ringing from
        // a stale call, this new invite supersedes it.
        if (pendingResetRef.current !== null) {
          window.clearTimeout(pendingResetRef.current);
          pendingResetRef.current = null;
        }
        setIncomingCall({
          callId: msg.call_id,
          conversationId: msg.conversation_id,
          from: msg.from,
          fromUsername: "", // filled by parent
        });
        remoteOfferSdpRef.current = msg.sdp ?? null;
        setState("incoming");
        setRole("callee");
        callIdRef.current = msg.call_id;
        conversationIdRef.current = msg.conversation_id;

        // Auto-decline after 30s (missed call)
        if (missedTimerRef.current) {
          window.clearTimeout(missedTimerRef.current);
          missedTimerRef.current = null;
        }
        missedTimerRef.current = window.setTimeout(() => {
          if (state === "incoming") {
            setState("ended");
            setIncomingCall(null);
            remoteOfferSdpRef.current = null;
          }
        }, 30_000);
        return;
      }

      if (!isMyConversation) return;

      // --- answer -----------------------------------------------------------
      if (msg.type === "call:answer" && role === "caller" && msg.sdp) {
        (async () => {
          await pcRef.current?.setRemoteDescription({
            type: "answer",
            sdp: msg.sdp,
          });
          flushIceCandidates();
          setState("active");
          setIncomingCall(null);
          startTimeRef.current = Date.now();
        })();
        return;
      }

      // --- ICE candidate ----------------------------------------------------
      if (msg.type === "call:ice-candidate" && msg.candidate) {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          pc.addIceCandidate(msg.candidate).catch(() => {});
        } else {
          // Queue until remote description is set
          iceCandidateQueueRef.current.push(msg.candidate);
        }
        return;
      }

      // --- decline ----------------------------------------------------------
      if (msg.type === "call:decline" && role === "caller") {
        setState("ended");
        setIncomingCall(null);
        closePeer();
        return;
      }

      // --- end --------------------------------------------------------------
      if (msg.type === "call:end") {
        setState("ended");
        setIncomingCall(null);
        closePeer();
        pendingResetRef.current = window.setTimeout(() => reset(), 1500);
        return;
      }
    });
    return () => off();
  }, [role, state, closePeer, reset]);

  // --- start outgoing call --------------------------------------------------
  const startCall = useCallback(
    async (
      conversationId: string,
      peerNameArg: string,
      mode: "voice" | "video" = "video",
    ) => {
      setPeerUsername(peerNameArg);
      setRole("caller");
      callIdRef.current = crypto.randomUUID();
      conversationIdRef.current = conversationId;

      // Ensure the WebSocket is running before signaling.
      realtime.start();

      // Wait for the socket to open (with a short timeout) so the invite
      // is not dropped.
      const socketOpen = await new Promise<boolean>((resolve) => {
        if (realtime.connectionState === "open") {
          resolve(true);
          return;
        }
        const off = realtime.onMessage(() => {
          // any message means socket is alive
        });
        const timer = window.setTimeout(() => {
          off();
          resolve(false);
        }, 5000);
        const check = () => {
          if (realtime.connectionState === "open") {
            off();
            window.clearTimeout(timer);
            resolve(true);
          } else if (realtime.connectionState === "closed") {
            off();
            window.clearTimeout(timer);
            resolve(false);
          } else {
            window.setTimeout(check, 100);
          }
        };
        window.setTimeout(check, 100);
      });

      if (!socketOpen) {
        setState("ended");
        pendingResetRef.current = window.setTimeout(() => reset(), 1500);
        return;
      }

      try {
        const res = await messagingApi.initiateCall(conversationId);
        callIdRef.current = res.call_id;
      } catch {
        // Server may already have a call record; proceed with signaling anyway
      }

      try {
        // Video calls try the camera and fall back to voice-only.
        let stream: MediaStream;
        if (mode === "voice") {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setHasVideo(false);
          setVideoEnabled(false);
        } else {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: { facingMode: "user" },
            });
            setHasVideo(true);
            setVideoEnabled(true);
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setHasVideo(false);
            setVideoEnabled(false);
          }
        }
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.ontrack = (event) => {
          remoteStreamRef.current = event.streams[0];
          setRemoteStream(event.streams[0]);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            realtime.sendCallSignal({
              action: "call:ice-candidate",
              call_id: callIdRef.current!,
              conversation_id: conversationId,
              candidate: event.candidate,
            });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        setState("requesting");

        realtime.sendCallSignal({
          action: "call:invite",
          call_id: callIdRef.current!,
          conversation_id: conversationId,
          sdp: offer.sdp ?? undefined,
        });

        missedTimerRef.current = window.setTimeout(() => {
          if (state === "requesting") {
            setState("ended");
            closePeer();
            pendingResetRef.current = window.setTimeout(() => reset(), 1500);
          }
        }, 30_000);
      } catch (error) {
        console.error("Failed to start call:", error);
        setState("ended");
        closePeer();
        pendingResetRef.current = window.setTimeout(() => reset(), 1500);
      }
    },
    [closePeer, reset]
  );

  // --- accept incoming call -------------------------------------------------
  const acceptCall = useCallback(async () => {
    if (!callIdRef.current || !conversationIdRef.current) return;

    try {
      await messagingApi.answerCall(callIdRef.current);
    } catch {
      /* server may have already handled it */
    }

    // Try with camera; fall back to voice-only if unavailable.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user" },
      });
      setHasVideo(true);
      setVideoEnabled(true);
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasVideo(false);
      setVideoEnabled(false);
    }
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        realtime.sendCallSignal({
          action: "call:ice-candidate",
          call_id: callIdRef.current!,
          conversation_id: conversationIdRef.current!,
          candidate: event.candidate,
        });
      }
    };

    // Set remote description from the stored offer SDP
    if (remoteOfferSdpRef.current) {
      await pc.setRemoteDescription({
        type: "offer",
        sdp: remoteOfferSdpRef.current,
      });
      flushIceCandidates();
    }

    await pc.setLocalDescription(await pc.createAnswer());

    realtime.sendCallSignal({
      action: "call:answer",
      call_id: callIdRef.current!,
      conversation_id: conversationIdRef.current!,
      sdp: pc.localDescription?.sdp ?? undefined,
    });

    setRole("callee");
    setState("active");
    setIncomingCall(null);
    startTimeRef.current = Date.now();
    remoteOfferSdpRef.current = null;

    if (missedTimerRef.current) {
      window.clearTimeout(missedTimerRef.current);
      missedTimerRef.current = null;
    }
  }, []);

  // --- decline incoming call ------------------------------------------------
  const declineCallAction = useCallback(async () => {
    if (callIdRef.current) {
      try {
        await messagingApi.declineCall(callIdRef.current);
      } catch {
        /* ignore */
      }
      realtime.sendCallSignal({
        action: "call:decline",
        call_id: callIdRef.current,
        conversation_id: conversationIdRef.current!,
      });
    }
    setState("ended");
    setIncomingCall(null);
    remoteOfferSdpRef.current = null;
    closePeer();
    pendingResetRef.current = window.setTimeout(() => reset(), 1500);
  }, [closePeer, reset]);

  // --- end call -------------------------------------------------------------
  const endCallAction = useCallback(async () => {
    const duration = startTimeRef.current
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : 0;
    if (callIdRef.current) {
      try {
        await messagingApi.endCall(callIdRef.current, duration);
      } catch {
        /* ignore */
      }
      realtime.sendCallSignal({
        action: "call:end",
        call_id: callIdRef.current,
        conversation_id: conversationIdRef.current!,
        duration_seconds: duration,
      });
    }
    setState("ended");
    closePeer();
    pendingResetRef.current = window.setTimeout(() => reset(), 1500);
  }, [closePeer, reset]);

  // --- toggle mute ----------------------------------------------------------
  const toggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !next));
  }, [isMuted]);

  // --- toggle camera ---------------------------------------------------------
  const toggleCamera = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    if (tracks.length === 0) return;
    const next = !videoEnabled;
    setVideoEnabled(next);
    tracks.forEach((t) => (t.enabled = next));
  }, [videoEnabled]);

  // --- cleanup on unmount ---------------------------------------------------
  useEffect(() => {
    return () => {
      closePeer();
      stopTimer();
    };
  }, [closePeer, stopTimer]);

  return {
    state,
    peerUsername,
    role,
    durationSeconds,
    isMuted,
    startCall,
    acceptCall,
    declineCall: declineCallAction,
    endCall: endCallAction,
    toggleMute,
    toggleCamera,
    incomingCall,
    localStream,
    remoteStream,
    hasVideo,
    videoEnabled,
  };
}

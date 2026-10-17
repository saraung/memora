import { tokenStore } from "@/services/api-client";

export interface RealtimeAttachment {
  id: string;
  resource_type: string;
  width: number | null;
  height: number | null;
  secure_url: string;
}

export interface ServerMessage {
  type: string;
  conversation_id?: string;
  message?: {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string | null;
    is_edited: boolean;
    is_deleted: boolean;
    created_at: string;
  };
  media?: RealtimeAttachment[];
  sender_id?: string;
  code?: string;
}

type Handler = (msg: ServerMessage) => void;

function wsUrl(): string {
  const base = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  if (base) return `${base}/api/v1/ws`;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/api/v1/ws`;
}

const MAX_BACKOFF_MS = 30_000;

/**
 * Long-lived WebSocket with reconnect, heartbeat, and subscriptions.
 * The access token is read fresh from the in-memory store on every
 * (re)connect, so silent refreshes are picked up automatically.
 */
class RealtimeClient {
  private socket: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private subscriptions = new Set<string>();
  private running = false;
  private backoffMs = 1000;
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;

  start(): void {
    this.running = true;
    this.connect();
  }

  stop(): void {
    this.running = false;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
  }

  onMessage(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  subscribe(conversationId: string): void {
    this.subscriptions.add(conversationId);
    this.send({ action: "subscribe", conversation_id: conversationId });
  }

  unsubscribe(conversationId: string): void {
    this.subscriptions.delete(conversationId);
    this.send({ action: "unsubscribe", conversation_id: conversationId });
  }

  sendTyping(conversationId: string): void {
    this.send({ action: "typing", conversation_id: conversationId });
  }

  sendCallSignal(payload: {
    action:
      | "call:invite"
      | "call:answer"
      | "call:ice-candidate"
      | "call:decline"
      | "call:end";
    call_id: string;
    conversation_id: string;
    sdp?: string;
    candidate?: RTCIceCandidateInit | null;
    duration_seconds?: number;
  }): void {
    this.send({
      action: payload.action,
      call_id: payload.call_id,
      conversation_id: payload.conversation_id,
      sdp: payload.sdp,
      candidate: payload.candidate,
      duration_seconds: payload.duration_seconds,
    });
  }

  get connectionState(): "open" | "connecting" | "closed" {
    if (this.socket?.readyState === WebSocket.OPEN) return "open";
    if (this.socket) return "connecting";
    return "closed";
  }

  private connect(): void {
    if (!this.running || this.socket) return;
    const token = tokenStore.get();
    if (!token) {
      this.scheduleReconnect();
      return;
    }
    const socket = new WebSocket(`${wsUrl()}?ticket=${encodeURIComponent(token)}`);
    this.socket = socket;

    socket.onopen = () => {
      this.backoffMs = 1000;
      this.startHeartbeat();
      for (const id of this.subscriptions) {
        this.send({ action: "subscribe", conversation_id: id });
      }
    };
    socket.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data)) as ServerMessage;
        for (const handler of [...this.handlers]) handler(msg);
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.stopHeartbeat();
      this.scheduleReconnect();
    };
    socket.onerror = () => {
      socket.close();
    };
  }

  private scheduleReconnect(): void {
    if (!this.running || this.reconnectTimer !== null) return;
    const delay = Math.min(this.backoffMs, MAX_BACKOFF_MS);
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(payload: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.send({ action: "ping" });
    }, 25_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const realtime = new RealtimeClient();

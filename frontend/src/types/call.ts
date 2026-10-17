export type CallStatus = "ringing" | "accepted" | "declined" | "missed" | "ended";

export interface Call {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  status: CallStatus;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface CallSignal {
  type:
    | "call:invite"
    | "call:answer"
    | "call:ice-candidate"
    | "call:decline"
    | "call:end";
  call_id: string;
  conversation_id: string;
  from: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit | null;
  duration_seconds?: number;
}

/** Backend envelope types (see PRD §6.1). */

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id?: string;
  };
}

export interface Paginated<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}

/** Analytics payloads mirroring the backend `/admin/stats` contract. */

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface CountItem {
  key: string;
  count: number;
}

export interface OverviewStats {
  generated_at: string;
  range_days: number;
  accounts: {
    total: number;
    active: number;
    suspended: number;
    deactivated: number;
    new_7d: number;
    new_30d: number;
  };
  content: {
    posts: number;
    reels: number;
    stories: number;
    comments: number;
    messages: number;
  };
  social: {
    follows: number;
  };
  reports: {
    total: number;
    pending: number;
    under_review: number;
    action_taken: number;
    dismissed: number;
    last_7d: number;
  };
  staff: {
    total: number;
    active: number;
  };
  signups_series: SeriesPoint[];
  posts_series: SeriesPoint[];
  reports_series: SeriesPoint[];
  reports_by_category: CountItem[];
  reports_by_status: CountItem[];
  roles: CountItem[];
}

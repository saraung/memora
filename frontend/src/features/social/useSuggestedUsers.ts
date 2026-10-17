import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api-client";
import type { UserSummary } from "@/types/social";

export interface SuggestedUser extends UserSummary {
  follower_count: number;
}

async function fetchSuggestions(): Promise<SuggestedUser[]> {
  const { data } = await api.get<{ user: UserSummary; follower_count: number }[]>(
    "/users/me/suggestions",
    { params: { limit: 10 } },
  );
  return data.map((s) => ({ ...s.user, follower_count: s.follower_count }));
}

export function useSuggestedUsers() {
  return useQuery({
    queryKey: ["suggested-users"],
    queryFn: fetchSuggestions,
    staleTime: 60_000,
  });
}

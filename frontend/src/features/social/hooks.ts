import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { socialApi } from "@/services/endpoints/social";
import { ApiError } from "@/services/api-client";
import type { Profile, Relationship, UserPage } from "@/types/social";

export const socialKeys = {
  profile: (username: string) => ["profile", username.toLowerCase()] as const,
  relationshipList: (username: string, kind: "followers" | "following") =>
    ["profile", username.toLowerCase(), kind] as const,
  followRequests: ["follow-requests"] as const,
  blocked: ["blocked"] as const,
  me: ["me"] as const,
};

function toastError(toast: (msg: string, kind?: "error") => void, error: unknown, fallback: string) {
  toast(
    error instanceof ApiError ? error.message : fallback,
    "error",
  );
}

export function useProfile(username: string | undefined) {
  return useQuery({
    queryKey: socialKeys.profile(username ?? ""),
    queryFn: () => socialApi.getProfile(username ?? ""),
    enabled: Boolean(username),
    retry: (count, error) =>
      error instanceof ApiError && error.status === 404 ? false : count < 1,
  });
}

export function useFollowToggle(profile: Profile | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const key = socialKeys.profile(profile?.username ?? "");

  return useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("No profile loaded");
      if (profile.relationship === "following" || profile.relationship === "requested") {
        return socialApi.unfollow(profile.id);
      }
      return socialApi.follow(profile.id);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous =
        queryClient.getQueryData<Profile>(key);
      if (previous && previous.relationship !== "self") {
        const next: Relationship =
          previous.relationship === "following" ||
          previous.relationship === "requested"
            ? "none"
            : previous.is_private
              ? "requested"
              : "following";
        const delta =
          previous.relationship === "none" && next !== "none"
            ? 1
            : previous.relationship !== "none" && next === "none"
              ? -1
              : 0;
        queryClient.setQueryData<Profile>(key, {
          ...previous,
          relationship: next,
          follower_count: previous.follower_count + delta,
        });
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toastError(toast, error, "Could not update follow. Please try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: socialKeys.me });
    },
  });
}

export function useBlockToggle(profile: Profile | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (block: boolean) => {
      if (!profile) throw new Error("No profile loaded");
      return block
        ? socialApi.block(profile.id)
        : socialApi.unblock(profile.id);
    },
    onSuccess: (_status, block) => {
      toast(
        block
          ? `Blocked @${profile?.username}.`
          : `Unblocked @${profile?.username}.`,
        "success",
      );
      queryClient.invalidateQueries({ queryKey: socialKeys.blocked });
      if (profile) {
        queryClient.invalidateQueries({
          queryKey: socialKeys.profile(profile.username),
        });
      }
      queryClient.invalidateQueries({ queryKey: socialKeys.me });
    },
    onError: (error) =>
      toastError(toast, error, "Could not update block. Please try again."),
  });
}

export function usePrivacy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (is_private: boolean) => socialApi.setPrivacy(is_private),
    onSuccess: (profile) => {
      toast(
        profile.is_private
          ? "Your account is now private."
          : "Your account is now public.",
        "success",
      );
      queryClient.invalidateQueries({ queryKey: socialKeys.me });
      queryClient.invalidateQueries({
        queryKey: socialKeys.profile(profile.username),
      });
    },
    onError: (error) =>
      toastError(toast, error, "Could not update privacy. Please try again."),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: socialApi.updateProfile,
    onSuccess: (profile) => {
      toast("Profile updated.", "success");
      queryClient.invalidateQueries({ queryKey: socialKeys.me });
      queryClient.invalidateQueries({
        queryKey: socialKeys.profile(profile.username),
      });
    },
    onError: (error) =>
      toastError(toast, error, "Could not update profile. Please try again."),
  });
}

export function useRelationshipList(
  username: string | undefined,
  kind: "followers" | "following",
) {
  return useInfiniteQuery<
    UserPage,
    ApiError,
    InfiniteData<UserPage>,
    ReturnType<typeof socialKeys.relationshipList>,
    string | undefined
  >({
    queryKey: socialKeys.relationshipList(username ?? "", kind),
    queryFn: ({ pageParam }) =>
      kind === "followers"
        ? socialApi.followers(username ?? "", { limit: 20, cursor: pageParam })
        : socialApi.following(username ?? "", { limit: 20, cursor: pageParam }),
    enabled: Boolean(username),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function useFollowRequests() {
  return useQuery({
    queryKey: socialKeys.followRequests,
    queryFn: socialApi.followRequests,
  });
}

export function useDecideRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve ? socialApi.approveRequest(id) : socialApi.rejectRequest(id),
    onSuccess: (item, { approve }) => {
      toast(
        approve
          ? `Approved @${item.requester.username}.`
          : `Rejected @${item.requester.username}.`,
        "success",
      );
      queryClient.invalidateQueries({ queryKey: socialKeys.followRequests });
      queryClient.invalidateQueries({ queryKey: socialKeys.me });
    },
    onError: (error) =>
      toastError(toast, error, "Could not decide the request. Please try again."),
  });
}

export function useBlocked() {
  return useQuery({
    queryKey: socialKeys.blocked,
    queryFn: socialApi.blocked,
  });
}

export function useUnblock() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (userId: string) => socialApi.unblock(userId),
    onSuccess: () => {
      toast("User unblocked.", "success");
      queryClient.invalidateQueries({ queryKey: socialKeys.blocked });
      queryClient.invalidateQueries({ queryKey: socialKeys.me });
    },
    onError: (error) =>
      toastError(toast, error, "Could not unblock. Please try again."),
  });
}

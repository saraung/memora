import { useState } from "react";
import { Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useFollowToggle } from "@/features/social/hooks";
import type { Profile } from "@/types/social";

const LABEL: Record<string, string> = {
  following: "Following",
  requested: "Requested",
  none: "Follow",
};

/** Context-aware follow control with optimistic updates. */
export function FollowButton({ profile }: { profile: Profile }) {
  const toggle = useFollowToggle(profile);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const active =
    profile.relationship === "following" ||
    profile.relationship === "requested";
  const Icon =
    profile.relationship === "following"
      ? Check
      : profile.relationship === "requested"
        ? Clock
        : undefined;

  const handleClick = () => {
    if (active) setConfirmOpen(true);
    else toggle.mutate();
  };

  return (
    <>
      <Button
        variant={active ? "outline" : "primary"}
        onClick={handleClick}
        loading={toggle.isPending}
        className="min-w-28"
      >
        {Icon && <Icon className="size-4" aria-hidden />}
        {LABEL[profile.relationship]}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          toggle.mutate();
          setConfirmOpen(false);
        }}
        title={
          profile.relationship === "following"
            ? `Unfollow @${profile.username}?`
            : `Withdraw request to @${profile.username}?`
        }
        description="They won't be notified."
        confirmLabel={
          profile.relationship === "following" ? "Unfollow" : "Withdraw"
        }
        loading={toggle.isPending}
      />
    </>
  );
}

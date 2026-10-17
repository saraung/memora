import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  BadgeCheck,
  Bookmark,
  CalendarDays,
  Clapperboard,
  Flag,
  Grid3x3,
  Link2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Upload,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  GridSkeleton,
  ProfileHeaderSkeleton,
  StoriesRailSkeleton,
} from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { FollowButton } from "@/components/social/FollowButton";
import { ProfileGrid } from "@/components/content/ProfileGrid";
import { ProfileMoments } from "@/components/content/ProfileMoments";
import { ProfileSaved } from "@/components/content/ProfileSaved";
import { ProfileStories } from "@/components/ephemeral/ProfileStories";
import { useReport } from "@/components/moderation/ReportDialog";
import {
  useBlockToggle,
  useProfile,
  useUpdateProfile,
} from "@/features/social/hooks";
import { ApiError } from "@/services/api-client";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  uploadImageAsset,
} from "@/services/endpoints/content";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/social";

function ProfileSkeleton() {
  return (
    <PageContainer className="space-y-4" aria-label="Loading profile">
      <ProfileHeaderSkeleton />
      <StoriesRailSkeleton count={4} />
      <GridSkeleton count={9} />
    </PageContainer>
  );
}

function Stat({
  value,
  label,
  to,
}: {
  value: number;
  label: string;
  to?: string;
}) {
  const inner = (
    <>
      <span className="text-base font-black text-1">{value}</span>{" "}
      <span className="text-sm text-2">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className="rounded-lg px-1 py-0.5 transition-colors hover:bg-muted">
      {inner}
    </Link>
  ) : (
    <span className="px-1">{inner}</span>
  );
}

function BlockMenu({ profile }: { profile: Profile }) {
  const block = useBlockToggle(profile);
  const { openReport } = useReport();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <DropdownMenu
        label="More actions"
        trigger={
          <button
            type="button"
            aria-label="More actions"
            className="flex size-10 cursor-pointer items-center justify-center rounded-xl border border-line text-2 transition-colors hover:bg-muted"
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        }
        items={[
          {
            label: `Report @${profile.username}`,
            icon: <Flag className="size-4" aria-hidden />,
            onSelect: () =>
              openReport({
                type: "user",
                id: profile.id,
                label: `@${profile.username}`,
              }),
          },
          {
            label: `Block @${profile.username}`,
            danger: true,
            onSelect: () => setConfirmOpen(true),
          },
        ]}
      />
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          block.mutate(true);
          setConfirmOpen(false);
        }}
        title={`Block @${profile.username}?`}
        description="You won't see each other's profiles or content, and any follow between you is removed."
        confirmLabel="Block"
        danger
        loading={block.isPending}
      />
    </>
  );
}

interface EditForm {
  display_name: string;
  bio: string;
  avatar_url: string;
  links: string;
}

function EditProfileDialog({
  profile,
  open,
  onClose,
}: {
  profile: Profile;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditForm>({
    defaultValues: {
      display_name: profile.display_name,
      bio: profile.bio ?? "",
      avatar_url: profile.avatar_url ?? "",
      links: (profile.links ?? []).join("\n"),
    },
  });
  const avatarUrl = watch("avatar_url");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      setUploadError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setUploadError("Image must be 10 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const asset = await uploadImageAsset(file);
      setValue("avatar_url", asset.secure_url, { shouldDirty: true });
    } catch (error) {
      setUploadError(
        error instanceof ApiError
          ? error.message
          : "Could not upload the image. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (values: EditForm) => {
    const links = values.links
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    update.mutate(
      {
        display_name: values.display_name.trim(),
        bio: values.bio.trim() || null,
        avatar_url: values.avatar_url.trim() || null,
        links,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="Edit profile">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={watch("display_name") || profile.username}
            src={avatarUrl || null}
            size="xl"
          />
          <div className="flex flex-col items-start gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={AVATAR_MIME_TYPES.join(",")}
              className="hidden"
              aria-label="Upload profile photo"
              onChange={(e) => {
                void onPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" aria-hidden />
              {avatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            {avatarUrl && !uploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setValue("avatar_url", "", { shouldDirty: true })
                }
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        <FormError message={uploadError} />
        <Input
          label="Display name"
          maxLength={80}
          error={errors.display_name?.message}
          {...register("display_name", {
            required: "Display name is required",
            maxLength: 80,
          })}
        />
        <Textarea
          label="Bio"
          maxLength={160}
          rows={3}
          placeholder="A sentence about you"
          {...register("bio", { maxLength: 160 })}
        />
        <Textarea
          label="Links (one per line)"
          rows={2}
          placeholder={"https://your-site.com"}
          {...register("links")}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={update.isPending || uploading}
            disabled={uploading}
          >
            Save changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ProfileHeader({ profile }: { profile: Profile }) {
  const [editOpen, setEditOpen] = useState(false);
  const navigate = useNavigate();
  const own = profile.relationship === "self";

  const openThread = () => {
    navigate(`/messages/new/${profile.username}`);
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
      <div className="flex items-start gap-4">
        <div className="w-fit shrink-0">
          <div className="story-ring">
            <div className="story-ring-gap">
              <Avatar
                name={profile.display_name || profile.username}
                src={profile.avatar_url}
                size="xl"
              />
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 text-xl font-display font-extrabold tracking-tight text-1">
            <span className="truncate">{profile.display_name}</span>
            {profile.is_verified && (
              <BadgeCheck
                className="size-5 shrink-0 text-primary"
                aria-label="Verified"
              />
            )}
          </h1>
          <p className="text-sm text-2">@{profile.username}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.is_private && (
              <Badge variant="neutral">
                <Lock className="size-3.5" aria-hidden /> Private
              </Badge>
            )}
            <Badge
              variant={
                profile.account_status === "active" ? "success" : "warning"
              }
            >
              {profile.account_status}
            </Badge>
          </div>
        </div>
      </div>

      {profile.bio && (
        <p className="mt-4 text-sm whitespace-pre-line text-1">
          {profile.bio}
        </p>
      )}
      {profile.links && profile.links.length > 0 && (
        <div className="mt-3 space-y-1">
          {profile.links.map((link) => (
            <a
              key={link}
              href={link}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium break-all text-primary hover:underline"
            >
              <Link2 className="size-3.5 shrink-0" aria-hidden />
              {link.replace(/^https?:\/\//, "")}
            </a>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 border-t border-line pt-4">
        <Stat
          value={profile.follower_count}
          label="followers"
          to={`/u/${profile.username}/followers`}
        />
        <Stat
          value={profile.following_count}
          label="following"
          to={`/u/${profile.username}/following`}
        />
        <span className="flex items-center gap-1 text-sm text-3">
          <CalendarDays className="size-4" aria-hidden />
          Joined{" "}
          {new Date(profile.created_at).toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        {own ? (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit profile
          </Button>
        ) : (
          <>
            <FollowButton profile={profile} />
            <Button
              variant="outline"
              onClick={openThread}
              className="gap-2"
            >
              <MessageCircle className="size-4" aria-hidden />
              Message
            </Button>
            <BlockMenu profile={profile} />
          </>
        )}
      </div>
      {own && (
        <EditProfileDialog
          profile={profile}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </section>
  );
}

type ProfileTab = "posts" | "moments" | "saved";

function ProfileTabs({
  tab,
  onChange,
  own,
}: {
  tab: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  own: boolean;
}) {
  const items = [
    { key: "posts" as const, label: "Posts", icon: Grid3x3 },
    { key: "moments" as const, label: "Moments", icon: Clapperboard },
    ...(own
      ? [{ key: "saved" as const, label: "Saved", icon: Bookmark }]
      : []),
  ];
  return (
    <div role="tablist" className="flex border-b border-line">
      {items.map(({ key, label, icon: Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors",
              active ? "text-1" : "text-3 hover:text-2",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-brand"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const profile = useProfile(username);
  const [tab, setTab] = useState<ProfileTab>("posts");

  if (profile.isPending) return <ProfileSkeleton />;

  if (profile.isError) {
    const notFound =
      profile.error instanceof ApiError && profile.error.status === 404;
    return (
      <PageContainer>
        {notFound ? (
          <EmptyState
            title="Profile not available"
            message="This profile doesn't exist, is private, or you don't have access."
          />
        ) : (
          <ErrorState
            title="Could not load this profile"
            onRetry={() => profile.refetch()}
          />
        )}
      </PageContainer>
    );
  }

  const own = profile.data.relationship === "self";
  const shownTab: ProfileTab = !own && tab === "saved" ? "posts" : tab;

  return (
    <PageContainer className="space-y-4">
      <ProfileHeader profile={profile.data} />
      <ProfileStories username={profile.data.username} />
      <ProfileTabs tab={shownTab} onChange={setTab} own={own} />
      {shownTab === "saved" ? (
        <ProfileSaved />
      ) : shownTab === "moments" ? (
        <ProfileMoments username={profile.data.username} />
      ) : (
        <ProfileGrid username={profile.data.username} />
      )}
    </PageContainer>
  );
}

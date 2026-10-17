import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/navigation/AppShell";
import {
  GuestRoute,
  ProtectedRoute,
} from "@/components/navigation/ProtectedRoute";
import { AuthLayout } from "@/layouts/AuthLayout";
import { BookmarksPage } from "@/pages/BookmarksPage";
import { ComposePage } from "@/pages/ComposePage";
import { ExplorePage } from "@/pages/ExplorePage";
import { FeedPage } from "@/pages/FeedPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { LoginPage } from "@/pages/LoginPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { NewMessagePage } from "@/pages/NewMessagePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { PostPage } from "@/pages/PostPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { MomentComposerPage } from "@/pages/MomentComposerPage";
import { MomentsPage } from "@/pages/MomentsPage";
import { ReelPage } from "@/pages/ReelPage";
import { SearchPage } from "@/pages/SearchPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { RelationshipListPage } from "@/pages/RelationshipListPage";
import { RequestsPage } from "@/pages/RequestsPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { StoryComposerPage } from "@/pages/StoryComposerPage";
import { StoryPage } from "@/pages/StoryPage";
import { TagPage } from "@/pages/TagPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/register", element: <RegisterPage /> },
          { path: "/verify-email", element: <VerifyEmailPage /> },
          { path: "/forgot-password", element: <ForgotPasswordPage /> },
          { path: "/reset-password", element: <ResetPasswordPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <FeedPage /> },
          { path: "/search", element: <SearchPage /> },
          { path: "/h/:tag", element: <TagPage /> },
          { path: "/compose", element: <ComposePage /> },
          { path: "/stories/new", element: <StoryComposerPage /> },
          { path: "/stories/:storyId", element: <StoryPage /> },
          { path: "/moments/new", element: <MomentComposerPage /> },
          { path: "/moments", element: <MomentsPage /> },
          { path: "/reels", element: <Navigate to="/moments" replace /> },
          { path: "/reels/new", element: <Navigate to="/moments/new" replace /> },
          { path: "/reels/:reelId", element: <ReelPage /> },
          { path: "/messages", element: <MessagesPage /> },
          { path: "/messages/new/:username", element: <NewMessagePage /> },
          { path: "/messages/:conversationId", element: <MessagesPage /> },
          { path: "/notifications", element: <NotificationsPage /> },
          { path: "/p/:postId", element: <PostPage /> },
          { path: "/settings", element: <SettingsPage /> },
          { path: "/requests", element: <RequestsPage /> },
          { path: "/explore", element: <ExplorePage /> },
          { path: "/bookmarks", element: <BookmarksPage /> },
          { path: "/u/:username", element: <ProfilePage /> },
          {
            path: "/u/:username/followers",
            element: <RelationshipListPage kind="followers" />,
          },
          {
            path: "/u/:username/following",
            element: <RelationshipListPage kind="following" />,
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

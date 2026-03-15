import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AuthLayout } from "@/layouts/AuthLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LoginPage } from "@/features/auth/LoginPage";
import { GithubCallbackPage } from "@/features/auth/GithubCallbackPage";
import { GitlabCallbackPage } from "@/features/auth/GitlabCallbackPage";
import { SpaceListPage } from "@/features/spaces/SpaceListPage";
import { BoardPage } from "@/features/board/BoardPage";
import { HomePage } from "@/pages/HomePage";
import { PrivacyPolicyPage } from "@/pages/PrivacyPolicyPage";
import { TermsPage } from "@/pages/TermsPage";
import { BillingPage } from "@/pages/BillingPage";
import { TeamPage } from "@/pages/TeamPage";
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage";

function RootLayout() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/home",
        element: <HomePage />,
      },
      {
        path: "/privacy",
        element: <PrivacyPolicyPage />,
      },
      {
        path: "/terms",
        element: <TermsPage />,
      },
      {
        path: "/login",
        element: <AuthLayout />,
        children: [
          { index: true, element: <LoginPage /> },
          { path: "callback", element: <GithubCallbackPage /> },
          { path: "gitlab/callback", element: <GitlabCallbackPage /> },
        ],
      },
      {
        path: "/",
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/spaces" replace /> },
          { path: "spaces", element: <SpaceListPage /> },
          { path: "spaces/:spaceId", element: <BoardPage /> },
          { path: "billing", element: <BillingPage /> },
          { path: "team", element: <TeamPage /> },
        ],
      },
      {
        path: "/invitations/:token",
        element: (
          <ProtectedRoute>
            <AcceptInvitationPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

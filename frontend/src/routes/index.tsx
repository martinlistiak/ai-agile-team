import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AuthLayout } from "@/layouts/AuthLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage";
import { GithubCallbackPage } from "@/features/auth/GithubCallbackPage";
import { GitlabCallbackPage } from "@/features/auth/GitlabCallbackPage";
import { SpaceListPage } from "@/features/spaces/SpaceListPage";
import { BoardPage } from "@/features/board/BoardPage";
import { HomePage } from "@/pages/HomePage";
import { PrivacyPolicyPage } from "@/pages/PrivacyPolicyPage";
import { StatusPage } from "@/pages/StatusPage";
import { TermsPage } from "@/pages/TermsPage";
import { BillingPage } from "@/pages/BillingPage";
import { TeamPage } from "@/pages/TeamPage";
import { IntegrationsPage } from "@/pages/IntegrationsPage";
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage";
import { ApiDocsPage } from "@/pages/ApiDocsPage";
import { EnterprisePage } from "@/pages/EnterprisePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotificationSettingsPage } from "@/pages/NotificationSettingsPage";

function RootLayout() {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Outlet />
    </ErrorBoundary>
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
        path: "/status",
        element: <StatusPage />,
      },
      {
        path: "/docs",
        element: <ApiDocsPage />,
      },
      {
        path: "/login",
        element: <AuthLayout />,
        children: [
          { index: true, element: <LoginPage /> },
          { path: "forgot-password", element: <ForgotPasswordPage /> },
          { path: "reset-password", element: <ResetPasswordPage /> },
          { path: "verify-email", element: <VerifyEmailPage /> },
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
          { path: "settings", element: <SettingsPage /> },
          {
            path: "settings/notifications",
            element: <NotificationSettingsPage />,
          },
          { path: "team", element: <TeamPage /> },
          { path: "integrations", element: <IntegrationsPage /> },
          { path: "enterprise", element: <EnterprisePage /> },
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

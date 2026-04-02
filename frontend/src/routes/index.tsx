import { createBrowserRouter, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthLayout } from "@/layouts/AuthLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { trackPageview } from "@/lib/analytics";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage";
import { GithubCallbackPage } from "@/features/auth/GithubCallbackPage";
import { GitlabCallbackPage } from "@/features/auth/GitlabCallbackPage";
import { SpaceListPage } from "@/features/spaces/SpaceListPage";
import { BoardPage } from "@/features/board/BoardPage";
import { HomePage } from "@/pages/HomePage";
import { ContactPage } from "@/pages/ContactPage";
import { PrivacyPolicyPage } from "@/pages/PrivacyPolicyPage";
import { StatusPage } from "@/pages/StatusPage";
import { TermsPage } from "@/pages/TermsPage";
import { BillingGate } from "@/components/BillingGate";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { TeamPage } from "@/pages/TeamPage";
import { IntegrationsPage } from "@/pages/IntegrationsPage";
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage";
import { ApiDocsPage } from "@/pages/ApiDocsPage";
import { EnterprisePage } from "@/pages/EnterprisePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotificationSettingsPage } from "@/pages/NotificationSettingsPage";
import { AdminPage } from "@/pages/AdminPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function RootLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    trackPageview(pathname);
  }, [pathname]);

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
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/contact",
        element: <ContactPage />,
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
        path: "/billing",
        element: (
          <ProtectedRoute>
            <BillingGate />
          </ProtectedRoute>
        ),
      },
      {
        element: (
          <ProtectedRoute>
            <SubscriptionGate>
              <AppLayout />
            </SubscriptionGate>
          </ProtectedRoute>
        ),
        children: [
          { path: "/spaces", element: <SpaceListPage /> },
          { path: "/spaces/:spaceId", element: <BoardPage /> },
          { path: "/settings", element: <SettingsPage /> },
          {
            path: "/settings/notifications",
            element: <NotificationSettingsPage />,
          },
          { path: "/team", element: <TeamPage /> },
          { path: "/integrations", element: <IntegrationsPage /> },
          { path: "/enterprise", element: <EnterprisePage /> },
          { path: "/admin", element: <AdminPage /> },
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
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

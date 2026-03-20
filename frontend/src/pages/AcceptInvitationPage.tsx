import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  useInvitationInfo,
  useAcceptInvitation,
} from "@/api/hooks/useInvitation";

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    data: invitation,
    isLoading: loading,
    error: fetchError,
  } = useInvitationInfo(token);
  const acceptMutation = useAcceptInvitation();

  const handleAccept = async () => {
    if (!token) return;
    setError(null);
    try {
      await acceptMutation.mutateAsync(token);
      navigate("/team");
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Failed to accept invitation");
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  if ((fetchError || error) && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">
            {error || "Invitation not found or has expired"}
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-indigo-500 hover:underline"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-sm text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Team invitation
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            You've been invited to join{" "}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {invitation?.team.name}
            </span>
            . Please log in or sign up to accept.
          </p>
          <button
            onClick={() => navigate(`/login?redirect=/invitations/${token}`)}
            className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
          >
            Log in to accept
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-sm text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Join {invitation?.team.name}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {invitation?.invitedBy.name} invited you to join this team.
        </p>
        <p className="text-xs text-gray-400 mb-6">Logged in as {user?.email}</p>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={acceptMutation.isPending}
            className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {acceptMutation.isPending ? "Accepting…" : "Accept invitation"}
          </button>
        </div>
      </div>
    </div>
  );
}

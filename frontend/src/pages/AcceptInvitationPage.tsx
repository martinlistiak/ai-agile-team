import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";
import type { InvitationInfo } from "@/types";

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .get(`/invitations/${token}`)
      .then(({ data }) => setInvitation(data))
      .catch(() => setError("Invitation not found or has expired"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      await api.post(`/invitations/${token}/accept`);
      navigate("/team");
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
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
            disabled={accepting}
            className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {accepting ? "Accepting…" : "Accept invitation"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import type { Team, TeamDetail } from "@/types";

export function TeamPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const { error: showError } = useToast();

  /** Turn raw HTTP errors like "Cannot POST /api/teams" into friendly messages */
  const friendlyError = (err: any, fallback: string): string => {
    const msg: string | undefined = err.response?.data?.message;
    if (!msg || /^Cannot (GET|POST|PUT|PATCH|DELETE) \//.test(msg)) {
      return fallback;
    }
    return msg;
  };

  const fetchTeams = useCallback(async () => {
    try {
      const { data } = await api.get("/teams");
      setTeams(data);
      if (data.length > 0 && !selectedTeam) {
        const { data: detail } = await api.get(`/teams/${data[0].id}`);
        setSelectedTeam(detail);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const loadTeam = async (teamId: string) => {
    const { data } = await api.get(`/teams/${teamId}`);
    setSelectedTeam(data);
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post("/teams", { name: newTeamName.trim() });
      setNewTeamName("");
      await fetchTeams();
      await loadTeam(data.id);
    } catch (err: any) {
      showError(
        friendlyError(
          err,
          "Failed to create team. Please check your connection and try again.",
        ),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!selectedTeam || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.post(`/teams/${selectedTeam.id}/invitations`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail("");
      await loadTeam(selectedTeam.id);
    } catch (err: any) {
      showError(friendlyError(err, "Failed to send invitation"));
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!selectedTeam) return;
    try {
      await api.delete(`/teams/${selectedTeam.id}/invitations/${invitationId}`);
      await loadTeam(selectedTeam.id);
    } catch {
      /* ignore */
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;
    try {
      await api.delete(`/teams/${selectedTeam.id}/members/${memberId}`);
      await loadTeam(selectedTeam.id);
    } catch (err: any) {
      showError(friendlyError(err, "Failed to remove member"));
    }
  };

  const handleRoleChange = async (
    memberId: string,
    role: "admin" | "member",
  ) => {
    if (!selectedTeam) return;
    try {
      await api.patch(`/teams/${selectedTeam.id}/members/${memberId}/role`, {
        role,
      });
      await loadTeam(selectedTeam.id);
    } catch (err: any) {
      showError(friendlyError(err, "Failed to update role"));
    }
  };

  const handleSeatChange = async (seatCount: number) => {
    // Seats are now auto-calculated based on member count
  };

  const isOwnerOrAdmin =
    selectedTeam?.members.some(
      (m) =>
        m.userId === user?.id && (m.role === "owner" || m.role === "admin"),
    ) ?? false;

  const isOwner =
    selectedTeam?.members.some(
      (m) => m.userId === user?.id && m.role === "owner",
    ) ?? false;

  const canInvite =
    isOwnerOrAdmin &&
    (user?.planTier === "team" || user?.planTier === "enterprise");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Team
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your team members and invitations
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            You don't have a team yet. Create one to start collaborating.
          </p>
          <div className="flex items-center justify-center gap-2">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
            />
            <button
              onClick={handleCreateTeam}
              disabled={creating || !newTeamName.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create team"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Team selector (if multiple) */}
          {teams.length > 1 && (
            <div className="flex gap-2 mb-6">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => loadTeam(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedTeam?.id === t.id
                      ? "bg-indigo-500 text-white"
                      : "border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {selectedTeam && (
            <>
              {/* Seat info */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Seats used
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {selectedTeam.members.length}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Billed per seat on your subscription
                  </p>
                </div>
              </div>

              {/* Invite form */}
              {isOwnerOrAdmin && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Invite a new member
                  </p>
                  {canInvite ? (
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) =>
                          setInviteRole(e.target.value as "member" | "admin")
                        }
                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        aria-label="Role"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={handleInvite}
                        disabled={inviting || !inviteEmail.trim()}
                        className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
                      >
                        {inviting ? "Sending…" : "Send invite"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Upgrade to a Team or Enterprise plan to invite members.
                      </p>
                      <a
                        href="/billing"
                        className="text-sm font-medium text-indigo-500 hover:text-indigo-600 transition-colors"
                      >
                        Upgrade plan
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Members list */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Members ({selectedTeam.members.length})
                  </p>
                </div>
                <ul>
                  {selectedTeam.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between px-5 py-3 border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        {m.user.avatarUrl ? (
                          <img
                            src={m.user.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-medium text-indigo-600 dark:text-indigo-400">
                            {m.user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {m.user.name}
                            {m.userId === user?.id && (
                              <span className="ml-1.5 text-[11px] text-gray-400">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">
                            {m.user.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOwnerOrAdmin &&
                        m.role !== "owner" &&
                        m.userId !== user?.id ? (
                          <>
                            <select
                              value={m.role}
                              onChange={(e) =>
                                handleRoleChange(
                                  m.id,
                                  e.target.value as "admin" | "member",
                                )
                              }
                              className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-gray-600 dark:text-gray-400"
                              aria-label={`Role for ${m.user.name}`}
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              onClick={() => handleRemoveMember(m.id)}
                              className="text-xs text-red-500 hover:text-red-600 px-2 py-1"
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 capitalize px-2 py-1 rounded bg-gray-50 dark:bg-gray-800">
                            {m.role}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pending invitations */}
              {selectedTeam.pendingInvitations.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Pending invitations (
                      {selectedTeam.pendingInvitations.length})
                    </p>
                  </div>
                  <ul>
                    {selectedTeam.pendingInvitations.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center justify-between px-5 py-3 border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                      >
                        <div>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {inv.email}
                          </p>
                          <p className="text-xs text-gray-400">
                            Expires{" "}
                            {new Date(inv.expiresAt).toLocaleDateString()} ·{" "}
                            {inv.role}
                          </p>
                        </div>
                        {isOwnerOrAdmin && (
                          <button
                            onClick={() => handleRevokeInvitation(inv.id)}
                            className="text-xs text-red-500 hover:text-red-600 px-2 py-1"
                          >
                            Revoke
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

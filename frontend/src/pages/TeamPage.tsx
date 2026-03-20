import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useTeams,
  useTeamDetail,
  useCreateTeam,
  useInviteMember,
  useRevokeInvitation,
  useRemoveMember,
  useChangeMemberRole,
} from "@/api/hooks/useTeams";

export function TeamPage() {
  const { user } = useAuth();
  const { data: teams = [], isLoading: loading } = useTeams();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const { data: selectedTeam } = useTeamDetail(selectedTeamId);
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");

  const createTeamMutation = useCreateTeam();
  const inviteMutation = useInviteMember();
  const revokeInvitationMutation = useRevokeInvitation();
  const removeMemberMutation = useRemoveMember();
  const changeRoleMutation = useChangeMemberRole();

  // Auto-select first team
  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    const team = await createTeamMutation.mutateAsync(newTeamName.trim());
    setNewTeamName("");
    setSelectedTeamId(team.id);
  };

  const handleInvite = async () => {
    if (!selectedTeamId || !inviteEmail.trim()) return;
    await inviteMutation.mutateAsync({
      teamId: selectedTeamId,
      email: inviteEmail.trim(),
      role: inviteRole,
    });
    setInviteEmail("");
  };

  const isOwnerOrAdmin =
    selectedTeam?.members.some(
      (m) =>
        m.userId === user?.id && (m.role === "owner" || m.role === "admin"),
    ) ?? false;

  const canInvite =
    isOwnerOrAdmin &&
    (user?.planTier === "team" || user?.planTier === "enterprise");

  const needsEmailVerification = user?.emailVerified === false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
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
              disabled={createTeamMutation.isPending || !newTeamName.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {createTeamMutation.isPending ? "Creating…" : "Create team"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {teams.length > 1 && (
            <div className="flex gap-2 mb-6">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeamId(t.id)}
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
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Team members
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {selectedTeam.members.length}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Unlimited members — billed per space
                  </p>
                </div>
              </div>

              {isOwnerOrAdmin && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Invite a new member
                  </p>
                  {canInvite && needsEmailVerification ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Verify your email address before inviting teammates. Check
                      your inbox for the confirmation link, or use &quot;Resend
                      email&quot; in the banner at the top of the app.
                    </p>
                  ) : canInvite ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
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
                        disabled={
                          inviteMutation.isPending || !inviteEmail.trim()
                        }
                        className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
                      >
                        {inviteMutation.isPending ? "Sending…" : "Send invite"}
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
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 md:px-5 border-b border-gray-50 dark:border-gray-800/50 last:border-0"
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
                                changeRoleMutation.mutate({
                                  teamId: selectedTeam.id,
                                  memberId: m.id,
                                  role: e.target.value as "admin" | "member",
                                })
                              }
                              className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-gray-600 dark:text-gray-400"
                              aria-label={`Role for ${m.user.name}`}
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              onClick={() =>
                                removeMemberMutation.mutate({
                                  teamId: selectedTeam.id,
                                  memberId: m.id,
                                })
                              }
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
                            onClick={() =>
                              revokeInvitationMutation.mutate({
                                teamId: selectedTeam.id,
                                invitationId: inv.id,
                              })
                            }
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

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useTeams,
  useTeamDetail,
  useCreateTeam,
  useUpdateTeam,
  useInviteMember,
  useRevokeInvitation,
  useRemoveMember,
  useChangeMemberRole,
} from "@/api/hooks/useTeams";
import { cn } from "@/lib/cn";
import { Button } from "@/components/Button";

export function TeamPage() {
  const { user } = useAuth();
  const { data: teams = [], isLoading: loading } = useTeams();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const { data: selectedTeam } = useTeamDetail(selectedTeamId);
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const createTeamMutation = useCreateTeam();
  const updateTeamMutation = useUpdateTeam();
  const inviteMutation = useInviteMember();
  const revokeInvitationMutation = useRevokeInvitation();
  const removeMemberMutation = useRemoveMember();
  const changeRoleMutation = useChangeMemberRole();

  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  useEffect(() => {
    if (selectedTeam) {
      setEditedName(selectedTeam.name);
    }
  }, [selectedTeam]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    const team = await createTeamMutation.mutateAsync(newTeamName.trim());
    setNewTeamName("");
    setSelectedTeamId(team.id);
  };

  const handleSaveName = async () => {
    if (!selectedTeamId || !editedName.trim()) return;
    if (editedName.trim() === selectedTeam?.name) {
      setIsEditingName(false);
      return;
    }
    await updateTeamMutation.mutateAsync({
      teamId: selectedTeamId,
      name: editedName.trim(),
    });
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setEditedName(selectedTeam?.name ?? "");
    setIsEditingName(false);
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

  const needsEmailVerification = user?.emailVerified === false;

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  // Empty state — no teams yet
  if (teams.length === 0) {
    return (
      <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto pb-24">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Team
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create a team to collaborate with others.
          </p>
        </div>

        <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Create your team
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Teams let you collaborate with up to 99 people on any plan—no
            upgrade required.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 max-w-md">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
            />
            <Button
              onClick={handleCreateTeam}
              disabled={!newTeamName.trim()}
              loading={createTeamMutation.isPending}
            >
              Create team
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Team
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your team members and invitations.
        </p>
      </div>

      {/* Team selector for multiple teams */}
      {teams.length > 1 && (
        <div
          className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-1 gap-1 mb-6"
          role="group"
          aria-label="Select team"
        >
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTeamId(t.id)}
              className={cn(
                "cursor-pointer px-3 py-2 rounded-md text-sm font-medium transition-colors",
                selectedTeam?.id === t.id
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {selectedTeam && (
        <>
          {/* Team name section */}
          <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Team name
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              The name of your team as it appears across the workspace.
            </p>

            {isEditingName ? (
              <div className="flex flex-col sm:flex-row gap-2 max-w-md">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveName}
                    disabled={!editedName.trim()}
                    loading={updateTeamMutation.isPending}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                  {selectedTeam.name}
                </span>
                {isOwnerOrAdmin && (
                  <Button variant="link" onClick={() => setIsEditingName(true)}>
                    Edit
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* Capacity section */}
          <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Team capacity
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Invite up to 99 members on any plan—no per-seat charges.
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {selectedTeam.members.length}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                / 99 members
              </span>
            </div>
          </section>

          {/* Invite section */}
          {isOwnerOrAdmin && (
            <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Invite members
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Send an invitation email to add someone to your team.
              </p>

              {needsEmailVerification ? (
                <p className="text-sm text-amber-800 dark:text-amber-300/95">
                  Verify your email address before inviting teammates. Check
                  your inbox for the confirmation link.
                </p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as "member" | "admin")
                    }
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    aria-label="Role"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button
                    onClick={handleInvite}
                    disabled={!inviteEmail.trim()}
                    loading={inviteMutation.isPending}
                  >
                    Send invite
                  </Button>
                </div>
              )}
            </section>
          )}

          {/* Members list */}
          <section className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Members ({selectedTeam.members.length})
              </h2>
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
                        className="w-8 h-8 rounded-full object-cover"
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
                      <p className="text-xs text-gray-400">{m.user.email}</p>
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
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() =>
                            removeMemberMutation.mutate({
                              teamId: selectedTeam.id,
                              memberId: m.id,
                            })
                          }
                          className="text-red-500 hover:text-red-600"
                        >
                          Remove
                        </Button>
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
          </section>

          {/* Pending invitations */}
          {selectedTeam.pendingInvitations.length > 0 && (
            <section className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Pending invitations ({selectedTeam.pendingInvitations.length})
                </h2>
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
                        Expires {new Date(inv.expiresAt).toLocaleDateString()} ·{" "}
                        {inv.role}
                      </p>
                    </div>
                    {isOwnerOrAdmin && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() =>
                          revokeInvitationMutation.mutate({
                            teamId: selectedTeam.id,
                            invitationId: inv.id,
                          })
                        }
                        className="text-red-500 hover:text-red-600"
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

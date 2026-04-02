import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonate } from "@/api/hooks/useImpersonation";
import api from "@/api/client";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  planTier: string;
  subscriptionStatus: string;
  createdAt: string;
}

export function AdminPage() {
  const { user, startImpersonation } = useAuth();
  const [search, setSearch] = useState("");
  const impersonateMutation = useImpersonate();

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data } = await api.get("/auth/admin/users");
      return data;
    },
    enabled: user?.isSuperAdmin === true,
  });

  if (!user?.isSuperAdmin) {
    return (
      <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Access Denied
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          You do not have permission to access this page.
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleImpersonate = async (targetUser: AdminUser) => {
    const result = await impersonateMutation.mutateAsync(targetUser.id);
    startImpersonation(result.accessToken, result.user);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Admin
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Superadmin tools for user management.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Impersonate User
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          View the app as another user. You will be in read-only mode and cannot
          make any changes.
        </p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full max-w-md px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 mb-4"
        />

        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">
                    User
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">
                    Plan
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">
                    Status
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">
                    Joined
                  </th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.slice(0, 50).map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-100 dark:border-gray-800/50 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-medium text-indigo-600 dark:text-indigo-400">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {u.name}
                          </p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">
                      {u.planTier}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          u.subscriptionStatus === "active" ||
                          u.subscriptionStatus === "trialing"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {u.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== user.id && (
                        <button
                          onClick={() => handleImpersonate(u)}
                          disabled={impersonateMutation.isPending}
                          className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50"
                        >
                          {impersonateMutation.isPending &&
                          impersonateMutation.variables === u.id
                            ? "Loading…"
                            : "View as"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length > 50 && (
              <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
                Showing 50 of {filteredUsers.length} results. Refine your
                search.
              </p>
            )}
            {filteredUsers.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                No users found.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

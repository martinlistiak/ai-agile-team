import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import {
  useNotificationPreferences,
  usePatchNotificationPreferences,
} from "@/api/hooks/useNotificationPreferences";
import type { EmailDigestFrequency, NotificationPreference } from "@/types";

const DIGEST_OPTIONS: {
  value: EmailDigestFrequency;
  label: string;
  hint: string;
}[] = [
  {
    value: "instant",
    label: "Instant",
    hint: "Send each email as the event happens.",
  },
  {
    value: "hourly",
    label: "Hourly digest",
    hint: "Bundled delivery when digest email is available.",
  },
  {
    value: "daily",
    label: "Daily digest",
    hint: "Bundled delivery when digest email is available.",
  },
  {
    value: "none",
    label: "No email",
    hint: "Turn off all notification emails (in-app still follows toggles below).",
  },
];

const ROWS: {
  label: string;
  inAppKey: keyof NotificationPreference;
  emailKey: keyof NotificationPreference;
}[] = [
  {
    label: "Agent run completed",
    inAppKey: "inAppAgentCompleted",
    emailKey: "emailAgentCompleted",
  },
  {
    label: "Agent run failed",
    inAppKey: "inAppAgentFailed",
    emailKey: "emailAgentFailed",
  },
  {
    label: "Pipeline stage changed",
    inAppKey: "inAppPipelineStageChanged",
    emailKey: "emailPipelineStageChanged",
  },
  {
    label: "Pull request created",
    inAppKey: "inAppPrCreated",
    emailKey: "emailPrCreated",
  },
  {
    label: "Ticket assigned to you",
    inAppKey: "inAppTicketAssigned",
    emailKey: "emailTicketAssigned",
  },
  {
    label: "Ticket comment",
    inAppKey: "inAppTicketCommented",
    emailKey: "emailTicketCommented",
  },
  {
    label: "Team invitation",
    inAppKey: "inAppTeamInvitation",
    emailKey: "emailTeamInvitation",
  },
  {
    label: "Team member joined",
    inAppKey: "inAppTeamMemberJoined",
    emailKey: "emailTeamMemberJoined",
  },
];

export function NotificationSettingsPage() {
  const {
    data: prefs,
    isLoading: loading,
    error: loadError,
    refetch,
  } = useNotificationPreferences();
  const patchMutation = usePatchNotificationPreferences();

  const onToggle = (key: keyof NotificationPreference, value: boolean) => {
    patchMutation.mutate({ [key]: value } as Partial<NotificationPreference>);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto pb-24">
      <div className="mb-6">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-4"
        >
          <FiArrowLeft className="h-4 w-4" aria-hidden />
          Back to account settings
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Notification settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Control in-app alerts and email for workspace activity.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      )}

      {!loading && loadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-800 dark:text-red-200">
          <p>{(loadError as Error).message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 text-sm font-medium text-red-900 dark:text-red-100 underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && prefs && (
        <>
          <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Global
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Mute everything stops new in-app notifications and emails until
              you turn it off.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.muteAll}
                disabled={patchMutation.isPending}
                onChange={(e) => onToggle("muteAll", e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-800 dark:text-gray-200">
                Mute all notifications
              </span>
            </label>
          </section>

          <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Email timing
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Instant sends mail when events occur. Digest options are stored
              for your account; bundled digests may not be active in every
              environment yet.
            </p>
            <select
              value={prefs.emailDigestFrequency}
              disabled={patchMutation.isPending}
              onChange={(e) =>
                patchMutation.mutate({
                  emailDigestFrequency: e.target.value as EmailDigestFrequency,
                })
              }
              className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            >
              {DIGEST_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.hint}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6 overflow-x-auto">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              By event type
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              In-app notifications appear in the app; email follows your timing
              setting above (and each toggle).
            </p>
            <table className="w-full text-sm min-w-[320px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Event</th>
                  <th className="pb-2 pr-4 font-medium w-28">In-app</th>
                  <th className="pb-2 font-medium w-28">Email</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-gray-100 dark:border-gray-800/80 last:border-0"
                  >
                    <td className="py-3 pr-4 text-gray-800 dark:text-gray-200">
                      {row.label}
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="checkbox"
                        checked={Boolean(prefs[row.inAppKey])}
                        disabled={patchMutation.isPending}
                        onChange={(e) =>
                          onToggle(row.inAppKey, e.target.checked)
                        }
                        aria-label={`In-app: ${row.label}`}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </td>
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(prefs[row.emailKey])}
                        disabled={patchMutation.isPending}
                        onChange={(e) =>
                          onToggle(row.emailKey, e.target.checked)
                        }
                        aria-label={`Email: ${row.label}`}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

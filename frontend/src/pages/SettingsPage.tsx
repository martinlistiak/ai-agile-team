import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { FiMonitor, FiMoon, FiSun, FiUpload } from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/cn";
import {
  useSaveProfile,
  useUploadAvatar,
  useChangePassword,
  useDeleteAccount,
} from "@/api/hooks/useSettings";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof FiSun }[] =
  [
    { value: "light", label: "Light", icon: FiSun },
    { value: "system", label: "System", icon: FiMonitor },
    { value: "dark", label: "Dark", icon: FiMoon },
  ];

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { mode, setMode, resolvedMode } = useTheme();
  const { success } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarPreviewBroken, setAvatarPreviewBroken] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState("");
  const [showRemoveAvatarConfirm, setShowRemoveAvatarConfirm] = useState(false);

  const saveProfileMutation = useSaveProfile();
  const uploadAvatarMutation = useUploadAvatar();
  const changePasswordMutation = useChangePassword();
  const deleteAccountMutation = useDeleteAccount();

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setAvatarPreviewBroken(false);
  }, [user]);

  const canEditEmail = Boolean(user?.hasPassword);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload: { name?: string; email?: string } = {};
    if (name.trim() !== user.name) payload.name = name.trim();
    if (canEditEmail && email.trim().toLowerCase() !== user.email.toLowerCase())
      payload.email = email.trim();
    if (Object.keys(payload).length === 0) {
      success("Nothing to save.");
      return;
    }
    saveProfileMutation.mutate(payload);
  };

  const handleAvatarFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      uploadAvatarMutation.mutate(file);
    },
    [uploadAvatarMutation],
  );

  const handleConfirmRemoveAvatar = useCallback(() => {
    if (!user?.avatarUrl) return;
    saveProfileMutation.mutate(
      { avatarUrl: null },
      {
        onSuccess: () => setShowRemoveAvatarConfirm(false),
      },
    );
  }, [user?.avatarUrl, saveProfileMutation]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      return;
    }
    changePasswordMutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmNewPassword("");
        },
      },
    );
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    deleteAccountMutation.mutate(
      user.hasPassword
        ? { password: deletePassword }
        : { confirmationEmail: deleteEmailConfirm.trim() },
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Account settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your profile, password, notifications, and data.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Notifications
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Choose which workspace events send in-app alerts and email.
        </p>
        <Link
          to="/settings/notifications"
          className="inline-flex text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Open notification settings
        </Link>
      </section>

      <section
        id="appearance"
        className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6"
      >
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Appearance
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Choose light or dark, or match your device. This applies across the
          app on this browser.
        </p>
        <div
          className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-1 gap-1"
          role="group"
          aria-label="Theme"
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={cn(
                  "cursor-pointer flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
                )}
                aria-pressed={active}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
        {mode === "system" && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Using{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {resolvedMode === "dark" ? "dark" : "light"}
            </span>{" "}
            from your system preference.
          </p>
        )}
      </section>

      <section
        id="profile"
        className="relative mb-10 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50/80 dark:border-stone-800 dark:bg-stone-950/50"
      >
        <div
          className="absolute left-0 top-0 h-full w-1 bg-primary-500 dark:bg-primary-400"
          aria-hidden
        />
        <div className="px-5 py-7 pl-6 sm:px-8 sm:py-9 sm:pl-8">
          <header className="mb-9 max-w-2xl border-b border-stone-200/90 pb-7 dark:border-stone-800/90">
            <h2 className="font-display text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-stone-900 dark:text-stone-50 sm:text-[2rem]">
              Profile
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              How you appear across the workspace. Photos accept JPEG, PNG,
              WebP, or GIF up to 2&nbsp;MB. OAuth accounts may show a provider
              image until you add your own.
            </p>
          </header>

          <form
            onSubmit={handleSaveProfile}
            className="grid gap-10 lg:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-0"
          >
            <div className="lg:pt-1">
              <p className="mb-4 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-stone-500">
                Portrait
              </p>
              <div
                className={cn(
                  "relative isolate mb-5 inline-flex h-23 w-23 items-center justify-center overflow-hidden rounded-full bg-primary-600 text-xl font-semibold text-white shadow-[5px_5px_0_0_rgb(214_211_209)] motion-safe:transition-shadow motion-safe:duration-200 dark:bg-primary-700 dark:shadow-[5px_5px_0_0_rgb(68_64_60)]",
                  uploadAvatarMutation.isPending && "opacity-80",
                )}
              >
                {user.avatarUrl && !avatarPreviewBroken ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setAvatarPreviewBroken(true)}
                  />
                ) : (
                  <span aria-hidden>{user.name[0]?.toUpperCase() || "?"}</span>
                )}
              </div>
              <input
                ref={fileInputRef}
                id="settings-avatar-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                tabIndex={-1}
                onChange={handleAvatarFileChange}
              />
              <div className="flex flex-col items-stretch gap-2 sm:max-w-54">
                <button
                  type="button"
                  disabled={uploadAvatarMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload profile photo"
                  className={cn(
                    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium text-stone-800 motion-safe:transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800",
                  )}
                >
                  <FiUpload className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  {uploadAvatarMutation.isPending ? "Uploading…" : "Upload"}
                </button>
                {user.avatarUrl ? (
                  <button
                    type="button"
                    disabled={
                      saveProfileMutation.isPending ||
                      uploadAvatarMutation.isPending
                    }
                    onClick={() => setShowRemoveAvatarConfirm(true)}
                    className="cursor-pointer text-left text-sm font-medium text-stone-500 underline decoration-stone-300 underline-offset-4 transition-colors hover:text-red-700 hover:decoration-red-400/60 disabled:cursor-not-allowed disabled:opacity-50 dark:text-stone-400 dark:decoration-stone-600 dark:hover:text-red-400"
                  >
                    Remove photo…
                  </button>
                ) : null}
              </div>
            </div>

            <div className="space-y-5 lg:max-w-md">
              <div>
                <label
                  htmlFor="settings-name"
                  className="mb-1.5 block text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-stone-500 dark:text-stone-500"
                >
                  Display name
                </label>
                <input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-primary-500/0 transition-[box-shadow,border-color] focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-primary-500"
                />
              </div>
              <div>
                <label
                  htmlFor="settings-email"
                  className="mb-1.5 block text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-stone-500 dark:text-stone-500"
                >
                  Email
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canEditEmail}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-primary-500/0 transition-[box-shadow,border-color] focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-primary-500"
                />
                {!canEditEmail && (
                  <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                    Managed by your sign-in provider (GitHub, GitLab, or SSO).
                  </p>
                )}
                {canEditEmail && user.emailVerified === false && (
                  <p className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300/95">
                    Verify your email to keep full access. Check your inbox or
                    use the banner in the app.
                  </p>
                )}
              </div>
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={saveProfileMutation.isPending}
                  className="text-sm font-medium rounded-lg bg-primary-600 px-5 py-2.5 text-white motion-safe:transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                >
                  {saveProfileMutation.isPending ? "Saving…" : "Save profile"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <ConfirmDialog
        open={showRemoveAvatarConfirm}
        title="Remove profile photo?"
        message="Your picture will be cleared in Runa. You can upload another anytime. If you use GitHub, GitLab, or SSO, your provider may attach an avatar again the next time you sign in."
        confirmLabel="Remove photo"
        cancelLabel="Keep photo"
        confirmPending={saveProfileMutation.isPending}
        pendingConfirmLabel="Removing…"
        variant="default"
        onConfirm={handleConfirmRemoveAvatar}
        onCancel={() => setShowRemoveAvatarConfirm(false)}
      />

      {user.hasPassword ? (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Password
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Use a strong password you do not reuse elsewhere.
          </p>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label
                htmlFor="settings-current-pw"
                className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
              >
                Current password
              </label>
              <input
                id="settings-current-pw"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor="settings-new-pw"
                className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
              >
                New password
              </label>
              <input
                id="settings-new-pw"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor="settings-confirm-pw"
                className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
              >
                Confirm new password
              </label>
              <input
                id="settings-confirm-pw"
                type="password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {changePasswordMutation.isPending
                ? "Updating…"
                : "Update password"}
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Password
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You sign in with GitHub, GitLab, or SSO. There is no Runa password
            on this account.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-5">
        <h2 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
          Delete account
        </h2>
        <p className="text-xs text-red-800/90 dark:text-red-200/80 mb-3">
          Permanently delete your account, spaces, and personal data we hold
          locally. Active subscriptions are cancelled in Stripe when possible.
          If you own a team with other members, remove them or delete the team
          first. See our{" "}
          <Link
            to="/privacy"
            className="underline underline-offset-2 font-medium"
          >
            Privacy Policy
          </Link>{" "}
          for your rights.
        </p>
        {!showDeletePanel ? (
          <button
            type="button"
            onClick={() => setShowDeletePanel(true)}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Delete my account…
          </button>
        ) : (
          <form onSubmit={handleDeleteAccount} className="space-y-4 max-w-md">
            {user.hasPassword ? (
              <div>
                <label
                  htmlFor="settings-delete-pw"
                  className="block text-xs font-medium text-red-900 dark:text-red-200 mb-1"
                >
                  Enter your password to confirm
                </label>
                <input
                  id="settings-delete-pw"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
            ) : (
              <div>
                <label
                  htmlFor="settings-delete-email"
                  className="block text-xs font-medium text-red-900 dark:text-red-200 mb-1"
                >
                  Type your email exactly to confirm
                </label>
                <input
                  id="settings-delete-email"
                  type="email"
                  autoComplete="off"
                  value={deleteEmailConfirm}
                  onChange={(e) => setDeleteEmailConfirm(e.target.value)}
                  required
                  placeholder={user.email}
                  className="w-full rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={deleteAccountMutation.isPending}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteAccountMutation.isPending
                  ? "Deleting…"
                  : "Permanently delete account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeletePanel(false);
                  setDeletePassword("");
                  setDeleteEmailConfirm("");
                }}
                className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

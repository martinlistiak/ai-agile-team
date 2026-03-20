import { useMutation } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import { getApiErrorPayload } from "@/lib/api-errors";
import { trackEvent } from "@/lib/analytics";
import { useAuth, type ProfilePatchUser } from "@/contexts/AuthContext";

export function useUploadAvatar() {
  const { mergeUser, refreshUser } = useAuth();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const { data } = await api.post<{ user: ProfilePatchUser }>(
        "/auth/profile/avatar",
        body,
      );
      return data.user;
    },
    onSuccess: async (user) => {
      mergeUser(user);
      await refreshUser();
      success("Profile photo updated.");
      trackEvent("settings_avatar_uploaded", {});
    },
    onError: (err) => {
      showError(getApiErrorPayload(err).message);
    },
  });
}

export function useSaveProfile() {
  const { mergeUser, refreshUser } = useAuth();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      name?: string;
      email?: string;
      avatarUrl?: string | null;
    }) => {
      const { data } = await api.patch<{ user: ProfilePatchUser }>(
        "/auth/profile",
        payload,
      );
      return { user: data.user, changedEmail: !!payload.email };
    },
    onSuccess: async ({ user, changedEmail }) => {
      mergeUser(user);
      await refreshUser();
      success(
        changedEmail
          ? "Profile saved. Check your inbox to verify your new email."
          : "Profile saved.",
      );
      trackEvent("settings_profile_saved", {
        changed_email: changedEmail ? "true" : "false",
      });
    },
    onError: (err) => {
      showError(getApiErrorPayload(err).message);
    },
  });
}

export function useChangePassword() {
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      currentPassword: string;
      newPassword: string;
    }) => {
      await api.post("/auth/change-password", payload);
    },
    onSuccess: () => {
      success("Password updated.");
      trackEvent("settings_password_changed", {});
    },
    onError: (err) => {
      showError(getApiErrorPayload(err).message);
    },
  });
}

export function useDeleteAccount() {
  const { logout } = useAuth();
  const { error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      password?: string;
      confirmationEmail?: string;
    }) => {
      await api.post(
        "/auth/delete-account",
        payload.password
          ? { password: payload.password }
          : { confirmationEmail: payload.confirmationEmail },
      );
    },
    onSuccess: () => {
      trackEvent("settings_account_deleted", {});
      logout();
      window.location.href = "/login";
    },
    onError: (err) => {
      showError(getApiErrorPayload(err).message);
    },
  });
}

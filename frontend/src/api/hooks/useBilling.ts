import { useQuery, useMutation } from "@tanstack/react-query";
import api from "@/api/client";
import { trackEvent } from "@/lib/analytics";

interface UsageStats {
  periodStart: string;
  periodEnd: string;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  totalTokens: number;
}

export interface BillingInvoice {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  currency: string;
  created: string;
  pdfUrl: string | null;
}

export function useBillingInvoices(enabled: boolean) {
  return useQuery<{ invoices: BillingInvoice[] }>({
    queryKey: ["billing", "invoices"],
    queryFn: async () => {
      const { data } = await api.get<{ invoices: BillingInvoice[] }>(
        "/billing/invoices",
      );
      return data;
    },
    enabled,
  });
}

export function useBillingUsage() {
  return useQuery<UsageStats>({
    queryKey: ["billing", "usage"],
    queryFn: async () => {
      const { data } = await api.get<UsageStats>("/billing/usage");
      return data;
    },
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: async (payload: {
      plan: "starter" | "team" | "enterprise";
      interval: "annual" | "monthly";
    }) => {
      const { data } = await api.post("/billing/checkout", payload);
      trackEvent("billing_checkout_started", {
        plan: payload.plan,
        billing_interval: payload.interval,
      });
      return data as { url: string };
    },
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/billing/portal");
      trackEvent("billing_portal_opened", {});
      return data as { url: string };
    },
  });
}

export function useCreditsBalance() {
  return useQuery<{ creditsBalance: number }>({
    queryKey: ["billing", "credits"],
    queryFn: async () => {
      const { data } = await api.get<{ creditsBalance: number }>(
        "/billing/credits",
      );
      return data;
    },
  });
}

export function useCreditTopUp() {
  return useMutation({
    mutationFn: async (amount: number) => {
      const { data } = await api.post("/billing/top-up", { amount });
      trackEvent("credits_topup_started", { amount: String(amount) });
      return data as { url: string };
    },
  });
}

export function useVerifyCheckoutSession() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await api.post<{ success: boolean }>(
        "/billing/verify-session",
        { sessionId },
      );
      return data;
    },
  });
}

export function useVerifyTopUpSession() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await api.post<{
        success: boolean;
        creditsAdded: number;
      }>("/billing/verify-topup", { sessionId });
      return data;
    },
  });
}

export function useAddSpaceCheckout() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ url: string }>("/billing/add-space");
      trackEvent("billing_add_space_started", {});
      return data;
    },
  });
}

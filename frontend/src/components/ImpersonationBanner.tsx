import { useAuth } from "@/contexts/AuthContext";
import { useStopImpersonation } from "@/api/hooks/useImpersonation";

export function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonation } = useAuth();
  const stopMutation = useStopImpersonation();

  if (!isImpersonating || !user) return null;

  const handleStop = async () => {
    const result = await stopMutation.mutateAsync();
    stopImpersonation(result.accessToken, result.user);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-center gap-4">
      <span>
        Viewing as {user.name} ({user.email}) — Read-only mode
      </span>
      <button
        onClick={handleStop}
        disabled={stopMutation.isPending}
        className="px-3 py-1 bg-amber-950 text-amber-100 rounded text-xs font-medium hover:bg-amber-900 transition-colors disabled:opacity-50"
      >
        {stopMutation.isPending ? "Exiting…" : "Exit impersonation"}
      </button>
    </div>
  );
}

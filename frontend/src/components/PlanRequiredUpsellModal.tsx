import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { FiCheck, FiLayers } from "react-icons/fi";

interface PlanRequiredUpsellModalProps {
  onClose: () => void;
}

export function PlanRequiredUpsellModal({ onClose }: PlanRequiredUpsellModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    navigate("/billing");
  };

  return (
    <Modal onClose={onClose} className="max-w-md" aria-label="Upgrade plan">
      <div className="p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
          <FiLayers className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Upgrade your plan
        </h2>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          This feature is included on the Team plan and above. Upgrade to unlock
          it for your workspace.
        </p>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Team and Enterprise include:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FiCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Advanced automation and pipeline features</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FiCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Higher limits and collaboration tools</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FiCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Priority support on Enterprise</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Maybe later
          </Button>
          <Button variant="primary" onClick={handleUpgrade} className="flex-1">
            View plans
          </Button>
        </div>
      </div>
    </Modal>
  );
}

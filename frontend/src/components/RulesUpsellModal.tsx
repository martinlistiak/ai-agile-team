import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { FiFileText, FiCheck } from "react-icons/fi";

interface RulesUpsellModalProps {
  onClose: () => void;
}

export function RulesUpsellModal({ onClose }: RulesUpsellModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    navigate("/billing");
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <div className="p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
          <FiFileText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Upgrade to unlock Custom Rules
        </h2>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Custom agent rules are available on the Team plan and above. Define
          how agents behave with space-wide, agent-specific, and cross-team
          rules.
        </p>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            With custom rules you can:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FiCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Set space-wide rules that apply to all agents</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FiCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Create agent-specific rules for fine-grained control</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FiCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Define cross-team rules for consistency</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FiCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Version and toggle rules on/off as needed</span>
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

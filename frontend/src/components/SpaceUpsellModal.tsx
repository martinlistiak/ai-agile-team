import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useAddSpaceCheckout } from "@/api/hooks/useBilling";
import { FiPlus, FiCheck } from "react-icons/fi";

interface SpaceUpsellModalProps {
  currentSpaceCount: number;
  onClose: () => void;
  onConfirmed: () => void;
}

export function SpaceUpsellModal({
  currentSpaceCount,
  onClose,
  onConfirmed,
}: SpaceUpsellModalProps) {
  const { user } = useAuth();
  const addSpaceCheckout = useAddSpaceCheckout();
  const planTier = user?.planTier ?? "starter";

  const pricePerSpace = planTier === "team" ? 39 : 15;
  const newTotal = currentSpaceCount + 1;

  const handleConfirm = async () => {
    try {
      await addSpaceCheckout.mutateAsync();
      onClose();
      onConfirmed();
    } catch (err) {
      console.error("Failed to add space:", err);
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <div className="p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
          <FiPlus className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Add another space?
        </h2>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          You currently have {currentSpaceCount}{" "}
          {currentSpaceCount === 1 ? "space" : "spaces"}. Adding a new space
          will update your subscription.
        </p>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Current spaces
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {currentSpaceCount}
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              New space
            </span>
            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
              +1
            </span>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                New total
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {newTotal} spaces × ${pricePerSpace}/mo = $
                {newTotal * pricePerSpace}/mo
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <FiCheck className="w-4 h-4 text-emerald-500" />
            <span>Prorated billing — only pay for what you use</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <FiCheck className="w-4 h-4 text-emerald-500" />
            <span>Delete anytime to reduce your bill</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            loading={addSpaceCheckout.isPending}
            className="flex-1"
          >
            Add space
          </Button>
        </div>
      </div>
    </Modal>
  );
}

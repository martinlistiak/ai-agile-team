import { useState } from "react";
import { FiZap } from "react-icons/fi";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { useCreditTopUp } from "@/api/hooks/useBilling";
import { formatTopUpTokens } from "@/config/pricing";

interface TokenTopUpDialogProps {
  onClose: () => void;
  message?: string;
}

const PRESETS = [5, 10, 20, 50];

export function TokenTopUpDialog({ onClose, message }: TokenTopUpDialogProps) {
  const [amount, setAmount] = useState(10);
  const topUp = useCreditTopUp();

  const handleTopUp = async () => {
    try {
      const data = await topUp.mutateAsync({ amount });
      window.location.href = data.url;
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <div className="p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
          <FiZap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          You've run out of tokens
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {message || "Your monthly token limit has been reached."}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          Top up usage credits to keep going. Credits never expire and are used
          when your monthly quota runs out.
        </p>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-5 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
            Select amount
          </p>
          <div className="flex gap-2 mb-3">
            {PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className={`cursor-pointer flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  amount === v
                    ? "bg-amber-600 text-white"
                    : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                }`}
              >
                ${v}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ${amount} = {formatTopUpTokens(amount)} tokens · $1 ={" "}
            {formatTopUpTokens(1)} tokens
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Maybe later
          </Button>
          <Button
            variant="primary"
            onClick={handleTopUp}
            loading={topUp.isPending}
            className="flex-1"
          >
            Buy ${amount} credits
          </Button>
        </div>
      </div>
    </Modal>
  );
}

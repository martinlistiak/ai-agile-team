import { FiCheck, FiX, FiZap } from 'react-icons/fi';
import { useSuggestedRules, useAcceptSuggestedRule, useRejectSuggestedRule } from '@/api/hooks/useRules';

export function SuggestedRulesBar({ spaceId }: { spaceId: string }) {
  const { data: suggestions = [] } = useSuggestedRules(spaceId);
  const acceptRule = useAcceptSuggestedRule();
  const rejectRule = useRejectSuggestedRule();

  if (suggestions.length === 0) return null;

  return (
    <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-2 dark:border-yellow-800 dark:bg-yellow-950/30">
      <div className="flex items-center gap-2 text-xs font-medium text-yellow-700 dark:text-yellow-400">
        <FiZap size={12} />
        <span>{suggestions.length} rule suggestion{suggestions.length > 1 ? 's' : ''} from the learning loop</span>
      </div>
      <div className="mt-2 space-y-2">
        {suggestions.slice(0, 3).map((s) => (
          <div key={s.id} className="flex items-start gap-2 rounded-lg bg-white/80 p-2 dark:bg-gray-900/50">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800 dark:text-gray-200">{s.content}</p>
              <p className="mt-0.5 text-[10px] text-gray-500">{s.reasoning}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => acceptRule.mutate({ id: s.id, spaceId })}
                className="cursor-pointer rounded bg-green-100 p-1 text-green-600 hover:bg-green-200 dark:bg-green-900 dark:text-green-400"
                title="Accept rule"
              >
                <FiCheck size={14} />
              </button>
              <button
                type="button"
                onClick={() => rejectRule.mutate({ id: s.id, spaceId })}
                className="cursor-pointer rounded bg-red-100 p-1 text-red-600 hover:bg-red-200 dark:bg-red-900 dark:text-red-400"
                title="Reject"
              >
                <FiX size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

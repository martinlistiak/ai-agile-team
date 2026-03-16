import { useState } from 'react';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { useRules, useCreateRule, useUpdateRule, useDeleteRule, type Rule } from '@/api/hooks/useRules';
import { useAgents } from '@/api/hooks/useAgents';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/cn';

const SCOPE_LABELS: Record<string, { label: string; borderColor: string; textColor: string }> = {
  space: {
    label: 'Space',
    borderColor: 'border-l-primary-500/70 dark:border-l-primary-400/60',
    textColor: 'text-primary-600 dark:text-primary-400',
  },
  agent: {
    label: 'Agent',
    borderColor: 'border-l-amber-600/70 dark:border-l-amber-500/50',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  'cross-team': {
    label: 'Cross-team',
    borderColor: 'border-l-emerald-600/70 dark:border-l-emerald-500/50',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
};

function RuleItem({ rule, spaceId }: { rule: Rule; spaceId: string }) {
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const scopeInfo = SCOPE_LABELS[rule.scope] || SCOPE_LABELS.space;

  return (
    <div
      className={cn(
        'group relative border-l-2 py-3 pl-4 pr-2 transition-colors',
        scopeInfo.borderColor,
        rule.isActive
          ? 'opacity-100'
          : 'opacity-50 dark:opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={cn('text-[11px] font-medium uppercase tracking-wider', scopeInfo.textColor)}>
              {scopeInfo.label}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-500">v{rule.version}</span>
          </div>
          <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{rule.content}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => updateRule.mutate({ id: rule.id, spaceId, isActive: !rule.isActive })}
            className={cn(
              'cursor-pointer rounded px-2 py-1 text-[10px] font-medium transition-colors',
              rule.isActive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300',
            )}
          >
            {rule.isActive ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            onClick={() => deleteRule.mutate({ id: rule.id, spaceId })}
            className="cursor-pointer rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:text-gray-500 dark:hover:text-red-400"
            aria-label="Delete rule"
          >
            <FiTrash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function RulesPanel({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const { data: rules = [] } = useRules(spaceId);
  const { data: agents = [] } = useAgents(spaceId);
  const createRule = useCreateRule();
  const [newContent, setNewContent] = useState('');
  const [newScope, setNewScope] = useState('space');
  const [newAgentId, setNewAgentId] = useState('');

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    await createRule.mutateAsync({
      spaceId,
      content: newContent.trim(),
      scope: newScope,
      agentId: newScope === 'agent' ? newAgentId || undefined : undefined,
    });
    setNewContent('');
  };

  const spaceRules = rules.filter(r => r.scope === 'space');
  const agentRules = rules.filter(r => r.scope === 'agent');
  const crossTeamRules = rules.filter(r => r.scope === 'cross-team');

  return (
    <Modal onClose={onClose} aria-labelledby="rules-panel-title" className="flex h-[82vh] w-full max-w-xl flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-3.5 dark:border-stone-800">
          <h2 id="rules-panel-title" className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Rules & Documentation
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Add rule — minimal bar, no card */}
          <div className="shrink-0 border-b border-stone-200 px-5 py-3 dark:border-stone-800">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={newScope}
                onChange={(e) => setNewScope(e.target.value)}
                className="h-9 rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-primary-400 dark:focus:ring-primary-400"
              >
                <option value="space">Space</option>
                <option value="agent">Agent</option>
                <option value="cross-team">Cross-team</option>
              </select>
              {newScope === 'agent' && (
                <select
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  className="h-9 rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-primary-400 dark:focus:ring-primary-400"
                >
                  <option value="">Agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.agentType}</option>
                  ))}
                </select>
              )}
              <input
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="New rule..."
                className="h-9 min-w-48 flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder-gray-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-primary-400 dark:focus:ring-primary-400"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newContent.trim()}
                className="cursor-pointer flex h-9 items-center gap-1.5 rounded-md bg-primary-500 px-3 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-40 dark:bg-primary-600 dark:hover:bg-primary-500"
              >
                <FiPlus size={14} strokeWidth={2.5} />
                Add
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {spaceRules.length > 0 && (
              <section className="mb-6">
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">
                  Space rules
                </h3>
                <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
                  {spaceRules.map((r) => (
                    <RuleItem key={r.id} rule={r} spaceId={spaceId} />
                  ))}
                </div>
              </section>
            )}

            {agentRules.length > 0 && (
              <section className="mb-6">
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">
                  Agent rules
                </h3>
                <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
                  {agentRules.map((r) => (
                    <RuleItem key={r.id} rule={r} spaceId={spaceId} />
                  ))}
                </div>
              </section>
            )}

            {crossTeamRules.length > 0 && (
              <section className="mb-6">
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">
                  Cross-team rules
                </h3>
                <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
                  {crossTeamRules.map((r) => (
                    <RuleItem key={r.id} rule={r} spaceId={spaceId} />
                  ))}
                </div>
              </section>
            )}

            {rules.length === 0 && (
              <p className="pt-6 text-sm text-gray-500 dark:text-gray-500">
                No rules yet. Add one above to guide how agents behave in this space.
              </p>
            )}
          </div>
        </div>
    </Modal>
  );
}

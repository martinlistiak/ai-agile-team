import { useState } from 'react';
import { FiPlus, FiTrash2, FiX, FiBook } from 'react-icons/fi';
import { useRules, useCreateRule, useUpdateRule, useDeleteRule, type Rule } from '@/api/hooks/useRules';
import { useAgents } from '@/api/hooks/useAgents';
import { cn } from '@/lib/cn';

const SCOPE_LABELS: Record<string, { label: string; color: string }> = {
  space: { label: 'Space', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  agent: { label: 'Agent', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  'cross-team': { label: 'Cross-Team', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
};

function RuleItem({ rule, spaceId }: { rule: Rule; spaceId: string }) {
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const scopeInfo = SCOPE_LABELS[rule.scope] || SCOPE_LABELS.space;

  return (
    <div className={cn('rounded-lg border p-3', rule.isActive ? 'border-gray-200 dark:border-gray-700' : 'border-dashed border-gray-300 opacity-60 dark:border-gray-600')}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', scopeInfo.color)}>
            {scopeInfo.label}
          </span>
          <span className="text-[10px] text-gray-400">v{rule.version}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateRule.mutate({ id: rule.id, spaceId, isActive: !rule.isActive })}
            className={cn('cursor-pointer rounded px-2 py-0.5 text-[10px]', rule.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800')}
          >
            {rule.isActive ? 'Active' : 'Disabled'}
          </button>
          <button
            type="button"
            onClick={() => deleteRule.mutate({ id: rule.id, spaceId })}
            className="cursor-pointer text-gray-400 hover:text-red-500"
          >
            <FiTrash2 size={12} />
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-800 dark:text-gray-200">{rule.content}</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <FiBook className="text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rules & Documentation</h2>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <FiX size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Add new rule */}
          <div className="mb-6 rounded-lg border border-dashed border-primary-300 bg-primary-50/50 p-4 dark:border-primary-700 dark:bg-primary-950/20">
            <div className="mb-2 flex gap-2">
              <select
                value={newScope}
                onChange={(e) => setNewScope(e.target.value)}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="space">Space Rule</option>
                <option value="agent">Agent Rule</option>
                <option value="cross-team">Cross-Team Rule</option>
              </select>
              {newScope === 'agent' && (
                <select
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  className="rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="">Select agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.agentType.toUpperCase()}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Type a new rule..."
                className="flex-1 rounded border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newContent.trim()}
                className="cursor-pointer flex items-center gap-1 rounded-lg bg-primary-500 px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
              >
                <FiPlus size={14} />
                Add
              </button>
            </div>
          </div>

          {/* Space rules */}
          {spaceRules.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Space Rules</h3>
              <div className="space-y-2">
                {spaceRules.map((r) => <RuleItem key={r.id} rule={r} spaceId={spaceId} />)}
              </div>
            </div>
          )}

          {/* Agent rules */}
          {agentRules.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Agent Rules</h3>
              <div className="space-y-2">
                {agentRules.map((r) => <RuleItem key={r.id} rule={r} spaceId={spaceId} />)}
              </div>
            </div>
          )}

          {/* Cross-team rules */}
          {crossTeamRules.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Cross-Team Rules</h3>
              <div className="space-y-2">
                {crossTeamRules.map((r) => <RuleItem key={r.id} rule={r} spaceId={spaceId} />)}
              </div>
            </div>
          )}

          {rules.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">
              No rules yet. Rules guide how agents behave in this space.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

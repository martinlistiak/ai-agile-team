import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FiChevronDown } from "react-icons/fi";
import { cn } from "@/lib/cn";
import { getAvatarSrc } from "@/lib/avatars";
import { useAgents } from "@/api/hooks/useAgents";
import type { Agent } from "@/types";

interface AgentOption {
  value: string;
  label: string;
  avatarType: string;
}

const BUILT_IN_AGENTS: AgentOption[] = [
  { value: "pm", label: "PM Agent", avatarType: "pm" },
  { value: "developer", label: "Developer Agent", avatarType: "developer" },
  { value: "reviewer", label: "Reviewer Agent", avatarType: "reviewer" },
  { value: "tester", label: "Tester Agent", avatarType: "tester" },
];

function buildAgentOptions(agents: Agent[]): AgentOption[] {
  const customAgents = agents
    .filter((a) => a.isCustom)
    .map((a) => ({
      value: `custom:${a.id}`,
      label: a.name || "Custom Agent",
      avatarType: "custom",
    }));
  return [...BUILT_IN_AGENTS, ...customAgents];
}

interface AgentSelectorDropdownProps {
  value: string;
  onChange: (agent: string) => void;
}

export function AgentSelectorDropdown({
  value,
  onChange,
}: AgentSelectorDropdownProps) {
  const { spaceId } = useParams();
  const { data: agents = [] } = useAgents(spaceId || null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const allAgents = buildAgentOptions(agents);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = allAgents.find((a) => a.value === value) ?? allAgents[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium transition-colors",
          "hover:border-primary-400 dark:border-gray-700 dark:hover:border-primary-500",
          "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select agent"
      >
        <img
          src={getAvatarSrc(selected.avatarType)}
          alt={selected.label}
          className="h-5 w-5 rounded-full pixelated"
        />
        <span>{selected.label}</span>
        <FiChevronDown
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Agent options"
          className={cn(
            "absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] max-h-[280px] overflow-y-auto overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg",
            "dark:border-gray-700 dark:bg-gray-800",
          )}
        >
          {allAgents.map((agent) => {
            const isSelected = agent.value === value;
            return (
              <li
                key={agent.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(agent.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                  isSelected
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50",
                )}
              >
                <img
                  src={getAvatarSrc(agent.avatarType)}
                  alt={agent.label}
                  className="h-6 w-6 rounded-full pixelated"
                />
                <span className="font-medium">{agent.label}</span>
                {isSelected && (
                  <span className="ml-auto text-primary-500">✓</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

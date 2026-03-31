import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiGrid,
  FiUsers as FiAgents,
  FiPlus,
  FiUser,
  FiCreditCard,
  FiUsers,
  FiLink,
  FiShield,
  FiSettings,
  FiLogOut,
  FiMoon,
  FiSun,
  FiBell,
  FiMessageSquare,
} from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSpaces } from "@/api/hooks/useSpaces";
import { useAgents } from "@/api/hooks/useAgents";
import { AgentInspector } from "@/features/agents/AgentInspector";
import { OnboardingWizard } from "@/features/onboarding/OnboardingWizard";
import { SpaceUpsellModal } from "@/components/SpaceUpsellModal";
import { cn } from "@/lib/cn";
import { getSpaceColor } from "@/lib/spaceColor";
import { getStatusRingClass, getAvatarSrc } from "@/lib/avatars";
import RotatingBorder from "@/components/RotatingBorder";
import { FeedbackModal } from "@/components/FeedbackModal";
import type { Agent } from "@/types";

const AGENT_CONFIG: Record<string, { name: string; color: string }> = {
  pm: { name: "Product Manager", color: "bg-blue-500" },
  developer: { name: "Developer", color: "bg-purple-500" },
  reviewer: { name: "Reviewer", color: "bg-amber-500" },
  tester: { name: "Tester", color: "bg-green-500" },
};

const AGENT_BORDER_COLORS: Record<string, string> = {
  pm: "#3b82f6",
  developer: "#8b5cf6",
  reviewer: "#f59e0b",
  tester: "#22c55e",
  custom: "#8b5cf6",
};

const SHEET_BOTTOM_CLASS =
  "bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]";

function MobileSheet({
  titleId,
  title,
  children,
  panelRef,
}: {
  titleId: string;
  title: string;
  children: React.ReactNode;
  panelRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn(
        "mobile-nav-sheet-in fixed left-0 right-0 z-50 flex max-h-[min(72vh,100dvh-5rem)] flex-col overflow-hidden rounded-t-[1.35rem] border border-b-0 border-[oklch(0.88_0.02_264/0.65)] bg-[oklch(0.995_0.006_264)] shadow-[0_-20px_50px_-24px_oklch(0.25_0.04_264/0.35)] dark:border-white/10 dark:bg-[oklch(0.16_0.022_264)] dark:shadow-[0_-24px_56px_-20px_oklch(0.05_0.02_264/0.65)]",
        SHEET_BOTTOM_CLASS,
      )}
    >
      <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden>
        <div className="h-1 w-11 rounded-full bg-[oklch(0.78_0.02_264)] dark:bg-[oklch(0.38_0.02_264)]" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-1">
        <h2
          id={titleId}
          className="font-display text-[1.35rem] font-normal tracking-tight text-[oklch(0.22_0.04_264)] dark:text-[oklch(0.93_0.02_264)]"
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function tabClass(active: boolean) {
  return cn(
    "flex min-h-14 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-[color,background-color] duration-200 ease-out",
    active
      ? "text-primary-600 bg-primary-500/[0.12] dark:text-primary-300 dark:bg-primary-400/15"
      : "text-[oklch(0.45_0.02_264)] hover:bg-[oklch(0.94_0.015_264)] dark:text-[oklch(0.65_0.02_264)] dark:hover:bg-[oklch(0.22_0.02_264)]",
  );
}

export function MobileNav() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const { data: spaces } = useSpaces();
  const { data: agents } = useAgents(spaceId || null);

  const spacesTitleId = useId();
  const agentsTitleId = useId();
  const profileTitleId = useId();
  const sheetPanelRef = useRef<HTMLDivElement>(null);

  const [activeSheet, setActiveSheet] = useState<
    "spaces" | "agents" | "profile" | null
  >(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [inspectedAgent, setInspectedAgent] = useState<Agent | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const spaceCount = spaces?.length ?? 0;
  const isSubscribed =
    user?.subscriptionStatus === "active" ||
    user?.subscriptionStatus === "trialing";

  const handleAddSpaceClick = () => {
    closeSheet();
    if (spaceCount > 0 && isSubscribed) {
      setShowUpsell(true);
    } else {
      setShowCreate(true);
    }
  };

  const closeSheet = () => setActiveSheet(null);

  useEffect(() => {
    if (!activeSheet) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => sheetPanelRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
    };
  }, [activeSheet]);

  useEffect(() => {
    if (!activeSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSheet]);

  return (
    <>
      <nav
        className="mobile-nav-stack-height fixed bottom-0 left-0 right-0 z-30 flex flex-col border-t border-[oklch(0.88_0.02_264/0.75)] bg-[oklch(0.99_0.008_264)] dark:border-white/10 dark:bg-[oklch(0.13_0.022_264)]"
        aria-label="Main navigation"
      >
        <div className="flex h-14 shrink-0 items-center justify-around px-1.5">
          <button
            type="button"
            onClick={() =>
              setActiveSheet(activeSheet === "spaces" ? null : "spaces")
            }
            className={tabClass(activeSheet === "spaces")}
            aria-label="Spaces"
            aria-expanded={activeSheet === "spaces"}
          >
            <FiGrid
              size={20}
              strokeWidth={activeSheet === "spaces" ? 2.25 : 2}
            />
            <span className="text-[10px] font-semibold tracking-wide">
              Spaces
            </span>
          </button>

          {spaceId && (
            <button
              type="button"
              onClick={() =>
                setActiveSheet(activeSheet === "agents" ? null : "agents")
              }
              className={tabClass(activeSheet === "agents")}
              aria-label="Agents"
              aria-expanded={activeSheet === "agents"}
            >
              <FiAgents
                size={20}
                strokeWidth={activeSheet === "agents" ? 2.25 : 2}
              />
              <span className="text-[10px] font-semibold tracking-wide">
                Agents
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              setActiveSheet(activeSheet === "profile" ? null : "profile")
            }
            className={tabClass(activeSheet === "profile")}
            aria-label="Account menu"
            aria-expanded={activeSheet === "profile"}
          >
            <FiUser
              size={20}
              strokeWidth={activeSheet === "profile" ? 2.25 : 2}
            />
            <span className="text-[10px] font-semibold tracking-wide">
              Menu
            </span>
          </button>
        </div>
      </nav>

      {activeSheet && (
        <button
          type="button"
          aria-label="Close menu"
          className="mobile-nav-backdrop-in fixed inset-0 z-40 cursor-default border-0 bg-[oklch(0.2_0.03_264/0.48)] p-0 focus:outline-none dark:bg-[oklch(0.08_0.02_264/0.72)]"
          onClick={closeSheet}
        />
      )}

      {activeSheet === "spaces" && (
        <MobileSheet
          titleId={spacesTitleId}
          title="Spaces"
          panelRef={sheetPanelRef}
        >
          <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4">
            {spaces?.map((space) => {
              const color = getSpaceColor(space.name, space.color);
              const isActive = spaceId === space.id;
              return (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => {
                    navigate(`/spaces/${space.id}`);
                    closeSheet();
                  }}
                  className="flex cursor-pointer flex-col items-center gap-2"
                >
                  <div
                    className={cn(
                      "flex h-13 w-13 items-center justify-center text-sm font-bold transition-transform active:scale-95",
                      isActive
                        ? "text-white shadow-md"
                        : "border-2 border-[oklch(0.88_0.02_264)] bg-white text-[oklch(0.35_0.03_264)] dark:border-white/15 dark:bg-[oklch(0.2_0.02_264)] dark:text-[oklch(0.9_0.02_264)]",
                    )}
                    style={{
                      backgroundColor: isActive ? color : undefined,
                      borderColor: !isActive ? color : undefined,
                      borderRadius: "0.85rem 1.1rem 0.9rem 1rem",
                    }}
                  >
                    {space.name[0]?.toUpperCase()}
                  </div>
                  <span className="max-w-17 truncate text-center text-[11px] font-medium text-[oklch(0.42_0.02_264)] dark:text-[oklch(0.68_0.02_264)]">
                    {space.name}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleAddSpaceClick}
              className="flex cursor-pointer flex-col items-center gap-2"
            >
              <div className="flex h-13 w-13 items-center justify-center rounded-[0.85rem_1.1rem_0.9rem_1rem] border border-dashed border-[oklch(0.72_0.02_264)] text-[oklch(0.48_0.02_264)] dark:border-[oklch(0.4_0.02_264)] dark:text-[oklch(0.55_0.02_264)]">
                <FiPlus size={18} strokeWidth={2} />
              </div>
              <span className="text-[11px] font-medium text-[oklch(0.45_0.02_264)] dark:text-[oklch(0.6_0.02_264)]">
                New
              </span>
            </button>
          </div>
        </MobileSheet>
      )}

      {activeSheet === "agents" && spaceId && (
        <MobileSheet
          titleId={agentsTitleId}
          title="Agents"
          panelRef={sheetPanelRef}
        >
          <ul className="mt-3 flex list-none flex-col gap-1 p-0">
            {agents?.map((agent) => {
              const config = AGENT_CONFIG[agent.agentType] || AGENT_CONFIG.pm;
              const isActive = agent.status === "active";
              const borderColor =
                AGENT_BORDER_COLORS[agent.agentType] ??
                AGENT_BORDER_COLORS.custom;
              return (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => {
                      closeSheet();
                      setInspectedAgent(agent);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-[oklch(0.88_0.02_264/0.8)] hover:bg-[oklch(0.96_0.012_264)] active:bg-[oklch(0.93_0.015_264)] dark:hover:border-white/10 dark:hover:bg-[oklch(0.2_0.02_264)] dark:active:bg-[oklch(0.24_0.02_264)]"
                  >
                    <RotatingBorder
                      active={isActive}
                      color={borderColor}
                      borderRadius={9999}
                      duration={3}
                    >
                      <img
                        src={getAvatarSrc(agent.agentType)}
                        alt=""
                        className={cn(
                          "h-10 w-10 rounded-full pixelated shadow-sm",
                          !isActive && getStatusRingClass(agent.status),
                        )}
                      />
                    </RotatingBorder>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[oklch(0.22_0.03_264)] dark:text-[oklch(0.92_0.02_264)]">
                        {config.name}
                      </p>
                      <p className="text-xs capitalize text-[oklch(0.48_0.02_264)] dark:text-[oklch(0.62_0.02_264)]">
                        {agent.status}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        agent.status === "idle" &&
                          "bg-[oklch(0.62_0.02_264)] dark:bg-[oklch(0.45_0.02_264)]",
                        agent.status === "active" && "bg-emerald-500",
                        agent.status === "error" && "bg-red-500",
                      )}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </MobileSheet>
      )}

      {activeSheet === "profile" && (
        <MobileSheet
          titleId={profileTitleId}
          title="Account"
          panelRef={sheetPanelRef}
        >
          <div className="mt-4 flex items-center gap-3 border-b border-[oklch(0.9_0.015_264)] pb-4 dark:border-white/8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-600 text-sm font-semibold text-white dark:bg-primary-500">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                user?.name?.[0]?.toUpperCase() || "U"
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[oklch(0.2_0.03_264)] dark:text-[oklch(0.95_0.02_264)]">
                {user?.name}
              </p>
              <p className="truncate text-xs text-[oklch(0.48_0.02_264)] dark:text-[oklch(0.62_0.02_264)]">
                {user?.email}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-0.5">
            <ProfileRow
              icon={<FiSettings size={18} />}
              label="Settings"
              onClick={() => {
                closeSheet();
                navigate("/settings");
              }}
            />
            <ProfileRow
              icon={<FiBell size={18} />}
              label="Notifications"
              onClick={() => {
                closeSheet();
                navigate("/settings/notifications");
              }}
            />
            <ProfileRow
              icon={<FiCreditCard size={18} />}
              label="Billing"
              suffix={
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.55_0.02_264)] dark:text-[oklch(0.5_0.02_264)]">
                  {user?.planTier ?? "starter"}
                </span>
              }
              onClick={() => {
                closeSheet();
                navigate("/billing");
              }}
            />
            <ProfileRow
              icon={<FiUsers size={18} />}
              label="Team"
              onClick={() => {
                closeSheet();
                navigate("/team");
              }}
            />
            <ProfileRow
              icon={<FiLink size={18} />}
              label="Integrations"
              onClick={() => {
                closeSheet();
                navigate("/integrations");
              }}
            />
            {user?.planTier === "enterprise" && (
              <ProfileRow
                icon={<FiShield size={18} />}
                label="Enterprise"
                onClick={() => {
                  closeSheet();
                  navigate("/enterprise");
                }}
              />
            )}
            <div className="my-2 h-px bg-[oklch(0.9_0.015_264)] dark:bg-white/8" />
            <ProfileRow
              icon={<FiMessageSquare size={18} />}
              label="Provide Feedback"
              onClick={() => {
                closeSheet();
                setShowFeedback(true);
              }}
            />
            <ProfileRow
              icon={
                mode === "dark" ? <FiSun size={18} /> : <FiMoon size={18} />
              }
              label={mode === "dark" ? "Light mode" : "Dark mode"}
              onClick={() => setMode(mode !== "dark" ? "dark" : "light")}
            />
            <ProfileRow
              icon={<FiLogOut size={18} />}
              label="Log out"
              onClick={logout}
              danger
            />
          </div>
        </MobileSheet>
      )}

      {showUpsell &&
        createPortal(
          <SpaceUpsellModal
            currentSpaceCount={spaceCount}
            onClose={() => setShowUpsell(false)}
            onConfirmed={() => {
              setShowUpsell(false);
              setShowCreate(true);
            }}
          />,
          document.body,
        )}
      {showCreate &&
        createPortal(
          <OnboardingWizard onClose={() => setShowCreate(false)} />,
          document.body,
        )}
      {inspectedAgent && (
        <AgentInspector
          agent={inspectedAgent}
          onClose={() => setInspectedAgent(null)}
        />
      )}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </>
  );
}

function ProfileRow({
  icon,
  label,
  onClick,
  suffix,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  suffix?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
        danger
          ? "text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
          : "text-[oklch(0.28_0.03_264)] hover:bg-[oklch(0.95_0.012_264)] dark:text-[oklch(0.88_0.02_264)] dark:hover:bg-[oklch(0.22_0.02_264)]",
      )}
    >
      <span
        className={cn(
          "[&>svg]:block",
          danger
            ? "text-red-600 dark:text-red-400"
            : "text-[oklch(0.42_0.02_264)] dark:text-[oklch(0.58_0.02_264)]",
        )}
      >
        {icon}
      </span>
      <span className="font-medium">{label}</span>
      {suffix ? <span className="ml-auto">{suffix}</span> : null}
    </button>
  );
}

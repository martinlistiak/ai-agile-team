import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSpaces, useReorderSpaces } from "@/api/hooks/useSpaces";
import { OnboardingWizard } from "@/features/onboarding/OnboardingWizard";
import {
  FiCreditCard,
  FiLogOut,
  FiMoon,
  FiPlus,
  FiSun,
  FiUsers,
} from "react-icons/fi";
import { cn } from "@/lib/cn";
import { getSpaceColor } from "@/lib/spaceColor";
import type { Space } from "@/types";

function RailTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ left: 0, top: 0 });

  const updatePosition = useCallback(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setCoords({
        left: rect.right + 12,
        top: rect.top + rect.height / 2,
      });
    }
  }, []);

  const handleMouseEnter = () => {
    updatePosition();
    setVisible(true);
  };
  const handleMouseLeave = () => setVisible(false);

  return (
    <>
      <div
        ref={wrapperRef}
        className="relative inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {visible &&
        createPortal(
          <div
            className="pointer-events-none fixed z-9999 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-sm dark:bg-gray-100 dark:text-gray-900"
            style={{ left: coords.left, top: coords.top }}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}

function ThemeModeSwitch() {
  const { mode, setMode } = useTheme();

  const options = [
    { value: "light" as const, icon: FiSun, label: "Light mode" },

    { value: "dark" as const, icon: FiMoon, label: "Dark mode" },
  ];

  return (
    <div className="flex justify-center">
      <RailTooltip label="Theme">
        <div className="inline-flex rounded-full bg-gray-100 p-1 dark:bg-gray-800">
          {options.map((option) => {
            const Icon = option.icon;
            const isActive = option.value === mode;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(mode !== "dark" ? "dark" : "light")}
                className={cn(
                  "cursor-pointer flex h-5 w-5 items-center justify-center rounded-full text-sm transition-colors",
                  isActive
                    ? "bg-primary-500 text-white shadow-sm"
                    : "text-gray-500 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100",
                )}
                aria-label={option.label}
                title={option.label}
              >
                <Icon />
              </button>
            );
          })}
        </div>
      </RailTooltip>
    </div>
  );
}

function SortableSpaceButton({
  space,
  isActive,
  onClick,
}: {
  space: Space;
  isActive: boolean;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: space.id });

  const color = getSpaceColor(space.name, space.color);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <RailTooltip label={space.name}>
      <button
        ref={setNodeRef}
        style={{
          ...style,
          backgroundColor: isActive ? color : undefined,
          borderColor: !isActive ? color : undefined,
        }}
        {...attributes}
        {...listeners}
        type="button"
        onClick={onClick}
        className={cn(
          "cursor-pointer flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-sm transition-colors touch-none",
          isActive
            ? "text-white"
            : "border-2 bg-white text-gray-700 hover:opacity-80 dark:bg-gray-800 dark:text-gray-200",
        )}
        aria-label={space.name}
        title={space.name}
      >
        {space.name[0]?.toUpperCase()}
      </button>
    </RailTooltip>
  );
}

export function SpaceSidebar() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { data: spaces } = useSpaces();
  const reorderSpaces = useReorderSpaces();
  const [showCreate, setShowCreate] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !spaces) return;

    const oldIndex = spaces.findIndex((s) => s.id === active.id);
    const newIndex = spaces.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(spaces, oldIndex, newIndex);
    reorderSpaces.mutate(reordered.map((s) => s.id));
  };

  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  return (
    <div className="w-16 bg-gray-50 dark:bg-gray-900/60 flex flex-col shrink-0">
      <div className="flex flex-col items-center gap-3 px-3 py-4">
        <div className="relative" ref={userMenuRef}>
          <RailTooltip label={user?.name || "User menu"}>
            <button
              type="button"
              onClick={() => setShowUserMenu((current) => !current)}
              className="cursor-pointer flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary-500 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
              aria-label={user?.name || "User menu"}
              title={user?.name || "User menu"}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                user?.name?.[0]?.toUpperCase() || "U"
              )}
            </button>
          </RailTooltip>

          {showUserMenu && (
            <div className="absolute left-full top-0 z-30 ml-3 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate("/billing");
                }}
                className="cursor-pointer flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <FiCreditCard />
                <span>Billing</span>
                <span className="ml-auto text-[10px] font-medium capitalize text-gray-400">
                  {user?.planTier ?? "starter"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate("/team");
                }}
                className="cursor-pointer flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <FiUsers />
                <span>Team</span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="cursor-pointer flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <FiLogOut />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col items-center gap-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={spaces?.map((s) => s.id) ?? []}
              strategy={verticalListSortingStrategy}
            >
              {spaces?.map((space) => (
                <SortableSpaceButton
                  key={space.id}
                  space={space}
                  isActive={spaceId === space.id}
                  onClick={() => navigate(`/spaces/${space.id}`)}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className="relative">
            <RailTooltip label="New space">
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="cursor-pointer flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-transparent text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-500 dark:border-gray-700 dark:text-gray-400"
                aria-label="Create new space"
                title="New space"
              >
                <FiPlus />
              </button>
            </RailTooltip>
            {showCreate &&
              createPortal(
                <OnboardingWizard onClose={() => setShowCreate(false)} />,
                document.body,
              )}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-2 py-3 dark:border-gray-800">
        <ThemeModeSwitch />
      </div>
    </div>
  );
}

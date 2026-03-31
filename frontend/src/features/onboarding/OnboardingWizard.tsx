import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreateSpace,
  useGithubRepositories,
  useGitlabRepositories,
} from "@/api/hooks/useSpaces";
import { Modal } from "@/components/Modal";
import { overlaySurfaceClass } from "@/components/overlaySurface";
import { cn } from "@/lib/cn";
import type { GithubRepository, GitlabRepository } from "@/types";

export type WizardStep = 1 | 2 | 3;

const PIPELINE_STAGES = [
  { key: "planning", label: "Planning" },
  { key: "development", label: "Development" },
  { key: "review", label: "Review" },
  { key: "testing", label: "Testing" },
  { key: "staged", label: "Staged" },
];

/**
 * Pure step-advancement logic extracted for testability.
 * Returns the next step after completing.
 * Returns null if the wizard is complete (step 3 completed).
 */
export function getNextStep(
  currentStep: WizardStep,
  action: "complete",
): WizardStep | null {
  if (currentStep === 3 && action === "complete") return null;
  return (currentStep + 1) as WizardStep;
}

interface OnboardingWizardProps {
  /** When provided, the wizard renders as a closable modal overlay. */
  onClose?: () => void;
}

export function OnboardingWizard({ onClose }: OnboardingWizardProps = {}) {
  const navigate = useNavigate();
  const createSpace = useCreateSpace();
  const { data: repos, isLoading: isLoadingRepos } =
    useGithubRepositories(true);
  const { data: gitlabRepos, isLoading: isLoadingGitlabRepos } =
    useGitlabRepositories(true);

  const [step, setStep] = useState<WizardStep>(1);
  const [spaceName, setSpaceName] = useState("");
  const [repoSource, setRepoSource] = useState<"github" | "gitlab">("github");
  const [selectedRepo, setSelectedRepo] = useState<GithubRepository | null>(
    null,
  );
  const [selectedGitlabRepo, setSelectedGitlabRepo] =
    useState<GitlabRepository | null>(null);
  const [pipelineConfig, setPipelineConfig] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PIPELINE_STAGES.map((s) => [s.key, true])),
  );

  const handleNext = () => {
    const next = getNextStep(step, "complete");
    if (next) setStep(next);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as WizardStep);
  };

  const handleComplete = async () => {
    if (!spaceName.trim()) return;

    const space = await createSpace.mutateAsync({
      name: spaceName.trim(),
      githubRepoUrl:
        repoSource === "github" ? selectedRepo?.htmlUrl : undefined,
      gitlabRepoUrl:
        repoSource === "gitlab" ? selectedGitlabRepo?.htmlUrl : undefined,
    });
    onClose?.();
    navigate(`/spaces/${space.id}`, { replace: true });
  };

  const toggleStage = (key: string) => {
    setPipelineConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const card = (
    <div
      className={cn(
        "w-full max-w-xl rounded-2xl shadow-sm p-5 md:p-8 relative",
        onClose
          ? overlaySurfaceClass
          : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800",
      )}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => s < step && setStep(s as WizardStep)}
              disabled={s >= step}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s === step
                  ? "bg-primary-500 text-white"
                  : s < step
                    ? "bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300 cursor-pointer hover:bg-primary-200 dark:hover:bg-primary-800"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-default"
              }`}
            >
              {s}
            </button>
            {s < 3 && (
              <div
                className={`w-12 h-0.5 ${
                  s < step ? "bg-primary-500" : "bg-gray-200 dark:bg-gray-600"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Create Space */}
      {step === 1 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Name your space
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            A space is where your project lives. Give it a name to get started.
          </p>
          <label className="block mb-4">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Space name
            </span>
            <input
              type="text"
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              placeholder="My Project"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
          <button
            onClick={handleNext}
            disabled={!spaceName.trim()}
            className="cursor-pointer w-full bg-primary-500 text-white rounded-lg px-4 py-3 font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Connect GitHub */}
      {step === 2 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Connect a repository
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Link a repo so agents can read code and create pull/merge requests.
          </p>

          {/* Source toggle */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setRepoSource("github")}
              className={`cursor-pointer flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                repoSource === "github"
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              GitHub
            </button>
            <button
              type="button"
              onClick={() => setRepoSource("gitlab")}
              className={`cursor-pointer flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                repoSource === "gitlab"
                  ? "bg-[#fc6d26] text-white"
                  : "border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              GitLab
            </button>
          </div>

          {repoSource === "github" ? (
            <>
              {isLoadingRepos ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
              ) : repos?.length ? (
                <label className="block mb-4">
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select a GitHub repository
                  </span>
                  <select
                    value={selectedRepo?.htmlUrl ?? ""}
                    onChange={(e) => {
                      const repo =
                        repos.find((r) => r.htmlUrl === e.target.value) ?? null;
                      setSelectedRepo(repo);
                    }}
                    className="cursor-pointer w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">— None —</option>
                    {repos.map((repo) => (
                      <option key={repo.id} value={repo.htmlUrl}>
                        {repo.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  No GitHub repositories found. Sign in with GitHub first, or
                  connect one later.
                </p>
              )}
            </>
          ) : (
            <>
              {isLoadingGitlabRepos ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#fc6d26]" />
                </div>
              ) : gitlabRepos?.length ? (
                <label className="block mb-4">
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select a GitLab repository
                  </span>
                  <select
                    value={selectedGitlabRepo?.htmlUrl ?? ""}
                    onChange={(e) => {
                      const repo =
                        gitlabRepos.find((r) => r.htmlUrl === e.target.value) ??
                        null;
                      setSelectedGitlabRepo(repo);
                    }}
                    className="cursor-pointer w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">— None —</option>
                    {gitlabRepos.map((repo) => (
                      <option key={repo.id} value={repo.htmlUrl}>
                        {repo.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  No GitLab repositories found. Sign in with GitLab first, or
                  connect one later.
                </p>
              )}
            </>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="cursor-pointer flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg px-4 py-3 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className="cursor-pointer flex-1 bg-primary-500 text-white rounded-lg px-4 py-3 font-medium hover:bg-primary-600 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Configure Pipeline */}
      {step === 3 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Configure your pipeline
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Choose which pipeline stages are enabled. Agents will automatically
            run at enabled stages.
          </p>
          <div className="space-y-3 mb-6">
            {PIPELINE_STAGES.map((stage) => (
              <label
                key={stage.key}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={pipelineConfig[stage.key] ?? true}
                  onChange={() => toggleStage(stage.key)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {stage.label}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="cursor-pointer flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg px-4 py-3 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleComplete}
              disabled={createSpace.isPending}
              className="cursor-pointer flex-1 bg-primary-500 text-white rounded-lg px-4 py-3 font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createSpace.isPending ? "Creating space..." : "Create space"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (onClose) {
    return (
      <Modal onClose={onClose} className="max-w-lg">
        {card}
      </Modal>
    );
  }

  // Full-page mode (onboarding)
  return <div className="flex items-center justify-center h-full">{card}</div>;
}

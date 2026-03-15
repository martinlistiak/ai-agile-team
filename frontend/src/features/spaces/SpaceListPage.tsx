import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSpaces } from "@/api/hooks/useSpaces";
import { OnboardingWizard } from "@/features/onboarding/OnboardingWizard";

export function SpaceListPage() {
  const { data: spaces, isLoading } = useSpaces();
  const navigate = useNavigate();

  useEffect(() => {
    if (spaces && spaces.length > 0) {
      navigate(`/spaces/${spaces[0].id}`, { replace: true });
    }
  }, [spaces, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!spaces || spaces.length === 0) {
    return <OnboardingWizard />;
  }

  return null;
}

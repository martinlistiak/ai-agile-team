import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicNav } from "@/components/PublicNav";
import { homepageStyles } from "./homepage/homepage-styles";
import { HeroSection } from "./homepage/HeroSection";
import { AppMockup } from "./homepage/AppMockup";
import { StatsStrip } from "./homepage/StatsStrip";
import { LogoCarouselSection } from "./homepage/LogoCarousel";
import { FeaturesSection } from "./homepage/FeaturesSection";
import { TokenOptimizationSection } from "./homepage/TokenOptimizationSection";
import { PipelineSection } from "./homepage/PipelineSection";
import { CustomAgentsSection } from "./homepage/CustomAgentsSection";
import { PricingSection } from "./homepage/PricingSection";
import { CtaSection } from "./homepage/CtaSection";

export function HomePage() {
  const { hash } = useLocation();

  useLayoutEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <div className="homepage-root">
      <style>{homepageStyles}</style>
      <PublicNav />
      <HeroSection />
      <AppMockup />
      <StatsStrip />
      <LogoCarouselSection />
      <FeaturesSection />
      <TokenOptimizationSection />
      <PipelineSection />
      <CustomAgentsSection />
      <PricingSection />
      <CtaSection />
      <PublicFooter />
    </div>
  );
}

import { PublicFooter } from "@/components/PublicFooter";
import { PublicNav } from "@/components/PublicNav";

export function TermsPage() {
  return (
    <div className="terms-page-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Instrument+Serif:ital@0;1&display=swap');

        .terms-page-root {
          --hue-brand: 239;
          --surface: oklch(0.985 0.004 var(--hue-brand));
          --surface-raised: oklch(1 0 0);
          --text-primary: oklch(0.18 0.02 var(--hue-brand));
          --text-secondary: oklch(0.45 0.01 var(--hue-brand));
          --text-tertiary: oklch(0.6 0.008 var(--hue-brand));
          --accent: oklch(0.55 0.22 var(--hue-brand));
          --border: oklch(0.88 0.008 var(--hue-brand));
          --border-light: oklch(0.93 0.005 var(--hue-brand));

          font-family: 'DM Sans', system-ui, sans-serif;
          color: var(--text-primary);
          background: var(--surface);
          min-height: 100vh;
        }

        .terms-page-root * { box-sizing: border-box; }
        .font-display { font-family: 'Instrument Serif', Georgia, serif; }

        .nav-blur {
          backdrop-filter: blur(12px) saturate(1.4);
          -webkit-backdrop-filter: blur(12px) saturate(1.4);
          background: oklch(0.985 0.004 239 / 0.85);
        }
      `}</style>

      {/* Navigation */}
      <PublicNav />

      {/* Content */}
      <main className="pt-28 pb-20 px-6">
        <div className="max-w-[720px] mx-auto">
          <p
            className="text-[13px] font-medium tracking-wide uppercase mb-3"
            style={{ color: "var(--accent)" }}
          >
            Legal
          </p>
          <h1
            className="font-display tracking-[-0.02em] mb-2"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Terms &amp; Conditions
          </h1>
          <p
            className="text-[13px] mb-10"
            style={{ color: "var(--text-tertiary)" }}
          >
            Last updated: March 14, 2026
          </p>

          <div className="space-y-8" style={{ color: "var(--text-secondary)" }}>
            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                1. Acceptance of Terms
              </h2>
              <p className="text-[14px] leading-relaxed">
                By accessing or using the Runa platform, you agree to be bound
                by these Terms and Conditions. If you do not agree to these
                terms, you may not use the service. These terms apply to all
                users, including individual developers and team members within
                an organization.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                2. Description of Service
              </h2>
              <p className="text-[14px] leading-relaxed">
                Runa is an AI-powered project management platform that provides
                automated software development workflows through AI agents
                (Product Manager, Developer, and Tester). The service includes
                kanban board management, automated code generation, pull request
                creation, testing, and pipeline orchestration through
                integration with third-party services such as GitHub.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                3. Account Registration
              </h2>
              <p className="text-[14px] leading-relaxed">
                You must create an account to use Runa. You are responsible for
                maintaining the confidentiality of your account credentials and
                for all activities that occur under your account. You agree to
                provide accurate and complete information during registration
                and to keep your account information up to date.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                4. Acceptable Use
              </h2>
              <p className="text-[14px] leading-relaxed mb-3">
                You agree to use Runa only for lawful purposes and in accordance
                with these terms. You may not:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed">
                <li>
                  Use the AI agents to generate malicious code, malware, or code
                  intended to cause harm
                </li>
                <li>
                  Attempt to circumvent usage limits, rate limits, or security
                  measures
                </li>
                <li>
                  Use the service to infringe on the intellectual property
                  rights of others
                </li>
                <li>
                  Share your account credentials or allow unauthorized access to
                  your account
                </li>
                <li>
                  Use the platform in any way that could damage, disable, or
                  impair the service
                </li>
              </ul>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                5. Intellectual Property
              </h2>
              <p className="text-[14px] leading-relaxed">
                You retain all ownership rights to the code and content in your
                repositories. Code generated by Runa's AI agents on your behalf
                is owned by you. The Runa platform, including its design,
                features, AI models, and documentation, remains the intellectual
                property of Runa and its licensors.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                6. Third-Party Integrations
              </h2>
              <p className="text-[14px] leading-relaxed">
                Runa integrates with third-party services such as GitHub. Your
                use of these integrations is subject to the respective
                third-party terms of service. We are not responsible for the
                availability, accuracy, or practices of third-party services.
                You authorize Runa to access your connected accounts as
                necessary to perform requested operations.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                7. AI Agent Limitations
              </h2>
              <p className="text-[14px] leading-relaxed">
                Runa's AI agents are tools designed to assist with software
                development. While we strive for accuracy and quality,
                AI-generated code and decisions may contain errors. You are
                responsible for reviewing, testing, and validating all output
                produced by the AI agents before deploying it to production.
                Runa does not guarantee that AI-generated code will be free of
                bugs, security vulnerabilities, or defects.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                8. Subscription and Billing
              </h2>
              <p className="text-[14px] leading-relaxed">
                Certain features of Runa require a paid subscription. Pricing is
                as displayed on our pricing page at the time of purchase.
                Subscriptions renew automatically unless cancelled before the
                renewal date. We reserve the right to change pricing with 30
                days' notice. Refunds are handled on a case-by-case basis.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                9. Service Availability
              </h2>
              <p className="text-[14px] leading-relaxed">
                We aim to provide reliable, uninterrupted access to Runa but do
                not guarantee 100% uptime. We may perform scheduled maintenance,
                and the service may be temporarily unavailable due to factors
                beyond our control. Enterprise plans include specific SLA
                guarantees as outlined in the applicable service agreement.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                10. Limitation of Liability
              </h2>
              <p className="text-[14px] leading-relaxed">
                To the maximum extent permitted by law, Runa shall not be liable
                for any indirect, incidental, special, consequential, or
                punitive damages, including loss of profits, data, or business
                opportunities, arising from your use of the service. Our total
                liability shall not exceed the amount you paid for the service
                in the twelve months preceding the claim.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                11. Termination
              </h2>
              <p className="text-[14px] leading-relaxed">
                You may terminate your account at any time. We may suspend or
                terminate your access if you violate these terms or engage in
                conduct that we determine is harmful to the service or other
                users. Upon termination, your right to use the service ceases
                immediately, though we will provide a reasonable period to
                export your data.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                12. Changes to Terms
              </h2>
              <p className="text-[14px] leading-relaxed">
                We reserve the right to modify these terms at any time. Material
                changes will be communicated via email or through the platform.
                Continued use of Runa after changes take effect constitutes
                acceptance of the revised terms.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                13. Contact
              </h2>
              <p className="text-[14px] leading-relaxed">
                For questions about these terms, please contact us at{" "}
                <span style={{ color: "var(--accent)" }}>
                  legal@runa-app.com
                </span>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}

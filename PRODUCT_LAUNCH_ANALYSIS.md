# Runa - Product & UX Analysis for Successful Launch

## Context

Runa is an AI-powered agile team automation platform ("Your agile team, automated"). It deploys 4 specialized AI agents (PM, Developer, Reviewer, Tester) + custom agents to automate the software development lifecycle. It integrates with GitHub/GitLab, has a kanban board, pipeline automation, team collaboration, and tiered pricing (Starter $19/mo, Team $46/mo, Enterprise custom).

This analysis identifies critical gaps and high-impact improvements for a successful launch.

---

## Critical Issues (Must Fix Before Launch)

### 1. Value Demonstration is Too Slow (Time-to-Value Problem)

- **Problem:** New users must sign up, connect GitHub/GitLab, configure a pipeline, create a ticket, AND wait for an agent to run before they see any value. That's 5+ steps before the "aha moment."
- **Tasks:**
  - [ ] Add a **30-second interactive demo** on the landing page showing agents in action (recorded or simulated)
  - [ ] Create a **sandbox/playground mode** - let users try agents on a sample repo without signup
  - [ ] Pre-populate the first space with a **sample ticket + completed agent execution** so users immediately see what agents produce
  - [ ] Add a "Quick Start" option: "Paste a GitHub issue URL" → agents auto-run on it

### 2. Pricing Disconnect

- **Problem:** Landing page says $19/$46 but backend has $29/$99. This inconsistency will erode trust. Also, the Starter plan at 10 runs/day is very limiting for evaluation - users can't properly test the product.
- **Tasks:**
  - [x] Align pricing across frontend and backend immediately
  - [x] Add token limits to ensure profitability with Opus model usage
  - [x] Show clear usage meters in the UI so users don't hit surprise walls

---

## High-Impact UX Improvements

### 4. Onboarding Needs Guided Success

- **Current:** 3-step wizard (name space → pick repo → configure pipeline) then drops user on empty board
- **Tasks:**
  - [ ] After onboarding, auto-create a **"Getting Started" ticket** and trigger the PM agent on it
  - [ ] Add **tooltips/coach marks** pointing to key actions: "Create your first ticket", "Watch the PM agent plan it", "See the developer write code"
  - [ ] Show a **progress checklist** (like Slack/Notion onboarding): Connect repo, Create first ticket, Run first agent, Review first PR, Invite a teammate
  - [ ] Detect common repo types and suggest relevant rules automatically

### 5. Chat UX is Underutilized

- **Problem:** The chat feature exists but feels bolted on. It's a modal that opens over the board rather than an integrated experience.
- **Tasks:**
  - [ ] Make chat a **first-class panel** alongside the board (split view), not a modal overlay
  - [ ] Enable **natural language commands** in chat: "Create a ticket for adding dark mode" → PM agent creates it
  - [ ] Show agent activity feed in chat context so users can ask follow-up questions about what an agent did
  - [ ] Add **@mentions** for agents: "@developer fix the null check in auth.ts"

### 6. Missing Collaboration Features for Teams

- **Problem:** For a "Team" plan product, collaboration feels thin. No activity feed, no notifications in-app, no way to see what teammates or agents are doing in real-time.
- **Tasks:**
  - [ ] Add an **Activity Feed** showing all actions (human + agent) in chronological order
  - [ ] Add **in-app notifications** (bell icon) for: agent completed, PR created, review done, ticket assigned
  - [ ] Show **team member presence** (who's online, what they're looking at)
  - [ ] Add **@mentions in comments** to notify specific team members

### 7. No Analytics or Reporting Dashboard

- **Problem:** Users have no way to measure the ROI of Runa. How many tickets did agents handle? How much time was saved? What's the code quality trend?
- **Tasks:**
  - [ ] Add a **Dashboard/Analytics page** with:
    - Tickets completed this week/month (by agents vs humans)
    - Agent success rate (completed vs failed executions)
    - Average time from ticket creation to PR
    - Token usage and cost tracking
    - Code review pass rate (approved vs changes requested)
  - [ ] This is critical for enterprise sales - decision makers need ROI data

---

## Product Positioning & Growth

### 8. Landing Page Needs Stronger Differentiation

- **Problem:** The landing page describes features but doesn't clearly answer "why Runa over hiring, or over Copilot, or over Linear+GitHub Actions?"
- **Tasks:**
  - [ ] Lead with a **concrete before/after**: "Your team spends 6 hours a week on ticket grooming, code review, and test writing. Runa does it in minutes."
  - [ ] Add **real output examples**: show an actual ticket the PM agent wrote, an actual PR the developer created, an actual review
  - [ ] Add a **comparison section**: Runa vs manual workflow, Runa vs other AI coding tools
  - [ ] Include **social proof** early: testimonials, logos, case studies (even from beta users)

### 9. Missing Integrations That Users Expect

- **Problem:** Only GitHub and GitLab. No Jira, no Linear, no Slack notifications, no CI/CD integration.
- **Tasks (prioritized):**
  - [ ] **Slack integration** - send notifications when agents complete work, allow triggering agents from Slack
  - [ ] **Jira import** - many teams already have backlogs in Jira; one-click import removes migration friction
  - [ ] **Linear integration** - popular with the target audience (dev teams)
  - [ ] **CI/CD webhooks** - trigger tester agent when CI fails, or when PR is created
  - [ ] **VS Code extension** - trigger agents from the IDE

### 10. The "Custom Agents" Feature is a Growth Lever

- **Problem:** Custom agents are gated to Team plan but they're the most viral/sticky feature. They're also limited (no tool use, just text).
- **Tasks:**
  - [ ] Allow **1 custom agent on Starter** as a taste
  - [ ] Give custom agents access to **tools** (read files, create tickets) - text-only chat agents are far less useful
  - [ ] Create an **agent template gallery** (e.g., "Security Auditor", "Documentation Writer", "Migration Helper") to inspire users
  - [ ] Allow sharing/exporting agent configs between teams

---

## UX Polish for Launch Readiness

### 11. Empty States Need Work

- [ ] Empty board, empty chat, empty rules - all should have **helpful illustrations and CTAs**, not blank space
- [ ] Every empty state should answer: "What is this?" and "What should I do first?"

### 12. Error Handling & Recovery

- [ ] When an agent fails, show clear **error messages** and **retry options**
- [ ] Show what went wrong (couldn't clone repo, API rate limit, model error) with actionable steps
- [ ] Add a "Report Issue" button on failed executions

### 13. Mobile Experience

- [ ] Kanban board on mobile needs a **list view** alternative (kanban columns are awkward on small screens)
- [ ] Ensure agent execution can be monitored on mobile
- [ ] Test and polish the bottom sheet interactions

### 14. Loading & Performance Perception

- [ ] Add **progress stages** during agent execution: "Reading codebase..." → "Planning changes..." → "Writing code..." → "Committing..."
- [ ] Show estimated time remaining based on historical execution data
- [ ] Agent executions can take 30-120 seconds - this feels like eternity without feedback

### 15. Trust & Transparency

- [ ] Add a **"Preview before push"** option for the developer agent
- [ ] Show a **diff preview** before the agent commits
- [ ] Add **guardrails configuration**: "Never modify these files", "Always create PR, never push to main"
- [ ] Clearly show what permissions each agent has

---

## Priority Ranking for Launch

| Priority | Item                                   | Impact                 | Effort |
| -------- | -------------------------------------- | ---------------------- | ------ |
| P0       | Fix pricing inconsistency (#2)         | Trust                  | Low    |
| P0       | Agent activity visibility (#3)         | Core value             | Medium |
| P0       | Interactive demo/sandbox (#1)          | Conversion             | Medium |
| P1       | Guided onboarding (#4)                 | Activation             | Medium |
| P1       | Analytics dashboard (#7)               | Retention + Enterprise | High   |
| P1       | Landing page differentiation (#8)      | Conversion             | Low    |
| P1       | Progress stages during execution (#14) | Trust                  | Low    |
| P2       | Chat as first-class feature (#5)       | Engagement             | Medium |
| P2       | Slack integration (#9)                 | Growth                 | Medium |
| P2       | Empty states (#11)                     | Polish                 | Low    |
| P2       | Trust & guardrails (#15)               | Trust                  | Medium |
| P3       | Team collaboration (#6)                | Team plan value        | High   |
| P3       | Custom agent improvements (#10)        | Growth                 | Medium |
| P3       | Mobile list view (#13)                 | Reach                  | Low    |
| P3       | Jira/Linear import (#9)                | Growth                 | High   |

---

## Summary

Runa has a compelling core product - the 4-agent pipeline automation is genuinely differentiated. The biggest risks for launch are:

1. **Time-to-value is too long** - users need to see agent magic in under 60 seconds
2. **Agent work is invisible** - the product's core value (agents doing work) is hidden behind audit logs
3. **No way to measure ROI** - especially problematic for team/enterprise sales
4. **Trust gap** - users need more control and visibility before letting AI push code

Fix these four and you have a strong launch foundation. Everything else is optimization.

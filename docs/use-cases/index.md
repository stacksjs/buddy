---
layout: home
title: Use Cases
description: How Buddy fits an open source project, a startup, a platform team, an agency, a monorepo, a compliance programme, a migration off Renovate, or a workflow full of AI coding agents.

hero:
  name: "use cases"
  text: "Find the shape of your problem"
  tagline: "The same binary solves quite different problems depending on who is running it. Pick the situation that looks like yours and start from the configuration that fits it."
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Browse the features
      link: /features/
    - theme: alt
      text: Compare Buddy
      link: /compare/

features:
  - title: "Open Source Maintainers"
    icon: "🌱"
    span: 2
    details: "A free reviewer for a project with no budget, running on GitHub's free minutes, that helps first-time contributors instead of scolding them — and never gives a drive-by comment the power to make the bot act."
    link: /use-cases/open-source
    linkText: "For maintainers"
  - title: "Startups"
    icon: "🚀"
    details: "Four engineers, no reviewer to spare, and dependencies quietly rotting. Automate the review nobody has time for and the updates nobody wants."
    link: /use-cases/startups
    linkText: "For small teams"
  - title: "Platform & Enterprise Teams"
    icon: "🏢"
    details: "Standards enforced as check runs across every repository, on your own infrastructure, with no vendor holding your source."
    link: /use-cases/platform-teams
    linkText: "For platform teams"
  - title: "Agencies & Consultancies"
    icon: "🧰"
    details: "Twenty client repositories on eight stacks. One config template, one workflow, and a dependency-health report the client can read."
    link: /use-cases/agencies
    linkText: "For agencies"
  - title: "Monorepos"
    icon: "🏗️"
    details: "Every manifest at every depth, discovered by walking the tree. No workspaces setting, because there is nothing to configure."
    link: /use-cases/monorepos
    linkText: "At scale"
  - title: "Security & Compliance"
    icon: "🛡️"
    span: 2
    details: "Licence allowlists, OSV advisories, end-of-life base images and workflow supply-chain audits — enforced as blocking checks, with an auditable trail and nothing leaving your perimeter."
    link: /use-cases/security-compliance
    linkText: "For security teams"
  - title: "Migrating off Renovate or Dependabot"
    icon: "🔄"
    details: "buddy setup reads your existing config, converts what maps, and reports what does not. Nothing changes silently."
    link: /use-cases/migrating
    linkText: "How migration works"
  - title: "Working with AI Coding Agents"
    icon: "🤖"
    details: "When most of the diff was written by an agent, review is the bottleneck. buddy review --format agent closes the loop before the PR exists."
    link: /use-cases/ai-coding-agents
    linkText: "Close the loop"
---

## Not sure which one you are?

Answer one question: **what is the thing you keep not getting to?**

| If it is… | Start here |
| --- | --- |
| Nobody reviews the PRs properly | [AI code review](/features/ai-code-review) |
| Dependencies are six months behind | [Dependency updates](/features/dependency-updates) |
| Standards exist but nobody enforces them | [Merge gates](/features/merge-gates) |
| The build breaks and sits red for a day | [CI repair](/features/ci-repair) |
| A vendor cannot have our source | [Your CI, your keys](/features/self-hosted) |
| We cannot justify another per-seat tool | [Local review](/features/local-review) — it runs with no key at all |

## Or just try it

```bash
bun add -g @buddysh/buddy
buddy review --light
```

No account, no key, no repository access. It reads your working tree and tells you what it finds.

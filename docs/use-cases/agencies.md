---
layout: home
title: Buddy for Agencies & Consultancies
description: Twenty client repositories across eight stacks, one config template, one workflow — and a dependency-health report the client can actually read.

hero:
  name: "agencies"
  text: "Twenty repositories, one you"
  tagline: "Client work means many codebases, uneven standards, and handovers where nobody remembers which project pinned what. Buddy gives every repository the same reviewer and the same maintenance loop, whatever stack it is written in."
  announcement:
    tag: "report"
    text: "buddy report turns maintenance into something billable"
    link: "#reports"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Ecosystems it covers
      link: /advanced/ecosystems
  code:
    - file: "the monthly report"
      lang: "ascii"
      content: |
        $ buddy report --period 30d --publish

                     __
            (\,------'()'--o    acme-storefront
             (_    ___    /~"   last 30 days
              (_)_)  (_)_)

          dependencies    412 tracked
          outdated        18  (4 major, 14 minor)
          advisories      2 resolved, 0 open
          eol             1 base image (node:18)

          updates merged  23
          median age      2.1 days
          auto-merged     19 (patch policy)

          published to issue #77
    - file: "one config, many stacks"
      lang: "ts"
      content: |
        // the same file works whether the client
        // repo is Node, PHP, Python, Go or Rust
        export default {
          packages: {
            strategy: 'patch',
            groups: [
              { name: 'Types', patterns: ['@types/*'] },
              { name: 'Symfony', patterns: ['symfony/*'] },
            ],
          },
          pullRequest: {
            reviewers: ['acme-agency/maintainers'],
            labels: ['dependencies', 'maintenance'],
            autoMerge: {
              enabled: true,
              strategy: 'squash',
              conditions: ['patch-only'],
            },
          },
          gates: {
            titleFormat: 'warning',
            dependencyGate: {
              mode: 'error',
              blockVulnerable: true,
              blockEol: true,
            },
          },
          schedule: { cron: '0 6 * * 1' },
        } satisfies BuddyConfig

features:
  - title: "One tool for every client stack"
    icon: "🌍"
    span: 2
    details: "npm, Bun, yarn, pnpm, Composer, Docker, GitHub Actions, pkgx, Launchpad, Zig, Python, Rust, Go and Ruby. The Laravel client and the Next.js client get the same workflow file with the same config shape, which is what makes twenty repositories manageable by one person."
  - title: "Handover, documented"
    icon: "📋"
    details: "buddy report writes dependency health and update activity over a window. Publish it to an issue monthly and the maintenance retainer stops being an invisible line item."
  - title: "The reviewer that knows the codebase you inherited"
    icon: "🔍"
    details: "Onboarding onto a client project you did not write is the worst time to be the only reviewer. Buddy reads the diff with the surrounding code in front of it, every time."
  - title: "No per-seat maths"
    icon: "🧾"
    details: "A per-seat reviewer across twenty client organisations is a procurement problem. Buddy is MIT-licensed; you pay tokens on your own account."
  - title: "Client keeps their own keys"
    icon: "🔑"
    details: "Where a client insists their code never reaches a third party, configure no provider at all: the analyzers, workflow audit, secret scanning and dependency updates run unchanged."
  - title: "Cleanup included"
    icon: "🧹"
    details: "buddy cleanup removes stale update branches with no open PR, and buddy list-branches shows what is outstanding — so a project you touch quarterly does not accumulate a hundred dead branches."
---

## The pattern that scales

1. **Template the config.** Publish an internal package exporting your agency defaults; each client repository extends it with its own `repository` block and any client-specific policy.
2. **Template the workflows.** `buddy setup --non-interactive --preset standard` generates them, and the output is ordinary YAML you can ship as a reusable workflow.
3. **Schedule the loop.** Weekly scans, patch auto-merge, a monthly published report.
4. **Review the exceptions only.** Majors and advisories get a human; everything else moves on its own.

```bash
buddy setup --non-interactive --preset standard --token-setup existing-secret
```

## Reports the client will actually read {#reports}

```bash
buddy report --period 30d                     # markdown to stdout
buddy report --period 90d --format json       # into your own dashboard
buddy report --period 30d --publish           # to the repository's report issue
buddy report --prompt "focus on security posture" --publish
```

The numbers are computed from scan results and pull request history, so the report works with no AI provider at all. A configured provider adds a narrative around the numbers; it never produces them — which matters when the report is going to a client.

## Related

[Dependency updates](/features/dependency-updates) · [Monorepos](/use-cases/monorepos) · [Ecosystems](/advanced/ecosystems) · [Scheduling](/advanced/scheduling)

---
layout: home
title: Buddy vs Renovate
description: Renovate is the most configurable dependency bot there is. Buddy matches the dependency half, imports your renovate.json, and adds code review, merge gates and CI repair.

hero:
  name: "buddy vs renovate"
  text: "The dependency bot, plus the reviewer"
  tagline: "Renovate is genuinely good software and Buddy owes it several ideas — the dashboard, the rebase checkbox, grouped updates. The difference is that Buddy does not stop at dependencies, and that its configuration is a TypeScript file rather than a JSON dialect."
  actions:
    - theme: brand
      text: Migrate from Renovate
      link: /advanced/migration/renovate
    - theme: alt
      text: Dependency updates
      link: /features/dependency-updates
    - theme: alt
      text: All comparisons
      link: /compare/
  code:
    - file: "the migration"
      lang: "ascii"
      content: |
        $ buddy setup

                     __
            (\,------'()'--o    found renovate.json
             (_    ___    /~"   migrating configuration
              (_)_)  (_)_)

          schedule       → weekly preset
          packageRules   6 → 4 groups, 2 ignores
          automerge      → autoMerge.conditions
          assignees      2 → pullRequest.assignees

          no equivalent (2)
            · rangeStrategy: "bump"
            · osvVulnerabilityAlerts (always on)

          your renovate.json is left in place.

features:
  - title: "Everything the dependency half needs"
    icon: "📦"
    span: 2
    details: "Grouped pull requests, real changelogs for every version in the range, OSV advisories, a pinned dashboard with rebase checkboxes, auto-merge with conditions, lock file regeneration, and monorepo discovery by walking the tree. If you use it in Renovate, it is almost certainly here."
  - title: "It also reviews code"
    icon: "🔍"
    details: "Inline findings, @buddy in the thread, merge gates as check runs, CI repair, finishing touches. That half has no Renovate equivalent because Renovate is not trying to be that."
  - title: "TypeScript config"
    icon: "⌨️"
    details: "buddy.config.ts is type-checked in your editor. A typo in a group name is a compile error rather than a rule that silently never matches."
  - title: "Constraints are preserved"
    icon: "📐"
    details: "Buddy has no rangeStrategy. ~=2.28 becomes ~=2.31, never ==2.31 — turning a deliberately flexible constraint into a pin is not an update, it is a policy change."
  - title: "Migration, reported"
    icon: "🔄"
    details: "buddy setup reads renovate.json, .renovaterc or the package.json block and tells you what carried over and what has no equivalent, before writing anything."
  - title: "Your workflow file"
    icon: "🏠"
    details: "Scheduling is a cron in a workflow in your repository, visible in the diff, rather than configuration interpreted by a hosted service."
---

## Side by side

| | Buddy | Renovate |
| --- | --- | --- |
| Dependency updates | ✅ | ✅ |
| Grouping, changelogs, dashboard, auto-merge | ✅ | ✅ |
| Security advisories | ✅ OSV | ✅ |
| End-of-life base images | ✅ | Partial |
| AI code review | ✅ | — |
| `@bot` conversations on a PR | ✅ | Dashboard checkboxes |
| Merge gates as check runs | ✅ | — |
| CI repair | ✅ | — |
| Local pre-push review | ✅ | — |
| Workflow supply-chain audit | ✅ | — |
| Configuration | TypeScript, JSON or YAML | JSON / JSON5 |
| Self-hosted | ✅ | ✅ |
| Open source | ✅ MIT | ✅ |
| Platform coverage | GitHub, GitLab, Bitbucket Cloud | Broader — more platforms |
| Ecosystem coverage | 11 ecosystems | Broader — many more managers |

## Where Renovate is the better choice

Said plainly, because there are real cases:

- **Breadth of ecosystems.** Renovate supports far more package managers than Buddy's eleven. If your stack includes something exotic — Bazel, Helm, Terraform providers, Gradle plugins — check Buddy's [ecosystem list](/advanced/ecosystems) first, because that is the row where Renovate wins outright.
- **Breadth of platforms.** Renovate runs against more git hosts than GitHub, GitLab and Bitbucket Cloud.
- **Very fine-grained rules.** Renovate's `packageRules` matching is more expressive than Buddy's pattern groups. If your configuration is two hundred lines of carefully layered rules, expect the migration report to have entries in the "no equivalent" column.
- **You want nothing to do with AI.** Renovate has no model in it. Buddy's dependency half also runs with no provider configured — but if the goal is a codebase where no AI tooling is installed at all, Renovate is the simpler answer.

## Where Buddy is different

- **One tool for both jobs.** Most teams running Renovate also run a code reviewer. That is two vendors, two configurations and two security reviews.
- **Deterministic gates on dependencies.** `dependencyGate` blocks a merge on a licence outside your allowlist, a known advisory, a deprecated package or an EOL base image — as a check run, with no model involved.
- **A reviewer that reads the update.** For a major version bump, `@buddy review` reads the changelog *and* your call sites.
- **No hosted option to opt into.** There is no Buddy app and no Buddy server, so the self-hosted path is the only path and therefore the well-tested one.

## Switching

```bash
bun add -g @buddysh/buddy
buddy setup    # detects and migrates renovate.json
```

Nothing forces a cut-over. Give Buddy a different branch prefix and label, let both bots run for a sprint, and turn Renovate off when you are convinced. Your `renovate.json` is never deleted.

Details in [migrating from Renovate](/advanced/migration/renovate).

## Related

[Dependency updates](/features/dependency-updates) · [Ecosystems](/advanced/ecosystems) · [Buddy vs Dependabot](/compare/dependabot) · [All comparisons](/compare/)

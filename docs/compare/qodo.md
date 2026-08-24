---
layout: home
title: Buddy vs Qodo Merge
description: Qodo Merge (formerly PR-Agent) is the other reviewer with open-source roots and a self-hosted path. Similar philosophy, different scope — and Buddy carries the dependency half.

hero:
  name: "buddy vs qodo merge"
  text: "The nearest philosophical neighbour"
  tagline: "Qodo Merge, which grew out of the open-source PR-Agent, is the other reviewer that lets you run it yourself with your own model keys. If you have already decided that self-hosting is the requirement, this is the comparison that turns on scope rather than principle."
  actions:
    - theme: brand
      text: AI code review
      link: /features/ai-code-review
    - theme: alt
      text: The agent runtime
      link: /ai/agent
    - theme: alt
      text: All comparisons
      link: /compare/
  code:
    - file: "one config, both halves"
      lang: "ts"
      content: |
        export default {
          ai: { provider: 'anthropic', model: 'claude-opus-5' },

          // the reviewer
          gates: {
            titleFormat: 'error',
            description: { mode: 'error', requireSections: ['Why'] },
            custom: [
              { name: 'tests', assertion: 'A behaviour change comes with a test.' },
            ],
          },

          // and the dependency bot
          packages: {
            strategy: 'patch',
            groups: [{ name: 'Types', patterns: ['@types/*'] }],
          },
          pullRequest: {
            autoMerge: { enabled: true, conditions: ['patch-only'] },
          },
        } satisfies BuddyConfig

features:
  - title: "Both halves, one configuration"
    icon: "🧩"
    span: 2
    details: "Qodo Merge reviews pull requests. Buddy reviews pull requests and manages dependencies across eleven ecosystems, from the same config file and the same workflows — so a self-hosted setup covers what would otherwise be a reviewer plus Renovate."
  - title: "Merge gates as check runs"
    icon: "🚦"
    details: "Title format, description sections, linked issue, dependency policy and your own natural-language assertions, published as a check your branch protection can require."
  - title: "An analyzer floor with no model"
    icon: "🦴"
    details: "Secret scanning, workflow auditing, actionlint, shellcheck, hadolint and syntax checks run with no key and no network — usable in a pre-commit hook."
  - title: "Local review"
    icon: "💻"
    details: "buddy review reads the working tree before a pull request exists, and --format agent pipes findings straight into a coding agent."
  - title: "A documented sandbox"
    icon: "🔒"
    details: "Capability tiers per mode, an allowlisted command environment with no credentials in it, workspace confinement checked twice, and untrusted third-party text that never reaches the system prompt."
  - title: "CI repair and finishing touches"
    icon: "🛠️"
    details: "Classify a failing run and fix what is unambiguous; deliver tests, docstrings or an autofix as a stacked pull request rather than a surprise commit."
---

## Side by side

| | Buddy | Qodo Merge |
| --- | --- | --- |
| AI pull request review | ✅ | ✅ |
| In-thread commands | ✅ | ✅ |
| Self-hosted / your own keys | ✅ | ✅ |
| Open source | ✅ MIT | Partly — open core |
| Dependency updates | ✅ | — |
| Security advisories, licence policy | ✅ | — |
| Workflow supply-chain audit | ✅ | — |
| Merge gates as check runs | ✅ | ✅ |
| CI repair | ✅ | — |
| Local pre-push review | ✅ | ✅ |
| Works with no API key | ✅ analyzers | — |
| Git hosts | GitHub, GitLab, Bitbucket Cloud | Broader |

Product capabilities change; check Qodo's own documentation before deciding on any single row.

## Where Qodo Merge is the better choice

- **Platform coverage.** Qodo supports more git hosts and CI systems than Buddy's GitHub, GitLab and Bitbucket Cloud.
- **You want a commercial tier with support** on top of the open-source core, and a vendor to call.
- **The broader Qodo suite** — test generation and the IDE tooling around it — is something you want as one product rather than assembled.
- **You are already running PR-Agent** happily. Buddy's review is different, not categorically better, and a working setup has real value.

## Where Buddy is different

- **The dependency half.** This is the substantive one. Running Qodo Merge usually means also running Renovate or Dependabot; Buddy is both.
- **A no-model floor.** The analyzers, secret scanner and workflow audit have no AI in them and no key requirement, so they run everywhere including a pre-commit hook.
- **Deterministic gates.** Licence allowlists, advisories and EOL images are computed, not judged — auditable and reproducible.
- **Explicit capability tiers.** A tool outside a mode's tiers is never advertised to the model, so review mode cannot request a write tool rather than requesting one and being refused.

## Related

[AI code review](/features/ai-code-review) · [The agent runtime](/ai/agent) · [Merge gates](/features/merge-gates) · [All comparisons](/compare/)

---
layout: home
title: Migrating from Renovate or Dependabot
description: buddy setup reads your existing renovate.json or dependabot.yml, converts what maps, and reports what does not — so nothing about your update policy changes silently.

hero:
  name: "migrating"
  text: "Bring the config you already wrote"
  tagline: "Nobody wants to re-derive two years of package rules from memory. buddy setup detects a Renovate or Dependabot configuration, converts the parts that have an equivalent, and tells you plainly about the parts that do not."
  announcement:
    tag: "reversible"
    text: "Your old config is left in place until you delete it"
    link: "#reversible"
  actions:
    - theme: brand
      text: From Renovate
      link: /advanced/migration/renovate
    - theme: alt
      text: From Dependabot
      link: /advanced/migration/dependabot
    - theme: alt
      text: vs Renovate
      link: /compare/renovate
  code:
    - file: "buddy setup"
      lang: "ascii"
      content: |
        $ buddy setup

                     __
            (\,------'()'--o    found renovate.json
             (_    ___    /~"   migrating configuration
              (_)_)  (_)_)

          schedule       "before 4am on monday"
                         → weekly preset
          packageRules   6 rules
                         → 4 groups, 2 ignores
          automerge      patch only
                         → autoMerge.conditions
          assignees      2 → pullRequest.assignees
          labels         1 → pullRequest.labels

          no equivalent (2)
            · rangeStrategy: "bump"
              buddy preserves the existing
              constraint operator instead
            · osvVulnerabilityAlerts
              advisories are always on

          write buddy.config.ts? (y/N)
    - file: "what you end up with"
      lang: "ts"
      content: |
        export default {
          packages: {
            strategy: 'patch',
            ignore: ['aws-sdk', '@types/node'],
            groups: [
              { name: 'Types', patterns: ['@types/*'] },
              { name: 'ESLint', patterns: ['eslint*'] },
              { name: 'React', patterns: ['react*'] },
              { name: 'Testing', patterns: ['jest*', '@testing-library/*'] },
            ],
          },
          pullRequest: {
            assignees: ['alice', 'bob'],
            labels: ['dependencies'],
            autoMerge: {
              enabled: true,
              strategy: 'squash',
              conditions: ['patch-only'],
            },
          },
          schedule: { cron: '0 3 * * 1' },
        } satisfies BuddyConfig

features:
  - title: "Reads both, automatically"
    icon: "🔎"
    details: "renovate.json, .renovaterc, a renovate block in package.json, and .github/dependabot.yml or .yaml. Detection happens as part of setup — there is no separate migrate command to remember."
  - title: "Reports what does not map"
    icon: "📋"
    span: 2
    details: "The migration report lists every setting that has no Buddy equivalent and why. A migration that quietly drops a rule is worse than one that refuses to run, because you find out six weeks later when something you thought was pinned moved."
  - title: "Package rules become groups"
    icon: "🎨"
    details: "Match patterns become group patterns, per-rule update types become per-group strategies, and enabled: false becomes an ignore entry."
  - title: "Schedules become presets"
    icon: "📅"
    details: "A Renovate schedule string or a Dependabot interval maps to a workflow preset — standard, high-frequency, security, minimal — and you can hand-edit the generated cron afterwards."
  - title: "Reviewers and labels carry over"
    icon: "👥"
    details: "assignees, reviewers and labels move straight into pullRequest, so the routing your team relies on keeps working from the first run."
  - title: "Run both for a fortnight"
    icon: "🤝"
    details: "Nothing forces a cut-over. Point Buddy at a different label and branch prefix, let both open pull requests for a sprint, and turn the old one off when you are convinced."
---

## The migration, step by step

```bash
bun add -g @buddysh/buddy
buddy setup
```

1. **Detection.** Buddy looks for Renovate and Dependabot configuration in the usual places.
2. **Conversion.** Schedules, package rules, ignores, automerge policy, assignees, reviewers and labels are mapped.
3. **Report.** You get a summary of what carried over, at what confidence, and what has no equivalent — before anything is written.
4. **Write.** `buddy.config.ts` and the workflows are generated only after you say yes.

## What is deliberately different {#reversible}

A few Renovate behaviours have no Buddy equivalent because Buddy takes a different position, not because it is missing:

| Renovate | Buddy |
| --- | --- |
| `rangeStrategy: bump` / `pin` / `replace` | The existing constraint operator is preserved. `~=2.28` becomes `~=2.31`, never `==2.31` — replacing a deliberately flexible constraint with a pin is a change nobody asked for arriving inside a dependency update. |
| `osvVulnerabilityAlerts` | Advisories are always on. There is no version of this that you want off. |
| Hosted scheduling | A cron in a workflow you own, so the schedule is visible in the repository rather than in a vendor dashboard. |
| `dependencyDashboardApproval` | The dashboard's checkboxes trigger a rebase; approval flows through your normal review, not a second one. |

Your `renovate.json` is not deleted. Turn the old bot off when you are ready, and delete the file whenever you like.

## Then take the half Renovate never had

Once the dependency loop is running, the reviewer is already installed:

```bash
buddy review                # local, before the PR exists
buddy security              # audit your workflows
buddy gate 128              # publish the pre-merge check run
```

## Related

[From Renovate](/advanced/migration/renovate) · [From Dependabot](/advanced/migration/dependabot) · [Buddy vs Renovate](/compare/renovate) · [Buddy vs Dependabot](/compare/dependabot) · [The setup command](/cli/setup)

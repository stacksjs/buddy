---
layout: home
title: Buddy for Startups
description: Four engineers, no reviewer to spare, and dependencies quietly rotting. Buddy automates the review nobody has time for and the updates nobody wants to do.

hero:
  name: "startups"
  text: "You do not have a spare reviewer"
  tagline: "At five engineers, code review is whoever is least busy at 6pm. Buddy is the second pair of eyes that is always available, never tired, and does not need the context switch — so the human review can be about the design instead of the null check."
  announcement:
    tag: "no seats"
    text: "You pay for tokens, not per engineer"
    link: /features/self-hosted
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: What it costs
      link: "#cost"
    - theme: alt
      text: vs CodeRabbit
      link: /compare/coderabbit
  code:
    - file: "friday afternoon"
      lang: "ascii"
      content: |
        $ buddy review

                     __
            (\,------'()'--o    working tree
             (_    ___    /~"   6 files, 180 lines
              (_)_)  (_)_)

          src/billing/webhook.ts:44  major  correctness
            Stripe sends this event more than once.
            The handler has no idempotency key, so a
            retried webhook charges twice.

          src/billing/webhook.ts:71  minor  security
            The signature check runs after the body
            is parsed, so malformed payloads reach
            the parser unauthenticated.

          2 findings. run with --fix to apply 1.
    - file: "buddy.config.ts"
      lang: "ts"
      content: |
        export default {
          ai: {
            provider: 'anthropic',
            model: 'claude-opus-5',
          },
          gates: {
            // start soft; promote to 'error' when
            // the team stops arguing with them
            titleFormat: 'warning',
            description: { mode: 'warning' },
            dependencyGate: {
              mode: 'error',
              blockVulnerable: true,
            },
          },
          packages: {
            strategy: 'patch',
            groups: [
              { name: 'Types', patterns: ['@types/*'] },
            ],
          },
          pullRequest: {
            autoMerge: {
              enabled: true,
              strategy: 'squash',
              conditions: ['patch-only'],
            },
          },
        } satisfies BuddyConfig

features:
  - title: "Catches the expensive class of bug"
    icon: "💸"
    span: 2
    details: "Double-charged webhooks, sessions that read as valid when they expired, retries that never terminate. Buddy states the failure a change causes, which is the only kind of review finding worth interrupting a shipping team for."
  - title: "Reviews before the PR exists"
    icon: "⚡"
    details: "buddy review reads the working tree. The fastest review is the one that happens while you still have the code in your head."
  - title: "Dependencies stop being a project"
    icon: "📦"
    details: "Patch updates auto-merge, minor updates come grouped with real changelogs, and the pinned dashboard means you always know how far behind you are."
  - title: "Ships with the gates off"
    icon: "🎚️"
    details: "Every gate has an off/warning/error mode. Turn them on when the team is ready, not when a vendor decided the default was error."
  - title: "One bot instead of two subscriptions"
    icon: "🧾"
    details: "A hosted reviewer plus a dependency service is two vendors, two security reviews, two invoices. Buddy is one binary in a workflow you already have."
  - title: "Red builds fix themselves"
    icon: "🛠️"
    details: "buddy fix-ci regenerates a drifted lock file mechanically, retries a flake once, and reports the failures it will not guess at."
---

## Week one

```bash
bun add -g @buddysh/buddy
buddy setup
```

`buddy setup` reads the repository, detects your package manager, migrates a Renovate or Dependabot config if it finds one, writes `buddy.config.ts` and generates the workflows. It asks before it writes anything, and the generated workflows are ordinary YAML you can edit.

Then, before you commit anything else:

```bash
buddy review --branch --base main
```

That is the review of everything on your current branch, in about the time it takes to read this paragraph.

## What it costs {#cost}

Buddy is MIT-licensed. There is no seat count and no plan.

| | You pay |
| --- | --- |
| Buddy | Nothing |
| The analyzers, secret scanning, workflow audit, dependency updates | Nothing — no model involved |
| AI review, gates, CI repair, finishing touches | Model tokens, at your provider's rate |
| CI | Minutes you are already buying |

Two dials keep the model bill predictable: `ai.maxTokensPerRun` caps a single run, and a cheaper model on `ai.model` costs a fraction for the common case. Many teams run `haiku` on every push and `opus` only on `@buddy full-review`.

## Keep the humans doing human work

The point is not to remove code review. It is to make sure that by the time a teammate opens the diff, the mechanical objections are already handled and the conversation can be about whether this is the right thing to build.

```bash
# a pre-commit hook that costs nothing and blocks the obvious
buddy review --staged --light --fail-on major
```

## Related

[AI code review](/features/ai-code-review) · [Local review](/features/local-review) · [Merge gates](/features/merge-gates) · [Dependency updates](/features/dependency-updates)

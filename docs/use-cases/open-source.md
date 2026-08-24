---
layout: home
title: Buddy for Open Source
description: A free code reviewer and dependency bot for maintainers — runs on GitHub's free minutes, helps first-time contributors, and never lets a drive-by comment make the bot act.

hero:
  name: "open source"
  text: "The reviewer a maintainer cannot hire"
  tagline: "You are one person with a hundred watchers and a contribution queue that only grows. Buddy triages the pull requests, answers the questions you would have answered, keeps the dependencies current, and asks nothing in return."
  announcement:
    tag: "MIT"
    text: "Free, and no account to create"
    link: /license
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Local review, no key
      link: /features/local-review
  code:
    - file: "a first-time contributor"
      lang: "ascii"
      content: |
        buddy  commented on #482

          Thanks for the PR! Two things before a
          maintainer looks at this:

          src/parse.ts:118  major  correctness
            `Number(input)` returns NaN for an empty
            string, and NaN passes the `< max` check
            below — so an empty field is accepted as
            a valid quantity.

          The project uses tabs; this file arrived
          with spaces. `bun run lint:fix` sorts it.

          Everything else looks good to me.
    - file: "the whole workflow"
      lang: "yaml"
      content: |
        name: Buddy
        on:
          pull_request:
            types: [opened, synchronize]

        jobs:
          review:
            runs-on: ubuntu-latest
            timeout-minutes: 10
            permissions:
              contents: read
              pull-requests: write
            steps:
              - uses: actions/checkout@v4
                with: { fetch-depth: 0 }
              - uses: oven-sh/setup-bun@v2
              # no key configured: the analyzers run,
              # and the whole thing costs nothing.
              - run: bunx @buddysh/buddy review ${{ github.event.pull_request.number }} --light
                env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

features:
  - title: "It can cost literally nothing"
    icon: "🪙"
    span: 2
    details: "With no provider configured, buddy review --light runs secret scanning, workflow auditing, actionlint, shellcheck, hadolint and syntax checks on GitHub's free minutes for public repositories. Add a key later if you want the model's findings — the workflow does not change."
  - title: "Hostile comments cannot act"
    icon: "🔐"
    details: "Every @buddy command is permission-checked. A commenter without write access lands in restricted mode, which draws only from read-only tools, so the worst a stranger can do is ask Buddy to read a file."
  - title: "Injection is assumed, not hoped against"
    icon: "🧪"
    details: "A public repository's PR titles, bodies and branch content are attacker-controlled. They never reach the system prompt — only tool output inside an escaped untrusted-content block."
  - title: "Explains rather than scolds"
    icon: "🫱"
    details: "Findings name the failure they cause, in the contributor's own diff. That is the difference between a review a newcomer learns from and a wall of red they abandon."
  - title: "Keeps dependencies from rotting"
    icon: "📦"
    details: "Grouped update PRs with real changelogs, a pinned dashboard issue, and auto-merge for patches — so a quiet month does not mean six months of drift."
  - title: "Answers the FAQ for you"
    icon: "💬"
    details: "@buddy why is this a race condition? gets answered in the thread with the code in front of it, which is one fewer round-trip waiting on your evening."
---

## A sensible starting configuration

```ts
// buddy.config.ts
export default {
  ai: {
    // Cheap model, small budget. A maintainer's review bot does not
    // need the frontier model on every drive-by typo fix.
    provider: 'anthropic',
    model: 'haiku',
    maxTokensPerRun: 60_000,
  },
  gates: {
    titleFormat: 'warning',
    description: { mode: 'warning' },
  },
  packages: {
    strategy: 'all',
    groups: [
      { name: 'Types', patterns: ['@types/*'] },
      { name: 'Linting', patterns: ['eslint*', 'prettier*'], strategy: 'patch' },
    ],
  },
  pullRequest: {
    labels: ['dependencies'],
    autoMerge: { enabled: true, strategy: 'squash', conditions: ['patch-only'] },
  },
  issues: {
    quickLinks: true,
  },
} satisfies BuddyConfig
```

Gates start at `warning` deliberately. A project that suddenly starts blocking outside contributions on a title format loses contributors, not gains standards.

## Issues, not just pull requests

```ts
issues: { quickLinks: true }
```

Buddy posts a small set of checkboxes on new issues. Tick "plan this" and it replies with an implementation plan — which is often exactly what a would-be contributor needs to turn "I'd like to help" into a pull request. Both actions are opt-in checkboxes on purpose: an issue is a request for a conversation as often as for code, and a bot that opens a pull request against every new issue is one a maintainer turns off in a week.

## Reduce the noise on your own terms

- `@buddy pause` on a pull request that is being iterated hard, `@buddy resume` when it settles.
- `@buddy remember we do not use default exports` — later runs read the note back, so telling it once is enough.
- Reviews are incremental: a contributor pushing five times gets five different reviews, not the same one five times.

## Related

[AI code review](/features/ai-code-review) · [Conversations](/features/pr-conversations) · [Dependency updates](/features/dependency-updates) · [Your CI, your keys](/features/self-hosted)

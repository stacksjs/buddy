---
layout: home
title: Merge Gates
description: Buddy publishes pre-merge gates as a real GitHub check run — title format, description quality, linked issue, dependency policy and your own natural-language assertions.

hero:
  name: "merge gates"
  text: "A check run, not a comment nobody reads"
  tagline: "Standards enforced by a comment are standards enforced by whoever feels like arguing today. Buddy publishes its gates as a real check run, so branch protection does the enforcing and the conversation is about the code again."
  announcement:
    tag: "no key needed"
    text: "The deterministic gates run with no AI provider"
    link: "#deterministic"
  actions:
    - theme: brand
      text: Configure the gates
      link: /config
    - theme: alt
      text: Read the CLI reference
      link: /cli/overview
  code:
    - file: "the check run"
      lang: "ascii"
      content: |
        $ buddy gate 128

                     __
            (\,------'()'--o    pre-merge gates
             (_    ___    /~"   pull request #128
              (_)_)  (_)_)

          ✔ title-format     conventional commit
          ✔ description      complete
          ✘ dependency-gate  1 policy violation
              `left-pad@1.3.0` is licensed `WTFPL`,
              which is not on the allowlist
          ~ linked-issue     no verdict (no provider)
          ✔ tests-updated    behaviour change covered

          error · 1 failing gate
          check run published: buddy/gate
    - file: "buddy.config.ts"
      lang: "ts"
      content: |
        export default {
          gates: {
            titleFormat: 'error',
            description: {
              mode: 'error',
              requireSections: ['Why', 'Testing'],
            },
            dependencyGate: {
              mode: 'error',
              licenseAllowlist: ['MIT', 'Apache-2.0', 'ISC'],
              blockVulnerable: true,
              blockDeprecated: true,
              blockEol: true,
            },
            linkedIssue: 'warning',
            custom: [
              {
                name: 'tests-updated',
                assertion: 'A behaviour change comes with a test.',
                mode: 'warning',
              },
            ],
          },
        } satisfies BuddyConfig

features:
  - title: "Title format"
    icon: "🏷️"
    details: "Conventional commits, checked with a regex rather than a language model. feat(scope): ... passes; Update stuff does not."
  - title: "Description quality"
    icon: "📄"
    details: "A body that is empty or twenty characters long fails. requireSections names the headings a description must actually contain — Why, Testing, Rollback, whatever your template promises."
  - title: "Dependency policy"
    icon: "📦"
    span: 2
    details: "Blocks a change that introduces a package with a known advisory, a deprecated package, a base image past end of life, or a licence that is not on your allowlist. An unknown licence is reported rather than assumed acceptable — that is the point of an allowlist."
  - title: "Linked issue"
    icon: "🔗"
    details: "Checks that the change actually addresses the issue it says it closes. The failure worth catching is the partial implementation: the issue leaves the backlog and the remaining work is never done."
  - title: "Your own assertions"
    icon: "✍️"
    span: 2
    details: "Write a rule in English — 'a behaviour change comes with a test', 'no new dependency in the core package', 'public APIs are documented' — and it becomes a check. Each assertion is evaluated separately, so one unanswerable rule cannot take the others down with it."
  - title: "Three modes per gate"
    icon: "🎚️"
    details: "off, warning or error. Roll a gate out as a warning, watch it for a fortnight, then promote it — nobody has to argue with a bot that just started blocking merges."
---

## Wire it up

```yaml
name: Buddy Gate
on:
  pull_request:
    types: [opened, edited, synchronize, ready_for_review]

jobs:
  gate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      checks: write
      pull-requests: read
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bunx @buddysh/buddy gate ${{ github.event.pull_request.number }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Then mark `buddy/gate` as a required check in your branch protection rules. That is the whole enforcement story: GitHub blocks the merge, Buddy just reports the truth.

## Deterministic first {#deterministic}

The title, description and dependency gates need no AI provider at all. They are computed from the pull request and from data Buddy already collects while scanning dependencies, which makes them the gates a repository gets for free.

The assertion gates — linked issue, and your own `custom` rules — need a provider. With none configured they return a **neutral** result rather than a pass, because a check that could not run must never read as one that succeeded. The same applies when a provider errors mid-run.

Assertions are written to pass on an unclear case, deliberately. A gate that blocks on uncertainty is a gate that gets turned off within a month.

## Untrusted by construction

The pull request title, body and diff are third-party text on a public repository. The assertion checks wrap all of it in an `<untrusted-content>` block and instruct the model to read it as data, never as instructions. Details in [the agent runtime](/ai/agent).

## After the merge

```ts
gates: {
  postMerge: {
    changelog: { enabled: true, path: 'CHANGELOG.md' },
    commentOnIssues: true,
    refreshDashboard: true,
  },
}
```

`buddy post-merge <pr>` runs the other end of the lifecycle: append the changelog entry, tell the linked issues their fix has shipped, and refresh the dependency dashboard.

## Related

[AI code review](/features/ai-code-review) · [Dependency updates](/features/dependency-updates) · [Security & compliance](/use-cases/security-compliance) · [Configuration reference](/config)

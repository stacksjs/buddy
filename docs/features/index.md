---
layout: home
title: Features
description: Everything Buddy does — AI code review, in-thread conversations, local review, merge gates, CI repair, finishing touches, dependency updates and workflow security — running on your CI with your keys.

hero:
  name: "features"
  text: "One teammate, nine jobs"
  tagline: "Buddy replaces a hosted code reviewer and a dependency bot with a single binary that runs inside your own pipeline. Pick the half you need — or run all of it."
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Compare Buddy
      link: /compare/
  code:
    - file: "buddy --help"
      lang: "ascii"
      content: |
        $ buddy --help

                     __
            (\,------'()'--o    buddy v0.11
             (_    ___    /~"   fetch. read. speak up.
              (_)_)  (_)_)

          review      read a PR, a branch, or the working tree
          gate        publish the pre-merge check run
          fix-ci      diagnose a failing run and repair it
          touch       run a finishing touch as a stacked PR
          security    audit workflows for supply-chain footguns
          scan        find outdated dependencies
          update      open the update pull requests
          dashboard   maintain the pinned dependency issue
          report      dependency health over a window
          doctor      what is configured, what is missing

features:
  - title: "AI Code Review"
    icon: "🔍"
    span: 2
    details: "Inline findings anchored to the lines you changed, each stating the failure it causes rather than a style preference. Incremental by default — a second push gets new findings, not the ones you already read."
    link: /features/ai-code-review
    linkText: "How the review works"
  - title: "Conversations"
    icon: "💬"
    details: "Mention @buddy to re-review, summarise, resolve threads, pause, plan, or just ask a question about the diff."
    link: /features/pr-conversations
    linkText: "Every command"
  - title: "Local Review"
    icon: "💻"
    details: "buddy review reads your working tree. --light needs no key and no network, so it fits in a pre-commit hook."
    link: /features/local-review
    linkText: "Review before you push"
  - title: "Merge Gates"
    icon: "🚦"
    details: "Title format, description quality, linked issue and dependency policy, published as a real check run rather than a comment nobody reads."
    link: /features/merge-gates
    linkText: "Gate the merge"
  - title: "CI Repair"
    icon: "🛠️"
    details: "buddy fix-ci reads the failing workflow run, classifies the failure, and opens the repair when the fix is unambiguous."
    link: /features/ci-repair
    linkText: "Fix the build"
  - title: "Finishing Touches"
    icon: "✨"
    details: "Docstrings, tests, simplification and autofix — delivered as a stacked pull request you can merge, ignore or close."
    link: /features/finishing-touches
    linkText: "See the touches"
  - title: "Dependency Updates"
    icon: "📦"
    span: 2
    details: "The whole Renovate and Dependabot job — scanning, grouping, real changelogs, OSV advisories, a pinned dashboard and auto-merge — across npm, Composer, Docker, Actions, Go, Rust, Python, Ruby and Zig."
    link: /features/dependency-updates
    linkText: "The dependency half"
  - title: "Workflow Security"
    icon: "🛡️"
    details: "Static analysis for the supply-chain footguns that live in .github/workflows — bash injection, excessive permissions, unpinned actions."
    link: /features/workflow-security
    linkText: "Audit your workflows"
  - title: "Your CI, Your Keys"
    icon: "🏠"
    details: "No app installed on your repository, no diff leaving your pipeline. Anthropic, OpenAI, Google, OpenRouter — or no provider at all."
    link: /features/self-hosted
    linkText: "How self-hosting works"
---

## Two halves, no coupling

Neither half of Buddy depends on the other. Run the reviewer alone, run the updater alone, or run both from the same config.

| | Review | Dependencies |
| --- | --- | --- |
| On a pull request | Inline findings, summary, `@buddy` commands, merge gates | Grouped update PRs with real changelogs |
| Before you push | `buddy review` on the working tree | `buddy scan` |
| When CI fails | `buddy fix-ci` diagnoses and repairs | Lock files regenerated on rebase |
| Ongoing | Findings tracked, threads resolved | Pinned dashboard issue, `buddy report` |

## Start in one command

```bash
bun add -g @buddysh/buddy
buddy setup
```

`buddy setup` reads your repository, spots the package managers you actually use, migrates a Renovate or Dependabot config if it finds one, writes `buddy.config.ts`, and generates the workflows. It asks before it writes anything.

## Where to go next

- New here? [What is Buddy?](/intro) then [Getting Started](/guide/getting-started)
- Deciding? [Compare Buddy against the alternatives](/compare/)
- Looking for your situation? [Use cases](/use-cases/)
- Ready to configure? [Configuration reference](/config)

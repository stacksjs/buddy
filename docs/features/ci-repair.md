---
layout: home
title: CI Repair
description: buddy fix-ci reads a failing workflow run, classifies the failure, and opens the repair when the fix is unambiguous — with a hard attempt limit so it never loops.

hero:
  name: "ci repair"
  text: "It fixes the build it can explain"
  tagline: "Most red builds are one of six things, and half of them are not your fault. buddy fix-ci reads the log, classifies the failure, checks whether the base branch is already broken, and repairs it when the fix is unambiguous — or tells you plainly that it is not."
  announcement:
    tag: "fix-ci"
    text: "Classification runs with no AI provider at all"
    link: "#classification"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: The agent runtime
      link: /ai/agent
  code:
    - file: "fix-ci"
      lang: "ascii"
      content: |
        $ buddy fix-ci --pr 128

                     __
            (\,------'()'--o    reading the failing run
             (_    ___    /~"   ci / test (ubuntu-latest)
              (_)_)  (_)_)

          classified   lockfile-drift
          evidence     "lockfile had changes, but
                        --frozen-lockfile was set"
          base branch  green — the failure is ours
          mechanical   yes

          → regenerating bun.lock
          → committed to buddy/update-react-18
          → posted the outcome on #128

          fixed. attempt 1 of 3.
    - file: "when it will not guess"
      lang: "ascii"
      content: |
        $ buddy fix-ci --pr 131

          classified   test-failure
          evidence     "expected 3, received 2"
                       "at src/queue/batch.test.ts:44"
          base branch  green
          mechanical   no

          → the failing assertion is about behaviour
            this pull request changed on purpose.
            Either the test or the change is wrong,
            and choosing between them is yours.

          reported. no commit made.

features:
  - title: "Six failures, told apart"
    icon: "🔬"
    span: 2
    details: "Lock file drift, runner flake, install failure, type error, test failure and lint. Each has a signature matched against the log, and each carries the evidence lines that produced the verdict — so the classification is auditable rather than asserted."
  - title: "Checks the base first"
    icon: "🌿"
    details: "If the same failure happens on the base branch, the pull request did not cause it. Buddy says so instead of trying to repair somebody else's breakage on your branch."
  - title: "Mechanical before model"
    icon: "⚙️"
    details: "Lock file drift is regenerated deterministically — no provider, no tokens, no guessing. The agent is only reached for failures that genuinely need reading the code."
  - title: "A hard attempt limit"
    icon: "🛑"
    details: "Prior attempts on the pull request are counted, and the run stops at the limit. A repair bot that retries forever is worse than a red build, because a red build is honest."
  - title: "It commits, it does not merge"
    icon: "🌱"
    details: "Repairs land on the working branch as an ordinary commit you review. fix-ci mode may write, run commands and use git — on that branch, in a workspace it cannot escape."
  - title: "Explains itself either way"
    icon: "🗒️"
    details: "Every run posts an outcome: what it classified, what it did, and — when it declined — why the fix was not the bot's to make."
---

## From the thread

```text
@buddy fix-ci
```

The most common way to reach it. The command is permission-checked, so a commenter without write access cannot make Buddy push to your branch.

## From the CLI

```bash
buddy fix-ci --pr 128
buddy fix-ci --pr 128 --dry-run     # classify and report, change nothing
```

## From a workflow

```yaml
name: Buddy Fix CI
on:
  workflow_run:
    workflows: [CI]
    types: [completed]

jobs:
  repair:
    if: github.event.workflow_run.conclusion == 'failure'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      actions: read
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bunx @buddysh/buddy fix-ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## How classification works {#classification}

The log is matched against failure signatures before any model is involved. That ordering matters for cost and for trust: a stale lock file is a pattern, not a judgement call, and paying a language model to recognise one is silly.

| Kind | What it means | Repair |
| --- | --- | --- |
| `lockfile-drift` | The lock file is out of step with its manifest | Regenerated mechanically |
| `flake` | Network, rate limit or runner problem | Worth one retry |
| `install` | Dependencies could not be resolved | Agent, or reported |
| `type-error` | The change does not type-check | Agent |
| `test-failure` | An assertion failed | Agent, or reported |
| `lint` | Lint or formatting violations | Agent |
| `unknown` | Nothing recognisable | Reported, with the interesting log lines |

With no AI provider configured, classification and the mechanical repairs still work. You lose the agent-driven fixes, not the diagnosis.

## What it is allowed to do

`fix-ci` is an [agent mode](/ai/agent) drawing from the read, write, shell, git and comment tiers. Its limits are structural rather than advisory:

- Commands run from an **empty environment plus an allowlist**, so a command the agent runs cannot authenticate to your registry, your cloud or GitHub — the credentials are simply not there.
- Every path is resolved against the workspace and rejected if it escapes, checked twice so a symlink inside the workspace cannot satisfy the first check and land outside it.
- Tool calls, wall clock and tokens are each independently bounded.

## Related

[Conversations](/features/pr-conversations) · [Finishing touches](/features/finishing-touches) · [The agent runtime](/ai/agent) · [Dependency updates](/features/dependency-updates)

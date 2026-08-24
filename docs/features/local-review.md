---
layout: home
title: Local Review
description: buddy review reads your working tree before the pull request exists. --light runs the analyzers with no API key and no network, fast enough for a pre-commit hook.

hero:
  name: "local review"
  text: "The cheapest review is the one before the PR"
  tagline: "buddy review reads your working tree — staged changes included — and tells you what a reviewer would say. No pull request to open, no CI queue to wait for, and with --light, no API key at all."
  announcement:
    tag: "--light"
    text: "No key, no network, no excuse"
    link: "#light"
  actions:
    - theme: brand
      text: Install Buddy
      link: /install
    - theme: alt
      text: Full CLI reference
      link: /cli/review
  code:
    - file: "pre-commit"
      lang: "ascii"
      content: |
        $ buddy review --staged --light --fail-on major

                     __
            (\,------'()'--o    analyzers only
             (_    ___    /~"   no key, no network
              (_)_)  (_)_)

          secrets      scanning 6 staged files
          actionlint   .github/workflows/ci.yml
          shellcheck   scripts/release.sh
          yaml/json    3 files

          scripts/release.sh:12  major  security
            AWS key literal in the deploy step.

          1 major finding — commit blocked.
        $ echo $?
        1
    - file: "hand it to an agent"
      lang: "ascii"
      content: |
        $ buddy review --format agent | claude

        # the block tells the agent to change only
        # what each finding asks for — and gives it
        # explicit permission to disagree and leave
        # the code alone.

        $ buddy review --format json | jq '.findings[]
            | select(.severity == "major")'

        $ buddy review --format github
        ::error file=src/auth.ts,line=82::Token
          refresh drops the error.

features:
  - title: "Reads what you are about to commit"
    icon: "📝"
    details: "The default reviews the working tree against HEAD with staged changes included — a pre-commit review that ignored what you just staged would miss the very lines you are committing."
  - title: "Three scopes"
    icon: "🎯"
    details: "No flag reviews the working tree, --staged reviews the index only, --branch reviews this branch against its base."
  - title: "Works offline"
    icon: "🦴"
    span: 2
    details: "--light skips the model entirely and runs secret scanning, workflow auditing, YAML and JSON validation, and whatever linters the machine has installed — actionlint, shellcheck, hadolint, markdownlint. Fast enough for a hook, and it works on a plane."
  - title: "Exit codes, not vibes"
    icon: "🚧"
    details: "--fail-on <severity> exits non-zero when something at or above that severity is found. That is what turns a suggestion into a gate."
  - title: "Applies its own suggestions"
    icon: "🩹"
    details: "--fix confirms each suggestion; --fix --yes applies them all. Fixes land bottom-up per file, and a suggestion whose line no longer matches is skipped rather than written over an unrelated line."
  - title: "Pipes cleanly"
    icon: "🔌"
    details: "json, github annotations, or agent. Every format except pretty owns stdout completely, so no log line lands in the middle of your JSON."
---

## The three commands worth aliasing

```bash
buddy review                              # working tree, staged included
buddy review --staged --light --fail-on major   # a pre-commit hook
buddy review --branch --base main         # everything on this branch
```

## No key required {#light}

`--light` is the flag that makes local review universal. It runs the analyzers Buddy ships with and nothing else:

| Analyzer | What it catches |
| --- | --- |
| Secret scanning | Keys, tokens and credentials about to be committed |
| Workflow audit | Bash injection, excessive permissions, unpinned actions, missing timeouts |
| `actionlint` | GitHub Actions workflow errors |
| `shellcheck` | Shell script bugs |
| `hadolint` | Dockerfile problems |
| `markdownlint` | Documentation lint |
| Syntax / YAML / JSON | Files that do not parse |

Missing analyzer binaries are a warning, not a failure — Buddy runs the ones the machine has. `buddy doctor` reports which are installed and the command that installs the rest.

## In a pre-commit hook

```bash
# .git/hooks/pre-commit
#!/bin/sh
buddy review --staged --light --fail-on major
```

No key, no network, no per-seat cost, and it runs in the seconds you would otherwise spend waiting for CI to tell you the same thing.

## Handing findings to a coding agent

```bash
buddy review --format agent | claude
```

`--format agent` emits an instruction rather than a report. It tells the agent to change only what each finding asks for, and explicitly gives it permission to disagree and leave the code alone — an agent that mechanically applies a wrong finding is worse than one that pushes back.

## Diagnosing the setup

```bash
buddy doctor
```

Reports credentials, git state, configuration validity and which analyzer tools are installed, and every problem it finds comes with the command or setting that fixes it. Missing credentials and missing binaries are warnings; `doctor` exits non-zero only when something is genuinely broken.

## Related

[AI code review](/features/ai-code-review) · [Workflow security](/features/workflow-security) · [Local review CLI reference](/cli/review) · [Working with AI coding agents](/use-cases/ai-coding-agents)

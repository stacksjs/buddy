---
layout: home

hero:
  name: "buddy"
  text: "The teammate who reads every pull request"
  tagline: "Buddy reviews your code, answers questions in the thread, gates merges, repairs failing CI — and keeps your dependencies current while it is in there. One bot, your CI, your keys."
  announcement:
    tag: "v0.11"
    text: "Now published as @buddysh/buddy"
    link: /install
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Why Buddy?
      link: /intro
    - theme: alt
      text: View on GitHub
      link: https://github.com/stacksjs/buddy
  code:
    - file: "buddy"
      lang: "ascii"
      content: |
        $ buddy review

                       __
              (\,------'()'--o          buddy v0.11
               (_    ___    /~"         fetch. read. speak up.
                (_)_)  (_)_)

           analyzers   secrets · actionlint · shellcheck · hadolint
           diff        14 files, 412 changed lines

           src/auth/session.ts:82   major   correctness
             Token refresh drops the error, so an expired
             session reads as a successful login.

           .github/workflows/ci.yml:19  minor  security
             Interpolates a PR title into `run:`.

           2 findings. 1 posted inline, 1 already reported.
    - file: "in the thread"
      lang: "ascii"
      content: |
        @buddy review          review new changes since last time
        @buddy full-review     re-read the whole diff
        @buddy summary         a fresh summary, no inline notes
        @buddy resolve         resolve the threads Buddy opened
        @buddy pause / resume  stop or restart on this PR
        @buddy fix-ci          diagnose and try to fix the failing checks
        @buddy plan            turn an issue into an implementation plan
        @buddy rebase          rebase a dependency update
        @buddy merge           re-check auto-merge conditions now
        @buddy remember <text> keep a note for future runs
        @buddy help            show the table

        ...anything else after the mention is treated
        as a question, and answered in the thread.
    - file: "buddy.config.ts"
      lang: "ts"
      content: |
        import type { BuddyConfig } from '@buddysh/buddy'

        export default {
          ai: {
            provider: 'anthropic',
            model: 'claude-opus-5',
          },
          packages: {
            strategy: 'all',
            groups: [
              { name: 'TypeScript Types', patterns: ['@types/*'] },
            ],
          },
          pullRequest: {
            labels: ['dependencies'],
            autoMerge: { enabled: true, strategy: 'squash', conditions: ['patch-only'] },
          },
        } satisfies BuddyConfig

features:
  - title: "Reviews like a colleague, not a linter"
    icon: "🔍"
    span: 2
    details: "Inline findings anchored to the lines you actually changed, each with the failure it causes rather than a style opinion. Buddy remembers what it already said, so a second push gets new findings — not the same ones again."
  - title: "Talks back in the thread"
    icon: "💬"
    details: "Mention @buddy to re-review, summarise, resolve its own threads, pause on a noisy PR, or just ask a question about the diff."
  - title: "Works without an API key"
    icon: "🦴"
    details: "buddy review --light runs secret scanning, actionlint, shellcheck, hadolint and syntax checks with no model and no network. Fast enough for a pre-commit hook."
  - title: "Stands at the gate"
    icon: "🚦"
    details: "Pre-merge gates publish a real check run: title format, description quality, linked issue, dependency policy. Merge is blocked by a check, not by a comment nobody reads."
  - title: "Fixes the build it broke"
    icon: "🛠️"
    details: "buddy fix-ci reads a failing workflow run, classifies the failure, and opens the repair when the fix is unambiguous."
  - title: "Also minds the dependencies"
    icon: "📦"
    details: "The whole Renovate/Dependabot job — scanning, grouping, changelogs, a pinned dashboard, auto-merge — across npm, Composer, Docker, Actions, Go, Rust, Python and Ruby."
  - title: "Your CI, your keys, your model"
    icon: "🏠"
    span: 2
    details: "Buddy runs as a step in your own workflow. Point it at Anthropic, OpenAI, Google, OpenRouter or any OpenAI-compatible endpoint — or at nothing at all and keep the analyzers. No third-party app on your repository, no diff leaving your pipeline."
---

## Two jobs, one teammate

Buddy covers the ground that usually takes two bots and two subscriptions.

| | Review | Dependencies |
| --- | --- | --- |
| On a pull request | Inline findings, summary, `@buddy` commands, merge gates | Grouped update PRs with real changelogs |
| Before you push | `buddy review` on the working tree | `buddy scan` |
| When CI fails | `buddy fix-ci` diagnoses and repairs | Lock files regenerated on rebase |
| Ongoing | Findings tracked, threads resolved | Pinned dashboard issue |

## Bring Buddy home

```bash
bun add -g @buddysh/buddy
buddy setup
```

`buddy setup` reads your repository, spots the package managers you actually use, migrates a Renovate or Dependabot config if it finds one, writes `buddy.config.ts`, and generates the GitHub Actions workflows. It asks before it writes anything.

## Review before anyone else has to

The fastest review is the one that happens before the pull request exists:

```bash
buddy review                     # working tree, staged changes included
buddy review --staged --light    # analyzers only — no key, no network
buddy review --branch --fail-on major
```

`--light` is the interesting one. It skips the model entirely and runs the analyzers Buddy ships with — secret scanning, `actionlint`, `shellcheck`, `hadolint`, `markdownlint`, YAML and JSON validation — so it works in a pre-commit hook, offline, on a machine with no API key. `--fail-on <severity>` exits non-zero, which is what makes it a gate rather than a suggestion.

Piping the findings straight to a coding agent works too:

```bash
buddy review --format agent | claude
```

Formats: `pretty`, `json`, `github` (Actions annotations) and `agent`. Everything except `pretty` owns stdout completely, so no log line lands in the middle of your JSON.

Full detail in [local review](/cli/review) and [the agent runtime](/ai/agent).

## Then talk to it

Once Buddy is on a pull request, it answers to its name:

```text
@buddy full-review
@buddy why is this a race condition?
@buddy pause
```

Commands are permission-checked, so a drive-by comment cannot make Buddy act. See [the CLI overview](/cli/overview) for the full table.

## Pick your model — or none

```ts
ai: { provider: 'anthropic', model: 'claude-opus-5' }
```

Anthropic, OpenAI, Google, OpenRouter and any OpenAI-compatible endpoint are supported. Model aliases (`opus`, `sonnet`, `haiku`) resolve to current Anthropic models; every other provider takes a concrete ID. Nothing is sent anywhere until you configure a provider, and a scan never blocks on the model being available. See [AI providers](/ai/providers) and [headless runs](/ai/headless).

## And the dependency half

Buddy does not open a pull request titled "Bump lodash". It opens one you can review:

| Package | Change | Age | Adoption | Passing | Confidence |
| --- | --- | --- | --- | --- | --- |
| [typescript](https://www.typescriptlang.org/) | `^5.8.2` → `^5.8.3` | 📅 | 📈 | ✅ | 🔒 |
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) | `^22.1.0` → `^22.4.0` | 📅 | 📈 | ✅ | 🔒 |

Underneath sits the release notes for every version in the range, a compare link, anything the maintainers flagged as breaking, and a checkbox that rebases the branch on demand.

| Ecosystem | Manifests it reads | Lock files it maintains |
| --- | --- | --- |
| JavaScript / TypeScript | `package.json`, workspace catalogs | `bun.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` |
| PHP | `composer.json` | `composer.lock` |
| pkgx / Launchpad | `deps.yaml`, `dependencies.yaml`, `pkgx.yaml` | `pantry.lock` |
| GitHub Actions | `.github/workflows/*.yml` | — |
| Docker | `Dockerfile`, `docker-compose.yml` | — |
| Go, Rust, Python, Ruby | `go.mod`, `Cargo.toml`, `pyproject.toml`, `Gemfile` | `go.sum`, `Cargo.lock`, `poetry.lock`, `Gemfile.lock` |

More in [pull request generation](/features/pull-requests), [the dashboard](/features/dependency-dashboard) and [ecosystems](/advanced/ecosystems).

## Compared to the alternatives

| | Buddy | CodeRabbit | Renovate | Dependabot |
| --- | --- | --- | --- | --- |
| AI code review | Yes | Yes | — | — |
| Dependency updates | Yes | — | Yes | Yes |
| Runs on | Your CI, your keys | Hosted app | Hosted or self-hosted | GitHub-hosted |
| Works with no API key | Analyzers only | — | n/a | n/a |
| Local pre-push review | Yes | — | — | — |
| Config | TypeScript, JSON or YAML | YAML | JSON / JS | YAML |
| Migration in | From Renovate and Dependabot | — | — | — |

## Coming from Renovate or Dependabot

```bash
buddy setup   # detects renovate.json / .github/dependabot.yml and migrates it
```

The migration report says exactly what carried over and what has no Buddy equivalent, so nothing changes silently. See [migrating from Renovate](/advanced/migration/renovate) and [from Dependabot](/advanced/migration/dependabot).

---

<div align="center">

```
  |\_/|
  |q p|   /}     Buddy is free, MIT licensed, and happy to see you.
  ( 0 )"""\
  |"^"`    |     github.com/stacksjs/buddy
  ||_/=\\__|
```

</div>

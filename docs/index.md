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
      text: Browse the features
      link: /features/
    - theme: alt
      text: Compare Buddy
      link: /compare/
  code:
    - file: "buddy"
      lang: "ascii"
      content: |
        $ buddy review

                     __
            (\,------'()'--o    buddy v0.11
             (_    ___    /~"   fetch. read. speak up.
              (_)_)  (_)_)

          analyzers  secrets, actionlint, shellcheck
          diff       14 files, 412 changed lines

          src/auth/session.ts:82  major  correctness
            Token refresh drops the error, so an
            expired session reads as a good login.

          .github/workflows/ci.yml:19  minor  security
            Interpolates a PR title into `run:`.

          2 findings. 1 inline, 1 already reported.
    - file: "in the thread"
      lang: "ascii"
      content: |
        @buddy review        new changes since last time
        @buddy full-review   re-read the whole diff
        @buddy summary       a summary, no inline notes
        @buddy pause         stop reviewing this PR
        @buddy resume        start again
        @buddy fix-ci        diagnose the failing checks
        @buddy rebase        rebase a dependency update
        @buddy merge         re-check auto-merge now
        @buddy remember ...  keep a note for future runs
        @buddy help          show the table

        ...anything else is treated as a question,
        and answered in the thread.
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
              { name: 'Types', patterns: ['@types/*'] },
            ],
          },
          pullRequest: {
            labels: ['dependencies'],
            autoMerge: {
              enabled: true,
              strategy: 'squash',
              conditions: ['patch-only'],
            },
          },
        } satisfies BuddyConfig

features:
  - title: "Reviews like a colleague, not a linter"
    icon: "🔍"
    span: 2
    details: "Inline findings anchored to the lines you actually changed, each with the failure it causes rather than a style opinion. Buddy remembers what it already said, so a second push gets new findings — not the same ones again."
  - title: "Talks back in the thread"
    icon: "💬"
    details: "Mention @buddy to re-review, summarise, pause on a noisy PR, or just ask a question about the diff."
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
    details: "The whole Renovate/Dependabot job — scanning, grouping, changelogs, a pinned dashboard, auto-merge — across npm, Composer, Docker, Actions, pkgx, Zig, Go, Rust, Python and Ruby."
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
| Docker | `Dockerfile` | — |
| Zig | `build.zig.zon` | — |
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
| Config | TypeScript, JavaScript or JSON | YAML | JSON / JS | YAML |
| Migration in | From Renovate and Dependabot | — | — | — |

The full matrix — including Greptile, Qodo Merge, Graphite, Sourcery and Snyk —
is in [the comparisons](/compare/), where each page also says plainly where the
other tool is the better choice.

## Find your own situation

[Open source maintainers](/use-cases/open-source) · [startups](/use-cases/startups) ·
[platform teams](/use-cases/platform-teams) · [agencies](/use-cases/agencies) ·
[monorepos](/use-cases/monorepos) · [security and compliance](/use-cases/security-compliance) ·
[migrating off Renovate](/use-cases/migrating) · [working with AI coding agents](/use-cases/ai-coding-agents)

## Coming from Renovate or Dependabot

You do not have to rewrite the configuration you already tuned. Setup finds it
and reads it:

```bash
buddy setup   # detects renovate.json / .github/dependabot.yml and migrates it
```

From a `renovate.json`, your schedule, package rules, ignored dependencies,
auto-merge preference, assignees and reviewers all carry across. Two things
cannot: `extends` presets, because Buddy has no preset registry to resolve them
against, and `regexManagers`, which has no equivalent at all. From a
`dependabot.yml` there is simply less to read — an update interval and an
ignore list is most of what the format holds.

Whatever happens, the migration report names it: what carried over, what did
not, and how confident the conversion is. Nothing is changed quietly, and
nothing is dropped without being listed.

Read the details for [Renovate](/advanced/migration/renovate) or
[Dependabot](/advanced/migration/dependabot) before you run it.

---

<figure class="BuddySignoff">

```
 |\_/|
 |q p|   /}
 ( 0 )"""\
 |"^"`    |
 ||_/=\__|
```

<figcaption>

Buddy is free, MIT licensed, and happy to see you —
[github.com/stacksjs/buddy](https://github.com/stacksjs/buddy)

</figcaption>

</figure>

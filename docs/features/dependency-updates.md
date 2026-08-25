---
layout: home
title: Dependency Updates
description: Buddy replaces Renovate and Dependabot — scanning, grouping, real changelogs, OSV advisories, a pinned dashboard, interactive rebase and auto-merge across ten ecosystems.

hero:
  name: "dependency updates"
  text: "Not a PR titled “Bump lodash”"
  tagline: "Buddy opens dependency pull requests you can actually review: every release note in the range, the compare link, whatever the maintainers flagged as breaking, the advisories that apply, and a checkbox that rebases the branch on demand."
  announcement:
    tag: "migration"
    text: "buddy setup imports your Renovate or Dependabot config"
    link: /advanced/migration
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: vs Renovate
      link: /compare/renovate
    - theme: alt
      text: vs Dependabot
      link: /compare/dependabot
  code:
    - file: "buddy scan"
      lang: "ascii"
      content: |
        $ buddy scan

                     __
            (\,------'()'--o    scanning 3 manifests
             (_    ___    /~"   npm · composer · actions
              (_)_)  (_)_)

          npm
            typescript      ^5.8.2  → ^5.8.3   patch
            @types/node     ^22.1.0 → ^22.4.0  minor
            vite            ^5.4.0  → ^6.0.1   major ⚠

          composer
            laravel/framework ^11.9 → ^11.31   minor

          github-actions
            actions/checkout  v4 → v4.2.2      patch

          5 updates · 1 major · 1 advisory resolved
    - file: "the pull request"
      lang: "ascii"
      content: |
        chore(deps): update all non-major dependencies

        | Package     | Change            | Confidence |
        |-------------|-------------------|------------|
        | typescript  | ^5.8.2 → ^5.8.3   | 🔒         |
        | @types/node | ^22.1.0 → ^22.4.0 | 🔒         |

        ### Release Notes
        <details>
        <summary>microsoft/TypeScript (typescript)</summary>
        ...every version in the range, with a
        compare link and the breaking changes
        the maintainers flagged.
        </details>

        - [ ] check this box to rebase/retry
    - file: "buddy.config.ts"
      lang: "ts"
      content: |
        export default {
          packages: {
            strategy: 'all',
            ignore: ['legacy-thing'],
            groups: [
              { name: 'Types', patterns: ['@types/*'] },
              {
                name: 'ESLint',
                patterns: ['eslint*', '@typescript-eslint/*'],
                strategy: 'patch',
              },
            ],
          },
          pullRequest: {
            labels: ['dependencies'],
            reviewers: ['platform-team'],
            autoMerge: {
              enabled: true,
              strategy: 'squash',
              conditions: ['patch-only'],
            },
          },
        } satisfies BuddyConfig

features:
  - title: "Ten ecosystems"
    icon: "🌍"
    span: 2
    details: "npm, Bun, yarn and pnpm; Composer; GitHub Actions; Docker; pkgx and Launchpad; Zig; and — through the adapter interface — Python, Rust, Go and Ruby. Every lock file that has one is regenerated with the right tool, not hand-edited."
  - title: "Advisories from OSV"
    icon: "🛡️"
    details: "Security advisories come from OSV.dev, which indexes every ecosystem Buddy supports. End-of-life base images are flagged too — an EOL image stops getting patches entirely, which outranks any single advisory."
  - title: "Real changelogs"
    icon: "📜"
    details: "Every release between your version and the target, not just the newest one. If the breaking change was in the middle of the range, it is in the pull request."
  - title: "Grouping that reduces noise"
    icon: "🎨"
    details: "Group by pattern with a per-group strategy, so @types/* moves together on minor while eslint* stays on patch. One review, one merge, one CI run."
  - title: "A pinned dashboard"
    icon: "📊"
    details: "One issue holding every detected dependency and every open update, with checkboxes that force a rebase. Tick, and the branch is rebuilt on the next run."
  - title: "Monorepos without a setting"
    icon: "🏗️"
    span: 2
    details: "There is no workspaces option to turn on. Buddy walks the repository, finds every manifest at any depth, skips node_modules and vendor and build output, and merges per-workspace bun outdated results with the root scan."
  - title: "Constraints are preserved"
    icon: "📐"
    details: "requests~=2.28.0 becomes ~=2.31.0, not ==2.31.0. Replacing a compatible-release policy with a pin is a change nobody asked for arriving inside a dependency update."
  - title: "Auto-merge with conditions"
    icon: "🤝"
    details: "squash, merge or rebase, optionally restricted to patch-only. Enable it for the updates you would never read, keep the rest for a human."
---

## Three commands

```bash
buddy scan                    # what is outdated, and why
buddy update --dry-run        # what the pull requests would say
buddy update                  # open them
```

Then the maintenance commands: `buddy dashboard` refreshes the pinned issue, `buddy update-check` rebases every pull request whose box is ticked, `buddy rebase <pr>` rebases one, `buddy cleanup` removes stale branches with no open pull request, and `buddy report --period 30d` writes a dependency-health report over a window.

## Update strategies

| Strategy | Updates it proposes |
| --- | --- |
| `patch` | Patch only — the safest default to automate |
| `minor` | Minor and patch, no majors |
| `major` | Major versions only |
| `all` | Everything, regardless of semver impact |

A strategy is set globally, per group, or per run with `--strategy`. See [update strategies](/features/update-strategies).

## What it will not touch

Every adapter declines things that look like dependencies but are not a version bump — because proposing one is worse than proposing nothing:

- **Go** — `// indirect` requirements, which are `go mod tidy`'s job, and pseudo-versions naming an untagged commit. A v1→v2 upgrade changes the module *path*, which is a source change, so it is never proposed.
- **Python** — `-r`, `-e` and `--index-url` directives, unconstrained requirements, Poetry's `python` marker, yanked releases. Versions are compared with PEP 440, not semver: `1.0.post1` is newer than `1.0`, and getting that wrong proposes a downgrade for every post-release on PyPI.
- **Rust** — `path` and `git` dependencies, which have no registry version, and yanked crates.
- **Ruby** — commented-out gems, and gems with `path:`, `git:` or `github:`.

## Coming from Renovate or Dependabot

```bash
buddy setup   # detects renovate.json / .github/dependabot.yml and migrates it
```

Schedules become workflow presets, package rules become groups and ignores, assignees and reviewers carry over. The migration report says exactly what carried over and what has no Buddy equivalent, so nothing changes silently. See [migrating from Renovate](/advanced/migration/renovate) and [from Dependabot](/advanced/migration/dependabot).

## Related

[Scanning](/features/scanning) · [Pull request generation](/features/pull-requests) · [Dependency dashboard](/features/dependency-dashboard) · [Auto-merge](/features/auto-merge) · [Ecosystems](/advanced/ecosystems) · [Monorepos](/advanced/monorepo)

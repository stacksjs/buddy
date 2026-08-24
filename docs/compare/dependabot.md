---
layout: home
title: Buddy vs Dependabot
description: Dependabot is free and already installed. Buddy trades that convenience for more ecosystems, real grouping, a dashboard, merge gates — and a code reviewer.

hero:
  name: "buddy vs dependabot"
  text: "Free is a strong opening bid"
  tagline: "Dependabot's advantage is real: it is already in your repository, it costs nothing, and it takes one YAML file. Buddy is worth the swap when that one file has stopped being enough — noise, missing ecosystems, no grouping worth the name, and no reviewer anywhere in sight."
  actions:
    - theme: brand
      text: Migrate from Dependabot
      link: /advanced/migration/dependabot
    - theme: alt
      text: Dependency updates
      link: /features/dependency-updates
    - theme: alt
      text: All comparisons
      link: /compare/
  code:
    - file: "one PR instead of nine"
      lang: "ascii"
      content: |
        $ buddy scan

                     __
            (\,------'()'--o    grouped by policy
             (_    ___    /~"   not one PR per package
              (_)_)  (_)_)

          Types           @types/node, @types/react,
                          @types/react-dom, @types/bun
                          → 1 pull request

          ESLint          eslint, @typescript-eslint/*,
                          eslint-plugin-*
                          → 1 pull request

          go.mod          2 updates    → 1 pull request
          Cargo.toml      1 update     → 1 pull request

          9 packages, 4 pull requests,
          4 CI runs instead of 9.

features:
  - title: "Grouping that actually reduces noise"
    icon: "🎨"
    span: 2
    details: "Group by pattern with a per-group strategy, so @types/* moves together on minor while eslint* stays on patch. One review, one merge, one CI run — instead of nine pull requests that each invalidate the other eight's lock file."
  - title: "More ecosystems"
    icon: "🌍"
    details: "npm, Bun, yarn, pnpm, Composer, Docker, GitHub Actions, pkgx, Launchpad, Zig, Python, Rust, Go and Ruby — including Bun's lock file, which Dependabot does not manage."
  - title: "A dashboard"
    icon: "📊"
    details: "One pinned issue holding every detected dependency and every open update, with checkboxes that force a rebase. Dependabot has no equivalent."
  - title: "Changelogs for the whole range"
    icon: "📜"
    details: "Every release between your version and the target, not just the newest. If the breaking change was in the middle of the range, it is in the pull request."
  - title: "It reviews code too"
    icon: "🔍"
    details: "Inline findings, in-thread commands, merge gates and CI repair. Dependabot is not trying to do this, which is fine — but you still need someone to."
  - title: "Any git host"
    icon: "🌐"
    details: "GitHub, GitLab and Bitbucket Cloud. Dependabot is GitHub-only by construction."
---

## Side by side

| | Buddy | Dependabot |
| --- | --- | --- |
| Cost | MIT + your model tokens + CI minutes | Free |
| Setup | `buddy setup` | One YAML file |
| Ecosystems | 11, including Bun and pkgx | Many, but no Bun lock file |
| Grouping | Pattern groups with per-group strategy | Basic grouping |
| Dashboard | ✅ pinned issue | — |
| Changelogs | Every version in the range | Release notes for the target |
| Rebase on demand | ✅ checkbox, `@buddy rebase` | `@dependabot rebase` |
| Auto-merge | ✅ with conditions | Via your own workflow |
| Security advisories | ✅ OSV | ✅ GitHub Advisory Database |
| AI code review | ✅ | — |
| Merge gates | ✅ | — |
| CI repair | ✅ | — |
| Git hosts | GitHub, GitLab, Bitbucket Cloud | GitHub |
| Runs on | Your CI minutes | GitHub-hosted, free |

## Where Dependabot is the better choice

- **You want zero cost and zero thought.** Dependabot needs no runner, no token, no model and no maintenance. For a small repository where dependency drift is the only problem, that is a very hard offer to beat, and you should probably just use it.
- **Security updates on a repository you barely touch.** Dependabot's security alerts are enabled at the org level and require nothing from you per repository.
- **You cannot spend CI minutes.** Buddy runs on your runner; Dependabot runs on GitHub's.

## Where Buddy is different

- **The noise problem.** The most common reason teams leave Dependabot is a pull request per package per week. Grouping fixes that at the policy level rather than by muting it.
- **Bun.** If your repository has a `bun.lock`, Buddy maintains it.
- **Blocking policy.** `dependencyGate` fails a check run on an advisory, a deprecated package, an EOL base image or a licence outside your allowlist — deterministically, with no model involved.
- **The other half.** Once Buddy is installed for updates, the reviewer, the merge gates, the workflow audit and CI repair are already there.

## Switching

```bash
bun add -g @buddysh/buddy
buddy setup    # detects and migrates .github/dependabot.yml
```

Schedules become presets, ignores carry over, and the migration report lists anything without an equivalent. Run both for a sprint if you like — Buddy uses its own branch prefix and labels. Details in [migrating from Dependabot](/advanced/migration/dependabot).

## Related

[Dependency updates](/features/dependency-updates) · [Auto-merge](/features/auto-merge) · [Buddy vs Renovate](/compare/renovate) · [All comparisons](/compare/)

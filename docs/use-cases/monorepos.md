---
layout: home
title: Buddy for Monorepos
description: Every manifest at every depth, discovered by walking the tree — with no workspaces setting to configure, because there is nothing to configure.

hero:
  name: "monorepos"
  text: "There is no monorepo mode"
  tagline: "Buddy treats a monorepo as the normal case rather than a feature you switch on. It walks the repository, finds every manifest at any depth, and groups the updates from all of them exactly the way it groups a single package's."
  announcement:
    tag: "zero config"
    text: "No workspaces setting, because there is nothing to set"
    link: /advanced/monorepo
  actions:
    - theme: brand
      text: How discovery works
      link: /advanced/monorepo
    - theme: alt
      text: Ecosystems
      link: /advanced/ecosystems
  code:
    - file: "one scan, every package"
      lang: "ascii"
      content: |
        $ buddy scan

                     __
            (\,------'()'--o    walking the repository
             (_    ___    /~"   19 manifests found
              (_)_)  (_)_)

          apps/web/package.json         3 updates
          apps/admin/package.json       3 updates
          packages/core/package.json    1 update
          packages/ui/package.json      3 updates
          services/billing/go.mod       2 updates
          services/search/Cargo.toml    1 update
          tooling/scripts/pyproject.toml 2 updates
          composer.json                 1 update
          Dockerfile                    1 update  ⚠ eol
          .github/workflows/*.yml       4 updates

          21 updates across 5 ecosystems.
          typescript appears in 4 manifests —
          grouped into one pull request.
    - file: "grouping that matches your layout"
      lang: "ts"
      content: |
        export default {
          packages: {
            strategy: 'patch',
            groups: [
              {
                name: 'Frontend',
                patterns: ['react*', 'next', '@types/react*'],
                strategy: 'minor',
              },
              {
                name: 'Build tooling',
                patterns: ['vite*', 'turbo', 'esbuild', 'tsup'],
                strategy: 'patch',
              },
              {
                name: 'Types',
                patterns: ['@types/*'],
              },
            ],
            ignore: ['legacy-internal-sdk'],
          },
        } satisfies BuddyConfig

features:
  - title: "Discovery by walking, not configuring"
    icon: "🚶"
    span: 2
    details: "package.json at any depth plus its lock file, composer.json, deps.yaml and friends, Dockerfile, .github/workflows/*.yml, build.zig.zon, go.mod, Cargo.toml, pyproject.toml and Gemfile. There is no list to maintain, so a new package added next quarter is covered the day it lands."
  - title: "Skips what is never first-party"
    icon: "⏭️"
    details: "node_modules, vendor, dist, build output and dotted directories are skipped rather than descended into. A directory it cannot read is skipped too, so a permissions problem in one corner does not abort the scan."
  - title: "One version, one pull request"
    icon: "🎯"
    details: "A package that appears in four manifests moves in one pull request that updates all four — not four PRs that each break the other three's lock file."
  - title: "Workspace-aware where it matters"
    icon: "📚"
    details: "For Bun and npm workspaces, Buddy runs bun outdated --filter per workspace package and merges those results with the root scan, so a catalog or workspace protocol version is resolved correctly."
  - title: "Mixed-language by default"
    icon: "🌍"
    details: "A repository with a Node frontend, a Go service, a Rust worker and a Python job is one scan and one dashboard — not four tools with four configurations."
  - title: "Reviews scoped to the diff"
    icon: "🔍"
    details: "Review reads the lines the pull request changed, so a 400-package repository does not mean a 400-package review. Cost scales with the change, not with the checkout."
---

## The dashboard is the map

For a monorepo, the pinned dependency dashboard is often the most useful thing Buddy produces: one issue holding every detected dependency, organised by ecosystem and by file, with every open update and a checkbox that forces a rebase.

```bash
buddy dashboard
```

It answers "what does this repository actually depend on" in one place, which is a question that gets harder every time somebody adds a package.

## Big repositories, sensible costs

- **Analyzers scale for free** — `--light` has no per-token cost at all, so a pre-commit hook stays instant regardless of repository size.
- **Review reads the diff**, not the tree. `ai.maxTokensPerRun` puts a hard ceiling on a single run.
- **Grouping cuts CI spend** more than it cuts review time: five grouped pull requests instead of forty is thirty-five fewer full CI runs a week.

## Related

[Monorepos, in detail](/advanced/monorepo) · [Dependency updates](/features/dependency-updates) · [Package management](/features/package-management) · [Dependency dashboard](/features/dependency-dashboard)

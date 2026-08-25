# Documentation

Buddy is one binary that does two jobs: it reviews code, and it keeps
dependencies current. Everything below is the reference for driving both.

If you have not installed it yet, [Getting Started](/guide/getting-started) is
the shortest path from nothing to a first review.

## Start here

| Page | What it covers |
| --- | --- |
| [What is Buddy?](/intro) | The shape of the product, and what it replaces |
| [Installation](/install) | Global install, project install, and the GitHub Action |
| [Getting Started](/guide/getting-started) | From zero to a reviewed pull request |
| [Usage](/usage) | The day-to-day commands, in the order you meet them |

## Command line

The CLI is the whole product — the GitHub Action is a thin wrapper around
these same commands.

| Page | What it covers |
| --- | --- |
| [Overview](/cli/overview) | Every command, grouped by what it is for |
| [`buddy setup`](/cli/setup) | Interactive and non-interactive setup |
| [Local Review](/cli/review) | Reviewing the working tree before a PR exists |
| [Update Commands](/cli/update) | `scan`, `update`, `update-check` |
| [Package Commands](/cli/package) | Working with individual packages |
| [Utility Commands](/cli/utility) | Dashboards, workflows, diagnostics |

## AI

Buddy talks to a model you choose, with credentials that stay in your CI.

| Page | What it covers |
| --- | --- |
| [Providers](/ai/providers) | Anthropic, OpenAI and the rest, and how keys resolve |
| [Agent Runtime](/ai/agent) | What the agent may read and change |
| [Headless Runs](/ai/headless) | `buddy run`, with schema-validated output |

## Configuration

| Page | What it covers |
| --- | --- |
| [Configuration Guide](/guide/configuration) | The options you actually reach for |
| [Configuration Reference](/config) | Every option, with defaults and types |
| [PR Generation](/guide/pr-generation) | Titles, bodies, labels and reviewers |

## Reference

The behaviour behind each feature, once you have decided you want it.

| Page | What it covers |
| --- | --- |
| [Dependency Scanning](/features/scanning) | How manifests are found and read |
| [Update Strategies](/features/update-strategies) | `major`, `minor`, `patch`, `all`, and package rules |
| [Package Management](/features/package-management) | Ignores, pins and grouping |
| [Dependency Files](/features/dependency-files) | Every manifest format Buddy understands |
| [Pull Request Generation](/features/pull-requests) | What lands in the PR body |
| [Release Notes](/features/release-notes) | Where changelogs come from, and reference sanitizing |
| [Labeling & Assignment](/features/labeling-assignment) | Labels, reviewers, assignees |
| [Auto-Merge](/features/auto-merge) | Strategies and conditions |
| [Rebase](/features/rebase) | The checkbox, and what it refreshes |
| [Dependency Dashboard](/features/dependency-dashboard) | The single-issue overview |
| [GitHub Actions](/features/github-actions) | Keeping workflow files current |

## Advanced

| Page | What it covers |
| --- | --- |
| [Ecosystems](/advanced/ecosystems) | All eleven, and what each one supports |
| [Monorepos](/advanced/monorepo) | Every manifest at every depth, with no setting |
| [Git Providers](/advanced/providers) | GitHub, and what provider support means |
| [Scheduling](/advanced/scheduling) | Cron, presets and what runs when |

### Migrating

| Page | What it covers |
| --- | --- |
| [Overview](/advanced/migration) | What carries across, and what does not |
| [From Renovate](/advanced/migration/renovate) | Reading an existing `renovate.json` |
| [From Dependabot](/advanced/migration/dependabot) | Reading `dependabot.yml` |

## API

For driving Buddy from your own code rather than the CLI.

| Page | What it covers |
| --- | --- |
| [Buddy Class](/api/buddy) | Scanning, updating and dashboards, programmatically |
| [Configuration Types](/api/configuration) | `BuddyConfig` and the validation helpers |

## Elsewhere

- [Features](/features/) — what each capability does, before you configure it
- [Use Cases](/use-cases/) — the same product, arranged by the problem you have
- [Comparisons](/compare/) — how Buddy differs from the tool you are on now

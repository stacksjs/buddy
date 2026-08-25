# Configuration Types

TypeScript interfaces and types for buddy configuration.

Everything on this page comes from `BuddyConfig` in `src/types.ts` and
`PackageRule` in `src/rules/engine.ts`. A config file — `buddy.config.ts`,
`buddy.config.js` or `buddy.config.json` — is merged over the packaged
defaults and validated before any network or git work happens.

## Core Configuration

### `BuddyConfig`

Every key is optional, and every section is inert until you set it.

```typescript
interface BuddyConfig {
  verbose?: boolean
  logLevel?: LogLevel
  repository?: RepositorySettings
  registries?: RegistrySettings
  security?: SecuritySettings
  schedule?: ScheduleSettings
  packages?: PackageSettings
  gates?: GateSettings
  issues?: IssueSettings
  reports?: ReportSettings
  analysis?: AnalysisSettings
  ai?: AiSettings
  notifications?: NotificationSettings
  maxPRsPerRun?: number
  pullRequest?: PullRequestSettings
  releaseNotes?: ReleaseNotesSettings
  workflows?: WorkflowSettings
  dashboard?: DashboardSettings
}

type BuddyOptions = Partial<BuddyConfig>
```

The nested type names above are for reading convenience; in source they are
inline object types on `BuddyConfig`. Each is described below, in declaration
order.

## Logging

```typescript
interface BuddyConfig {
  /** Enable verbose logging. Equivalent to `logLevel: 'debug'`. */
  verbose?: boolean

  /** How much output to emit. Overrides `verbose` when both are set. */
  logLevel?: LogLevel
}

type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'
```

Use `'silent'` when embedding buddy in another tool that owns its own output.
`logLevel` can also be set with the `BUDDY_LOG_LEVEL` environment variable.
The packaged defaults set `verbose: true`.

## Repository

```typescript
interface RepositorySettings {
  /** Git provider */
  provider: GitProviderName

  /** Repository owner/organization */
  owner: string

  /** Repository name */
  name: string

  /** Base branch for PRs */
  baseBranch?: string

  /** Access token for API operations */
  token?: string

  /** REST API base URL */
  apiUrl?: string

  /** Web base URL used for links in PR bodies and the dashboard */
  serverUrl?: string
}
```

Only `github` is implemented. `gitlab` and `bitbucket` type-check but are
rejected at validation with a link to the issue tracking them, so a config
typo cannot reach a workflow run.

`apiUrl` defaults to `GITHUB_API_URL` when set — GitHub Actions exports it on
both github.com and Enterprise Server runners — otherwise
`https://api.github.com`. Set it explicitly for GitHub Enterprise Server, for
example `https://github.acme.com/api/v3`. `serverUrl` defaults to
`GITHUB_SERVER_URL`, otherwise `https://github.com`.

## Registries

Package registry endpoints, for private or self-hosted mirrors.

```typescript
interface RegistrySettings {
  /** npm registry base URL (default: `.npmrc` `registry=`, else registry.npmjs.org) */
  npm?: string

  /** Per-scope npm registry overrides, keyed by scope including the `@` */
  npmScopes?: Record<string, string>

  /** Composer/Packagist base URL (default: packagist.org) */
  composer?: string

  /** Per-host container registry credentials, keyed by host */
  docker?: Record<string, {
    username?: string
    /** Environment variable holding the password */
    passwordEnv?: string
    /** Environment variable holding a pre-issued bearer token */
    tokenEnv?: string
  }>
}
```

Docker secrets are referenced by environment variable name, never inlined, so
a registry can be committed to the repository without committing the
credential that reaches it. `ghcr.io` falls back to `GITHUB_TOKEN`
automatically, so private GHCR images work in Actions with no config.

## Security

```typescript
interface SecuritySettings {
  /** Query the OSV.dev advisory database (default: true) */
  enabled?: boolean

  /** Move advisory-resolving updates to the front of the queue (default: true) */
  prioritize?: boolean

  /** Label name associated with advisory-resolving PRs (default: `security`) */
  label?: string

  /** Minimum severity to act on (default: `low`, i.e. everything) */
  minimumSeverity?: VulnerabilitySeverity
}

type VulnerabilitySeverity = 'low' | 'moderate' | 'high' | 'critical'
```

Disable `enabled` for fully offline runs. `prioritize` is what lets a security
update survive the `maxPRsPerRun` cap. `label` is the label name that
auto-merge's `security-only` condition looks for on a pull request.

## Schedule

```typescript
interface ScheduleSettings {
  /** Cron expression for scheduled runs */
  cron?: string

  /** Time zone for scheduling */
  timezone?: string
}
```

Per-update scheduling windows live on `packages.rules[].schedule`, not here.

## Packages

```typescript
interface PackageSettings {
  /** Update strategy for dependencies */
  strategy: 'major' | 'minor' | 'patch' | 'all'

  /** Packages to ignore */
  ignore?: string[]

  /** File/directory paths to ignore using glob patterns */
  ignorePaths?: string[]

  /** Packages to pin to specific versions */
  pin?: Record<string, string>

  /** Group related packages together */
  groups?: PackageGroup[]

  /** Include prerelease versions (alpha, beta, rc, etc.) */
  includePrerelease?: boolean

  /** Exclude major version updates (even if strategy allows them) */
  excludeMajor?: boolean

  /** Respect "latest" and "*" version indicators (default: true) */
  respectLatest?: boolean

  /** Minimum age in minutes a version must have before installation (default: 0) */
  minimumReleaseAge?: number

  /** Package names exempt from the minimum release age */
  minimumReleaseAgeExclude?: string[]

  /** Conditional rules applied to matching updates */
  rules?: PackageRule[]

  /** Report updates held back by a range declared elsewhere (default: true) */
  detectResolutionDrift?: boolean
}
```

A strategy names the greatest semver impact a run may propose, and admits
everything gentler beneath it:

| `strategy` | Admits |
|---|---|
| `all` | major, minor and patch |
| `major` | major only |
| `minor` | minor and patch |
| `patch` | patch only |

`rules` are evaluated in order and later matches override earlier ones per
field, so a broad rule can set a default and a narrow one refine it.

`detectResolutionDrift` surfaces packages held below their latest version by a
range declared elsewhere in the dependency tree. These cannot be fixed by
updating this repository — somebody has to widen a range in the dependant — so
they are reported on the dashboard rather than turned into pull requests.

### `PackageGroup`

```typescript
interface PackageGroup {
  /** Group name */
  name: string

  /** Package patterns to include */
  patterns: string[]

  /** Update strategy for this group */
  strategy?: 'major' | 'minor' | 'patch' | 'all'
}
```

A group has exactly these three fields, and only decides batching — which
packages share a pull request. Anything conditional belongs in
`packages.rules`.

## Gates

Pre-merge gates and post-merge actions.

```typescript
interface GateSettings {
  /** Require a conventional-commit pull request title */
  titleFormat?: 'off' | 'warning' | 'error'

  /** Require a description, optionally with named sections */
  description?: {
    mode: 'off' | 'warning' | 'error'
    requireSections?: string[]
  }

  /** Block dependencies by licence, advisory or deprecation */
  dependencyGate?: {
    mode: 'off' | 'warning' | 'error'
    licenseAllowlist?: string[]
    blockVulnerable?: boolean
    blockDeprecated?: boolean
    /** Block base images whose release cycle no longer gets security fixes */
    blockEol?: boolean
  }

  /** Check that a change addresses the issue it says it closes */
  linkedIssue?: 'off' | 'warning' | 'error'

  /** Repository-specific natural-language assertions */
  custom?: Array<{
    name: string
    assertion: string
    mode?: 'off' | 'warning' | 'error'
  }>

  /** What to do once a pull request merges */
  postMerge?: {
    changelog?: { enabled?: boolean, path?: string }
    commentOnIssues?: boolean
    refreshDashboard?: boolean
  }
}
```

The deterministic gates need no AI. The assertion gates — `linkedIssue` and
`custom` — degrade to a neutral result rather than a pass when no provider is
configured, so a check that could not run never reads as one that succeeded.

## Issues

```typescript
interface IssueSettings {
  /** Post the quick-links comment on new issues (default: false) */
  quickLinks?: boolean

  /** Include dependency context when the issue names a known package */
  dependencyContext?: boolean
}
```

Both actions are opt-in checkboxes on the posted comment: an issue is a
request for a conversation as often as for code, and a bot that opens a pull
request against every new issue is one a maintainer turns off in a week.

## Reports

Scheduled dependency-health and activity reports.

```typescript
interface ReportSettings {
  /** Generate reports (default: false) */
  enabled?: boolean

  /** Cron expression for the scheduled run */
  schedule?: string

  /** Reporting window (default: `30d`) */
  period?: '7d' | '30d' | '90d'

  /** What the AI narrative should emphasise */
  prompt?: string

  /** Title of the report issue (default: `Dependency Report`) */
  title?: string

  /** Labels applied to the report issue */
  labels?: string[]
}
```

The report is computed from scan results and pull request history, so it works
with no AI provider. A configured provider adds a narrative around the
numbers; it never produces them.

## Analysis

```typescript
interface AnalysisSettings {
  /** Turn all analyzers off (default: true, they are cheap and local) */
  enabled?: boolean

  /** Per-analyzer switches, keyed by name. Absent means enabled. */
  tools?: Record<string, boolean>
}
```

Recognised tool names are `secrets`, `github-actions`, `syntax`, `linter`,
`actionlint`, `shellcheck`, `hadolint` and `markdownlint`. Analyzers run
whether or not an AI provider is configured, so a repository with no key still
gets secret scanning, workflow auditing and whatever external linters the
runner has installed.

## AI

```typescript
interface AiSettings {
  /** Turn all AI features off even when a key is present */
  enabled?: boolean

  /** Which provider to use */
  provider?: 'anthropic' | 'openai' | 'google' | 'openrouter' | 'openai-compatible'

  /** Model alias or concrete ID */
  model?: string

  /** Reasoning depth to request (default: provider default) */
  effort?: 'low' | 'medium' | 'high'

  /** Environment variable holding the API key, when not the provider default */
  apiKeyEnv?: string

  /** Base URL override, for gateways and OpenAI-compatible endpoints */
  baseUrl?: string

  /** Hard ceiling on output tokens generated per run */
  maxTokensPerRun?: number

  majorUpgrades?: MajorUpgradeSettings
  review?: ReviewSettings
}
```

Every AI-powered feature is off unless a provider key is available, and
degrades to a no-op rather than failing the run — the dependency bot works
exactly as before with no AI configured.

With `provider` omitted, the first provider with an available API key is
chosen, in the order anthropic, openai, google, openrouter. Model aliases
(`opus`, `sonnet`, `haiku`) resolve to current Anthropic models; every other
provider needs a concrete ID. `BUDDY_MODEL` overrides `model` per run. Once
`maxTokensPerRun` is reached, further requests fail rather than spending more.

### `ai.majorUpgrades`

```typescript
interface MajorUpgradeSettings {
  /** Analyse major updates (default: false — opt in, it costs tokens) */
  enabled?: boolean

  /** Attempt the migration rather than only analysing it (default: false) */
  autoMigrate?: boolean

  /** Open as a draft below this confidence (default: `high`) */
  draftBelowConfidence?: 'high' | 'medium'

  /** Maximum agent attempts per upgrade */
  maxAttempts?: number

  /** Globs limiting which packages are analysed; empty means all majors */
  packages?: string[]
}
```

`autoMigrate` defaults off because a wrong migration is far more expensive
than a missing one.

### `ai.review`

```typescript
interface ReviewSettings {
  /** Enable AI review (default: false until you opt in) */
  enabled?: boolean

  /** How thorough to be */
  profile?: 'chill' | 'assertive'

  /** Review draft pull requests too (default: false) */
  drafts?: boolean

  /** Review automatically on open and push (default: true when enabled) */
  autoReview?: boolean

  /** Skip pull requests whose title contains any of these, e.g. `wip` */
  ignoreTitleKeywords?: string[]

  /** Skip pull requests opened by these users */
  ignoreUsernames?: string[]

  /** Request changes at this severity, or never (default: never) */
  requestChangesOn?: 'never' | 'critical'

  /** Post only the summary and walkthrough, no inline findings */
  summaryOnly?: boolean

  /** Gitignore-style path filters; `!` excludes */
  pathFilters?: string[]

  /** Guidance applied when reviewing files matching a glob */
  pathInstructions?: Array<{ path: string, instructions: string }>

  /** Convention files read from the base branch, or `false` to disable */
  guidelineFiles?: string[] | false

  /** Global guidance prepended to every review */
  instructions?: string
}
```

`chill` reports only confident defects; `assertive` also reports
lower-confidence findings, marked so they can be filtered downstream.
`pathFilters` apply on top of the built-in exclusions for lock files and build
output. `guidelineFiles` defaults to the usual convention files — CLAUDE.md,
AGENTS.md, .cursorrules and similar — and a list overrides those defaults.

## Notifications

```typescript
interface NotificationSettings {
  slack?: { webhookEnv?: string, events?: string[] }
  discord?: { webhookEnv?: string, events?: string[] }

  /** Signed JSON POSTs to your own endpoints */
  webhooks?: Array<{ url: string, secretEnv?: string, events?: string[] }>
}
```

Credentials are referenced by environment variable name, never inlined, so a
destination can be committed without committing its credential.

## Pull Requests

```typescript
interface BuddyConfig {
  /** Maximum number of PRs to create per workflow run (default: 10) */
  maxPRsPerRun?: number

  pullRequest?: PullRequestSettings
}

interface PullRequestSettings {
  /** Commit message format */
  commitMessageFormat?: string

  /** PR title format */
  titleFormat?: string

  /** PR body template */
  bodyTemplate?: string

  /** Auto-merge settings */
  autoMerge?: {
    enabled: boolean
    strategy: 'merge' | 'squash' | 'rebase'
    conditions?: string[]
    requireGreenCI?: boolean
    optOutLabel?: string
  }

  /** Reviewers to assign */
  reviewers?: string[]

  /** GitHub teams to request review from, by team slug */
  teamReviewers?: string[]

  /** Assignees to assign */
  assignees?: string[]

  /** Labels to add */
  labels?: string[]
}
```

`reviewers`, `assignees` and `labels` are plain string arrays. `teamReviewers`
takes team slugs without the organisation prefix. Reviewers and assignees
configured here are unioned with whatever the matching `packages.rules`
contributed for the updates in the pull request.

The labels a generated pull request carries are derived from its update types
and the ecosystems it touches — `dependencies`, `major`/`minor`/`patch`,
`npm`, `composer`, `zig`, `system`, `github-actions`, plus the package name
itself on a single-package PR — unioned with the `labels` effect of any
matching `packages.rules`. Per-update labelling therefore belongs in
`packages.rules[].labels`.

### `pullRequest.autoMerge`

`conditions` accepts `patch-only`, `minor-only`, `security-only` and `all`. A
pull request qualifies when any listed condition accepts it. An empty or
missing list means nothing auto-merges — the safe reading of a half-written
config. Update types are read from the metadata manifest embedded in the PR
body, not from its title, and a PR whose manifest is missing or truncated is
never eligible.

`requireGreenCI` defaults to `true` and is only meaningful on repositories
without branch protection, where buddy merges directly instead of handing the
pull request to GitHub's own auto-merge queue. `optOutLabel` defaults to
`no-auto-merge`; a pull request carrying it never merges unattended.

## Release Notes

```typescript
interface ReleaseNotesSettings {
  /** Enable release notes in PRs (default: true) */
  enabled?: boolean

  /** Sanitize GitHub references (#123, issue/PR URLs) to prevent spam notifications (default: true) */
  sanitizeReferences?: boolean

  /** Maximum number of releases to show per package (default: 3) */
  maxReleases?: number

  /** Maximum character length per release body (default: 1000) */
  maxBodyLength?: number

  /** Include compare links between versions (default: true) */
  includeCompareLinks?: boolean
}
```

## Workflows

```typescript
interface WorkflowSettings {
  /** Enable workflow generation */
  enabled?: boolean

  /** Output directory for workflows (default: `.github/workflows`) */
  outputDir?: string

  /** Workflow templates to generate */
  templates?: {
    comprehensive?: boolean
    daily?: boolean
    weekly?: boolean
    monthly?: boolean
    docker?: boolean
    monorepo?: boolean
  }

  /** Custom workflow configurations */
  custom?: Array<{
    name: string
    schedule: string
    strategy?: 'major' | 'minor' | 'patch' | 'all'
    autoMerge?: boolean
    reviewers?: string[]
    assignees?: string[]
    labels?: string[]
  }>
}
```

## Dashboard

```typescript
interface DashboardSettings {
  /** Enable dependency dashboard */
  enabled?: boolean

  /** Dashboard title (default: `Dependency Dashboard`) */
  title?: string

  /** Dashboard body template */
  bodyTemplate?: string

  /** Labels to add to dashboard issue */
  labels?: string[]

  /** Assignees to assign to dashboard issue */
  assignees?: string[]

  /** Include package.json dependencies */
  includePackageJson?: boolean

  /** Include dependency files (deps.yaml, etc.) */
  includeDependencyFiles?: boolean

  /** Include GitHub Actions */
  includeGitHubActions?: boolean

  /** Show open PRs section */
  showOpenPRs?: boolean

  /** Show detected dependencies section */
  showDetectedDependencies?: boolean

  /** Show deprecated dependencies section */
  showDeprecatedDependencies?: boolean

  /** Issue number to update (if it exists) */
  issueNumber?: number

  /** Pin the dashboard issue to the top of the issue list (default: false) */
  pin?: boolean
}
```

GitHub allows at most three pinned issues per repository; when that limit is
already reached the dashboard is still created, just unpinned.

## Package Rules

### `PackageRule`

The main extension point. Rules live on `packages.rules` and are the place for
everything that varies per update.

```typescript
interface PackageRule {
  // Matchers — all present matchers must match (AND within a rule)
  /** Package names or globs */
  matchPackages?: string[]
  matchEcosystems?: RuleEcosystem[]
  matchDepTypes?: string[]
  matchUpdateTypes?: Array<'major' | 'minor' | 'patch'>
  /** Globs on the manifest path, for monorepo directories */
  matchFiles?: string[]
  /** Semver range the currently installed version must satisfy */
  matchCurrentVersion?: string
  /** Cron expression describing when these updates may be proposed */
  schedule?: string
  /** IANA time zone `schedule` is written in (default: the runner's) */
  scheduleTimezone?: string

  // Effects
  /** `false` drops matching updates entirely */
  enabled?: boolean
  strategy?: 'major' | 'minor' | 'patch' | 'all'
  groupName?: string
  labels?: string[]
  reviewers?: string[]
  assignees?: string[]
  autoMerge?: boolean
  /** Minutes a version must have been published, overriding the global */
  minimumReleaseAge?: number
  /** Ordering within the per-run PR cap; higher goes first */
  prPriority?: number
  /** Attempt the migration for matching majors, overriding the global */
  autoMigrate?: boolean
}

type RuleEcosystem =
  | 'npm' | 'composer' | 'github-actions' | 'docker' | 'pkgx'
  | 'zig' | 'python' | 'rust' | 'go' | 'ruby'
```

Matchers combine with AND, so a rule with several matchers is a conjunction. A
rule with no matchers at all matches everything, which is why validation rejects
it and asks for an explicit matcher rather than accepting silence. Write the
deliberate catch-all as `matchPackages: ['**']`: a glob `*` stops at `/`, so it
matches `react` but not `@types/node`.

`matchCurrentVersion` lets a rule target a version series rather than a
package — holding back everything still on `<2.0.0` while letting the rest
through. Declared versions are stripped to their concrete floor first, so
`^1.2.3` is tested as `1.2.3`.

`schedule` describes a window, not a firing minute: `0 0 * * 6,0` holds
updates back on a weekday run and releases them on a weekend one.

### How effects combine

`labels`, `reviewers` and `assignees` accumulate across every matching rule.
A package matching both a "security" and a "frontend" rule carries both sets,
rather than whichever rule happened to be last.

```typescript
rules: [
  { matchUpdateTypes: ['patch'], labels: ['patch-update'] },
  { matchPackages: ['react*'], labels: ['frontend'], reviewers: ['ui-team'] },
]
// A patch update to react-dom carries both labels and the ui-team reviewer.
```

Every other effect — `enabled`, `strategy`, `groupName`, `autoMerge`,
`minimumReleaseAge`, `prPriority`, `autoMigrate` — is a per-field override,
and the last matching rule wins.

When several updates share one pull request, their resolved effects are merged
for the group: labels, reviewers and assignees union; `prPriority` takes the
maximum; `autoMerge` requires every update to have opted in, because one
package that must not merge unattended has to hold back the whole PR;
`autoMigrate` needs only one, because migrating what can be migrated leaves
the rest unchanged.

## Configuration Validation

```typescript
import { assertValidConfig, formatConfigIssues, validateConfig } from '@buddysh/buddy'

/** Every problem found; an empty array means the config is valid. */
function validateConfig(config: BuddyConfig): ConfigIssue[]

/** Render issues as one human-readable block, one per line. */
function formatConfigIssues(issues: readonly ConfigIssue[]): string

/** Validate and throw a ConfigurationError listing every issue. */
function assertValidConfig(config: BuddyConfig): void

interface ConfigIssue {
  /** Dotted path to the offending key, e.g. `packages.groups[0].patterns` */
  path: string

  /** What is wrong and what was expected */
  message: string
}
```

```typescript
const issues = validateConfig(config)
if (issues.length > 0)
  console.error(formatConfigIssues(issues))
```

`getConfig()` calls `assertValidConfig` for you, before any network or git
work happens. A malformed strategy or a group with no patterns otherwise
produces a run that silently does the wrong thing and reports success.

## Example Configurations

### Basic Configuration

```typescript
import type { BuddyConfig } from '@buddysh/buddy'

const config: BuddyConfig = {
  repository: {
    provider: 'github',
    owner: 'myorg',
    name: 'myproject',
    token: process.env.GITHUB_TOKEN,
  },
  packages: {
    strategy: 'minor',
    ignore: ['react'],
  },
  pullRequest: {
    reviewers: ['team-lead'],
  },
}

export default config
```

### Advanced Configuration

```typescript
import type { BuddyConfig } from '@buddysh/buddy'

const config: BuddyConfig = {
  maxPRsPerRun: 5,

  packages: {
    strategy: 'minor',
    ignorePaths: ['examples/**', 'packages/test-*/**'],

    // Groups decide which packages share a pull request.
    groups: [
      {
        name: 'React Ecosystem',
        patterns: ['react', 'react-dom', '@types/react'],
        strategy: 'patch',
      },
    ],

    // Rules decide everything that varies per update: labels, reviewers,
    // auto-merge, release age, ordering and scheduling windows.
    rules: [
      {
        matchPackages: ['react', 'react-dom'],
        reviewers: ['frontend-team'],
        autoMerge: false,
      },
      {
        matchUpdateTypes: ['patch'],
        labels: ['patch-update'],
        prPriority: 10,
      },
      {
        matchUpdateTypes: ['major'],
        labels: ['major-update'],
        schedule: '0 0 * * 6,0', // weekends only
        prPriority: -10,
      },
    ],
  },

  pullRequest: {
    reviewers: ['maintainer'],
    autoMerge: {
      enabled: true,
      strategy: 'squash',
      conditions: ['patch-only'],
      requireGreenCI: true,
    },
  },

  schedule: {
    cron: '0 2 * * *',
    timezone: 'UTC',
  },
}

export default config
```

See [Configuration Guide](/config) for detailed configuration examples and
best practices, and [scheduling](/advanced/scheduling) for the full matcher
and effect tables.

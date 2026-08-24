# Scheduling

Buddy has no daemon of its own. Something outside it decides when to run —
almost always a GitHub Actions `schedule:` trigger — and Buddy decides what is
allowed to be proposed on that run.

That split is worth holding onto, because it explains where each setting
lives: cron expressions in a workflow control *when Buddy wakes up*, and cron
expressions in the config control *which updates a waking run may open*.

## Scheduling the run

`buddy setup` generates workflows with a schedule already in them. To change
it, edit the workflow's `cron`:

```yaml
name: Buddy
on:
  schedule:
    - cron: '0 */6 * * *'   # every six hours
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: oven-sh/setup-bun@v2
      - run: bunx @buddysh/buddy update --verbose
        env:
          BUDDY_TOKEN: ${{ secrets.BUDDY_TOKEN }}
```

GitHub runs scheduled workflows in UTC and does not guarantee the minute — a
busy period can delay a run — so treat the cron as "about this often" rather
than "exactly then".

The presets `buddy setup` offers differ mostly in this cron:

| Preset | Cadence |
| --- | --- |
| Standard | Dashboard three times a week, updates daily |
| High frequency | Several times a day |
| Security | Every few hours, patches prioritised |
| Minimal | Weekly |
| Development / testing | Every few minutes, dry-run by default |

## Holding updates back until a window

A run that fires does not have to propose everything it finds. A package rule
with a `schedule` releases its matching updates only when the run happens
inside that window:

```typescript
import type { BuddyConfig } from '@buddysh/buddy'

export default {
  packages: {
    strategy: 'all',
    rules: [
      {
        // Majors only on the weekend, when nobody is shipping.
        matchUpdateTypes: ['major'],
        schedule: '0 0 * * 6,0',
        scheduleTimezone: 'Europe/Berlin',
      },
      {
        // Framework upgrades wait a week after publication.
        matchPackages: ['react', 'react-dom', 'next'],
        minimumReleaseAge: 10080,
      },
    ],
  },
} satisfies BuddyConfig
```

The cron here describes a **window, not a firing minute**. `0 0 * * 6,0` means
"Saturdays and Sundays": a run on Wednesday holds those updates back, a run on
Saturday lets them through. `scheduleTimezone` is an IANA name and defaults to
the runner's zone, which on GitHub is UTC.

## Package rules

`schedule` is one effect among several. A rule matches on any combination of:

| Matcher | Matches |
| --- | --- |
| `matchPackages` | Package names or globs |
| `matchEcosystems` | `npm`, `composer`, `docker`, `github-actions`, … |
| `matchDepTypes` | `dependencies`, `devDependencies`, … |
| `matchUpdateTypes` | `major`, `minor`, `patch` |
| `matchFiles` | Globs on the manifest path, for monorepo directories |
| `matchCurrentVersion` | A semver range the installed version must satisfy |

All matchers present on a rule must match. The effects it can then apply:

| Effect | Does |
| --- | --- |
| `enabled: false` | Drops matching updates entirely |
| `strategy` | Overrides the global update strategy |
| `groupName` | Collects matches into a named pull request |
| `labels`, `reviewers`, `assignees` | Applied to that pull request |
| `autoMerge` | Overrides the global auto-merge decision |
| `minimumReleaseAge` | Minutes a version must have been published |
| `prPriority` | Ordering within the per-run pull request cap |
| `autoMigrate` | Attempt the AI migration for matching majors |
| `schedule`, `scheduleTimezone` | The window described above |

A worked example:

```typescript
export default {
  packages: {
    strategy: 'all',
    rules: [
      {
        // Type packages are safe and boring: batch and merge them.
        matchPackages: ['@types/*'],
        groupName: 'TypeScript Types',
        autoMerge: true,
        labels: ['dependencies', 'types'],
      },
      {
        // Anything still on 0.x gets a human.
        matchCurrentVersion: '<1.0.0',
        autoMerge: false,
        reviewers: ['tech-lead'],
      },
      {
        // Freeze a legacy app's manifests without ignoring the packages
        // everywhere else in the monorepo.
        matchFiles: ['apps/legacy/**'],
        enabled: false,
      },
    ],
  },
} satisfies BuddyConfig
```

## Global cadence hints

The top-level `schedule` block records the cadence the project intends. It has
exactly two fields:

```typescript
export default {
  schedule: {
    cron: '0 2 * * *',
    timezone: 'America/Los_Angeles',
  },
} satisfies BuddyConfig
```

This does not make Buddy run on its own — the workflow trigger does that. It
is what `buddy schedule` reads when running Buddy as a long-lived process:

```bash
buddy schedule --strategy patch --verbose
```

That command keeps the process alive and fires the update job on the
configured cron, which is useful on a box you control and unnecessary in CI.

## Limiting how much lands at once

A frequent schedule and a large dependency tree can produce more pull requests
than anyone will review. `maxPRsPerRun` caps them, and `prPriority` decides
which ones make the cut:

```typescript
export default {
  maxPRsPerRun: 3,
  packages: {
    rules: [
      { matchUpdateTypes: ['patch'], prPriority: 10 },
      { matchUpdateTypes: ['major'], prPriority: -10 },
    ],
  },
} satisfies BuddyConfig
```

Updates that do not fit are not lost; they are proposed on the next run, and
they remain listed on the [dependency dashboard](/features/dependency-dashboard)
in the meantime.

## Security updates

Advisories from [OSV.dev](https://osv.dev) are matched against what you
actually depend on. With `prioritize`, those updates are proposed ahead of
routine ones and carry their own label, so a security fix is not queued behind
a batch of patch bumps:

```typescript
export default {
  security: {
    enabled: true,
    prioritize: true,
    label: 'security',
    minimumSeverity: 'moderate',
  },
} satisfies BuddyConfig
```

Note that `minimumReleaseAge` still applies to security updates — the age gate
is not bypassed for them. If you run a long cooling-off period and want fixes
for specific packages to move immediately, exempt them by name:

```typescript
export default {
  packages: {
    minimumReleaseAge: 4320, // three days
    minimumReleaseAgeExclude: ['openssl', '@types/node'],
  },
} satisfies BuddyConfig
```

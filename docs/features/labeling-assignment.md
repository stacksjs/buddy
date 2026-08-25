# Labeling & Assignment

Every pull request Buddy opens arrives already labelled, and — when you ask for
it — already carrying the reviewers and assignees the change deserves. Labels
come from two places: a set Buddy derives from the update itself, and whatever
your `packages.rules` attach to the packages that matched. Reviewers and
assignees come from your repository-wide `pullRequest` settings, unioned with
the same rules.

## Automatic Labels

Buddy derives these from the group it is about to open a PR for. They need no
configuration and are always present.

| Label | Applied when |
|---|---|
| `dependencies` | Always |
| `major` / `minor` / `patch` | The greatest semver impact in the PR |
| `npm` | The PR touches a `package.json` |
| `composer` | It touches `composer.json` or `composer.lock` |
| `zig` | It touches `build.zig.zon` |
| `system` | It touches a `deps.yaml`-style dependency file |
| `github-actions` | It touches a workflow under `.github/workflows/` |
| *the package name* | The PR updates exactly one package |

A PR bumping `react` on its own therefore opens with `dependencies`, `minor`,
`npm` and `react` before any rule of yours is consulted.

Labels that do not exist on the repository are retried one at a time and skipped
with a warning rather than failing the pull request, so a typo'd label costs you
a label, not a PR.

## Per-Package Labels, Reviewers and Assignees

`packages.rules` is where targeting happens. A rule matches on any combination of
package name, ecosystem, dependency type, update type, file path, installed
version and schedule, and attaches `labels`, `reviewers` and `assignees` to
whatever it matched.

```typescript
// buddy.config.ts
import type { BuddyConfig } from '@buddysh/buddy'

const config: BuddyConfig = {
  packages: {
    strategy: 'all',
    rules: [
      {
        matchEcosystems: ['npm'],
        labels: ['javascript'],
        reviewers: ['platform-team'],
      },
      {
        matchPackages: ['react', 'react-dom', '@types/react*'],
        labels: ['frontend'],
        reviewers: ['ui-lead'],
        assignees: ['ui-lead'],
      },
    ],
  },
}

export default config
```

### Effects Accumulate

This is the part worth understanding, because it is what makes narrow rules safe
to add: **list effects union, they do not override.**

A `react` bump in `package.json` matches *both* rules above. It does not take the
last one and discard the first — it carries everything both rules asked for:

| | Rule 1 (`npm`) | Rule 2 (`react*`) | Resolved |
|---|---|---|---|
| Labels | `javascript` | `frontend` | `javascript`, `frontend` |
| Reviewers | `platform-team` | `ui-lead` | `platform-team`, `ui-lead` |
| Assignees | — | `ui-lead` | `ui-lead` |

Combined with the automatic labels, the pull request opens carrying
`dependencies`, `minor`, `npm`, `react`, `javascript` and `frontend`, assigned to
`ui-lead`, with review requested from `platform-team` and `ui-lead`. Duplicates
are collapsed, so a name listed by three rules is requested once.

The non-list effects behave the opposite way. `enabled`, `strategy`,
`groupName`, `autoMerge`, `minimumReleaseAge`, `prPriority` and `autoMigrate`
are single values, so a later matching rule overrides an earlier one per field —
which is what lets a broad rule set a default and a narrow one refine it.

### Matchers

All matchers present on one rule must match (AND within a rule). Add rules for
OR.

| Matcher | Matches on |
|---|---|
| `matchPackages` | Package names or globs (`@types/*`) |
| `matchEcosystems` | `npm`, `composer`, `github-actions`, `docker`, `pkgx`, `zig`, `python`, `rust`, `go`, `ruby` |
| `matchDepTypes` | `dependencies`, `devDependencies`, `peerDependencies`, … |
| `matchUpdateTypes` | `major`, `minor`, `patch` |
| `matchFiles` | Globs on the manifest path, for monorepo directories |
| `matchCurrentVersion` | Semver range the *installed* version must satisfy |
| `schedule` | Cron window during which the rule applies |

A rule with no matchers at all applies to everything, and configuration
validation rejects it on the grounds that it is more often a misspelled matcher
than an intention — a typo does not disable a rule, it widens it.

Glob `*` stops at `/`, so it does not match a scoped package: use `**` for
"every package", or `@scope/*` for one scope.

```typescript
rules: [
  // Repository-wide labels, applied to every update
  { matchPackages: ['**'], labels: ['dependencies-bot'] },

  // Per-workspace ownership in a monorepo
  { matchFiles: ['packages/api/**'], reviewers: ['backend-team'] },
  { matchFiles: ['packages/web/**'], reviewers: ['frontend-team'] },

  // Type definitions go to whoever maintains the types
  { matchPackages: ['@types/*'], labels: ['types'], assignees: ['types-owner'] },

  // Majors get a second pair of eyes, whatever else matched
  { matchUpdateTypes: ['major'], labels: ['breaking-risk'], reviewers: ['tech-lead'] },
]
```

### Grouped Updates

When several updates travel in one PR, their resolved effects merge the same
way: labels, reviewers and assignees union across every update in the group. A
group containing one `@types/*` bump and one `react` bump carries the labels and
people from both rules, because the PR genuinely touches both.

`autoMerge` resolves conservatively across a group instead — every update must
allow it, so one package that must not merge unattended holds back the whole PR
containing it.

## Repository-Wide Reviewers and Assignees

Names that should be on every Buddy PR regardless of what changed belong in
`pullRequest`. All three are plain string arrays.

```typescript
export default {
  pullRequest: {
    reviewers: ['tech-lead'],
    teamReviewers: ['platform'],
    assignees: ['maintainer'],
  },
} satisfies BuddyConfig
```

| Option | Type | Description |
|---|---|---|
| `reviewers` | `string[]` | GitHub usernames to request review from |
| `teamReviewers` | `string[]` | GitHub team **slugs**, without the organisation prefix |
| `assignees` | `string[]` | GitHub usernames to assign |

`reviewers` and `assignees` are unioned with whatever the matching rules
contributed, so the two mechanisms compose rather than compete — the repository
default is a floor, not a ceiling. When neither the config nor a rule names
anybody, Buddy sends no reviewer request at all rather than an empty one, which
GitHub would read as a deliberate request for nobody.

Team reviewers are requested in the same API call as individual reviewers, so a
config listing `teamReviewers` and no `reviewers` never sends the request. Name
at least one individual reviewer alongside the team, or let a rule supply one.

How many approvals a merge actually requires is a GitHub branch-protection
setting, not a Buddy one. Buddy requests reviewers; the repository decides what
counts.

## Holding a PR Back With a Label

One label has behaviour attached to it. `pullRequest.autoMerge.optOutLabel` —
`no-auto-merge` by default — suppresses auto-merge on any PR carrying it, checked
both at the moment Buddy opens the PR and again when `buddy update-check`
re-evaluates open ones.

```typescript
export default {
  pullRequest: {
    autoMerge: {
      enabled: true,
      strategy: 'squash',
      conditions: ['patch-only'],
      optOutLabel: 'needs-human',
    },
  },
} satisfies BuddyConfig
```

Because rule labels are resolved before the PR is opened, a rule can mark a
package as never-unattended and the PR arrives already held back:

```typescript
rules: [
  { matchPackages: ['@company/auth*'], labels: ['no-auto-merge'] },
]
```

Setting `enabled: false` or a narrower `strategy` on the rule is the stronger
form of the same intent: the update is never proposed at all rather than proposed
and held. See [Auto-Merge](/features/auto-merge) for what qualifies in the first
place.

## Labels Are Configuration, Not Commands

There is no CLI for managing labels or assignees. Buddy resolves them at the
moment it opens a pull request, so the way to change them is to change
`buddy.config.ts` and let the next run pick it up.

A rule you add now therefore shows up on the next PR for that group rather than
on one already open. When a later run finds an existing open Buddy PR for that
group it refreshes the PR in place, rewriting its labels to the automatically
derived set and its reviewers and assignees to the repository-wide
`pullRequest` names. A label added
by hand on an open PR is therefore not guaranteed to survive the next refresh,
and neither is one a rule contributed when the PR was opened. Close the PR and
let the next run open it again when you need the current rules applied from
scratch.

See [Package Rules](/config#package-rules) for the full effect list and
[Pull Request Generation](/features/pull-requests) for how labelling fits into
the rest of the PR workflow.

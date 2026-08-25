# PR Generation

Buddy creates beautifully formatted pull requests with comprehensive information about dependency updates.

## PR Structure

Each PR includes:

1. **Title** - Descriptive update summary
2. **Update Table** - All packages being updated
3. **Release Notes** - Changelogs and breaking changes
4. **Metadata** - Confidence metrics, age, adoption
5. **Rebase Checkbox** - Interactive update control
6. **Configuration Section** - Schedule and merge info

## PR Format by Ecosystem

### npm Dependencies

Full table with confidence badges:

```markdown
| Package | Change | Age | Adoption | Passing | Confidence |
|---------|--------|-----|----------|---------|------------|
| [typescript](https://www.typescriptlang.org/) | `^5.8.2` -> `^5.8.3` | ... | ... | ... | ... |
```

### PHP/Composer Dependencies

```markdown
| Package | Change | File | Status |
|---------|--------|------|--------|
| laravel/framework | ^10.0.0 -> ^10.16.0 | composer.json | Available |
```

### Zig Dependencies

```markdown
| Package | Change | Type | File |
|---------|--------|------|------|
| httpz | 0.5.0 -> 0.6.0 | minor | build.zig.zon |
```

### GitHub Actions

```markdown
| Action | Change | File | Status |
|--------|--------|------|--------|
| actions/checkout | v4 -> v4.2.2 | ci.yml | Available |
```

## Customizing PR Titles

Configure the title format:

```typescript
pullRequest: {
  titleFormat: 'chore(deps): {title}'
}
```

### Available Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{title}` | Generated title | "update typescript to 5.8.3" |
| `{group}` | Update group name | "Non-Major Updates" |
| `{packages}` | Comma-separated package names | "typescript, vitest" |
| `{count}` | Number of packages in the PR | "2" |
| `{update_type}` | Highest semver impact in the group | "patch" |
| `{strategy}` | Configured update strategy | "minor" |

Unknown tokens are left in place rather than blanked, so a typo shows up in the
title instead of silently disappearing.

### Examples

```typescript
// Conventional commits style
titleFormat: 'chore(deps): {title}'
// Result: "chore(deps): update typescript to 5.8.3"

// Group style
titleFormat: 'Update {group} ({count} packages)'
// Result: "Update Non-Major Updates (2 packages)"

// With update type
titleFormat: '[{update_type}] {title}'
// Result: "[patch] update typescript to 5.8.3"
```

## Customizing Commit Messages

```typescript
pullRequest: {
  commitMessageFormat: 'chore(deps): {message}'
}
```

## Labels

### Static Labels

Always applied to PRs:

```typescript
pullRequest: {
  labels: ['dependencies', 'automated']
}
```

### Dynamic Labels

Buddy automatically adds contextual labels:

| Label | Condition |
|-------|-----------|
| `dependencies` | Always applied |
| `major` | Major version change |
| `minor` | Minor version change |
| `patch` | Patch version change |
| `security` | Resolves a published advisory |
| `npm` | npm package update |
| `composer` | Composer package update |
| `zig` | Zig package update |
| `github-actions` | Workflow update |

## Reviewers and Assignees

```typescript
pullRequest: {
  // Request reviews from these users
  reviewers: ['lead-dev', 'security-team'],

  // Assign PR to these users
  assignees: ['maintainer']
}
```

## Package Grouping

Group related packages into single PRs:

```typescript
packages: {
  groups: [
    {
      name: 'TypeScript Types',
      patterns: ['@types/*'],
      strategy: 'minor'
    },
    {
      name: 'Testing',
      patterns: ['vitest', '@vitest/*', 'happy-dom'],
      strategy: 'patch'
    }
  ]
}
```

### Group PR Title

```
chore(deps): update TypeScript Types (@types/node, @types/react, @types/bun)
```

## Auto-Merge

Automatically merge PRs that meet criteria:

```typescript
pullRequest: {
  autoMerge: {
    enabled: true,
    strategy: 'squash',
    conditions: ['patch-only']
  }
}
```

### Merge Strategies

| Strategy | Description |
|----------|-------------|
| `squash` | Squash commits (clean history) |
| `merge` | Create merge commit |
| `rebase` | Rebase and merge (linear) |

### Auto-Merge Conditions

| Condition | Description |
|-----------|-------------|
| `patch-only` | Every update in the PR is a patch |
| `minor-only` | Every update is minor or patch |
| `security-only` | The PR resolves a security advisory |
| `all` | All updates (use cautiously) |

A PR qualifies when any listed condition accepts it. An empty or missing list
means nothing auto-merges.

## Rebase Feature

Every PR includes a rebase checkbox:

```markdown
---

 - [ ] <!-- rebase-check -->If you want to update/retry this PR, check this box

---
```

### How It Works

1. Check the box in the PR description
2. Editing the PR body triggers the `buddy.yml` workflow, which detects checked boxes
3. PR is automatically updated with latest versions
4. Checkbox is unchecked after successful update

### Manual Trigger

```bash
buddy update-check --verbose
```

## Release Notes

Buddy includes detailed release notes:

```markdown
### Release Notes

<details>
<summary>microsoft/TypeScript (typescript)</summary>

### [`v5.8.3`](https://github.com/microsoft/TypeScript/releases/tag/v5.8.3)

[Compare Source](https://github.com/microsoft/TypeScript/compare/v5.8.2...v5.8.3)

##### Bug Fixes

- Fix issue with module resolution
- Improve error messages

</details>
```

### Breaking Change Detection

Breaking changes are highlighted:

```markdown
### Breaking Changes

- TypeScript now requires Node.js 18+
- Deprecated API removed

```

## Confidence Metrics

PRs include Merge Confidence data:

| Metric | Description |
|--------|-------------|
| Age | How long the version has been available |
| Adoption | Percentage of users who upgraded |
| Passing | CI pass rate for this upgrade path |
| Confidence | Overall confidence score |

## PR Configuration Section

Each PR includes configuration info:

```markdown
### Configuration

Schedule: Branch creation - At any time, Automerge - At any time

Automerge: Disabled by config. Please merge manually.

Rebasing: Whenever PR is behind base branch.

Ignore: Close this PR to ignore this update.
```

## Dry Run

Preview PRs without creating them:

```bash
buddy update --dry-run
```

Output shows:

- Packages to be updated
- PR titles that would be created
- Files that would be modified

## Programmatic Usage

Create PRs programmatically:

```typescript
import { Buddy, getConfig } from '@buddysh/buddy'

const config = await getConfig()
const buddy = new Buddy(config)

// Scan for updates
const scanResult = await buddy.scanForUpdates()
console.log(`Found ${scanResult.updates.length} updates`)

// Create PRs
if (scanResult.updates.length > 0) {
  await buddy.createPullRequests(scanResult)
}
```

## Next Steps

- Review [Configuration](/guide/configuration) options
- See [Usage Examples](/usage) for advanced patterns

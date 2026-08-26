# Rebase Functionality

Buddy's rebase feature allows you to update existing pull requests with the latest dependency versions, ensuring your PRs stay current with the newest available updates.

## Overview

Similar to Renovate's rebase functionality, Buddy monitors pull requests for rebase requests and automatically updates them with fresh dependency scans. This is especially useful when:

- New versions are released after your PR was created
- You want to refresh a stale PR with latest updates
- Dependencies have been updated in the base branch
- You need to retry a failed update

## How It Works

### 1. Update / Rebase Checkbox

Every Buddy pull request includes an interactive checkbox:

```markdown
---

 - [ ] <!-- rebase-check -->If you want to update/retry this PR, check this box

---
```

### 2. Automatic Detection

Ticking the box edits the pull request body, and that edit is the trigger. The unified workflow (`.github/workflows/buddy.yml`) listens on `pull_request: [edited]` — and on `issues: [edited]` for the same checkboxes on the dashboard — so nothing is polling and nothing waits for a schedule. The run then:

1. Scans all open pull requests
2. Identifies Buddy PRs with checked rebase boxes
3. Triggers a fresh dependency scan
4. Updates the PR with latest versions
5. Unchecks the box when complete

### 3. Complete Update Process

During rebase, Buddy:

- **Re-scans dependencies**: Finds the latest available versions
- **Updates all files**: package.json, lock files, dependency files, workflows
- **Refreshes PR content**: Updates title, body, changelog, and metadata
- **Maintains git history**: Uses Git CLI for reliable commits
- **Handles permissions**: Supports both GitHub token and PAT authentication

## Usage

### Interactive Rebase

1. **Open any Buddy PR**
2. **Scroll to the bottom** of the PR description
3. **Check the rebase checkbox**: `- [x] If you want to update/retry this PR, check this box`
4. **Wait for automation**: The edit fires the workflow straight away — no scheduled tick to wait for
5. **Review updates**: PR will be refreshed with latest dependency versions

### Manual Rebase via CLI

```bash
# Check for PRs with rebase checkbox enabled
buddy update-check

# Preview what would be rebased (dry run)
buddy update-check --dry-run

# Run with detailed logging
buddy update-check --verbose

# Combine options
buddy update-check --dry-run --verbose
```

### Manual Trigger via GitHub Actions

1. Go to **Actions** tab in your repository
2. Select the **"Buddy"** workflow
3. Click **"Run workflow"**
4. Choose options:
   - **Which job to run**: pick `check` to process rebase requests only
   - **Dry run**: Preview changes without applying them
5. Click **"Run workflow"** to execute

## Configuration

### Workflow Setup

The rebase handling lives in the unified workflow `buddy setup` writes to `.github/workflows/buddy.yml`. The parts that matter for rebasing:

```yaml
name: Buddy

on:
# Ticking the checkbox edits the PR body, which fires this event
  pull_request:
    types: [edited, opened, ready_for_review, synchronize, closed]

# The dashboard's checkboxes are the same request, made on an issue
  issues:
    types: [edited, opened]

  schedule:
    - cron: '0 */2 * * *' # Dependency updates
    - cron: '15 */2 * * *' # Dashboard refresh
    - cron: '0 4 * * *' # Daily cleanup of orphaned branches and obsolete PRs
    - cron: '0 9 * * 1' # Weekly dependency-health report

  workflow_dispatch: # Manual trigger
    inputs:
      job:
        description: Which job to run
        required: false
        default: all
        type: choice
        options:
          - all
          - check
          - update
          - dashboard
      dry_run:
        description: Dry run (preview only)
        required: false
        default: false
        type: boolean

permissions:
  contents: write
  pull-requests: write
  issues: write
  actions: write # Required for workflow file updates
  checks: read
  statuses: read
```

None of those schedules drives rebase detection — the edit event covers that. They exist for the periodic jobs: dependency updates, the dashboard refresh, cleanup and the weekly report.

### Token Configuration

#### Option 1: Personal Access Token (Full Features)

For complete functionality including workflow file updates:

1. **Create PAT**: Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
2. **Select scopes**:
   - `repo` (Full repository access)
   - `workflow` (Update GitHub Actions workflows)
3. **Add secret**: Repository Settings → Secrets → Add `BUDDY_TOKEN`
4. **Automatic detection**: Workflow uses PAT when available

#### Option 2: Default GitHub Token (Limited)

Uses the built-in `GITHUB_TOKEN` with these limitations:

- ✅ Updates package.json and dependency files
- ✅ Updates lock files
- ❌ Cannot update workflow files (`.github/workflows/*.yml`)
- ❌ Limited to basic repository operations

### Environment Variables

```bash
# Required for PR operations
GITHUB_TOKEN=<your-token>

# For rebase functionality
BUDDY_TOKEN=<your-pat> # Optional, fallback to GITHUB_TOKEN
```

## What Gets Updated

### File Types

During rebase, Buddy updates:

| File Type | Examples | Token Required |
|-----------|----------|----------------|
| **Package files** | package.json | GITHUB_TOKEN |
| **Lock files** | package-lock.json, yarn.lock, bun.lockb | GITHUB_TOKEN |
| **Dependency files** | deps.yaml, dependencies.yaml, pkgx.yaml | GITHUB_TOKEN |
| **GitHub Actions** | .github/workflows/*.yml | BUDDY_TOKEN |

### PR Content

- **Title**: Updated with latest package versions
- **Body**: Refreshed changelog and release notes
- **Tables**: Updated dependency tables with new versions
- **Metadata**: Fresh package statistics and confidence scores
- **Checkbox**: Automatically unchecked after successful rebase

## Troubleshooting

### Common Issues

#### 1. Permission Errors

**Error**: `refusing to allow a GitHub App to create or update workflow`

**Solution**: Add `BUDDY_TOKEN` with `workflow` scope:
```bash
# 1. Create PAT with 'repo' and 'workflow' scopes
# 2. Add as repository secret 'BUDDY_TOKEN'
# 3. Re-run the rebase workflow
```

#### 2. Git Identity Errors

**Error**: `Author identity unknown`

**Solution**: The workflow automatically configures Git identity, but you can verify:
```yaml

- name: Configure Git

  run: |
    git config --global user.name "github-actions[bot]"
    git config --global user.email "github-actions[bot]@users.noreply.github.com"
```

#### 3. No PRs Found

**Error**: `No buddy PRs found`

**Cause**: `buddy update-check` only considers open pull requests whose head branch starts with `buddy/`. The author is never inspected. The workflow adds one condition of its own on the edit trigger: an edit made by a bot account is ignored, so Buddy's own untick cannot re-trigger the run.

**Solution**: Ensure the PR was created by Buddy — a hand-made PR on a branch outside `buddy/` is never picked up — and tick the box from your own account rather than through another bot

#### 4. Rebase Not Triggered

**Check**:

1. Checkbox is properly formatted: `- [x] <!-- rebase-check -->`
2. Workflow has proper permissions
3. Actions are enabled in repository settings

## Advanced Usage

### Rebasing One PR Directly

`update-check` sweeps every open Buddy PR for ticked boxes. To act on a single PR without touching the checkbox at all, address it by number:

```bash
# Recreate PR #17 with the latest versions
buddy rebase 17

# Rebase even when the PR already looks up to date
buddy rebase 17 --force
```

A PR that is already current is skipped unless you pass `--force`, so this is safe to run from a script or from your own workflow step.

### Integration with Other Tools

The rebase functionality works seamlessly with:

- **Dependency Dashboard**: Checkbox updates reflected in dashboard
- **Auto-merge**: Rebased PRs can be auto-merged if configured
- **Package grouping**: Maintains original grouping during rebase
- **Update strategies**: Respects configured update strategies

### Monitoring Rebase Activity

Track rebase operations via:

- **GitHub Actions logs**: Detailed execution logs
- **PR comments**: Automatic status updates
- **Dashboard updates**: Reflected in dependency dashboard
- **Git history**: Clean commit history maintained

## Best Practices

### When to Use Rebase

- ✅ **Fresh releases**: New versions available since PR creation
- ✅ **Stale PRs**: Long-lived PRs that need refreshing
- ✅ **Failed builds**: Retry after fixing base branch issues
- ✅ **Conflict resolution**: Update with latest base branch changes

### When Not to Use Rebase

- ❌ **Recently created PRs**: Already up-to-date
- ❌ **Active development**: PR being actively reviewed/modified
- ❌ **Complex conflicts**: Manual intervention required
- ❌ **Production hotfixes**: Use direct updates instead

### Performance Considerations

- **Frequency**: Detection costs nothing while idle — the run starts on the edit, not on a clock
- **Rate limits**: GitHub API rate limits apply
- **Resource usage**: Minimal overhead per execution
- **Parallel execution**: Multiple rebase requests handled sequentially

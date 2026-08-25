# Utility Commands

Utility commands for configuration, scheduling, and repository management.

## open-settings

Open GitHub repository and organization settings in your browser.

```bash
buddy open-settings [options]
```

### Description

Quickly open the GitHub settings pages needed to configure permissions for buddy. It opens the repository's Actions settings, follows with the organization's, and prints the exact options to change on each.

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--verbose, -v` | Enable verbose logging | `false` |

### Examples

```bash
# Open the Actions settings pages for this repository
buddy open-settings

# Show how the repository was resolved
buddy open-settings --verbose
```

### What Opens

The repository comes from `repository.owner` and `repository.name` in `buddy.config.ts`, falling back to `git remote get-url origin`.

#### Repository Actions settings

`https://github.com/<owner>/<repo>/settings/actions`

- Workflow permissions — select "Read and write permissions"
- "Allow GitHub Actions to create and approve pull requests"

#### Organization Actions settings

`https://github.com/organizations/<owner>/settings/actions`

- The same two settings one level up, which may override the repository's

If neither the config nor the git remote identifies a repository, buddy prints both URLs with placeholders instead of opening anything.

### Related Pages

buddy does not open these, but setup points you at them:

- Personal access tokens — `https://github.com/settings/tokens`
- Repository secrets — `https://github.com/<owner>/<repo>/settings/secrets/actions`

## schedule

Run automated updates on a schedule.

```bash
buddy schedule [options]
```

### Description

Starts a scheduler in the foreground: it works out the next run from a cron expression, scans for updates when that time arrives, and opens pull requests for what it finds. The process stays alive until you stop it with Ctrl+C, so it belongs on a machine that stays up. On a CI runner, put the cadence in the workflow trigger and run `buddy update` instead, as the CI/CD Integration section below shows.

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--strategy <type>` | Update strategy, and the cadence that goes with it | `all` |
| `--verbose, -v` | Enable verbose logging | `false` |

### Examples

```bash
# Run scheduled updates
buddy schedule

# Daily patch updates
buddy schedule --strategy patch

# Watch what the scheduler is doing
buddy schedule --verbose
```

### Schedules

The strategy picks the cadence, so that larger updates arrive less often:

| Strategy | Cron |
|----------|------|
| `patch` | `0 2 * * *` |
| `minor` | `0 2 * * 1,4` |
| `major` | `0 2 * * 1` |
| `all` | `0 2 * * 1` |

The next run is derived from the hour and minute fields; the day-of-month and day-of-week fields are not evaluated, so all four of these fire at 2 AM every day. When the day has to matter, drive the cadence from a real cron daemon or a workflow `schedule:` trigger.

On start the scheduler prints the expression it settled on and when it will next fire:

```bash
✅ Scheduler started with cron: 0 2 * * 1
📅 Next run: 2026-09-01T02:00:00.000Z
🛑 Press Ctrl+C to stop the scheduler
```

### Configuration Integration

The schedule command uses settings from `buddy.config.ts`:

```typescript
export default {
  schedule: {
    timezone: 'America/New_York', // Time zone the cron is read in
  },
  repository: {
    provider: 'github',
    owner: 'your-org',
    name: 'your-repo',
  },
  pullRequest: {
    labels: ['dependencies'],
  },
} satisfies BuddyConfig
```

Repository details are required: without `repository.provider`, `repository.owner` and `repository.name`, the command exits before the scheduler starts. Pull requests are only opened when `pullRequest` is configured as well — otherwise a run scans, reports what it found, and stops there.

### CI/CD Integration

A runner exits when the job does, so there is nothing for a long-lived scheduler to wait for. Let the workflow trigger carry the schedule and run `buddy update`:

**GitHub Actions**
```yaml
name: Scheduled Dependencies
on:
  schedule:

    - cron: '0 2 * * 1'

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:

      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bunx @buddysh/buddy update --strategy patch --verbose

        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Same reasoning on a server you own — cron supplies the cadence, `update` does the work:

**Cron Job**
```bash
# Add to crontab
0 2 * * 1 cd /path/to/project && bunx @buddysh/buddy update --strategy patch
```

Reach for `buddy schedule` when you want one resident process instead, supervised by systemd or a process manager.

### Output

The schedule command provides detailed information about:

- **Execution time** and timezone
- **Updates found** and strategy used
- **Pull requests created** or updated
- **Errors** and warnings

### Troubleshooting

**Schedule not running:**

- Check the strategy you passed, and the cadence it maps to
- Verify timezone settings
- Ensure GitHub token is valid

**No updates found:**

- Run with `--verbose` for detailed scanning
- Check package ignore list
- Verify package.json exists

**Permission errors:**

- Check GitHub token scopes
- Verify repository access
- Review workflow permissions

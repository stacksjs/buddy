# CLI Reference Overview

Buddy provides a comprehensive command-line interface for dependency management, package analysis, and workflow automation.

## Installation & Setup

```bash
# Install Buddy globally
bun add -g @buddysh/buddy

# Interactive setup (recommended first step)
buddy setup

# Or use with bunx (no installation required)
bunx @buddysh/buddy setup
```

**🚀 Start with `setup`** - The setup command provides a complete Renovate-like configuration experience that automatically configures workflows, tokens, and repository settings.

## Command Structure

```bash
buddy <command> [options] [arguments]
```

## Available Commands

### Stacks

Use [`buddy stacks`](/cli/stacks) to run Stacks commands and manage background generation for registered projects.

### 🚀 Setup & Configuration

| Command | Description |
|---------|-------------|
| [`setup`](/cli/setup) | **Interactive/Non-interactive setup wizard** - Complete Renovate-like experience |
| [`open-settings`](/cli/utility#open-settings) | Open GitHub repository and organization settings |

### 🔍 Scanning & Analysis

| Command | Description |
|---------|-------------|
| [`scan`](/cli/update#scan) | Scan for dependency updates |
| [`check`](/cli/package#check) | Check specific packages for updates |

### ⬆️ Updates & Pull Requests

| Command | Description |
|---------|-------------|
| [`update`](/cli/update#update) | Update dependencies and create PRs |
| [`rebase`](/cli/update#rebase) | Rebase/retry a pull request |
| [`update-check`](/cli/update#update-check) | Auto-detect and rebase PRs with checked boxes |

### 📦 Package Information

| Command | Description |
|---------|-------------|
| [`info`](/cli/package#info) | Show detailed package information |
| [`versions`](/cli/package#versions) | Show all available versions of a package |
| [`latest`](/cli/package#latest) | Get the latest version of a package |
| [`exists`](/cli/package#exists) | Check if a package exists in the registry |
| [`deps`](/cli/package#deps) | Show package dependencies |
| [`compare`](/cli/package#compare) | Compare two versions of a package |
| [`search`](/cli/package#search) | Search for packages in the registry |

### 📊 Dashboard & Review

| Command | Description |
|---------|-------------|
| [`dashboard`](/features/dependency-dashboard) | Create or update the dependency dashboard issue |
| [`review`](/cli/review) | Review local changes, or a pull request |
| [`security`](/features/workflow-security) | Static-analyse GitHub Actions workflows |
| [`doctor`](/cli/review#diagnosing-setup) | Diagnose credentials, git state and analyzer tooling |

### ⏰ Automation & Scheduling

| Command | Description |
|---------|-------------|
| [`schedule`](/cli/utility#schedule) | Run automated updates on schedule |
| [`discord-alerts`](#discord-alerts) | Read alerts from selected Discord webhook or bot senders |

### Discord alerts

Set `DISCORD_BOT_TOKEN` in the command's environment. The bot needs **View Channel** and **Read Message History** in the target channel and the **Message Content** intent in the Discord Developer Portal. Use numeric Discord webhook or bot IDs for `--source-ids`.

```bash
buddy discord-alerts 123456789012345678 --source-ids 234567890123456789,345678901234567890
buddy discord-alerts 123456789012345678 --source-ids 234567890123456789,345678901234567890 --after 456789012345678901
buddy discord-alerts 123456789012345678 --hq-sources bughq=234567890123456789,loghq=345678901234567890,statushq=456789012345678901
```

Use `--hq-sources` with the verified webhook IDs for BugHQ, LogHQ, and StatusHQ. Messages from those senders include an `hq` object with the alert kind and available project details. Test messages and unknown formats get distinct kinds so they can be excluded from automated changes. `--source-ids` can include additional senders.

The first read checks the latest 100 channel messages. Later reads with `--after` return every newer message from the selected sources. The result contains `alerts` in chronological order and a `nextCursor` string. Save that cursor after recording the batch, even when messages from other senders leave `alerts` empty. The cursor is `null` when the first read finds an empty channel. Verify the bot can read a known alert before scheduling it.

Alert text and embeds come from Discord. Treat them as evidence for triage and verify any proposed code change in its repository.

## Global Options

Every command accepts these:

```bash
--config <path>  Path to a buddy config file
--help, -h       Show help information
--version        Show version information
```

Almost every command also takes `--verbose, -v` for detailed logging. Options are matched strictly: a flag a command does not declare is an error, not something quietly ignored.

## Examples

### Quick Start

```bash
# Interactive setup (recommended for new projects)
buddy setup

# Non-interactive setup with defaults
buddy setup --non-interactive

# Non-interactive setup with specific preset
buddy setup --non-interactive --preset testing --verbose

# Scan for available updates
buddy scan --verbose

# Apply updates and create PRs
buddy update
```

### Package Analysis

```bash
# Get information about a package
buddy info react

# Check available versions
buddy versions typescript --latest 5

# Search for packages
buddy search "test framework"
```

### PR Management

```bash
# Rebase a specific PR
buddy rebase 17

# Check all PRs for rebase requests
buddy update-check

# Force rebase even if up to date
buddy rebase 17 --force
```

## Configuration File

Most commands use settings from `buddy.config.ts`:

```typescript
import type { BuddyConfig } from '@buddysh/buddy'

export default {
  verbose: true,
  repository: {
    provider: 'github',
    owner: 'your-org',
    name: 'your-repo',
  },
  packages: {
    strategy: 'patch',
    ignore: ['@types/node'],
  },
  pullRequest: {
    reviewers: ['team-lead'],
    assignees: ['maintainer'],
    labels: ['dependencies'],
  }
} satisfies BuddyConfig
```

## Environment Variables

Buddy uses these environment variables:

```bash
# Required for GitHub operations. GH_TOKEN is accepted as an alias
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Optional: a PAT with 'repo' and 'workflow' scopes, used ahead of GITHUB_TOKEN
BUDDY_TOKEN=ghp_xxxxxxxxxxxx

# Optional: output level - silent, error, warn, info, debug
BUDDY_LOG_LEVEL=debug
```

## Exit Codes

Buddy uses standard exit codes:

- **0**: Success
- **1**: Any failure — configuration, network, an unknown command, or an option the command does not accept

## Debugging

### Verbose Mode

Enable detailed logging for any command:

```bash
buddy <command> --verbose
```

### Common Issues

**Command not found:**
```bash
# Check installation
which buddy

# Or use bunx
bunx @buddysh/buddy --version
```

**GitHub token issues:**
```bash
# Test token
gh auth status

# Login if needed
gh auth login
```

**Permission errors:**
```bash
# Check repository permissions
buddy open-settings
```

## Integration Examples

### CI/CD Pipeline

```yaml
# .github/workflows/dependencies.yml

- name: Update dependencies

  run: |
    bunx @buddysh/buddy scan --verbose
    bunx @buddysh/buddy update --strategy patch
```

### NPM Scripts

```json
{
  "scripts": {
    "deps:scan": "buddy scan --verbose",
    "deps:update": "buddy update",
    "deps:check": "buddy check react typescript",
    "deps:info": "buddy info"
  }
}
```

### Monorepo Usage

```bash
# Update specific workspace
cd packages/frontend
buddy update --strategy minor

# Check all workspaces
for dir in packages/*/; do
  echo "Checking $dir"
  cd "$dir" && buddy scan
  cd ../..
done
```

## Performance Tips

1. **Use specific strategies**: `--strategy patch` is faster than `all`
2. **Filter packages**: Use `buddy scan --packages` to check a short list
3. **Skip the noise**: Leave `--verbose` off unless you are debugging
4. **Parallel execution**: Run multiple commands in parallel for monorepos

## Getting Help

### Built-in Help

```bash
# General help — the flag and the subcommand do the same thing
buddy --help
buddy help

# Command-specific help
buddy scan --help
buddy update --help
```

### Documentation

- **Full Documentation**: [buddy.sh/docs](https://buddy.sh/docs)
- **Configuration Guide**: [/config](/config)
- **GitHub Setup**: [/features/github-actions](/features/github-actions)

### Community

- **GitHub Issues**: [Report bugs and feature requests](https://github.com/stacksjs/buddy/issues)
- **Discussions**: [Community discussions](https://github.com/stacksjs/buddy/discussions)
- **Discord**: [Join our Discord](https://stacksjs.com/discord)

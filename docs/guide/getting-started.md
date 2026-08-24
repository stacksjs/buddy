# Getting Started

Buddy is the fastest, most intelligent dependency management bot for modern JavaScript and TypeScript projects. This guide will help you set up automated dependency updates.

## Installation

Install Buddy globally:

::: code-group

```bash [bun]
bun add -g @buddysh/buddy
```

```bash [npm]
npm install -g @buddysh/buddy
```

:::

## Quick Start

### Interactive Setup (Recommended)

The easiest way to get started:

```bash
buddy setup
```

This wizard will guide you through:

- Detecting your project type and package manager
- Migrating from Renovate or Dependabot (if applicable)
- Setting up GitHub Actions workflows
- Configuring update schedules

### Non-Interactive Setup

For CI/CD pipelines:

```bash
# Basic setup with defaults
buddy setup --non-interactive

# With specific preset
buddy setup --non-interactive --preset security --verbose
```

**Available presets:**

- `standard` - Balanced updates (default)
- `high-frequency` - Multiple daily checks
- `security` - Prioritize security patches
- `minimal` - Weekly checks
- `testing` - For development/testing

## Basic Usage

### Scan for Updates

Check for outdated dependencies:

```bash
# Basic scan
buddy scan

# Verbose output
buddy scan --verbose

# Specific packages
buddy scan --packages "react,typescript,@types/node"

# Pattern matching
buddy scan --pattern "@types/*"
```

### Update Dependencies

Create pull requests for updates:

```bash
# Dry run first
buddy update --dry-run

# Apply updates
buddy update

# Specific strategy
buddy update --strategy minor
```

### Check for Rebase Requests

Process PR update requests:

```bash
buddy update-check
buddy update-check --verbose
```

## Update Strategies

| Strategy | Description |
|----------|-------------|
| `all` | All updates regardless of semver impact |
| `major` | Only major version updates |
| `minor` | Major and minor updates (no patch-only) |
| `patch` | All updates (most conservative) |

## Supported Ecosystems

Buddy automatically detects and updates:

### Package Managers

- **Bun** (`bun.lockb`)
- **npm** (`package-lock.json`)
- **yarn** (`yarn.lock`)
- **pnpm** (`pnpm-lock.yaml`)
- **Composer** (`composer.json`, `composer.lock`)
- **Zig** (`build.zig.zon`)

### Dependency Files

- `package.json`
- `deps.yaml` / `dependencies.yaml`
- `pkgx.yaml`
- `.deps.yaml`

### GitHub Actions

- `.github/workflows/*.yml`

## Generated Workflows

After setup, Buddy creates three workflows:

### `buddy-dashboard.yml`

Maintains the dependency dashboard issue:

- Runs Monday, Wednesday, Friday at 9 AM UTC
- Shows all open PRs and detected dependencies
- Interactive checkbox controls

### `buddy-check.yml`

Handles PR rebase requests:

- Runs every minute
- Detects checked rebase boxes
- Updates PR content automatically

### `buddy-update.yml`

Creates dependency update PRs:

- Schedule varies by preset
- Supports manual triggers
- Configurable update strategy

## CLI Reference

```bash
# Setup
buddy setup                    # Interactive setup
buddy setup --non-interactive  # CI/CD mode

# Scanning
buddy scan                     # Scan for updates
buddy scan --verbose           # Detailed output
buddy scan --strategy minor    # Specific strategy

# Updating
buddy update                   # Create update PRs
buddy update --dry-run         # Preview changes

# Maintenance
buddy update-check             # Process rebase requests
buddy dashboard                # Update dashboard issue

# Help
buddy help
buddy --version
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub API token (required for PRs) |
| `BUDDY_TOKEN` | PAT for workflow file updates |

## Next Steps

- Learn about [Configuration](/guide/configuration) options
- Explore [PR Generation](/guide/pr-generation) customization
- See [Usage Examples](/usage) for advanced patterns

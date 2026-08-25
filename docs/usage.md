# Get Started

There are multiple ways to use buddy: _as a CLI tool, library, or GitHub Action._

Buddy automatically detects and updates multiple dependency file formats including traditional `package.json` files, modern dependency files used by pkgx and Launchpad ecosystems, and GitHub Actions workflow dependencies.

## Quick Start

### Option 1: Interactive Setup (Recommended)

The fastest way to get started is with the interactive setup:

```bash
# Install buddy
bun add -g @buddysh/buddy

# Run interactive setup
buddy setup
```

The setup wizard will automatically:

- 🔍 Detect your repository
- 🔑 Guide token creation and setup
- 🔧 Configure GitHub Actions permissions
- ⚙️ Generate workflows and configuration
- 🎯 Provide clear next steps

#### [📖 Complete Setup Guide →](/cli/setup)

### Option 1a: Non-Interactive Setup

For CI/CD pipelines or automated deployments:

```bash
# Basic non-interactive setup (uses defaults)
buddy setup --non-interactive

# Non-interactive with specific preset and token setup
buddy setup --non-interactive --preset testing --token-setup existing-secret --verbose

# Production setup
buddy setup --non-interactive --preset security --token-setup existing-secret
```

Non-interactive mode:

- ✅ Uses sensible defaults without prompts
- ✅ Supports all preset configurations
- ✅ Configurable token setup modes
- ✅ Perfect for automation and CI/CD
- ✅ Still performs detection and validation

**Available presets**: `standard`, `high-frequency`, `security`, `minimal`, `testing`
**Token modes**: `default-token`, `existing-secret`, `new-pat`

### Option 2: Manual Configuration

If you prefer manual setup:

1. **Install buddy** _(see [Installation](/install))_
2. **Set up GitHub Actions permissions** for PR creation
3. **Create configuration** _(optional)_
4. **Run dependency scan**

```bash
# Quick scan for outdated packages
buddy scan

# Create pull requests for updates
buddy update

# Rebase an existing PR
buddy rebase 123
```

## CLI Usage

### Basic Commands

```bash
# Scan for outdated packages
buddy scan
buddy scan --verbose
buddy scan --strategy patch

# Create update pull requests
buddy update
buddy update --dry-run
buddy update --strategy patch

# Rebase/retry a specific PR
buddy rebase 123
buddy rebase 123 --force

# Auto-rebase every open buddy PR with a checked rebase box
buddy update-check
buddy update-check --dry-run
```

Reviewers, assignees, labels and auto-merge are configured under `pullRequest` in
`buddy.config.ts` — `buddy update` has no flags for them.

### Package Analysis

```bash
# Check specific package
buddy check cac
buddy check @types/bun

# Get package information
buddy info typescript
buddy versions react
buddy latest vue

# Dependency analysis
buddy deps package-name
buddy compare package-name 1.0.0 2.0.0
buddy search "ui library"
```

### Configuration & Utilities

```bash
# Generate the configuration file and GitHub Actions workflows
buddy setup
buddy setup --non-interactive --preset security

# Diagnose credentials, git state and tooling
buddy doctor

# Utility commands
buddy --help
buddy --version
```

## Supported File Types

Buddy automatically detects and updates dependencies across four categories:

### Package Dependencies

- **package.json** - npm, Bun, yarn, pnpm dependencies
- **composer.json** - PHP dependencies from Packagist
- **composer.lock** - PHP lock file with exact versions
- **deps.yaml**/**deps.yml** - Launchpad/pkgx dependency declarations
- **dependencies.yaml**/**dependencies.yml** - Alternative dependency format
- **pkgx.yaml**/**pkgx.yml** - pkgx-specific dependency files
- **.deps.yaml**/**.deps.yml** - Hidden dependency configuration

### GitHub Actions

- **.github/workflows/*.yml** - GitHub Actions workflow files
- **.github/workflows/*.yaml** - Alternative YAML extension

All `uses:` statements in workflow files are automatically detected and updated:

```yaml
# .github/workflows/ci.yml
steps:

  - uses: actions/checkout@v4 # ← Updated to v4.2.2
  - uses: oven-sh/setup-bun@v2 # ← Updated to v2.0.2
  - uses: actions/cache@v4.1.0 # ← Updated to v4.2.3

```

### Update Sources

- **npm packages**: Uses `bun outdated` for accurate detection
- **Composer packages**: Uses `composer outdated` and Packagist API
- **pkgx/Launchpad packages**: Uses `ts-pantry` library integration
- **GitHub Actions**: Fetches latest releases via GitHub API

## Library Usage

### Basic Integration

```typescript
import { Buddy } from '@buddysh/buddy'

const buddy = new Buddy({
  repository: {
    provider: 'github',
    owner: 'your-org',
    name: 'your-repo',
  },
  packages: {
    strategy: 'patch',
    ignore: ['@types/node'],
  },
})

// Scan for updates
const scanResult = await buddy.scanForUpdates()
console.log(`Found ${scanResult.updates.length} package updates`)

// Create pull requests
await buddy.createPullRequests(scanResult)
```

### Advanced Configuration

```typescript
import type { BuddyConfig } from '@buddysh/buddy'
import { Buddy } from '@buddysh/buddy'

const config: BuddyConfig = {
  verbose: true,

  repository: {
    provider: 'github',
    owner: 'acme-corp',
    name: 'web-app',
    baseBranch: 'main',
  },

  packages: {
    strategy: 'all',
    ignore: ['react', 'vue'], // Keep frameworks stable
    pin: {
      typescript: '^5.0.0', // Pin TypeScript to v5
    },
    groups: [
      {
        name: 'React Ecosystem',
        patterns: ['react', 'react-dom', '@types/react'],
        strategy: 'minor',
      },
      {
        name: 'Build Tools',
        patterns: ['vite', 'rollup', 'esbuild'],
        strategy: 'patch',
      },
    ],
  },

  pullRequest: {
    reviewers: ['team-lead', 'senior-dev'],
    assignees: ['dependabot-reviewer'],
    labels: ['dependencies', 'automated'],
    autoMerge: {
      enabled: true,
      strategy: 'squash',
      conditions: ['patch-only'],
    },
  },

  schedule: {
    cron: '0 2 _ _ 1', // Weekly on Monday at 2 AM
    timezone: 'UTC',
  },
}

const buddy = new Buddy(config)

// Full workflow
await buddy.run()
```

### Error Handling

```typescript
try {
  const buddy = new Buddy(config)
  const scanResult = await buddy.scanForUpdates()

  if (scanResult.updates.length === 0) {
    console.log('All packages are up to date!')
    return
  }

  await buddy.createPullRequests(scanResult)
  console.log(`Opened pull requests for ${scanResult.updates.length} updates`)
}
catch (error) {
  if (error.code === 'GITHUB_TOKEN_MISSING') {
    console.error('GitHub token required for PR creation')
    process.exit(1)
  }

  if (error.code === 'REPO_NOT_FOUND') {
    console.error('Repository not found or access denied')
    process.exit(1)
  }

  throw error
}
```

## GitHub Actions Integration

### Automated Updates

```yaml
name: Dependency Updates
on:
  schedule:

    - cron: '0 2 _ _ 1' # Weekly on Monday at 2 AM

  workflow_dispatch: # Allow manual trigger

jobs:
  update-dependencies:
    runs-on: ubuntu-latest
    permissions:
      contents: write # Read repository and write changes
      pull-requests: write # Create and update pull requests
      actions: write # Update workflow files (optional)

    steps:

      - name: Checkout

        uses: actions/checkout@v4

      - name: Setup Bun

        uses: oven-sh/setup-bun@v1

      - name: Install dependencies

        run: bun install

      - name: Update dependencies

        run: bunx @buddysh/buddy update
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # Built-in token
```

### Automated Setup in CI/CD

```yaml
name: Setup Buddy
on:
  workflow_dispatch:
    inputs:
      preset:
        description: 'Workflow preset'
        required: false
        default: 'standard'
        type: choice
        options:

          - standard
          - high-frequency
          - security
          - minimal
          - testing

jobs:
  setup-buddy:
    runs-on: ubuntu-latest
    steps:

      - name: Checkout

        uses: actions/checkout@v4

      - name: Setup Bun

        uses: oven-sh/setup-bun@v2

      - name: Setup Buddy

        run: |
          bunx @buddysh/buddy setup \
            --non-interactive \
            --preset ${{ github.event.inputs.preset || 'standard' }} \
            --token-setup existing-secret \
            --verbose
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit generated files

        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add .
          git commit -m "Add Buddy workflows and configuration" || exit 0
          git push
```

### Security Updates

```yaml
name: Security Updates
on:
  schedule:

    - cron: '0 _/6 _ _ _' # Every 6 hours

jobs:
  security-updates:
    runs-on: ubuntu-latest
    steps:

      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - name: Security updates only

        run: bunx @buddysh/buddy update --strategy patch --verbose
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Labels and auto-merge for these PRs come from the `pullRequest` block in
`buddy.config.ts`.

### Matrix Strategy

```yaml
name: Multi-Strategy Updates
on:
  schedule:

    - cron: '0 2 _ _ 1'

jobs:
  update:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        strategy: [patch, minor, major]

    steps:

      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - name: Update ${{ matrix.strategy }}

        run: bunx @buddysh/buddy update --strategy ${{ matrix.strategy }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Configuration Files

Buddy automatically detects configuration files:

### TypeScript Configuration

```typescript
// buddy.config.ts
import type { BuddyConfig } from '@buddysh/buddy'

export default {
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
    labels: ['dependencies'],
  },
} satisfies BuddyConfig
```

### JSON Configuration

```json
{
  "repository": {
    "provider": "github",
    "owner": "your-org",
    "name": "your-repo"
  },
  "packages": {
    "strategy": "patch",
    "ignore": ["@types/node"]
  },
  "pullRequest": {
    "reviewers": ["team-lead"],
    "labels": ["dependencies"]
  }
}
```

## Environment Variables

```bash
# For GitHub Actions (automatically provided)
GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}

# For local development (if needed)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Optional: Custom registry
export NPM_CONFIG_REGISTRY=https://registry.npmjs.org

# Optional: Log verbosity (silent | error | warn | info | debug)
export BUDDY_LOG_LEVEL=debug
```

## Workflow Examples

`buddy update` accepts `--strategy`, `--ignore`, `--dry-run`, `--respect-latest`,
`--no-respect-latest` and `--verbose`. Everything about the pull request itself —
reviewers, assignees, labels, auto-merge — is read from `buddy.config.ts`, so each
example below pairs the config with the script that runs it.

### Daily Patch Updates

```typescript
// buddy.config.ts
export default {
  pullRequest: {
    labels: ['security', 'patch-updates'],
    autoMerge: {
      enabled: true,
      strategy: 'squash',
      conditions: ['patch-only'],
    },
  },
} satisfies BuddyConfig
```

```bash
# !/bin/bash
# daily-updates.sh

buddy update --strategy patch
```

### Weekly Comprehensive Updates

```typescript
// buddy.config.ts
export default {
  pullRequest: {
    reviewers: ['team-lead', 'senior-dev'],
    assignees: ['maintainer'],
    labels: ['dependencies', 'weekly-update'],
  },
} satisfies BuddyConfig
```

```bash
# !/bin/bash
# weekly-updates.sh

buddy update --strategy all
```

### Emergency Security Update

```typescript
// buddy.config.ts
export default {
  pullRequest: {
    labels: ['security', 'urgent'],
    autoMerge: {
      enabled: true,
      strategy: 'squash',
      conditions: ['security-only'],
    },
  },
} satisfies BuddyConfig
```

```bash
# !/bin/bash
# security-update.sh

buddy update --strategy patch --verbose
```

## Dependency File Support

Buddy automatically detects and updates various dependency file formats:

### Supported File Types

```yaml
# deps.yaml - Launchpad/pkgx dependencies
dependencies:
  node: ^20.0.0
  typescript: ^5.0.0

devDependencies:
  eslint: ^8.0.0

# Also supports: deps.yml, dependencies.yaml, dependencies.yml
# pkgx.yaml, pkgx.yml, .deps.yaml, .deps.yml
```

### Mixed Project Support

Projects can use multiple dependency file formats simultaneously:

```bash
my-project/
├── package.json          # npm dependencies
├── deps.yaml             # Launchpad/pkgx dependencies
├── frontend/
│   ├── package.json      # Frontend-specific deps
│   └── deps.yml          # Additional tooling deps
└── backend/
    ├── package.json      # Backend dependencies
    └── .deps.yaml        # Hidden config dependencies
```

Buddy will scan all files and create coordinated pull requests that update dependencies across all detected formats.

### Version Prefix Preservation

Buddy preserves your version constraints when updating:

```yaml
# Before update
dependencies:
  express: ^4.18.0 # Caret range
  lodash: ~4.17.20 # Tilde range
  react: '>=18.0.0' # Greater than or equal
  vue: 3.0.0 # Exact version

# After update (preserves prefixes)
# dependencies
# express: ^4.18.2    # Caret preserved
# lodash: ~4.17.21    # Tilde preserved
# react: >=18.2.0     # Range preserved
# vue: 3.0.5          # Exact preserved
```

## Monorepo Support

For monorepos with multiple `package.json` and dependency files:

Workspaces are found by walking the repository — there is nothing to list.
Scope settings to a directory by matching the manifest path:

```typescript
// buddy.config.ts
export default {
  packages: {
    strategy: 'patch',
    ignorePaths: ['examples/**'],
    rules: [
      {
        matchFiles: ['packages/web/**', 'packages/mobile/**'],
        groupName: 'Frontend Apps',
        strategy: 'minor',
      },
      {
        matchFiles: ['apps/api/**', 'apps/worker/**'],
        groupName: 'Backend Services',
        strategy: 'patch',
      },
    ],
  },
} satisfies BuddyConfig
```

Note that `patterns` on a group matches **package names**, not paths. To scope
by path, use a rule with `matchFiles` as above. See
[monorepos](/advanced/monorepo).

## Testing

```bash
# Test configuration, credentials and git state
buddy doctor --verbose

# Test scanning and GitHub authentication
buddy scan --verbose

# Test package detection
buddy check typescript
```

## Performance Tips

- Use `--strategy patch` for faster, safer updates
- Configure package groups for related dependencies
- Use scheduling to avoid peak hours
- Enable auto-merge for patch updates
- Use ignore lists for critical packages

## Troubleshooting

### Common Issues

**No packages found:**
```bash
# Ensure Bun is installed and package.json exists
bun --version
ls package.json
```

**GitHub authentication failed:**
```bash
# For GitHub Actions: Check workflow permissions
# For local development: Check token permissions
gh auth status
```

**PR creation failed:**
```bash
# Verbose mode for detailed error information
buddy update --verbose
```

**Package registry issues:**
```bash
# Clear Bun cache
bun pm cache rm
```

Read more about specific features in the [Features](/features/scanning) section.

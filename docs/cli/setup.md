# Setup Command

Interactive setup wizard for automated dependency management.

## Overview

The `setup` command provides a comprehensive, Renovate-like setup experience that guides you through configuring Buddy for your project. It automates the entire process from repository detection to workflow generation.

```bash
buddy setup [options]
```

## Quick Start

```bash
# Interactive setup (recommended)
buddy setup

# Setup with verbose logging
buddy setup --verbose

# Non-interactive setup with defaults
buddy setup --non-interactive

# Non-interactive with specific preset and token setup
buddy setup --non-interactive --preset testing --token-setup new-pat --verbose
```

## Enhanced Features

The setup wizard provides a comprehensive configuration experience with advanced validation:

### Core Features

- **🔍 Automatic Repository Detection** - Detects GitHub repository from git remote with API validation
- **🔑 Enhanced Token Setup** - Comprehensive PAT guidance with scope validation and testing
- **🔧 Repository Settings Validation** - Real-time GitHub Actions permissions verification
- **⚙️ Intelligent Workflow Presets** - Smart recommendations based on project analysis
- **📝 Project-Aware Configuration** - Optimized settings based on detected project characteristics
- **🔄 Validated Workflow Creation** - YAML validation and security best practices verification
- **🎯 Comprehensive Instructions** - Complete setup verification and troubleshooting guidance

### Advanced Enhancements

- **🛡️ Pre-flight Validation** - Environment checks, conflict detection, and prerequisite validation
- **📊 Smart Project Analysis** - Automatic detection of project type, package manager, and ecosystem
- **📈 Interactive Progress Tracking** - Visual progress indicators with step-by-step guidance
- **🔍 Repository Health Checks** - API-based validation of repository access and permissions
- **⚙️ Workflow Validation** - Real-time YAML syntax and security validation
- **🚀 Recovery Capabilities** - Detailed error reporting and setup resumption support
- **📋 Configuration Migration** - Seamless import from Renovate and Dependabot configurations
- **🔌 Integration Ecosystem** - Extensible plugin system with Slack, Discord, and Jira integrations

## Setup Flow

### Configuration Migration & Discovery

```
🔍 Configuration Migration Detection:
Found 1 existing dependency management tool(s):
   • renovate (renovate.json)

📋 Migrating configurations...
✅ Migrated renovate configuration

📋 Configuration Migration Report

## RENOVATE Migration

- **Config Found**: ✅ Yes
- **Confidence**: 🟢 high
- **Migrated Settings**: schedule, packages, ignore, autoMerge, assignees, reviewers

```

**Migration Features:**

- **Tool Detection** - Automatically discovers Renovate (`renovate.json`, `.renovaterc`, package.json) and Dependabot (`.github/dependabot.yml`) configurations
- **Smart Conversion** - Maps Renovate package rules to Buddy groups, converts schedules to workflow presets, and preserves team assignments
- **Compatibility Analysis** - Identifies unsupported features like `extends` presets and `regexManagers`, provides alternatives and workarounds
- **Migration Report** - Detailed summary with confidence levels, migrated settings, warnings, and incompatible features

**Supported Migrations:**

- **Renovate**: Schedule patterns, package rules, ignore lists, automerge settings, assignees/reviewers
- **Dependabot**: Update intervals, ignore patterns, package ecosystem configurations
- **Confidence Scoring**: High (direct mapping), Medium (partial support), Low (significant incompatibilities)

### Integration Discovery

```
🔌 Integration Discovery:
Found 2 available integration(s):
   • slack-integration v1.0.0
   • discord-integration v1.0.0

🔌 Executing integration hooks...
✅ Executed hook: notify-slack
✅ Executed hook: notify-discord
```

**Plugin Discovery:**

- **Environment Detection** - Scans for `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`, `JIRA_API_TOKEN` environment variables
- **File-Based Configuration** - Checks `.buddy/slack-webhook`, `.buddy/discord-webhook`, `.buddy/jira-config.json` files
- **Custom Plugins** - Loads plugins from `.buddy/plugins/*.json` directory with error handling
- **Integration Loading** - Automatically enables discovered integrations for setup completion notifications

**Built-in Integrations:**

- **Slack**: Rich setup completion messages with repository details and project information
- **Discord**: Colorful embed notifications with project type and package manager details
- **Jira**: Automatic ticket creation for tracking setup completion with project context

### Pre-flight Validation

```
🔍 Pre-flight Validation:
⚠️  Warnings:
   • Found 2 existing workflow(s). Some may conflict with Buddy workflows.
💡 Suggestions:
   • Using Bun v1.2.19
   • GitHub CLI detected. This can help with authentication.
```

**Environment Checks:**

- **Git repository validation** - Ensures you're in a git repository with proper remote configuration
- **Runtime environment** - Validates Node.js or Bun installation for optimal performance
- **Git configuration** - Checks for user.name and user.email configuration
- **GitHub CLI detection** - Identifies helpful tools for authentication and setup

**Conflict Detection:**

- **Existing workflows** - Scans `.github/workflows/` for potential conflicts
- **Dependency management tools** - Detects Renovate, Dependabot, or other dependency managers
- **Configuration conflicts** - Identifies existing configuration that might interfere

### Smart Project Analysis

```
🔍 Project Analysis:
📦 Project Type: application
⚙️  Package Manager: bun
🔒 Lock File: Found
📄 Dependency Files: Found
🔄 GitHub Actions: Found
💡 Recommended Preset: Standard Setup

📋 Recommendations:
   • Bun detected. Optimal performance expected.
   • Dependency files detected. Multi-format support enabled.
   • 3 existing workflow(s) found. GitHub Actions updates will be included.
```

**Project Intelligence:**

- **Project type detection** - Identifies library, application, monorepo based on package.json and file structure
- **Package manager analysis** - Detects Bun, npm, yarn, pnpm with lock file validation
- **Dependency ecosystem** - Finds pkgx.yaml, deps.yaml, and Launchpad dependency files
- **GitHub Actions discovery** - Scans existing workflows for update integration
- **Smart recommendations** - Suggests optimal configuration based on detected characteristics

### Interactive Progress Tracking

```
📊 Setup Progress: 80% [████████████████░░░░]
🔄 Current Step: Workflow Configuration (8/10)
✅ Completed: Detecting existing configurations, Discovering integrations, Running pre-flight checks, Analyzing project, Repository Detection, GitHub Token Setup, Repository Settings
```

**Progress Features:**

- **Visual progress bar** - Real-time completion percentage with graphical indicators
- **Step tracking** - Clear indication of current step and total progress
- **Completion history** - Shows which steps have been successfully completed
- **Time tracking** - Monitors setup duration for performance insights
- **Recovery support** - Maintains progress state for resumption after interruptions

### Step 5: Repository Detection & Validation

```
📍 Repository Detection
✅ Detected repository: your-org/your-repo
🔗 GitHub URL: https://github.com/your-org/your-repo
```

Automatically detects your GitHub repository from `git remote get-url origin` and performs comprehensive validation:

**Enhanced Repository Validation:**

- **API connectivity** - Tests GitHub API access and repository permissions
- **Repository health** - Validates issues are enabled, repository is accessible, and permissions are adequate
- **Private repository support** - Enhanced validation for private repositories with appropriate token scopes
- **Organization settings** - Checks for organization-level restrictions that might affect setup

### Step 6: GitHub Token Setup

```
🔑 GitHub Token Setup
For full functionality, Buddy needs appropriate GitHub permissions.
This enables workflow file updates and advanced GitHub Actions features.
```

Provides three options:

- **Use organization/repository secrets** - A PAT is already configured as an organization or repository secret
- **Set up a new Personal Access Token** - Full guidance through PAT creation and secret configuration
- **Use default GITHUB_TOKEN only** - Limited permissions; workflow file updates will not work

### Step 7: Repository Settings

```
🔧 Repository Settings
```

Guides you through configuring GitHub Actions permissions:

1. Repository settings → Actions → General
2. Select "Read and write permissions"
3. Enable "Allow GitHub Actions to create and approve pull requests"

### Step 8: Workflow Configuration

```
⚙️  Workflow Configuration
? What type of update schedule would you like?
```

Choose from carefully crafted presets:

#### Available Presets

| Preset | Description |
|--------|-------------|
| **Standard Setup (Recommended)** | Dashboard updates 3x/week, dependency updates on schedule |
| **High Frequency** | Check for updates multiple times per day |
| **Security Focused** | Frequent patch updates with security-first approach |
| **Minimal Updates** | Weekly checks, lower frequency |
| **Development/Testing** | Manual triggers + frequent checks for testing |
| **Custom Configuration** | Create your own schedule |

The preset names the intent you picked; the workflow it writes is the same either way. See [Preset Details](#preset-details) for what that means once setup is done.

### Step 9: Configuration File Generation

```
📝 Configuration File
✅ Created buddy.config.ts with your repository settings.
💡 You can edit this file to customize Buddy's behavior.
🔧 The TypeScript config provides better IntelliSense and type safety.
```

Creates a complete configuration file with:

- Repository information
- Dashboard settings
- Workflow templates
- Package strategies
- Default options

### Step 10: Workflow Generation

```
🔄 Workflow Generation
✨ Setting up Standard Project...
📋 Daily patch updates, weekly minor updates, monthly major updates
Generated unified buddy workflow (combines check, update, and dashboard)
Generated GitHub Actions security audit workflow (buddy-security.yml)
✓ Generated unified workflow in .github/workflows
```

Generates two workflows:

#### 1. Unified Workflow (`buddy.yml`)

- **Schedule**: dependency updates every 2 hours, dashboard 15 minutes later, cleanup daily at 4 AM UTC, health report Monday at 9 AM UTC
- **Events**: `pull_request`, `issues`, `issue_comment`, `pull_request_review_comment` and `workflow_run`, so a ticked rebase box or an `@buddy` comment is acted on immediately rather than waited for
- **Purpose**: One workflow covering checks, updates, the dashboard, reviews and comment commands
- **Features**: `workflow_dispatch` with a `job` input to run a single job by hand

#### 2. Security Audit Workflow (`buddy-security.yml`)

- **Schedule**: Monday at 6 AM UTC, plus every push and pull request touching `.github/workflows/**`
- **Purpose**: Static-analyses your GitHub Actions workflows for supply-chain footguns
- **Features**: Kept separate so its path filters fire independently of the dependency pipeline

If an earlier version of Buddy left `buddy-check.yml`, `buddy-update.yml`, `buddy-dashboard.yml` or `gh-audit.yml` behind, setup deletes them — their jobs now live in `buddy.yml` and `buddy-security.yml`.

### Workflow Validation & Testing

```
🔍 Validating Generated Workflows
```

The checks live in `validateWorkflowGeneration`, exported from `@buddysh/buddy/setup`, so you can run them over a workflow of your own as well.

**Validation Features:**

- **YAML syntax validation** - Ensures a workflow is syntactically correct
- **Required field verification** - Validates presence of name, on, jobs, and other essential fields
- **Security best practices** - Checks token usage, permissions, and security configurations
- **Buddy integration** - Verifies workflows include proper buddy execution commands
- **Permission validation** - Ensures workflows have appropriate permissions for their functions

**Security Validation:**

- **Token scope verification** - Validates GITHUB_TOKEN vs BUDDY_TOKEN usage
- **Permission matrix** - Ensures workflows have minimum required permissions
- **Secret handling** - Validates secure handling of tokens and sensitive information
- **Workflow permissions** - Checks for explicit permission definitions and security boundaries

### Final Instructions & Integration Notifications

```
🎉 Setup Complete!
✅ Generated unified buddy workflow in .github/workflows/:
   - buddy.yml (Combined check, update, and dashboard management)
📁 Configuration file: buddy.config.ts
```

Provides clear next steps with:

- Git commands for committing changes
- Token setup instructions (if needed)
- Repository permissions configuration
- Links to GitHub settings pages

**Integration Notifications:**

- **Slack Messages** - Rich setup completion notifications with repository details, project type, and package manager information
- **Discord Embeds** - Colorful setup completion embeds with project metadata and timestamp tracking
- **Jira Tickets** - Automatic task creation for tracking and documenting setup completion
- **Custom Hooks** - Extensible plugin system for organization-specific notifications and integrations

## Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--verbose, -v` | Enable verbose logging and detailed output | `false` |
| `--non-interactive` | Run setup without prompts using defaults | `false` |
| `--preset <type>` | Workflow preset: `standard`, `high-frequency`, `security`, `minimal`, `testing` | `standard` |
| `--token-setup <type>` | Token setup mode: `existing-secret`, `new-pat`, `default-token` | `default-token` |

## Non-Interactive Mode

For CI/CD pipelines, automated deployments, or when you want to use defaults, the non-interactive mode allows setup without prompts:

### Basic Non-Interactive Setup

```bash
# Use all defaults (standard preset with default token)
buddy setup --non-interactive
```

This will:

- ✅ Use the `standard` preset for workflow configuration
- ✅ Use `default-token` mode (GITHUB_TOKEN with limited functionality)
- ✅ Skip all interactive prompts and confirmations
- ✅ Still perform migration detection and integration discovery
- ✅ Generate all necessary files with sensible defaults

### Advanced Non-Interactive Options

```bash
# High-frequency testing setup with verbose output
buddy setup --non-interactive --preset testing --verbose

# Security-focused setup with custom token
buddy setup --non-interactive --preset security --token-setup new-pat

# Standard setup using existing organization secrets
buddy setup --non-interactive --preset standard --token-setup existing-secret
```

### Non-Interactive Behavior

When `--non-interactive` is enabled:

| Component | Interactive Mode | Non-Interactive Mode |
|-----------|------------------|---------------------|
| **Configuration Migration** | Shows prompts, asks for confirmation | Detects tools, skips migration, logs findings |
| **Integration Discovery** | Shows available plugins, asks to load | Detects plugins, skips loading, logs findings |
| **Repository Detection** | Interactive validation and confirmation | Automatic detection, no user input required |
| **Token Setup** | Guided token creation with prompts | Uses specified `--token-setup` mode |
| **Workflow Configuration** | Interactive preset selection | Uses specified `--preset` (default: standard) |
| **Final Instructions** | Shows detailed next steps | Shows minimal completion message |

### Token Setup Modes

#### `default-token` (Default)

```bash
buddy setup --non-interactive --token-setup default-token
```

- Uses `GITHUB_TOKEN` provided by GitHub Actions
- Limited functionality (cannot update workflow files)
- Suitable for basic dependency updates
- No additional setup required

#### `existing-secret`

```bash
buddy setup --non-interactive --token-setup existing-secret
```

- Assumes `BUDDY_TOKEN` secret already exists
- Full functionality including workflow file updates
- Suitable for organizations with pre-configured secrets
- Best for production environments

#### `new-pat`

```bash
buddy setup --non-interactive --token-setup new-pat
```

- Configures for custom Personal Access Token
- Generates workflows that use `BUDDY_TOKEN`
- Requires manual token creation and secret setup
- Provides warnings about manual steps needed

### Preset Options

Every preset writes the same `buddy.yml`: dependency updates every 2 hours on the `patch` strategy, the dashboard 15 minutes behind them, and a manual trigger for running any single job. The preset records the cadence you intended — change the cadence itself in the workflow's `schedule:` block afterwards.

#### Standard Preset

```bash
buddy setup --non-interactive --preset standard
```

- Reported as **Standard Project**
- Daily patch updates, weekly minor updates, monthly major updates
- The default when `--preset` is omitted

#### Testing Preset

```bash
buddy setup --non-interactive --preset testing
```

- Reported as **Development/Testing**
- Manual trigger + every 20 minutes (for testing)
- Optimized for development and testing

#### Security Preset

```bash
buddy setup --non-interactive --preset security
```

- Reported as **Security Focused**
- Frequent patch updates with security-first approach
- Suitable for security-critical applications

#### High-Frequency Preset

```bash
buddy setup --non-interactive --preset high-frequency
```

- Reported as **High Frequency Updates**
- Check for updates 4 times per day (6AM, 12PM, 6PM, 12AM)
- Suitable for active development

#### Minimal Preset

```bash
buddy setup --non-interactive --preset minimal
```

- Reported as **Minimal Updates**
- Weekly patch updates, monthly minor/major updates
- Conservative approach for stable projects

### CI/CD Integration Examples

#### GitHub Actions Workflow

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
  setup:
    runs-on: ubuntu-latest
    steps:

      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Setup Buddy

        run: |
          bunx @buddysh/buddy setup \
            --non-interactive \
            --preset ${{ github.event.inputs.preset || 'standard' }} \
            --token-setup existing-secret \
            --verbose
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Docker Container Setup

```dockerfile
FROM oven/bun:latest

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install

# Non-interactive setup for containerized environments
RUN bunx @buddysh/buddy setup \
    --non-interactive \
    --preset minimal \
    --token-setup default-token \
    --verbose
```

#### Shell Script Automation

```bash
# !/bin/bash
# setup-buddy.sh

set -e

echo "Setting up Buddy for repository..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Determine preset based on environment
PRESET="standard"
if [[ "$ENVIRONMENT" == "development" ]]; then
    PRESET="testing"
elif [[ "$ENVIRONMENT" == "production" ]]; then
    PRESET="security"
fi

# Run non-interactive setup
bunx @buddysh/buddy setup \
    --non-interactive \
    --preset "$PRESET" \
    --token-setup existing-secret \
    --verbose

echo "Buddy setup complete!"
```

## Generated Files

The setup process creates several files:

### Configuration File (`buddy.config.ts`)

```typescript
import type { BuddyConfig } from '@buddysh/buddy'

const config: BuddyConfig = {
  repository: {
    owner: 'your-org',
    name: 'your-repo',
    provider: 'github',
    // Uses GITHUB_TOKEN by default
  },
  dashboard: {
    enabled: true,
    title: 'Dependency Dashboard',
    // issueNumber: undefined, // Auto-generated
  },
  workflows: {
    enabled: true,
    outputDir: '.github/workflows',
    templates: {
      daily: true,
      weekly: true,
      monthly: true,
    },
    custom: [],
  },
  packages: {
    strategy: 'all',
    ignore: [],
    ignorePaths: [],
  },
  verbose: false,
}

export default config
```

### Workflow Files

#### Unified Workflow (`buddy.yml`)

```yaml
name: Buddy

on:
  pull_request:
    types: [edited, opened, ready_for_review, synchronize, closed]

  issues:
    types: [edited, opened]

  issue_comment:
    types: [created]

  pull_request_review_comment:
    types: [created]

  workflow_run:
    types: [completed]

  schedule:

    - cron: '0 */2 * * *' # Dependency updates
    - cron: '15 */2 * * *' # Dashboard, 15 minutes behind
    - cron: '0 4 * * *' # Branch cleanup
    - cron: '0 9 * * 1' # Weekly dependency-health report

  workflow_dispatch: # Manual trigger, with job/strategy/dry_run inputs
```

#### Security Audit Workflow (`buddy-security.yml`)

```yaml
name: GH Actions Security Audit

on:
  push:
    branches: [main]
    paths:

      - '.github/workflows/**'

  pull_request:
    paths:

      - '.github/workflows/**'

  schedule:

    - cron: '0 6 * * 1' # Monday 06:00 UTC — weekly drift check

  workflow_dispatch:
```

## Token Setup Guide

### Creating a Personal Access Token

1. **Go to GitHub Settings**

   ```
   https://github.com/settings/tokens
   ```

2. **Generate New Token**
   - Click "Generate new token"
   - Give it a descriptive name (e.g., "buddy-token")

3. **Select Required Scopes**
   - ✅ `repo` - Full control of private repositories
   - ✅ `workflow` - Read and write permissions for GitHub Actions

4. **Copy Token**
   - Copy the generated token immediately
   - You won't be able to see it again

5. **Add Repository Secret**

   ```
   https://github.com/your-org/your-repo/settings/secrets/actions
   ```

   - Click "New repository secret"
   - Name: `BUDDY_TOKEN`
   - Value: Your generated token
   - Click "Add secret"

### Token Benefits

| Feature | GITHUB_TOKEN | BUDDY_TOKEN |
|---------|--------------|-----------------|
| **Package Updates** | ✅ Yes | ✅ Yes |
| **PR Creation** | ✅ Yes | ✅ Yes |
| **Workflow Updates** | ❌ No | ✅ Yes |
| **Advanced Features** | ❌ Limited | ✅ Full |

## Repository Settings

Configure GitHub Actions permissions:

1. **Repository Settings**

   ```
   https://github.com/your-org/your-repo/settings/actions
   ```

2. **Workflow Permissions**
   - Select "Read and write permissions"
   - ✅ Check "Allow GitHub Actions to create and approve pull requests"
   - Click "Save"

3. **Organization Settings** (if applicable)

   ```
   https://github.com/organizations/your-org/settings/actions
   ```

   - Configure the same permissions as above
   - Organization settings may override repository settings

## Preset Details

A preset is a statement of intent. Setup prints the one you chose and then writes the same `buddy.yml` for every preset: dependency updates every 2 hours (`0 */2 * * *`) on the `patch` strategy, the dashboard 15 minutes later, branch cleanup daily at 4 AM UTC and a dependency-health report on Monday at 9 AM UTC. Edit that `schedule:` block to change the cadence.

### Standard Setup (Recommended)

- **Reported as**: Standard Project
- **Intent**: Daily patch updates, weekly minor updates, monthly major updates
- **Best for**: Most projects wanting balanced automation

### High Frequency

- **Reported as**: High Frequency Updates
- **Intent**: Check for updates 4 times per day (6AM, 12PM, 6PM, 12AM)
- **Best for**: Active projects needing quick updates

### Security Focused

- **Reported as**: Security Focused
- **Intent**: Frequent patch updates with security-first approach
- **Best for**: Security-critical applications

### Minimal Updates

- **Reported as**: Minimal Updates
- **Intent**: Weekly patch updates, monthly minor/major updates
- **Best for**: Stable projects with low change frequency

### Development/Testing

- **Reported as**: Development/Testing
- **Intent**: Manual trigger + every 20 minutes (for testing)
- **Best for**: Testing Buddy functionality

## Post-Setup

After running setup, follow these steps:

### 1. Review Generated Files

```bash
# Check configuration
cat buddy.config.ts

# Review workflows
ls -la .github/workflows/
```

### 2. Test Setup

```bash
# Test repository detection
buddy scan --verbose

# See what an update run would open, without opening it
buddy update --dry-run

# Create or refresh the dashboard issue
buddy dashboard
```

### 3. Commit Changes

```bash
# Add generated files
git add .github/workflows/ buddy.config.ts

# Commit setup
git commit -m "Add Buddy dependency management workflows"

# Push to repository
git push
```

### 4. Verify Workflows

1. Go to repository **Actions** tab
2. Verify workflows appear in the list
3. Test the manual trigger on the Buddy workflow, picking the `dashboard` job
4. Check workflow permissions if needed

## Troubleshooting

### Setup Issues

**"Not a git repository" error:**
```bash
# Ensure you're in a git repository
git status

# Initialize if needed
git init
git remote add origin https://github.com/your-org/your-repo.git
```

**"Could not detect repository" error:**
```bash
# Check git remote
git remote get-url origin

# Should return: https://github.com/your-org/your-repo.git
# or: git@github.com:your-org/your-repo.git
```

### Permission Issues

**"GitHub Actions is not permitted" error:**

1. Check repository settings → Actions → General
2. Ensure "Read and write permissions" is selected
3. Enable "Allow GitHub Actions to create and approve pull requests"
4. Check organization settings if applicable

**Workflow files not updating:**

1. Ensure `BUDDY_TOKEN` secret is set
2. Verify token has `workflow` scope
3. Check repository permissions above

### Token Issues

**"Bad credentials" error:**

1. Verify `GITHUB_TOKEN` or `BUDDY_TOKEN` is set
2. Check token hasn't expired
3. Ensure token has required scopes (`repo`, `workflow`)

## Examples

### Interactive Setup

```bash
# Standard interactive setup (recommended for first-time users)
buddy setup

# Interactive setup with detailed logging
buddy setup --verbose
```

### Non-Interactive Setup

```bash
# Basic non-interactive setup (uses defaults)
buddy setup --non-interactive

# Non-interactive with specific preset
buddy setup --non-interactive --preset testing --verbose

# Production setup with existing secrets
buddy setup --non-interactive --preset security --token-setup existing-secret

# Development setup with new token
buddy setup --non-interactive --preset testing --token-setup new-pat --verbose
```

### Testing Setup Locally

```bash
# Test repository detection
buddy setup --verbose

# Test non-interactive flow
buddy setup --non-interactive --preset testing --verbose

# If setup completes, test scanning
buddy scan --verbose
```

## Technical Implementation

### Enhanced Setup Architecture

The enhanced setup command implements several advanced systems for a robust configuration experience:

#### Pre-flight Validation System

```typescript
interface ValidationResult {
  success: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}
```

**Environment Validation:**

- **Git repository checks** - Validates `.git` directory and remote configuration
- **Runtime environment** - Detects and validates Node.js/Bun installation
- **Configuration validation** - Checks git user.name and user.email settings
- **Tool detection** - Identifies GitHub CLI and other helpful development tools

**Conflict Detection:**

- **Workflow scanning** - Analyzes `.github/workflows/` for potential conflicts
- **Tool identification** - Detects Renovate, Dependabot, and other dependency managers
- **Configuration conflicts** - Identifies existing buddy or similar configurations

#### Smart Project Analysis Engine

```typescript
interface ProjectAnalysis {
  type: 'library' | 'application' | 'monorepo' | 'unknown'
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown'
  hasLockFile: boolean
  hasDependencyFiles: boolean
  hasGitHubActions: boolean
  recommendedPreset: string
  recommendations: string[]
}
```

**Project Intelligence:**

- **Type detection algorithm** - Analyzes package.json structure, workspace configuration, and file patterns
- **Package manager detection** - Identifies lock files and package manager signatures
- **Ecosystem analysis** - Scans for pkgx.yaml, deps.yaml, and Launchpad dependency files
- **Workflow integration** - Discovers existing GitHub Actions for update integration

#### Progress Tracking System

```typescript
interface SetupProgress {
  currentStep: number
  totalSteps: number
  stepName: string
  completed: string[]
  failed?: string
  canResume: boolean
  startTime: Date
}
```

**Progress Features:**

- **Visual indicators** - Real-time progress bars with completion percentages
- **State management** - Tracks completed steps and current progress
- **Recovery support** - Maintains state for resumption after interruptions
- **Performance monitoring** - Tracks setup duration and efficiency

#### Repository Validation API

```typescript
async function validateRepositoryAccess(repoInfo: RepositoryInfo): Promise<ValidationResult>
```

**API-Based Validation:**

- **Repository existence** - Tests GitHub API access and repository availability
- **Permission validation** - Verifies read/write access and organizational restrictions
- **Feature availability** - Checks if issues, pull requests, and actions are enabled
- **Private repository support** - Enhanced validation for private repositories

#### Workflow Validation Engine

```typescript
async function validateWorkflowGeneration(workflowContent: string): Promise<ValidationResult>
```

**Comprehensive Validation:**

- **YAML syntax validation** - Ensures generated workflows are syntactically correct
- **Security best practices** - Validates token usage, permissions, and security configurations
- **Buddy integration** - Verifies workflows include proper execution commands
- **Permission matrix validation** - Ensures workflows have appropriate GitHub Actions permissions

### Error Handling & Recovery

**Graceful Error Management:**

- **Detailed error reporting** - Comprehensive error messages with suggested solutions
- **Progressive degradation** - Continues setup where possible when non-critical steps fail
- **Recovery mechanisms** - Allows resumption from failed steps with state preservation
- **Rollback capabilities** - Provides mechanisms to undo partial setup on failure

**User Experience Enhancements:**

- **Clear progress indicators** - Visual feedback on setup progression
- **Contextual help** - Situation-specific guidance and troubleshooting
- **Intelligent recommendations** - Project-specific suggestions based on analysis
- **Setup verification** - Post-setup validation to ensure everything works correctly

## Next Steps

After successful setup:

1. **[Learn about the Dashboard](../features/dependency-dashboard.md)** - Understand dependency management
2. **[Explore Update Strategies](../features/update-strategies.md)** - Configure update behavior
3. **[Configure Package Management](../features/package-management.md)** - Fine-tune package handling
4. **[Review Pull Request Features](../features/pull-requests.md)** - Understand PR automation

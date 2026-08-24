# Package Commands

CLI commands for package analysis, management, and information retrieval.

## Package Information

### `info` - Package Details

Get comprehensive information about a package:

```bash
# Basic package info
buddy info react

# Detailed information
buddy info react --detailed

# Include dependencies
buddy info react --include-deps

# Show version history
buddy info react --versions --limit 10

# Output as JSON
buddy info react --json
```

**Options:**

- `--detailed` - Show extended package information
- `--include-deps` - Include dependency tree
- `--versions` - Show available versions
- `--limit <number>` - Limit version results
- `--json` - Output as JSON

### `versions` - Available Versions

List all available versions for a package:

```bash
# All versions
buddy versions typescript

# Latest 10 versions
buddy versions typescript --limit 10

# Include pre-releases
buddy versions typescript --include-pre

# Filter by tag
buddy versions typescript --tag latest

# Show release dates
buddy versions typescript --with-dates
```

### `latest` - Latest Version

Get the latest version of a package:

```bash
# Latest stable version
buddy latest vue

# Latest including pre-releases
buddy latest vue --include-pre

# Latest for specific tag
buddy latest vue --tag next
```

## Package Analysis

### `deps` - Dependency Analysis

Analyze package dependencies:

```bash
# Direct dependencies
buddy deps react

# Full dependency tree
buddy deps react --tree

# Specific depth
buddy deps react --depth 2

# Include dev dependencies
buddy deps react --include-dev

# Show outdated dependencies
buddy deps react --outdated

# Export dependency graph
buddy deps react --graph --output deps.json
```

**Options:**

- `--tree` - Show full dependency tree
- `--depth <number>` - Limit tree depth
- `--include-dev` - Include devDependencies
- `--outdated` - Show outdated dependencies
- `--graph` - Generate dependency graph
- `--output <file>` - Save output to file

### `check` - Package Updates

Check for available updates:

```bash
# Check all packages
buddy check

# Check specific packages
buddy check react vue typescript

# Check with strategy
buddy check --strategy minor

# Check security updates only
buddy check --security-only

# Check by pattern
buddy check --pattern "@types/*"

# Show changelogs
buddy check --with-changelog

# Group by update type
buddy check --group-by-type
```

**Options:**

- `--strategy <type>` - Update strategy (patch|minor|major|all)
- `--security-only` - Security updates only
- `--pattern <pattern>` - Package name pattern
- `--with-changelog` - Include changelog information
- `--group-by-type` - Group results by update type

### `outdated` - Outdated Packages

List packages that have updates available:

```bash
# All outdated packages
buddy outdated

# Outdated with severity
buddy outdated --severity

# Outdated dev dependencies
buddy outdated --dev-only

# Outdated production dependencies
buddy outdated --prod-only

# Table format
buddy outdated --table

# JSON output
buddy outdated --json
```

## Package Search

### `search` - Package Search

Search for packages in registries:

```bash
# Basic search
buddy search "state management"

# Limit results
buddy search "testing" --limit 20

# Search by keywords
buddy search --keywords "typescript,testing"

# Search by maintainer
buddy search --maintainer "facebook"

# Include deprecated packages
buddy search "react" --include-deprecated

# Sort by popularity
buddy search "ui components" --sort popularity
```

**Options:**

- `--limit <number>` - Limit search results
- `--keywords <keywords>` - Search by keywords (comma-separated)
- `--maintainer <name>` - Filter by maintainer
- `--include-deprecated` - Include deprecated packages
- `--sort <field>` - Sort by field (popularity|quality|maintenance)

### `exists` - Package Existence

Check if a package exists:

```bash
# Check if package exists
buddy exists @types/unknown-package

# Check multiple packages
buddy exists react vue angular

# Check with version
buddy exists react@18.0.0

# Silent mode (exit code only)
buddy exists react --silent
```

## Package Comparison

### `compare` - Version Comparison

Compare package versions:

```bash
# Compare two versions
buddy compare react 17.0.0 18.0.0

# Compare with current
buddy compare react --current 17.0.0 --target 18.0.0

# Show breaking changes
buddy compare react 17.0.0 18.0.0 --breaking-changes

# Include changelog
buddy compare react 17.0.0 18.0.0 --changelog

# Detailed comparison
buddy compare react 17.0.0 18.0.0 --detailed
```

### `diff` - Package Differences

Show differences between package versions:

```bash
# Show package.json differences
buddy diff react 17.0.0 18.0.0

# Show dependency differences
buddy diff react 17.0.0 18.0.0 --deps

# Show size differences
buddy diff react 17.0.0 18.0.0 --size

# Show vulnerability differences
buddy diff react 17.0.0 18.0.0 --vulnerabilities
```

## Registry Operations

### `registry` - Registry Management

Manage package registries:

```bash
# List configured registries
buddy registry list

# Add new registry
buddy registry add --name company --url https://npm.company.com

# Set default registry
buddy registry default company

# Test registry connection
buddy registry test company

# Remove registry
buddy registry remove company
```

### `whoami` - Registry Authentication

Check registry authentication:

```bash
# Check current user
buddy whoami

# Check for specific registry
buddy whoami --registry npm

# Check all registries
buddy whoami --all
```

## Package Validation

### `validate` - Package Validation

Validate package configurations:

```bash
# Validate package.json
buddy validate

# Validate dependencies
buddy validate --deps

# Check for security issues
buddy validate --security

# Check licenses
buddy validate --licenses

# Validate workspace packages
buddy validate --workspaces
```

### `audit` - Security Audit

Perform security audit:

```bash
# Basic audit
buddy audit

# Audit with fix suggestions
buddy audit --fix

# Audit specific severity
buddy audit --severity high

# Audit production only
buddy audit --production

# Generate audit report
buddy audit --report --output audit-report.json
```

## Package Management

### `install` - Install Packages

Install or update packages:

```bash
# Install package
buddy install lodash

# Install with version
buddy install lodash@4.17.21

# Install as dev dependency
buddy install --dev @types/lodash

# Install globally
buddy install --global typescript

# Install from specific registry
buddy install lodash --registry company
```

### `uninstall` - Remove Packages

Remove packages:

```bash
# Remove package
buddy uninstall lodash

# Remove dev dependency
buddy uninstall --dev @types/lodash

# Remove global package
buddy uninstall --global typescript

# Remove and update dependencies
buddy uninstall lodash --update-deps
```

## Workspace Operations

### `workspace` - Workspace Commands

Manage monorepo workspaces:

```bash
# List workspaces
buddy workspace list

# Show workspace info
buddy workspace info packages/ui

# Check workspace dependencies
buddy workspace deps packages/ui

# Update workspace
buddy workspace update packages/ui

# Validate workspace
buddy workspace validate packages/ui
```

## Output Formats

All package commands support multiple output formats:

```bash
# JSON output
buddy info react --json

# Table format
buddy outdated --table

# YAML output
buddy check --yaml

# CSV format
buddy outdated --csv

# Custom format
buddy info react --format "{name}@{version}"
```

## Configuration

Package commands respect global configuration:

```bash
# Use specific config file
buddy check --config custom-config.ts

# Override registry
buddy info react --registry https://npm.company.com

# Override strategy
buddy check --strategy major

# Debug mode
buddy check --debug

# Verbose output
buddy check --verbose
```

## Examples

### Daily Package Health Check

```bash
# Comprehensive package health check
buddy outdated --table && \
buddy audit --severity high && \
buddy validate --deps
```

### Security-Focused Analysis

```bash
# Check for security updates
buddy check --security-only --with-changelog

# Audit for vulnerabilities
buddy audit --production --report
```

### Monorepo Package Management

```bash
# Check all workspaces
buddy workspace list | xargs -I {} buddy check --workspace {}

# Validate workspace dependencies
buddy workspace validate --all
```

See [Package Management](/features/package-management) for more details on package handling features.

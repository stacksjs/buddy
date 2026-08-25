# Package Commands

CLI commands for package analysis and information retrieval.

## Package Information

### `info` - Package Details

Get comprehensive information about a package:

```bash
# Basic package info
buddy info react

# Info for a specific dist-tag
buddy info typescript@latest

# Output as JSON
buddy info react --json

# Verbose output
buddy info react --verbose
```

Without `--json`, the command prints the description, homepage, repository,
license, author, keywords, dependency counts and the number of published
versions.

**Options:**

- `--json` - Output as JSON
- `--verbose, -v` - Enable verbose logging

### `versions` - Available Versions

List available versions for a package:

```bash
# Most recent versions (10 by default)
buddy versions typescript

# Latest 5 versions
buddy versions typescript --latest 5
```

The output shows the total number of published versions, the latest version, and
the most recent versions in descending order.

**Options:**

- `--latest <count>` - Show only the latest N versions (default: `10`)
- `--verbose, -v` - Enable verbose logging

### `latest` - Latest Version

Get the latest version of a package:

```bash
# Latest version
buddy latest vue

# Works with scoped packages
buddy latest @types/node
```

**Options:**

- `--verbose, -v` - Enable verbose logging

## Package Analysis

### `deps` - Dependency Analysis

Show the dependencies a package declares:

```bash
# Production dependencies
buddy deps react

# Dev dependencies
buddy deps react --dev

# Peer dependencies
buddy deps react --peer

# Every dependency type
buddy deps react --all
```

**Options:**

- `--dev` - Show devDependencies
- `--peer` - Show peerDependencies
- `--all` - Show all dependency types
- `--verbose, -v` - Enable verbose logging

### `check` - Package Updates

Check named packages for available updates. At least one package name is
required:

```bash
# Check specific packages
buddy check react vue typescript

# Check with a strategy
buddy check react --strategy minor

# Verbose output
buddy check react typescript --verbose
```

Each update is reported as `name: current → new (type)`.

**Options:**

- `--strategy <type>` - Update strategy: `major|minor|patch|all` (default: `all`)
- `--verbose, -v` - Enable verbose logging

To check every dependency in the project rather than a fixed list, use
[`buddy scan`](/cli/update), which also accepts `--pattern "@types/*"` for
glob matching.

## Package Search

### `search` - Package Search

Search for packages in the registry:

```bash
# Basic search
buddy search "state management"

# Limit results
buddy search "test framework" --limit 5
```

**Options:**

- `--limit <count>` - Limit number of results (default: `10`)
- `--verbose, -v` - Enable verbose logging

### `exists` - Package Existence

Check whether a package exists in the registry:

```bash
# Check if a package exists
buddy exists react

# Check a name you expect to be free
buddy exists nonexistent-package-xyz
```

The command exits `0` when the package exists and `1` when it does not, so it
can be used directly in shell conditionals:

```bash
if buddy exists my-new-package-name; then
  echo "name is taken"
fi
```

**Options:**

- `--verbose, -v` - Enable verbose logging

## Package Comparison

### `compare` - Version Comparison

Compare two versions of a package:

```bash
# Compare two versions
buddy compare react 17.0.0 18.0.0

# Compare across a major boundary
buddy compare typescript 4.9.0 5.0.0
```

Both versions are positional and required. The output reports the update type
(`major`, `minor` or `patch`), how many published versions sit between the two,
and which of them is newer.

**Options:**

- `--verbose, -v` - Enable verbose logging

## Configuration

`--config` is a global option, so it works on every command:

```bash
# Use a specific config file
buddy check react --config custom-config.ts
```

`check` reads `packages.strategy` from the configuration file and `--strategy`
overrides it for that run. The registry lookup commands (`info`, `versions`,
`latest`, `deps`, `compare`, `search`, `exists`) query the registry directly and
take no configuration beyond the flags listed above.

## Examples

### Investigating a package before adding it

```bash
buddy exists fast-glob && \
buddy info fast-glob && \
buddy deps fast-glob --all
```

### Planning an upgrade

```bash
# See what versions are available
buddy versions typescript --latest 20

# Understand the jump
buddy compare typescript 5.8.2 5.9.0

# Check what Buddy would do with it
buddy check typescript --strategy minor
```

See [Package Management](/features/package-management) for more details on package handling features.

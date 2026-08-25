# Update Strategies

Buddy provides flexible update strategies to control how dependencies are updated, allowing you to balance stability with staying current.

## Overview

Update strategies determine which package versions buddy will suggest for updates. You can configure global strategies or set specific strategies for package groups.

## Available Strategies

### `patch` - Safest Updates

Updates only patch versions (bug fixes and security updates).

```typescript
// Example: 1.2.3 → 1.2.4 (but not 1.3.0 or 2.0.0)
export default {
  packages: {
    strategy: 'patch'
  }
} satisfies BuddyConfig
```

**When to use:**

- Production applications requiring maximum stability
- Critical systems where breaking changes must be avoided
- Security-focused updates only

**Example updates:**

- `react@18.2.0` → `react@18.2.1` ✅
- `react@18.2.0` → `react@18.3.0` ❌
- `react@18.2.0` → `react@19.0.0` ❌

### `minor` - Balanced Updates

Updates patch and minor versions (new features, backwards compatible).

```typescript
// Example: 1.2.3 → 1.3.0 (but not 2.0.0)
export default {
  packages: {
    strategy: 'minor'
  }
} satisfies BuddyConfig
```

**When to use:**

- Most production applications
- Teams that want new features without breaking changes
- Gradual adoption of improvements

**Example updates:**

- `typescript@5.1.0` → `typescript@5.1.6` ✅ (patch)
- `typescript@5.1.0` → `typescript@5.2.0` ✅ (minor)
- `typescript@5.1.0` → `typescript@6.0.0` ❌ (major)

### `major` - Breaking Changes Only

Updates major versions and nothing else. Minor and patch bumps are left for a
run configured to take them.

```typescript
// Example: 1.2.3 → 2.0.0
export default {
  packages: {
    strategy: 'major'
  }
} satisfies BuddyConfig
```

**When to use:**

- A dedicated maintenance window for breaking changes
- Keeping major upgrades in their own pull requests
- Teams comfortable with handling breaking changes

**Example updates:**

- `vue@2.7.0` → `vue@3.4.0` ✅ (major)
- `vue@2.7.0` → `vue@2.8.0` ❌ (minor)
- `vue@2.7.0` → `vue@2.7.16` ❌ (patch)

### `all` - Everything

Updates everything available, regardless of semver impact — major, minor and
patch together. This is the default.

```typescript
export default {
  packages: {
    strategy: 'all'
  }
} satisfies BuddyConfig
```

**When to use:**

- Experimental projects
- Early adoption teams
- Staying current across the whole dependency tree

**Example updates:**

- `react@18.2.0` → `react@18.2.1` ✅ (patch)
- `react@18.2.0` → `react@18.3.0` ✅ (minor)
- `react@18.2.0` → `react@19.0.0` ✅ (major)

Pre-release versions are a separate switch, not part of the strategy: set
`packages.includePrerelease` if you want alphas, betas and release candidates
considered.

### At a Glance

| Strategy | Updates it proposes |
| --- | --- |
| `all` | Everything, regardless of semver impact |
| `major` | Major versions only |
| `minor` | Minor and patch |
| `patch` | Patch only |

## Strategy Configuration

### Global Strategy

Apply the same strategy to all packages:

```typescript
export default {
  packages: {
    strategy: 'minor', // Applied to all packages
    ignore: ['react'] // Except ignored packages
  }
} satisfies BuddyConfig
```

### Package Groups with Different Strategies

Use different strategies for different types of packages:

```typescript
export default {
  packages: {
    strategy: 'patch', // Default strategy
    groups: [
      {
        name: 'Core Framework',
        patterns: ['react', 'react-dom', 'vue'],
        strategy: 'minor' // More conservative for core
      },
      {
        name: 'Development Tools',
        patterns: ['eslint', 'prettier', 'typescript'],
        strategy: 'major' // Dev-tool majors, batched on their own
      },
      {
        name: 'Testing Libraries',
        patterns: ['jest', 'vitest', '@testing-library/*'],
        strategy: 'minor'
      }
    ]
  }
} satisfies BuddyConfig
```

### Per-Package Strategy Override

Override strategy for specific packages:

```typescript
export default {
  packages: {
    strategy: 'minor',
    rules: [
      { matchPackages: ['react'], strategy: 'patch' }, // Keep React very stable
      { matchPackages: ['typescript'], strategy: 'major' }, // TypeScript majors only
      { matchPackages: ['@types/*'], strategy: 'all' } // Types can be aggressive
    ]
  }
} satisfies BuddyConfig
```

Rules are evaluated in order and later matches override earlier ones per
field, so a broad rule can set a default and a narrow one refine it.

## Smart Strategy Selection

Buddy automatically adjusts strategies based on package characteristics:

### Security Updates

Advisories from [OSV.dev](https://osv.dev) are matched against your
dependencies. With `prioritize` on, those updates are proposed ahead of
routine ones and carry their own label, so a fix is not queued behind a batch
of patch bumps:

```typescript
export default {
  security: {
    enabled: true,
    prioritize: true,
    label: 'security',
    minimumSeverity: 'moderate' // 'low' | 'moderate' | 'high' | 'critical'
  },
  packages: {
    strategy: 'patch'
  }
} satisfies BuddyConfig
```

Security handling changes ordering and labelling, not the version range: an
advisory whose fix is a minor release is still subject to the configured
strategy. Widen `strategy`, or add a rule, if you want those to land.

### Breaking Change Detection

Buddy analyzes changelogs and release notes to detect breaking changes:

```typescript
const breakingConfig = {
  packages: {
    strategy: 'major',
    breakingChangeHandling: {
      requireApproval: true, // Require manual approval for breaking changes
      skipBeta: true, // Skip beta versions with breaking changes
      maxMajorJump: 1 // Only allow 1 major version jump at a time
    }
  }
}
```

## Strategy Best Practices

### Progressive Strategy

Start conservative and gradually increase aggressiveness:

```typescript
// Week 1: Patch only
const week1Config = { strategy: 'patch' }

// Week 2: Add minor updates
const week2Config = { strategy: 'minor' }

// Week 3: minor everywhere, plus a group that takes dev-tool majors
const week3Config = {
  strategy: 'minor',
  groups: [
    {
      name: 'Development',
      patterns: ['eslint', 'prettier', 'webpack'],
      strategy: 'major'
    }
  ]
}
```

### Environment-Specific Strategies

Different strategies for different environments:

```typescript
const isProduction = process.env.NODE_ENV === 'production'
const isCorporate = process.env.CORPORATE_ENVIRONMENT === 'true'

export default {
  packages: {
    strategy: isProduction
      ? (isCorporate ? 'patch' : 'minor')
      : 'all'
  }
} satisfies BuddyConfig
```

### Ecosystem-Aware Strategies

Tailor strategies to specific ecosystems:

```typescript
const config = {
  packages: {
    strategy: 'minor',
    groups: [
      {
        name: 'React Ecosystem',
        patterns: ['react*', '@react*'],
        strategy: 'minor' // React ecosystem moves together
      },
      {
        name: 'Node Types',
        patterns: ['@types/node'],
        strategy: 'patch' // Node types should match Node version
      },
      {
        name: 'Build Tools',
        patterns: ['vite', 'rollup', 'esbuild'],
        strategy: 'major' // Build tools get their majors in a PR of their own
      }
    ]
  }
}
```

## CLI Strategy Overrides

Override configuration strategies via CLI:

```bash
# Force patch strategy regardless of config
buddy update --strategy patch

# Take the major bumps on their own, in a preview run first
buddy update --strategy major --dry-run

# Take the majors, but leave two packages behind
buddy update --strategy major --ignore react,vue
```

`--strategy` is a whole-run switch. Per-package strategies are config only —
use `rules` with `matchPackages`, as above.

## Monitoring Strategy Effectiveness

Track how strategies perform:

```typescript
const monitoringConfig = {
  packages: {
    strategy: 'minor',
    monitoring: {
      trackFailures: true, // Track failed updates
      rollbackThreshold: 3, // Auto-rollback after 3 failures
      successRate: 0.95, // Require 95% success rate
      adaptStrategy: true // Auto-adjust strategy based on success
    }
  }
}
```

## Common Strategy Patterns

### Conservative Enterprise

```typescript
export default {
  security: {
    enabled: true,
    prioritize: true,
    minimumSeverity: 'moderate'
  },
  packages: {
    strategy: 'patch',
    groups: [
      {
        name: 'Development Only',
        patterns: ['@types/*', 'eslint*', 'prettier'],
        strategy: 'minor'
      }
    ]
  }
} satisfies BuddyConfig
```

### Balanced Team

```typescript
export default {
  packages: {
    strategy: 'minor',
    groups: [
      {
        name: 'Core Dependencies',
        patterns: ['react', 'vue', 'angular'],
        strategy: 'patch'
      },
      {
        name: 'Development Tools',
        patterns: ['typescript', 'webpack', 'vite'],
        strategy: 'all'
      }
    ]
  }
} satisfies BuddyConfig
```

### Aggressive Startup

```typescript
export default {
  packages: {
    strategy: 'all',
    groups: [
      {
        name: 'Database & Infrastructure',
        patterns: ['prisma', 'mongoose', 'redis'],
        strategy: 'minor' // More careful with data layers
      }
    ]
  }
} satisfies BuddyConfig
```

## Integration with Pull Requests

Strategies affect PR creation:

- **Patch updates**: Auto-mergeable, minimal review
- **Minor updates**: Standard review process
- **Major updates**: Require explicit approval, additional testing
- **Security updates**: High priority, expedited merge

See [Pull Request Generation](/features/pull-requests) for more details on how strategies influence PR behavior.

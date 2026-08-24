# Monorepos

Buddy treats a monorepo as the normal case rather than a mode you switch on.
There is no `workspaces` setting to configure and no separate workspace
command: every manifest in the repository is discovered by walking it, and the
updates from all of them are grouped into pull requests the same way a
single-package project's are.

## How discovery works

Starting at the repository root, Buddy walks the tree and collects every
manifest and lock file it recognises:

- `package.json` at any depth, plus `bun.lock`, `package-lock.json`,
  `yarn.lock` and `pnpm-lock.yaml`
- `composer.json` and `composer.lock`
- `deps.yaml`, `dependencies.yaml`, `pkgx.yaml` and their dotted and `.yml`
  variants
- `Dockerfile`
- `.github/workflows/*.yml`
- `build.zig.zon`
- `go.mod`, `Cargo.toml`, `pyproject.toml`, `Gemfile`

Directories that never contain first-party manifests are skipped rather than
descended into — `node_modules`, `vendor`, `dist`, build output, and anything
whose name begins with a dot. A directory Buddy cannot read is skipped too, so
a permissions problem in one corner does not abort the scan.

For Bun and npm workspaces, Buddy additionally runs `bun outdated --filter`
per workspace package and merges those results with the root scan. Where a
package appears in both, the root result wins, since that is the version the
installer actually resolved.

## Excluding parts of the repository

`ignorePaths` takes glob patterns, matched against paths relative to the
repository root. This is the setting to reach for when a monorepo contains
fixtures, generated projects or an application that is deliberately frozen:

```typescript
import type { BuddyConfig } from '@buddysh/buddy'

export default {
  packages: {
    ignorePaths: [
      'packages/test-*/**',
      '**/*test-envs/**',
      'apps/legacy/**',
      'examples/**',
    ],
  },
} satisfies BuddyConfig
```

Patterns are evaluated with [Bun's `Glob`](https://bun.sh/docs/api/glob), so
`**` crosses directory boundaries and `*` does not.

To exclude a package everywhere it appears rather than a path, use `ignore`,
which matches package names:

```typescript
export default {
  packages: {
    ignore: ['@types/node', 'legacy-internal-tool'],
  },
} satisfies BuddyConfig
```

## pnpm catalogs

A pnpm workspace using catalogs keeps versions in `pnpm-workspace.yaml` and
writes `catalog:` in each `package.json`. Updating the `package.json` in that
case would overwrite the protocol string with itself and change nothing, so
Buddy reads the catalog instead and updates the version where it actually
lives.

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'

catalog:
  react: ^18.3.1
  typescript: ^5.8.2

catalogs:
  build:
    vite: ^5.4.0
```

Both the unnamed `catalog:` and named entries under `catalogs:` are read, and
a dependency written as `catalog:` or `catalog:build` resolves to the right
one. Updates are applied to the YAML file, so a single change propagates to
every package that referenced it.

## Grouping across packages

Groups match package names, not paths, so one group collects a dependency
wherever it appears in the repository. That is usually what you want: bumping
`typescript` in six packages belongs in one pull request, not six.

```typescript
export default {
  packages: {
    strategy: 'all',
    groups: [
      {
        name: 'TypeScript',
        patterns: ['typescript', '@types/*'],
        strategy: 'minor',
      },
      {
        name: 'Build Tools',
        patterns: ['vite', 'rollup', 'esbuild'],
        strategy: 'patch',
      },
    ],
  },
} satisfies BuddyConfig
```

Anything not matched by a group is batched by update type in the usual way.
See [update strategies](/features/update-strategies) for how `strategy`
interacts with grouping.

## Resolution drift

In a monorepo it is common for a package to sit behind its declared range
because something else in the tree caps it. `detectResolutionDrift` reports
those cases rather than opening a pull request that cannot change anything:

```typescript
export default {
  packages: {
    detectResolutionDrift: true,
  },
} satisfies BuddyConfig
```

The finding names the dependant whose range is doing the capping, which is the
piece that is otherwise tedious to work out by hand.

## Lock files

Every lock file Buddy touched is regenerated with the matching package manager
before the pull request is pushed, so a monorepo mixing Bun and pnpm ends up
with both files consistent. A package manager that is not installed on the
runner is skipped with a warning rather than producing a half-written lock
file.

## Limiting a run

There is no workspace flag, but a run can be narrowed by package:

```bash
buddy scan --packages "react,react-dom,typescript"
buddy scan --pattern "@types/*"
buddy update --ignore "typescript,vite"
```

`scan` narrows by package name or glob; `update` narrows by exclusion.
Combined with `ignorePaths`, that covers the cases a workspace filter would
otherwise be used for.

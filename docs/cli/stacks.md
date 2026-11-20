---
title: Stacks CLI
description: Run Stacks commands from Buddy and keep generated files current across your projects.
---

# Stacks CLI

Install Buddy once with Bun. The `buddy stacks` command uses each project's installed Stacks runtime.

```sh
bun add -g @buddysh/buddy
buddy stacks projects:scan ~/Code
buddy stacks dev --project shop
```

If you already installed `@stacksjs/buddy` globally with Bun, first run `bun remove -g @stacksjs/buddy`. Keep the copy installed by each project's dependencies.

## Use the runtime each project pins

Run `buddy stacks` from within a Stacks project or select one by name or path. Project commands run from its root on its installed framework version, so a machine can serve projects on different versions at the same time.

```sh
buddy stacks generate:migrations
buddy stacks generate:auto-imports --project ~/Code/shop
buddy stacks dashboard shop
```

The npm package also installs `stacks` and `bud` as shorthand. Use `buddy stacks` with the standalone Buddy binary and keep Bun on your PATH.

Use `--runtime <version>` before a Stacks command to select the machine runtime. Installed project commands still use the project's pinned version.

```sh
buddy stacks --runtime 0.75.635 --version
```

## Generate files in the background

Automatic generation requires Stacks 0.75.636 or later in each project you want to watch. Add `config/buddy.json` to those projects.

```json
{
  "generation": {
    "enabled": true,
    "autoCommit": false
  }
}
```

Start the background process once for the machine.

```sh
buddy stacks daemon:start
buddy stacks daemon:status
```

Buddy listens for file changes in registered projects, batches saves, and runs one generator at a time. It refreshes auto-imports, migration SQL and snapshots, named routes, and database declarations. Background generation leaves potentially destructive schema changes for review with `buddy stacks generate:migrations`.

The generated files are available to review in your working tree. Set `autoCommit` to `true` if you want Buddy to commit eligible generated files. See the [Stacks project and generation guide](https://stacksjs.com/docs/guide/buddy/projects) for the individual generator switches.

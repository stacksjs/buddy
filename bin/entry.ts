#!/usr/bin/env -S bun --config=/dev/null --no-install --no-env-file

import process from 'node:process'
import { runStacks, stacksArgs } from '../src/stacks-cli'

export async function main(): Promise<void> {
  const args = stacksArgs(process.argv.slice(2))
  if (args)
    runStacks(args)

  const { cli } = await import('./cli')
  cli.parse()
}

if (import.meta.main)
  await main()

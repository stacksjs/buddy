#!/usr/bin/env -S bun --config=/dev/null --no-install --no-env-file

import process from 'node:process'
import { runStacks } from '../src/stacks-cli'

if (import.meta.main)
  runStacks(process.argv.slice(2))

---
layout: home
title: Buddy for AI-Assisted Teams
description: When most of the diff was written by an agent, review is the bottleneck. buddy review --format agent closes the loop locally, before the pull request exists.

hero:
  name: "ai coding agents"
  text: "Somebody has to read what the agent wrote"
  tagline: "Generation got cheap and review did not. Buddy is the other half of the loop: it reads what your agent produced, states what actually breaks, and hands the findings back in a form the agent can act on — before any of it reaches a human."
  announcement:
    tag: "--format agent"
    text: "Pipe findings straight into your coding agent"
    link: "#loop"
  actions:
    - theme: brand
      text: Local review
      link: /features/local-review
    - theme: alt
      text: The agent runtime
      link: /ai/agent
  code:
    - file: "the loop"
      lang: "ascii"
      content: |
        $ claude "add rate limiting to the api"
          ... 9 files changed

        $ buddy review --format agent | claude

          # buddy emits an instruction, not a report:
          # change only what each finding asks for,
          # and you may disagree and leave the code
          # alone if a finding is wrong.

          ... 2 files changed

        $ buddy review --fail-on major
          no findings at or above major.

        $ git commit
    - file: "machine-readable"
      lang: "ascii"
      content: |
        $ buddy review --format json | jq '
            .findings[]
            | select(.severity == "major")
            | {file, line, message}'

        {
          "file": "src/api/limit.ts",
          "line": 34,
          "message": "The counter is keyed by IP
            before the proxy header is trusted, so
            every request behind the load balancer
            shares one bucket."
        }

        $ buddy run \
            --prompt "summarise this week's merges" \
            --output-schema-file schema.json

features:
  - title: "A second model, not the same one"
    icon: "👀"
    span: 2
    details: "An agent reviewing its own output agrees with itself. Buddy runs as a separate pass with its own prompt, its own context and — if you want — a different provider entirely, which is the only way the review is worth anything."
  - title: "Permission to disagree"
    icon: "🤔"
    details: "--format agent tells the agent to change only what each finding asks for and explicitly allows it to push back. An agent that mechanically applies a wrong finding is worse than one that argues."
  - title: "Runs before the PR"
    icon: "⏱️"
    details: "The whole loop happens in your working tree. Nothing hits CI, nothing notifies a teammate, and nothing costs a review cycle until the code is worth one."
  - title: "Deterministic checks first"
    icon: "🦴"
    details: "--light gives secret scanning, workflow auditing and the linters with no model at all. Agents leak keys into example files and invent workflow syntax; these catch it for free."
  - title: "Safe to run in a loop"
    icon: "🔁"
    details: "buddy review --fail-on major is a clean exit code, so an agent harness can iterate until the review passes without a human parsing prose."
  - title: "Headless, schema-validated"
    icon: "🧩"
    details: "buddy run --prompt ... --output-schema takes a JSON Schema and retries until the output validates, so a pipeline step gets structured data or a clear failure."
---

## The loop {#loop}

```bash
# 1. the agent writes
claude "add rate limiting to the api"

# 2. buddy reads it — a different pass, with its own context
buddy review --format agent | claude

# 3. gate it, so the loop terminates on a fact rather than a vibe
buddy review --fail-on major
```

`--format agent` emits an instruction block rather than a report. Every format except `pretty` owns stdout completely — diagnostics are suppressed — so nothing lands in the middle of the payload you are piping.

## Applying findings without a second agent

```bash
buddy review --fix          # confirm each suggestion
buddy review --fix --yes    # apply them all
```

Fixes are applied bottom-up within each file, so replacing one line cannot shift the line numbers of the ones still to apply. A suggestion whose line no longer matches — because the file moved since the review — is skipped rather than written, since applying it would corrupt an unrelated line.

## When the agent is Buddy

Buddy's own writing modes run inside a sandbox whose limits are structural: an empty environment plus an allowlist, so a command it runs cannot authenticate to anything; a workspace no resolved path can escape, checked twice against symlinks; and independent caps on tool calls, wall clock and tokens.

[Finishing touches](/features/finishing-touches) deliver agent work as a **stacked pull request** against your branch rather than a commit on it — so accepting agent output is a merge you reviewed, and refusing it is a close.

## Related

[Local review](/features/local-review) · [Local review CLI reference](/cli/review) · [Headless runs](/ai/headless) · [The agent runtime](/ai/agent) · [Finishing touches](/features/finishing-touches)

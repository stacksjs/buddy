---
layout: home
title: Your CI, Your Keys
description: Buddy is a binary that runs in your own pipeline. No app installed on your repository, no diff leaving your infrastructure, no per-seat pricing, and any model provider you like.

hero:
  name: "your ci, your keys"
  text: "There is no Buddy server"
  tagline: "Buddy is a step in a workflow you own. Your diff goes from your runner to the provider you chose, and nowhere else. Nothing to install on the repository, nobody to ask for a security review, no seat count to negotiate."
  announcement:
    tag: "MIT"
    text: "Open source, and it stays that way"
    link: /license
  actions:
    - theme: brand
      text: Install Buddy
      link: /install
    - theme: alt
      text: AI providers
      link: /ai/providers
    - theme: alt
      text: The security model
      link: /ai/agent
  code:
    - file: "the whole integration"
      lang: "yaml"
      content: |
        name: Buddy
        on:
          pull_request:
            types: [opened, synchronize]

        jobs:
          review:
            runs-on: ubuntu-latest
            timeout-minutes: 15
            permissions:
              contents: read
              pull-requests: write
              checks: write
            steps:
              - uses: actions/checkout@v4
                with: { fetch-depth: 0 }
              - uses: oven-sh/setup-bun@v2
              - run: bunx @buddysh/buddy review ${{ github.event.pull_request.number }}
                env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
                  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

        # that is the integration. there is no app
        # to install and no account to create.
    - file: "pick a provider"
      lang: "ts"
      content: |
        // Anthropic
        ai: { provider: 'anthropic', model: 'claude-opus-5' }

        // OpenAI
        ai: { provider: 'openai', model: 'gpt-5' }

        // Google
        ai: { provider: 'google', model: 'gemini-2.5-pro' }

        // OpenRouter
        ai: { provider: 'openrouter', model: 'meta-llama/llama-4-maverick' }

        // Anything OpenAI-compatible — including a
        // model running inside your own network
        ai: {
          provider: 'openai-compatible',
          baseUrl: 'https://llm.internal.acme.com/v1',
          model: 'acme-review-7b',
        }

        // Or none at all: the analyzers still run.

features:
  - title: "No third-party app on your repository"
    icon: "🏠"
    span: 2
    details: "A hosted reviewer needs an OAuth app with read access to your source, and your diffs pass through its infrastructure. Buddy needs a token you already have and a runner you already pay for. For a lot of organisations that is the difference between a two-week security review and a pull request."
  - title: "Your keys, your bill"
    icon: "🔑"
    details: "Model spend goes to your provider account, at your negotiated rate, with your retention settings. No per-seat licence sitting between you and the tokens you actually use."
  - title: "Bring your own model"
    icon: "🧠"
    details: "Anthropic, OpenAI, Google, OpenRouter, or any OpenAI-compatible endpoint — including a model hosted inside your own network. Nothing leaves the perimeter if you do not want it to."
  - title: "Or no model at all"
    icon: "🦴"
    details: "Configure no provider and Buddy keeps the analyzers: secret scanning, workflow auditing, actionlint, shellcheck, hadolint, markdownlint. Dependency updates run unchanged."
  - title: "Three git hosts"
    icon: "🌐"
    details: "GitHub, GitLab and Bitbucket Cloud, self-hosted instances included — point repository.apiUrl at your API root."
  - title: "Credentials are absent, not filtered"
    icon: "🔒"
    span: 2
    details: "Commands the agent runs start from an empty environment plus an allowlist, so a command cannot authenticate to your registry, your cloud or GitHub — the variables are simply not there. A blocklist would leak tomorrow's secret until someone remembered to write a rule; an allowlist makes it invisible by default."
---

## What actually leaves your network

| | Where it goes |
| --- | --- |
| The diff and the review prompt | The model provider you configured — and only when you configure one |
| The findings | Your git host, posted by your token |
| Dependency metadata queries | Public registries: npm, Packagist, crates.io, PyPI, RubyGems, the Go proxy, OSV.dev |
| Anything else | Nowhere. There is no telemetry endpoint and no vendor backend |

Run `buddy review --light` and the first row disappears too: no model, no network beyond your own repository.

## Self-hosted git

```ts
export default {
  repository: {
    provider: 'gitlab',
    owner: 'group/subgroup',   // subgroups included
    name: 'repo',
    apiUrl: 'https://gitlab.acme.com/api/v4',
  },
} satisfies BuddyConfig
```

Tokens are resolved from the environment by provider convention — `GITHUB_TOKEN`, `CI_JOB_TOKEN`, `BITBUCKET_TOKEN`, with `BUDDY_TOKEN` as the explicit override. Buddy never reads a token from a configuration file by default. See [git providers](/advanced/providers).

## The sandbox, in one table

Buddy's writing modes run inside the [agent runtime](/ai/agent), whose boundaries are structural rather than instructional:

| Boundary | How it holds |
| --- | --- |
| Tool availability | A mode declares capability tiers; a tool outside them is never advertised to the model, so it cannot be requested |
| Third-party text | PR bodies, comments and branch content arrive as tool output inside an escaped `<untrusted-content>` block — never in the system prompt |
| Filesystem | Every path resolved against the workspace and rejected if it escapes, checked twice so a symlink cannot slip past |
| Environment | Empty plus an allowlist, with a second check that drops anything whose *name* looks like a credential |
| Runaway runs | Independent caps on tool calls, wall clock and tokens |
| Transcripts | Structured, and passed through the same redaction filter as the rest of the AI layer |

## Cost, honestly

Buddy itself is MIT-licensed and free. What you pay is model tokens at your provider's rate, plus CI minutes you are already buying. A repository that runs `--light` in a hook and the analyzers in CI pays neither.

## Related

[AI providers](/ai/providers) · [The agent runtime](/ai/agent) · [Workflow security](/features/workflow-security) · [Platform teams](/use-cases/platform-teams) · [Compare Buddy](/compare/)

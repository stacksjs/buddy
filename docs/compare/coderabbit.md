---
layout: home
title: Buddy vs CodeRabbit
description: CodeRabbit is a hosted AI reviewer installed as an app on your repository. Buddy is a CLI in your own pipeline, with your own model keys — and it manages dependencies too.

hero:
  name: "buddy vs coderabbit"
  text: "Same job, different address"
  tagline: "CodeRabbit is the best-known hosted AI reviewer and it is a polished product. The questions that usually decide between them are not about review quality: where does the diff go, who pays for the tokens, and how many tools are you running."
  actions:
    - theme: brand
      text: AI code review
      link: /features/ai-code-review
    - theme: alt
      text: Your CI, your keys
      link: /features/self-hosted
    - theme: alt
      text: All comparisons
      link: /compare/
  code:
    - file: "the whole integration"
      lang: "yaml"
      content: |
        # no app to install, no account to create,
        # no OAuth scope to justify to security.
        name: Buddy
        on:
          pull_request:
            types: [opened, synchronize]

        jobs:
          review:
            runs-on: ubuntu-latest
            permissions:
              contents: read
              pull-requests: write
            steps:
              - uses: actions/checkout@v4
                with: { fetch-depth: 0 }
              - uses: oven-sh/setup-bun@v2
              - run: bunx @buddysh/buddy review ${{ github.event.pull_request.number }}
                env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
                  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

features:
  - title: "Your diff does not leave your pipeline"
    icon: "🏠"
    span: 2
    details: "A hosted reviewer needs an app with read access to your source, and your diffs pass through its infrastructure. Buddy's diff goes from your runner to the model provider you configured — and with --light, to nobody at all. For a lot of organisations that is the difference between a two-week security review and a pull request."
  - title: "You pick the model"
    icon: "🧠"
    details: "Anthropic, OpenAI, Google, OpenRouter, or any OpenAI-compatible endpoint — including one inside your own network. Tokens are billed to your account at your rate."
  - title: "Not priced per developer"
    icon: "🧾"
    details: "Buddy is MIT-licensed. Cost scales with the reviews you actually ran, not with headcount."
  - title: "It does dependencies as well"
    icon: "📦"
    details: "The Renovate and Dependabot job — grouping, changelogs, advisories, dashboard, auto-merge — across eleven ecosystems. That is one fewer vendor."
  - title: "Runs before the PR exists"
    icon: "💻"
    details: "buddy review reads the working tree; --light runs the analyzers offline, fast enough for a pre-commit hook. A hosted reviewer cannot see code that has not been pushed."
  - title: "Open source, MIT"
    icon: "📖"
    details: "Read the prompts, read the sandbox, fork it. Nothing about how a finding was produced is behind an API."
---

## Side by side

| | Buddy | CodeRabbit |
| --- | --- | --- |
| AI pull request review | ✅ | ✅ |
| In-thread `@bot` commands | ✅ | ✅ |
| Committable suggestions | ✅ | ✅ |
| Merge gates as check runs | ✅ | ✅ |
| Dependency updates | ✅ | — |
| Workflow supply-chain audit | ✅ | — |
| CI repair | ✅ | — |
| Local pre-push review | ✅ | — |
| Works with no API key | ✅ analyzers | — |
| Runs entirely in your CI | ✅ | Hosted app |
| Bring your own model | ✅ | — |
| Pricing model | MIT + your tokens | Per developer, hosted |
| Open source | ✅ MIT | — |

Product capabilities change; check CodeRabbit's own documentation before deciding on any single row.

## Where CodeRabbit is the better choice

- **You want it working in five minutes with no CI work.** Install the app, approve the scopes, done. Buddy needs a workflow file and a provider key, which `buddy setup` writes for you but is still more than clicking install.
- **You want a hosted dashboard and a support contract.** Buddy has neither. It has a GitHub repository and a Discord.
- **You do not have a model provider account** and do not want one. Buddy's AI features need a key; CodeRabbit's pricing includes the inference.
- **You want the product's own accumulated review tuning** rather than the prompts and analyzers Buddy ships, which you can read and change but also have to live with.

## Where Buddy is different

**Two jobs.** Most teams running CodeRabbit also run Renovate or Dependabot. Buddy is one binary, one config and one set of workflows for both — and either half runs alone.

**No third-party app.** The security review is short: your runner invokes a CLI, using a token your workflow already has, and the only outbound call is the one to the provider you chose. There is no vendor backend and no telemetry.

**A floor with no model at all.** `buddy review --light` runs secret scanning, workflow auditing, `actionlint`, `shellcheck`, `hadolint`, `markdownlint` and syntax checks with no key and no network. Every repository gets that for nothing, including the ones nobody would pay a per-seat licence for.

**Local review.** The fastest review is the one before the pull request exists:

```bash
buddy review                      # working tree, staged included
buddy review --format agent | claude
```

## Running both

Nothing stops you. Buddy's findings are posted by your own token under your own bot identity, so the two do not collide. A common shape is CodeRabbit for the hosted review experience and Buddy for dependencies, gates and the offline pre-commit hook — then a decision once you can see what each is actually catching.

## Related

[AI code review](/features/ai-code-review) · [Your CI, your keys](/features/self-hosted) · [Local review](/features/local-review) · [All comparisons](/compare/)

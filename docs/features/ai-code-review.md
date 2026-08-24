---
layout: home
title: AI Code Review
description: Buddy reviews pull requests the way a colleague would — inline findings anchored to the lines you changed, each stating the failure it causes. Runs on your CI, with your keys, against the model you choose.

hero:
  name: "ai code review"
  text: "Findings, not opinions"
  tagline: "Every review Buddy posts is anchored to a line you actually changed and names the failure it causes. No nitpicks about brace style, no summary of what the diff already says, and never the same finding twice."
  announcement:
    tag: "review"
    text: "Works without an API key, too"
    link: /features/local-review
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Review locally first
      link: /cli/review
    - theme: alt
      text: vs CodeRabbit
      link: /compare/coderabbit
  code:
    - file: "a review"
      lang: "ascii"
      content: |
        $ buddy review 128

                     __
            (\,------'()'--o    reading pull request #128
             (_    ___    /~"   14 files, 412 changed lines
              (_)_)  (_)_)

          src/auth/session.ts:82  major  correctness
            Token refresh drops the error, so an
            expired session reads as a good login.

          src/queue/worker.ts:31  minor  correctness
            The retry counter resets inside the loop,
            so a failing job retries forever.

          .github/workflows/ci.yml:19  minor  security
            Interpolates a PR title into `run:`.

          3 findings. 2 inline, 1 already reported.
    - file: "in the thread"
      lang: "ascii"
      content: |
        buddy  commented on src/auth/session.ts

          major · correctness

          `refreshToken()` returns `null` on a network
          error and on an expired token alike, and the
          caller treats `null` as "no refresh needed".
          An expired session therefore reads as a valid
          login until the next hard reload.

          Distinguish the two, or throw on the error
          path so the caller cannot silently continue.

          ✔ resolved by a later push

features:
  - title: "Anchored to your diff"
    icon: "📍"
    span: 2
    details: "Buddy reviews the lines the pull request changed, with enough surrounding context to judge them. A finding that cannot be attached to a changed line is reported in the summary rather than pinned to an innocent line, so nothing lands where it did not belong."
  - title: "Severity that means something"
    icon: "🎚️"
    details: "major, minor and nit. A major finding is a bug you would revert for. --fail-on turns that scale into an exit code, so severity is a gate rather than a decoration."
  - title: "Incremental by design"
    icon: "♻️"
    details: "Buddy records what it already said. Push again and you get findings about the new changes — not a fresh copy of the review you read this morning."
  - title: "Analyzers included"
    icon: "🧰"
    details: "Secret scanning, actionlint, shellcheck, hadolint, markdownlint and syntax checks run alongside the model, so one command reports everything instead of you merging two reports by hand."
  - title: "Suggestions you can commit"
    icon: "✅"
    details: "Where a fix is unambiguous, the finding carries a committable suggestion. Locally, buddy review --fix applies them bottom-up so one edit cannot shift the line numbers of the next."
  - title: "Prompt injection is assumed"
    icon: "🔒"
    span: 2
    details: "Pull request bodies, comments and contributor branch content are written by third parties. They never reach the system prompt — they arrive as tool output inside an explicit untrusted-content marker, with the escape sequence neutralised so a payload cannot close the block early and appear to be trusted context."
---

## What a review run does

```bash
buddy review 128            # review a PR and post the result
buddy review 128 --dry-run  # print it instead of posting
```

In CI it is one step in a workflow you own:

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: oven-sh/setup-bun@v2
- run: bunx @buddysh/buddy review ${{ github.event.pull_request.number }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

The diff is read by your runner, sent to the provider you configured, and the findings are posted by your token. There is no Buddy server in the path, because there is no Buddy server.

## Pick the model

```ts
// buddy.config.ts
export default {
  ai: {
    provider: 'anthropic',
    model: 'claude-opus-5',
    maxTokensPerRun: 200_000,
  },
} satisfies BuddyConfig
```

Anthropic, OpenAI, Google, OpenRouter and any OpenAI-compatible endpoint are supported. Model aliases (`opus`, `sonnet`, `haiku`) resolve to current Anthropic models; every other provider takes a concrete ID. See [AI providers](/ai/providers).

## Teach it your house rules

Review guidelines are read from your repository, so the standards a reviewer enforces are the ones your team wrote down rather than a vendor's defaults. `@buddy remember ...` appends a note that later runs read back, which is how a one-off correction in a thread becomes a standing rule.

## What it deliberately does not do

- **It does not rewrite your code.** Review mode draws only from the read and comment tool tiers; a write tool is never advertised to the model, so it cannot be requested at all. Changing code is [`fix-ci`](/features/ci-repair) and [finishing touches](/features/finishing-touches), and both are opt-in.
- **It does not block on the model.** A provider outage degrades the review to the analyzers rather than failing the run.
- **It does not act on a drive-by comment.** [`@buddy` commands](/features/pr-conversations) are permission-checked against the actor's access to the repository.

## Related

[In-thread conversations](/features/pr-conversations) · [Local review](/features/local-review) · [Merge gates](/features/merge-gates) · [The agent runtime](/ai/agent) · [Buddy vs CodeRabbit](/compare/coderabbit)

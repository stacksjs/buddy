---
layout: home
title: Pull Request Conversations
description: Mention @buddy in a pull request to re-review, summarise, resolve threads, pause, plan, rebase or ask a question. Every command is permission-checked against the commenter's access.

hero:
  name: "conversations"
  text: "It answers to its name"
  tagline: "A reviewer that cannot be argued with is a linter. Mention @buddy in the thread to re-run the review, ask why a finding is a finding, resolve what it opened, or tell it to be quiet on this one."
  announcement:
    tag: "commands"
    text: "Permission-checked, so a drive-by comment cannot act"
    link: "#permissions"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: CLI reference
      link: /cli/overview
  code:
    - file: "the command table"
      lang: "ascii"
      content: |
        @buddy review        new changes since last time
        @buddy full-review   re-read the whole diff
        @buddy summary       a summary, no inline notes
        @buddy resolve       resolve the threads it opened
        @buddy pause         stop reviewing this PR
        @buddy resume        start again
        @buddy fix-ci        diagnose the failing checks
        @buddy plan          turn an issue into a plan
        @buddy rebase        rebase a dependency update
        @buddy merge         re-check auto-merge now
        @buddy remember ...  keep a note for future runs
        @buddy help          show the table

        ...anything else is treated as a question,
        and answered in the thread.
    - file: "asking a question"
      lang: "ascii"
      content: |
        alice  commented 2 minutes ago

          @buddy why is this a race condition? the map
          is only written from one place.

        buddy  commented just now

          It is written from one place, but read from
          two. `flush()` iterates the map while the
          timer callback in worker.ts:44 can delete
          from it, and both run on the same loop only
          when the queue is empty.

          The reproducing order is: flush starts, an
          await yields, the timer fires, the entry is
          deleted, flush resumes on a stale iterator.

features:
  - title: "Re-review on demand"
    icon: "🔁"
    details: "@buddy review reads only what changed since the last run. @buddy full-review starts over, for when the branch has moved far enough that incremental is the wrong answer."
  - title: "Ask it anything"
    icon: "❓"
    details: "Anything that is not a command is treated as a question about this diff, and answered in the thread with the code in front of it."
  - title: "Quiet when you need it"
    icon: "🔕"
    details: "@buddy pause stops the reviewer on a noisy pull request without disabling it repository-wide. @buddy resume starts it again."
  - title: "Cleans up after itself"
    icon: "🧹"
    details: "@buddy resolve closes the threads Buddy opened — not the ones your teammates did — so a fixed review does not leave a page of stale conversation."
  - title: "Remembers corrections"
    icon: "🧠"
    details: "@buddy remember we pin all actions to a SHA writes the note down. Later runs read it back, so telling it once is enough."
  - title: "Permission-checked"
    icon: "🔐"
    span: 2
    details: "A command is dispatched only after the commenter's write access is verified. On a public repository a contributor without write access lands in restricted mode, which draws from read-only tools — so the worst a hostile comment can do is ask Buddy to read something it can already read."
---

## How it is wired

One workflow, triggered by comments:

```yaml
name: Buddy Comments
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  respond:
    if: contains(github.event.comment.body, '@buddy')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      checks: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bunx @buddysh/buddy handle-comment
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

`buddy setup` generates this for you. The command reads the event payload from the environment, so there is nothing to wire by hand.

## Issues answer too

`buddy handle-issue` posts Buddy's quick-links on a new issue — a set of checkboxes that turn an issue into an action without anyone having to remember the command names. Tick "plan this" and Buddy replies with an implementation plan; the plan mode draws only from read tools, so it can propose work it cannot perform.

## Permissions {#permissions}

Buddy classifies the actor before it classifies the request:

| Actor | Mode | Can it change the repository? |
| --- | --- | --- |
| Write access or above | The mode the command asks for | Yes, where the command is a writing one |
| No write access | `restricted` | No — read tools only |

Public repositories accept input from anyone, so the actor is gated exactly as tightly as the task. An unknown mode name raises an error rather than falling back to a permissive default, because silently landing in `implement` on a typo would be the worst possible failure.

Third-party text — the pull request body, the comment itself, branch content — never enters the system prompt. It arrives as tool output wrapped in an untrusted-content marker, with the closing sequence escaped inside the payload so the text cannot break out of its own quotation. Details in [the agent runtime](/ai/agent).

## Related

[AI code review](/features/ai-code-review) · [CI repair](/features/ci-repair) · [Finishing touches](/features/finishing-touches) · [The agent runtime](/ai/agent)

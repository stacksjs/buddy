---
layout: home
title: Buddy vs Greptile
description: Greptile indexes your whole codebase to give reviews cross-file context. Buddy stays diff-scoped, keeps the code on your side, and carries the dependency half too.

hero:
  name: "buddy vs greptile"
  text: "Whole-repo context, or no repo upload"
  tagline: "Greptile's bet is that a good review needs to understand the whole codebase, so it builds an index of it. That is a genuinely different design, and the trade it implies — your source, indexed on their infrastructure — is the whole comparison."
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
    - file: "what leaves your network"
      lang: "ascii"
      content: |
                     __
            (\,------'()'--o    buddy, per review
             (_    ___    /~"
              (_)_)  (_)_)

          out   the diff + surrounding context
                → the provider you configured
          out   registry metadata queries
                → npm, PyPI, crates.io, OSV
          out   nothing else. no telemetry,
                no vendor backend, no index.

          with --light:
          out   nothing at all.

features:
  - title: "Diff-scoped, deliberately"
    icon: "📍"
    span: 2
    details: "Buddy reviews the lines a change touched with enough surrounding context to judge them. That keeps a review's cost proportional to the change rather than the checkout, and it means there is no repository index to build, store, invalidate or protect."
  - title: "No index means no copy"
    icon: "🔒"
    details: "Nothing about your codebase is retained anywhere. Each run reads the workspace on your own runner and sends only what the review needs to the provider you chose."
  - title: "Your model, your bill"
    icon: "🧠"
    details: "Anthropic, OpenAI, Google, OpenRouter or an OpenAI-compatible endpoint inside your own network. Tokens are billed to you at your rate."
  - title: "Dependencies included"
    icon: "📦"
    details: "Scanning, grouping, changelogs, advisories, dashboard and auto-merge across eleven ecosystems — a second tool you do not have to buy."
  - title: "House rules, written down"
    icon: "✍️"
    details: "Review guidelines live in your repository, and @buddy remember ... appends a note later runs read back. Standards come from your team, not from a vendor's tuning."
  - title: "A free floor"
    icon: "🦴"
    details: "--light runs the analyzers with no key and no network, so every repository gets secret scanning and a workflow audit whether or not it justifies a licence."
---

## Side by side

| | Buddy | Greptile |
| --- | --- | --- |
| AI pull request review | ✅ | ✅ |
| Whole-repository semantic index | — | ✅ |
| Cross-file context in review | Surrounding context, diff-scoped | Index-backed |
| Dependency updates | ✅ | — |
| Workflow supply-chain audit | ✅ | — |
| CI repair | ✅ | — |
| Local pre-push review | ✅ | — |
| Works with no API key | ✅ analyzers | — |
| Runs entirely in your CI | ✅ | Hosted |
| Bring your own model | ✅ | — |
| Pricing model | MIT + your tokens | Per developer, hosted |
| Open source | ✅ MIT | — |

Product capabilities change; check Greptile's own documentation before deciding on any single row.

## Where Greptile is the better choice

Be honest about this one, because the architectural difference is real:

- **Findings that need the whole codebase.** "This duplicates a helper three packages away", "this breaks a caller you did not touch", "this contradicts a convention used everywhere else". A diff-scoped reviewer will miss some of those. If that class of finding is the one you are buying, an index-backed reviewer is the design that produces it.
- **Large, old, unfamiliar codebases** where the context that matters is rarely adjacent to the change.
- **You want a hosted product**, with a dashboard, support and no CI work.

Buddy narrows the gap with repository guidelines and remembered notes, but it does not close it, and pretending otherwise would not help you choose.

## Where Buddy is different

- **Nothing is indexed, so nothing is stored.** For organisations where uploading a copy of the source is the blocking objection, this is not a preference — it is the requirement.
- **Cost scales with changes, not with repository size.** A million-line repository does not cost more to review than a small one; a big pull request does.
- **Two categories in one tool.** Review *and* dependencies *and* merge gates *and* the workflow audit.
- **An offline floor.** Secret scanning and the workflow audit run with no key at all, in a pre-commit hook.

## Related

[AI code review](/features/ai-code-review) · [Your CI, your keys](/features/self-hosted) · [Buddy vs CodeRabbit](/compare/coderabbit) · [All comparisons](/compare/)

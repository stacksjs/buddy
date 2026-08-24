---
layout: home
title: Buddy vs Sourcery
description: Sourcery grew out of automated refactoring suggestions and now reviews pull requests. Buddy is a general reviewer with merge gates, a dependency bot and a workflow audit attached.

hero:
  name: "buddy vs sourcery"
  text: "Refactoring roots, different scope"
  tagline: "Sourcery started as a refactoring assistant — code quality suggestions in the editor — and grew into pull request review. That heritage shows in what it is good at, and in the shape of what it leaves to other tools."
  actions:
    - theme: brand
      text: AI code review
      link: /features/ai-code-review
    - theme: alt
      text: Finishing touches
      link: /features/finishing-touches
    - theme: alt
      text: All comparisons
      link: /compare/
  code:
    - file: "buddy's take on tidying"
      lang: "ascii"
      content: |
        $ buddy touch 128 --name simplify

                     __
            (\,------'()'--o    simplify, as a suggestion
             (_    ___    /~"   not a commit
              (_)_)  (_)_)

          → duplicated retry logic in worker.ts
            and queue.ts could share one helper
          → the nested ternary at parse.ts:60
            reads as three conditions
          ✗ left alone: the early return in
            auth.ts would change behaviour for
            an empty token

          posted as a suggestion. no branch opened.
          simplification is taste, and taste is
          not a bot's call to commit.

features:
  - title: "Findings are failures, not preferences"
    icon: "🎯"
    span: 2
    details: "Buddy's review reports what a change breaks — a dropped error that turns an expired session into a valid login, a retry counter that never terminates. Style and simplification live in the simplify finishing touch, which posts a suggestion rather than committing to your branch."
  - title: "Merge gates"
    icon: "🚦"
    details: "Title format, description sections, linked issue, dependency policy and your own English assertions, published as a check run branch protection can require."
  - title: "Dependencies included"
    icon: "📦"
    details: "Grouped updates, real changelogs, OSV advisories, a pinned dashboard and auto-merge across eleven ecosystems."
  - title: "Workflow supply-chain audit"
    icon: "🛡️"
    details: "bash injection, excessive permissions, unpinned actions, self-hosted exposure — the CI footguns a code reviewer does not look at."
  - title: "No key required for the floor"
    icon: "🦴"
    details: "Secret scanning and the analyzers run offline. Useful in a pre-commit hook, and free on every repository."
  - title: "Your CI, your model"
    icon: "🏠"
    details: "No hosted app on your repository. The diff goes to the provider you chose, or nowhere."
---

## Side by side

| | Buddy | Sourcery |
| --- | --- | --- |
| AI pull request review | ✅ | ✅ |
| Refactoring suggestions | Via the `simplify` touch | ✅ core strength |
| IDE integration | — | ✅ |
| Dependency updates | ✅ | — |
| Security advisories, licence policy | ✅ | — |
| Workflow supply-chain audit | ✅ | — |
| Merge gates as check runs | ✅ | — |
| CI repair | ✅ | — |
| Local pre-push review | ✅ CLI | ✅ IDE |
| Works with no API key | ✅ analyzers | — |
| Runs entirely in your CI | ✅ | Hosted |
| Bring your own model | ✅ | — |
| Open source | ✅ MIT | — |

Product capabilities change; check Sourcery's own documentation before deciding on any single row.

## Where Sourcery is the better choice

- **You want refactoring suggestions while you type.** Sourcery's editor integration is the thing it has been building longest, and Buddy has no IDE plugin at all — its local story is a CLI you run.
- **Python-first teams** who value the depth Sourcery built up there.
- **You want a hosted product** with a dashboard and support rather than a binary and a config file.

## Where Buddy is different

- **Scope.** Review is one of several jobs: merge gates, CI repair, the workflow audit and the whole dependency half sit alongside it.
- **Taste is delivered as a suggestion.** Simplification is posted for you to accept, not committed to your branch — because "cleaner" is an opinion and opinions do not belong in an automated commit.
- **It runs where your code already is.** No app installed, no diff leaving your pipeline, no per-developer licence.
- **A free floor everywhere.** `--light` gives every repository secret scanning and a workflow audit for nothing.

## Related

[AI code review](/features/ai-code-review) · [Finishing touches](/features/finishing-touches) · [Local review](/features/local-review) · [All comparisons](/compare/)

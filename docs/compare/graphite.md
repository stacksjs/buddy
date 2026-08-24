---
layout: home
title: Buddy vs Graphite Diamond
description: Diamond is the AI reviewer inside Graphite's stacked-PR platform. Buddy is a reviewer you add to the workflow you already have, with no platform to adopt.

hero:
  name: "buddy vs graphite"
  text: "A reviewer, not a workflow migration"
  tagline: "Graphite is a stacked-pull-request platform, and Diamond is the reviewer inside it. If stacking is what you want, the reviewer comes along for free. If you only want the reviewer, Buddy does not ask your team to change how they ship."
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
    - file: "nothing to adopt"
      lang: "ascii"
      content: |
                     __
            (\,------'()'--o    what changes for the team
             (_    ___    /~"
              (_)_)  (_)_)

          branching model      unchanged
          how you open PRs     unchanged
          the CLI they use     unchanged
          the review UI        github, as before

          what is added:
            one workflow file
            one config file
            findings in the thread

features:
  - title: "No platform to adopt"
    icon: "🪶"
    span: 2
    details: "Buddy is a step in a workflow. Nobody installs a CLI, nobody learns a new branching model, and nobody has to be talked into stacking. If the reviewer turns out not to earn its place, deleting one workflow file removes it completely."
  - title: "Stacked PRs where they help"
    icon: "🥞"
    details: "Finishing touches are delivered as a stacked pull request against your branch — so accepting agent-written tests is a merge you reviewed, and refusing them is a close. Stacking as a mechanism, not as a workflow you must adopt."
  - title: "Dependencies too"
    icon: "📦"
    details: "Grouped updates, changelogs, advisories, dashboard and auto-merge across eleven ecosystems, from the same config."
  - title: "Your keys, your model"
    icon: "🧠"
    details: "Any major provider or an OpenAI-compatible endpoint in your own network, billed to your account."
  - title: "Runs before the PR exists"
    icon: "💻"
    details: "buddy review on the working tree, --light with no key at all, --format agent piped into a coding agent."
  - title: "Open source"
    icon: "📖"
    details: "MIT. Read the prompts, read the sandbox, change either."
---

## Side by side

| | Buddy | Graphite Diamond |
| --- | --- | --- |
| AI pull request review | ✅ | ✅ |
| Stacked pull request platform | — | ✅ |
| Merge queue | — | ✅ |
| Requires adopting a workflow | — | Stacking, to get the value |
| Dependency updates | ✅ | — |
| Workflow supply-chain audit | ✅ | — |
| CI repair | ✅ | — |
| Local pre-push review | ✅ | — |
| Works with no API key | ✅ analyzers | — |
| Runs entirely in your CI | ✅ | Hosted |
| Bring your own model | ✅ | — |
| Pricing model | MIT + your tokens | Per developer, hosted |

Product capabilities change; check Graphite's own documentation before deciding on any single row.

## Where Graphite is the better choice

- **You want stacked pull requests.** This is a real workflow improvement for teams that ship in small dependent increments, and Buddy does nothing about it. If stacking is the problem you are solving, Graphite is the product for that problem and the reviewer is a bonus.
- **You want a merge queue** and the surrounding platform.
- **Your team already uses Graphite.** Adding a second reviewer to a platform you are already paying for is a hard sell to make.

## Where Buddy is different

- **Adoption cost is one workflow file.** No CLI for engineers to install, no branching model to teach, no migration.
- **It covers dependencies, gates, CI repair and the workflow audit** — categories the review-inside-a-platform model does not touch.
- **Nothing is hosted.** The diff goes to the provider you chose and nowhere else.
- **There is a free floor.** Secret scanning and the workflow audit run with no model on every repository you own.

## Related

[AI code review](/features/ai-code-review) · [Finishing touches](/features/finishing-touches) · [Your CI, your keys](/features/self-hosted) · [All comparisons](/compare/)

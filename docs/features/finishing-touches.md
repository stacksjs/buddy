---
layout: home
title: Finishing Touches
description: Tick a box on a pull request and Buddy writes the tests, the docstrings, the simplification or the autofix — delivered as a stacked pull request you can merge, ignore or close.

hero:
  name: "finishing touches"
  text: "The work everyone means to do"
  tagline: "Docstrings, tests, the simplification you noticed and skipped. Tick a box on the pull request and Buddy does one of them — then hands it back as a stacked pull request targeting your branch, so accepting it is a merge and refusing it is a close."
  announcement:
    tag: "stacked"
    text: "Never a surprise commit on your branch"
    link: "#stacked"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: How the agent is sandboxed
      link: /ai/agent
  code:
    - file: "on the pull request"
      lang: "ascii"
      content: |
        buddy  commented on #128

          Finishing touches — tick one and I will
          open it as a pull request against this
          branch.

          - [ ] unit-tests   cover the changed behaviour
          - [ ] docstrings   document the changed APIs
          - [ ] autofix      apply the review's fixes
          - [ ] simplify     tidy without changing behaviour
          - [ ] plan         write an implementation plan

        ─────────────────────────────────────────────

        buddy  commented 3 minutes ago

          **Write tests covering the changed behaviour**
          — opened #129 targeting this branch.

          3 files changed · `bun test` passed (214)
    - file: "buddy touch"
      lang: "ascii"
      content: |
        $ buddy touch 128 --name unit-tests

                     __
            (\,------'()'--o    finishing touch
             (_    ___    /~"   unit-tests on #128
              (_)_)  (_)_)

          → reading the branch diff
          → writing tests for the changed behaviour
          → verifying: bun test
            214 pass, 0 fail

          branch  buddy/update-queue/buddy-unit-tests
          opened  #129 → buddy/update-queue

        $ buddy touch 128 --dry-run
          would run: unit-tests, docstrings

features:
  - title: "unit-tests"
    icon: "🧪"
    details: "Writes tests for the behaviour the branch changed, following the suite's existing structure and naming — then runs them. A generated test that does not pass is worse than none, so a failure is reported rather than committed."
  - title: "docstrings"
    icon: "📚"
    details: "Documents the public APIs the branch changed, matching the density and conventions of the surrounding code rather than importing a different house style. Untouched code is left alone."
  - title: "autofix"
    icon: "🩹"
    details: "Applies exactly what the review's findings describe — and nothing else. An autofix commit that also refactors is one a reviewer has to disentangle."
  - title: "simplify"
    icon: "✂️"
    details: "Removes duplicated logic and unnecessary indirection in the changed code, and stops where a simplification would alter an edge case. Delivered as a suggestion by default, because taste is not a bot's call."
  - title: "plan"
    icon: "🗺️"
    details: "Names the files that would change and why, the order of the work, the risks, and how the result gets verified — written so another agent could execute it. Runs in review mode, so it cannot change anything."
  - title: "It verifies its own work"
    icon: "✅"
    span: 2
    details: "Every touch that changes code runs the project's tests or build before reporting done, and reports the failure instead of claiming success when verification fails. Buddy also reconciles what the agent says it changed against what actually changed on disk — a report that does not match the working tree is not trusted."
---

## Delivered as a stacked pull request {#stacked}

A touch never appends a quiet commit to the branch you are reviewing. It opens a branch of its own — `<your-branch>/buddy-<touch>` — and a pull request targeting your branch, labelled `buddy` and `finishing-touch`.

That shape is the whole point:

- **Accepting is a merge.** The diff is reviewed like any other.
- **Refusing is a close.** Nothing to revert, nothing to force-push.
- **Your branch is unchanged** until you say otherwise, so a touch cannot invalidate the review already in flight.

Touches whose output is a *suggestion* rather than a commit — `simplify` and `plan` — never open a branch at all. They post what they would do and stop.

## Running one

From the thread, tick the checkbox Buddy posts. From the CLI:

```bash
buddy touch 128                      # read the ticked boxes and run them
buddy touch 128 --name unit-tests    # run one directly
buddy touch 128 --test-command "bun test"
buddy touch 128 --dry-run            # report what would run
```

`--test-command` names the command that verifies the change. Without it Buddy uses what it can discover in the project, and a repository with no test command gets a touch that says so rather than one that claims a green run it never had.

## The sandbox is the same one

Touches that write run in `implement` mode; `plan` runs in `review` mode and has no write tool available to request. Both are bounded by the [agent runtime](/ai/agent)'s limits: an allowlisted environment with no credentials in it, a workspace no path can escape, and independent caps on tool calls, wall clock and tokens.

## Related

[AI code review](/features/ai-code-review) · [Conversations](/features/pr-conversations) · [CI repair](/features/ci-repair) · [The agent runtime](/ai/agent)

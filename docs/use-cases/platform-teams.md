---
layout: home
title: Buddy for Platform & Enterprise Teams
description: Enforce standards as check runs across every repository, on your own infrastructure, with no vendor holding your source and no per-seat licence to negotiate.

hero:
  name: "platform teams"
  text: "Standards that are checks, not wiki pages"
  tagline: "Every engineering organisation has a document nobody reads describing how pull requests are supposed to look. Buddy turns that document into check runs — on your runners, with your keys, in a config you can template across every repository you own."
  announcement:
    tag: "no vendor"
    text: "Nothing to install on the repository, nothing to security-review"
    link: /features/self-hosted
  actions:
    - theme: brand
      text: Merge gates
      link: /features/merge-gates
    - theme: alt
      text: The security model
      link: /ai/agent
    - theme: alt
      text: Compare Buddy
      link: /compare/
  code:
    - file: "the org policy, as code"
      lang: "ts"
      content: |
        // shared across every repository
        export default {
          gates: {
            titleFormat: 'error',
            description: {
              mode: 'error',
              requireSections: ['Why', 'Testing', 'Rollback'],
            },
            dependencyGate: {
              mode: 'error',
              licenseAllowlist: [
                'MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause',
              ],
              blockVulnerable: true,
              blockDeprecated: true,
              blockEol: true,
            },
            linkedIssue: 'error',
            custom: [
              {
                name: 'no-new-runtime-deps',
                assertion: 'No new runtime dependency is added to packages/core.',
                mode: 'error',
              },
              {
                name: 'migrations-reversible',
                assertion: 'Every database migration has a down migration.',
                mode: 'error',
              },
            ],
            postMerge: {
              changelog: { enabled: true },
              commentOnIssues: true,
            },
          },
        } satisfies BuddyConfig
    - file: "the check run"
      lang: "ascii"
      content: |
        buddy/gates — 2 failing

          ✔ title-format          conventional commit
          ✔ description           complete
          ✘ dependency-gate       1 violation
              `fast-glob@3.3.2` → advisory
              GHSA-xxxx-xxxx-xxxx
          ✔ linked-issue          addresses #4021
          ✘ no-new-runtime-deps   not satisfied
              packages/core/package.json adds
              `lodash` to dependencies
          ✔ migrations-reversible

        merge blocked by branch protection.

features:
  - title: "Your infrastructure, full stop"
    icon: "🏠"
    span: 2
    details: "There is no Buddy server. No OAuth app with read access to your source, no diffs traversing a vendor's infrastructure, no data-processing addendum to negotiate. It is a binary invoked by a workflow your team wrote, in a runner your team already operates."
  - title: "Policy in English"
    icon: "✍️"
    details: "custom assertions are natural-language rules evaluated per pull request — 'every migration has a down migration', 'no new runtime dependency in core'. Each is checked separately so one unanswerable rule cannot take the others down."
  - title: "Rollout without a revolt"
    icon: "🎚️"
    details: "Every gate is off, warning or error. Ship the whole policy as warnings, watch the failure rate for a fortnight, then promote the ones that were right."
  - title: "Licence and advisory control"
    icon: "⚖️"
    details: "An allowlist blocks anything not on it — an unknown licence is reported, never assumed acceptable. Advisories come from OSV, and base images past end of life are flagged as their own category."
  - title: "Any git host"
    icon: "🌐"
    details: "GitHub, GitLab and Bitbucket Cloud through one provider interface, self-hosted instances included via repository.apiUrl."
  - title: "Bring your own model — even a private one"
    icon: "🧠"
    span: 2
    details: "Anthropic, OpenAI, Google, OpenRouter, or any OpenAI-compatible endpoint, which includes a model served inside your own network. For an organisation that cannot send source to a third party, that is the difference between a pilot and a hard no."
  - title: "Reports on a schedule"
    icon: "📈"
    details: "buddy report --period 30d --publish computes dependency health and update activity from scan results and PR history — no model required — and publishes it to a tracking issue."
---

## Templating across repositories

Buddy reads `buddy.config.ts`, `.json` or `.yaml`. Most platform teams publish a package that exports the org defaults and let each repository extend it:

```ts
// buddy.config.ts in every repository
import { orgDefaults } from '@acme/buddy-config'

export default {
  ...orgDefaults,
  repository: { provider: 'github', owner: 'acme', name: 'payments' },
  gates: {
    ...orgDefaults.gates,
    // payments needs a stricter licence policy than the rest
    dependencyGate: { ...orgDefaults.gates.dependencyGate, licenseAllowlist: ['MIT', 'Apache-2.0'] },
  },
} satisfies BuddyConfig
```

The workflows themselves are ordinary reusable workflows — nothing Buddy-specific about distributing them.

## The security review, pre-answered

| Question | Answer |
| --- | --- |
| What has access to our source? | Your runner. Buddy is a CLI it invokes. |
| Where does the diff go? | To the model provider you configured, if you configured one. `--light` sends it nowhere. |
| What token does it use? | The one your workflow provides. Buddy never reads a token from a config file by default. |
| Can the AI change our code? | Only in `fix-ci` and `implement` modes, which are opt-in. Review and plan modes have no write tool available to request. |
| Can a command it runs reach our secrets? | No — commands start from an empty environment plus an allowlist, and a second check drops anything whose name looks like a credential. |
| Can it escape the workspace? | Paths are resolved and rejected if they escape, checked twice so a symlink cannot slip past. |
| Is contributor text trusted? | Never. It arrives as tool output inside an escaped `<untrusted-content>` block. |
| Is there telemetry? | No. |

The long version is in [the agent runtime](/ai/agent).

## Related

[Merge gates](/features/merge-gates) · [Workflow security](/features/workflow-security) · [Your CI, your keys](/features/self-hosted) · [Security & compliance](/use-cases/security-compliance) · [Git providers](/advanced/providers)

---
layout: home
title: Buddy for Security & Compliance
description: Licence allowlists, OSV advisories, end-of-life base images and workflow supply-chain audits — enforced as blocking checks, with nothing leaving your perimeter.

hero:
  name: "security & compliance"
  text: "Policy that blocks, and evidence that it did"
  tagline: "A policy nobody can enforce is a document. Buddy turns dependency and workflow policy into check runs your branch protection honours — computed on your own runners, from public advisory data, with no diff leaving your infrastructure."
  announcement:
    tag: "no vendor"
    text: "Nothing to install on the repository, no data-processing agreement"
    link: /features/self-hosted
  actions:
    - theme: brand
      text: Merge gates
      link: /features/merge-gates
    - theme: alt
      text: Workflow security
      link: /features/workflow-security
    - theme: alt
      text: The security model
      link: /ai/agent
  code:
    - file: "the policy"
      lang: "ts"
      content: |
        export default {
          gates: {
            dependencyGate: {
              mode: 'error',
              licenseAllowlist: [
                'MIT', 'Apache-2.0', 'ISC',
                'BSD-2-Clause', 'BSD-3-Clause',
              ],
              blockVulnerable: true,
              blockDeprecated: true,
              blockEol: true,
            },
            description: {
              mode: 'error',
              requireSections: ['Why', 'Testing', 'Rollback'],
            },
            linkedIssue: 'error',
            custom: [
              {
                name: 'no-secrets-in-config',
                assertion: 'No credential, key or token is added to a checked-in config file.',
                mode: 'error',
              },
            ],
            postMerge: {
              changelog: { enabled: true },
              commentOnIssues: true,
            },
          },
        } satisfies BuddyConfig
    - file: "the supply-chain audit"
      lang: "ascii"
      content: |
        $ buddy security --format json | jq '.findings[]
            | select(.severity == "error")'

        {
          "rule": "bash-injection",
          "file": ".github/workflows/label.yml",
          "line": 19,
          "message": "Job `label`, step 2:
            `github.event.pull_request.title` is
            interpolated into a shell."
        }
        {
          "rule": "excessive-permissions",
          "file": ".github/workflows/release.yml",
          "line": 6,
          "message": "Workflow grants
            `permissions: write-all`."
        }

features:
  - title: "Licence allowlists that fail closed"
    icon: "⚖️"
    span: 2
    details: "Anything not on the allowlist is a violation, and an unknown licence is reported rather than assumed acceptable — that is the entire point of an allowlist. The check is deterministic and needs no AI provider, so it is auditable and reproducible."
  - title: "Advisories from OSV"
    icon: "🛡️"
    details: "OSV.dev indexes every ecosystem Buddy supports — npm, Composer, PyPI, crates.io, Go, RubyGems — so a vulnerable dependency blocks the merge in all of them, not just the one your scanner happened to cover."
  - title: "End of life is its own category"
    icon: "⏳"
    details: "A base image past end of life stops receiving security fixes entirely, which outranks any single advisory. blockEol treats it that way rather than waiting for a CVE."
  - title: "Six workflow footguns"
    icon: "💉"
    details: "bash-injection, dangerous-pull-request-target, excessive-permissions, unpinned-action, self-hosted-exposure and missing-timeout — the patterns that turn a CI pipeline into an attack surface."
  - title: "Secrets caught before the push"
    icon: "🔑"
    details: "A narrow, low-false-positive scanner for AWS, GitHub, Anthropic, OpenAI, Google, Slack and npm credentials plus private key blocks, running offline in a pre-commit hook."
  - title: "Nothing leaves the perimeter"
    icon: "🏠"
    span: 2
    details: "The deterministic gates, the workflow audit and the secret scanner involve no model at all. Where you do use AI, you choose the provider — including an OpenAI-compatible endpoint inside your own network. There is no Buddy backend to send anything to."
---

## The AI attack surface, addressed

Any tool that puts a language model near your repository introduces two questions. Buddy answers both structurally rather than with a promise:

**Can third-party text steer the model?** Pull request bodies, comments and contributor branch content never enter the system prompt. They arrive only as tool output, wrapped in an explicit `<untrusted-content>` marker with the closing sequence escaped inside the payload — so a comment containing its own `</untrusted-content>` cannot close the block early and appear as trusted context. Every mode's playbook repeats the rule, so the defence holds instructionally as well as structurally.

**Can the model reach something it should not?** A mode declares capability tiers, and a tool outside those tiers is never advertised to the model — so it cannot be requested at all, rather than being requested and refused. Review and plan modes have no write tool in their vocabulary.

| Boundary | Mechanism |
| --- | --- |
| Credentials | Commands run from an empty environment plus an allowlist; a second check drops anything whose name looks like a credential |
| Filesystem | Paths resolved against the workspace and rejected if they escape — checked twice, so a symlink inside cannot land outside |
| Actor | A commenter without write access runs in `restricted` mode, read tools only |
| Runaway runs | Independent caps on tool calls, wall clock and tokens |
| Evidence | Structured transcripts, through the same redaction filter as the rest of the AI layer |

## Evidence for the auditor

- **Check runs** are recorded against every pull request, with per-gate pass, fail and neutral results. A gate that *could not run* returns neutral, never a pass — a check that silently degraded to success is worse than no check.
- **`buddy report --period 90d --publish`** writes dependency health and update activity to a tracking issue on a schedule, computed from data rather than narrated by a model.
- **`buddy security --format json`** gives the workflow audit in a form a compliance pipeline can ingest.
- **The dependency dashboard** enumerates everything the repository depends on, by ecosystem and by file.

## Run it on everything, immediately

```bash
buddy security                                   # workflow audit, offline
buddy review --branch --light --fail-on major    # analyzers + secrets, offline
buddy scan                                       # advisories and EOL, no model
```

None of these need an API key. You can run all three across every repository you own this afternoon and know where you stand before deciding anything else.

## Related

[Merge gates](/features/merge-gates) · [Workflow security](/features/workflow-security) · [Your CI, your keys](/features/self-hosted) · [Platform teams](/use-cases/platform-teams) · [The agent runtime](/ai/agent)

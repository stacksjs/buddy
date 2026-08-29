# Local Review

`buddy review` reviews your changes before you push them. With no pull
request number it reads the working tree, so there is nothing to open and
nothing to wait for.

```bash
buddy review
```

## What gets reviewed

| Flag       | Reviews                                                        |
| ---------- | -------------------------------------------------------------- |
| *(none)*   | Working tree against `HEAD`, staged changes included           |
| `--staged` | Staged changes only                                            |
| `--branch` | This branch against its base (`--base`, default `main`)        |

The default includes staged changes deliberately: a pre-commit review that
ignored what you just staged would miss the very changes you are about to
commit.

## Reviewing a pull request

Pass a number to review a pull request instead of local changes:

```bash
buddy review 123
```

Add `--auto` when Buddy is choosing to review rather than being asked — which
is what the generated workflow does. It honours the filters under
`ai.review`, so a draft or a `wip` pull request is skipped before the diff is
fetched, costing one API call rather than a full review:

| Setting | Skips when |
|---|---|
| `enabled: false` | Always — including an explicit `@buddy review` |
| `autoReview: false` | The trigger is automatic; asking still works |
| `drafts` | The pull request is a draft and this is not `true` |
| `ignoreTitleKeywords` | The title contains one of them, case-insensitively |
| `ignoreUsernames` | The author is listed |

Without `--auto` none of these apply except `enabled`, because a person at a
terminal has already decided they want the review.

`--format` and `--fail-on` apply here too. The review is posted to the pull
request regardless; they govern what the terminal sees and the exit code, so
`buddy review 123 --fail-on major` can gate a pipeline on the review it just
left.

A pull request review runs the same path as [`@buddy review`](/features/pr-conversations),
so both assemble the same context: the analyzers, the guidelines and the
learnings `@buddy remember` has recorded — all read from the base branch, never
from the pull request's own, so a branch cannot rewrite the rules its code is
reviewed against.

## Without an API key

`--light` runs the analyzers and skips the model entirely — secret scanning,
workflow auditing, YAML/JSON validation, and whatever linters the machine has
installed. It needs no key and no network, which makes it usable in a
pre-commit hook:

```bash
buddy review --staged --light --fail-on major
```

`--fail-on <severity>` exits non-zero when something at or above that severity
is found, so the hook blocks the commit.

A full review adds the model's findings to the analyzers', so one command
reports everything rather than you running two and merging them by hand.

## Output formats

```bash
buddy review --format json     # machine-readable
buddy review --format github   # ::error annotations for Actions
buddy review --format agent    # a prompt block for a coding agent
```

Every format except `pretty` owns stdout completely — diagnostics are
suppressed — so the output can be piped without a log line landing in the
middle of a JSON document.

### Piping to an agent

`--format agent` emits an instruction rather than a report:

```bash
buddy review --format agent | claude
```

The block tells the agent to change only what each finding asks for, and
explicitly gives it permission to disagree and leave the code alone — an agent
that mechanically applies a wrong finding is worse than one that pushes back.

## Applying suggestions

```bash
buddy review --fix          # confirm each suggestion
buddy review --fix --yes    # apply without asking
```

Findings are applied bottom-up within each file, so replacing one line cannot
shift the line numbers of the ones still to be applied. A suggestion whose line
no longer matches — because the file changed since the review — is skipped
rather than written, since applying it would corrupt an unrelated line.

Confirmation is per finding by default. A suggestion is a proposal; applying a
batch unseen is how a review turns into an unreviewed commit.

## Reviewing a pull request

Pass a number to review a PR and post the result:

```bash
buddy review 42
buddy review 42 --dry-run    # print it instead of posting
```

This needs a token; local review does not.

## Diagnosing setup

```bash
buddy doctor
```

Reports credentials, git state, configuration validity and which analyzer
tools are installed. Every problem it finds comes with the command or setting
that fixes it.

Missing credentials and missing analyzer binaries are **warnings**, not
failures — dependency updates and static analysis both work without them.
`doctor` exits non-zero only when something is genuinely broken.

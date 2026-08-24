# Release Notes

Every pull request Buddy opens carries the actual release notes for the
versions it is proposing — not a link to go and find them. For a bump from
`^5.8.0` to `^5.8.3`, that means the notes for `5.8.1`, `5.8.2` and `5.8.3`,
so the diff you are approving is described rather than implied.

## Where the notes come from

For each package, Buddy tries these sources in order and uses the first that
answers:

1. **GitHub Releases** for the repository named in the package's metadata —
   the richest source, and the one most projects actually maintain.
2. **Git tags**, when a project tags releases but does not publish release
   objects.
3. **A changelog file** in the repository (`CHANGELOG.md` and common
   variants), with the section for each version extracted.
4. **Registry metadata** — description, homepage, license and publish dates —
   which is always available and is what the summary table is built from.

Composer packages resolve through Packagist to the same underlying repository,
so a PHP dependency hosted on GitHub gets the same treatment as an npm one.

Because every version between the current and the target is fetched, a bump
that skips several patches shows each one. Where the source repository is
known, a compare link between the two versions is included as well.

## Configuration

The whole surface is five options:

```typescript
import type { BuddyConfig } from '@buddysh/buddy'

export default {
  releaseNotes: {
    enabled: true,
    maxReleases: 3,
    maxBodyLength: 1000,
    includeCompareLinks: true,
    sanitizeReferences: true,
  },
} satisfies BuddyConfig
```

| Option | Default | Does |
| --- | --- | --- |
| `enabled` | `true` | Include release notes in pull request bodies at all |
| `maxReleases` | `3` | How many versions to show per package |
| `maxBodyLength` | `1000` | Characters kept per release before truncation |
| `includeCompareLinks` | `true` | Add a `compare/v1...v2` link per package |
| `sanitizeReferences` | `true` | Defuse issue and PR references — see below |

`maxReleases` matters on a grouped pull request: ten packages each showing ten
releases produces a body nobody reads and, past a point, one GitHub will not
render. The default of three shows the recent history without burying the
table above it.

## Why references are sanitized

This is the least obvious setting and the one worth understanding.

Release notes are full of text like `fixes #123` or links to pull requests in
the upstream repository. Copied verbatim into your pull request body, GitHub
reads those as references to **your** repository's issues — so opening a
routine dependency update can notify unrelated people, and leave a
"referenced this issue" trail on issues that have nothing to do with it. On an
active repository with a frequent update schedule, that is a steady drip of
noise aimed at your team.

With `sanitizeReferences` on, the reference is rendered as text instead of a
link:

| In the upstream notes | In your pull request |
| --- | --- |
| `#123` | the same text, wrapped in code formatting |
| `fixes #456` | `fixes` followed by the number in code formatting |
| `https://github.com/org/repo/pull/123` | `org/repo#123`, as code rather than a link |
| `https://github.com/org/repo/issues/456` | `org/repo#456`, as code rather than a link |

The information survives — you can still see which issue was fixed — but it no
longer cross-links into your tracker.

Code is left alone. Fenced blocks and inline code are protected before
sanitization runs, so a changelog snippet containing `#include <stdio.h>` or a
shell comment is not rewritten.

Turn it off only if you genuinely want those cross-links:

```typescript
export default {
  releaseNotes: {
    sanitizeReferences: false,
  },
} satisfies BuddyConfig
```

## Turning notes off

On a repository where update pull requests are auto-merged without review, the
notes are weight without a reader:

```typescript
export default {
  releaseNotes: {
    enabled: false,
  },
} satisfies BuddyConfig
```

The dependency table, the version change and the metadata badges remain; only
the notes section is dropped.

## What a rendered section looks like

````markdown
### Release Notes

<details>
<summary>microsoft/TypeScript (typescript)</summary>

### [`v5.8.3`](https://github.com/microsoft/TypeScript/releases/tag/v5.8.3)

[Compare Source](https://github.com/microsoft/TypeScript/compare/v5.8.2...v5.8.3)

##### Bug Fixes

- Fix issue with module resolution (`#61234`)
- Improve error messages

</details>
````

Each package gets its own collapsed `<details>` block, so a grouped pull
request stays scannable and expands only where you want detail.

## Related

- [Pull request generation](/features/pull-requests) — the body the notes sit in
- [Update strategies](/features/update-strategies) — what gets proposed in the first place
- [Configuration reference](/config) — every option in one place

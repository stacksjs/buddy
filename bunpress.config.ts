import type { BunPressConfig, NavItem } from '@stacksjs/bunpress'

/**
 * The site's own stylesheet, read at config load rather than inlined here.
 * It is a real .css file so an editor treats it as one; `themeConfig.css`
 * only accepts a string.
 */
const themeCss = await Bun.file(new URL('./docs/.theme/buddy.css', import.meta.url)).text()

const REPO = 'https://github.com/stacksjs/buddy'

/**
 * The sidebar is keyed by path prefix, so a reader inside `/features/` sees the
 * feature list rather than the whole manual. Every markdown file under `docs/`
 * appears in exactly one group below — a page that is not listed here is
 * reachable only by direct link, which is how documentation quietly rots.
 */
/**
 * One sidebar for the whole of the documentation.
 *
 * The nav used to carry Guide, CLI, AI, Config and API as five separate
 * entries, and each of those sections had a sidebar listing only itself — so
 * the nav was the only way to cross between them. Collapsing the nav to a
 * single Docs link therefore had to come with a single sidebar: otherwise a
 * reader who landed on a CLI page could reach the AI pages only through
 * search.
 *
 * Ordered the way someone works through the product rather than
 * alphabetically: what it is, how to drive it, what to configure, then the
 * reference material you look up rather than read.
 */
const docsSidebar = [
  {
    text: 'Introduction',
    items: [
      { text: 'Documentation', link: '/docs' },
      { text: 'What is Buddy?', link: '/intro' },
      { text: 'Installation', link: '/install' },
      { text: 'Getting Started', link: '/guide/getting-started' },
      { text: 'Usage', link: '/usage' },
    ],
  },
  {
    text: 'CLI',
    items: [
      { text: 'Overview', link: '/cli/overview' },
      { text: 'setup', link: '/cli/setup' },
      { text: 'Local Review', link: '/cli/review' },
      { text: 'Update Commands', link: '/cli/update' },
      { text: 'Package Commands', link: '/cli/package' },
      { text: 'Utility Commands', link: '/cli/utility' },
    ],
  },
  {
    text: 'AI',
    items: [
      { text: 'Providers', link: '/ai/providers' },
      { text: 'Agent Runtime', link: '/ai/agent' },
      { text: 'Headless Runs', link: '/ai/headless' },
    ],
  },
  {
    text: 'Configuration',
    items: [
      { text: 'Configuration Guide', link: '/guide/configuration' },
      { text: 'Configuration Reference', link: '/config' },
      { text: 'PR Generation', link: '/guide/pr-generation' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Dependency Scanning', link: '/features/scanning' },
      { text: 'Update Strategies', link: '/features/update-strategies' },
      { text: 'Package Management', link: '/features/package-management' },
      { text: 'Dependency Files', link: '/features/dependency-files' },
      { text: 'Pull Request Generation', link: '/features/pull-requests' },
      { text: 'Release Notes', link: '/features/release-notes' },
      { text: 'Labeling & Assignment', link: '/features/labeling-assignment' },
      { text: 'Auto-Merge', link: '/features/auto-merge' },
      { text: 'Rebase', link: '/features/rebase' },
      { text: 'Dependency Dashboard', link: '/features/dependency-dashboard' },
      { text: 'GitHub Actions', link: '/features/github-actions' },
    ],
  },
  {
    text: 'Advanced',
    items: [
      { text: 'Ecosystems', link: '/advanced/ecosystems' },
      { text: 'Monorepos', link: '/advanced/monorepo' },
      { text: 'Git Providers', link: '/advanced/providers' },
      { text: 'Scheduling', link: '/advanced/scheduling' },
    ],
  },
  {
    text: 'Migration',
    items: [
      { text: 'Overview', link: '/advanced/migration' },
      { text: 'From Renovate', link: '/advanced/migration/renovate' },
      { text: 'From Dependabot', link: '/advanced/migration/dependabot' },
    ],
  },
  {
    text: 'API',
    items: [
      { text: 'Buddy Class', link: '/api/buddy' },
      { text: 'Configuration Types', link: '/api/configuration' },
    ],
  },
]

const projectSidebar = [
  {
    text: 'Project',
    items: [
      { text: 'Showcase', link: '/showcase' },
      { text: 'Team', link: '/team' },
      { text: 'Sponsors', link: '/sponsors' },
      { text: 'Partners', link: '/partners' },
      { text: 'Stargazers', link: '/stargazers' },
      { text: 'Postcardware', link: '/postcardware' },
      { text: 'License', link: '/license' },
    ],
  },
]

/**
 * The Features mega menu.
 *
 * Every entry points at a landing page rather than a reference page: someone
 * opening a menu called "Features" is deciding whether they want the thing,
 * not configuring it. Each landing page links down into the docs, so the
 * reference material is one click further on rather than hidden.
 */
const featuresMenu: NavItem = {
  text: 'Features',
  activeMatch: '^/features/',
  columns: 3,
  items: [
    {
      text: 'Review',
      items: [
        {
          text: 'AI Code Review',
          link: '/features/ai-code-review',
          icon: '🔍',
          description: 'Inline findings anchored to the lines you changed',
        },
        {
          text: 'Conversations',
          link: '/features/pr-conversations',
          icon: '💬',
          description: '@buddy answers, re-reviews, resolves and pauses',
        },
        {
          text: 'Local Review',
          link: '/features/local-review',
          icon: '💻',
          description: 'Read the working tree before the PR exists',
        },
        {
          text: 'Finishing Touches',
          link: '/features/finishing-touches',
          icon: '✨',
          description: 'Tests, docstrings and autofix, as a stacked PR',
        },
      ],
    },
    {
      text: 'Automate',
      items: [
        {
          text: 'Merge Gates',
          link: '/features/merge-gates',
          icon: '🚦',
          description: 'A real check run, not a comment nobody reads',
        },
        {
          text: 'CI Repair',
          link: '/features/ci-repair',
          icon: '🛠️',
          description: 'Classify a failing run and fix what is unambiguous',
        },
        {
          text: 'Dependency Updates',
          link: '/features/dependency-updates',
          icon: '📦',
          description: 'Eleven ecosystems, real changelogs, auto-merge',
        },
      ],
    },
    {
      text: 'Platform',
      items: [
        {
          text: 'Workflow Security',
          link: '/features/workflow-security',
          icon: '🛡️',
          description: 'Supply-chain footguns in .github/workflows',
        },
        {
          text: 'Your CI, Your Keys',
          link: '/features/self-hosted',
          icon: '🏠',
          description: 'No hosted app, no diff leaving your pipeline',
        },
      ],
    },
  ],
  footer: {
    text: 'All features →',
    link: '/features/',
    note: 'Nine jobs, one binary.',
  },
}

/**
 * The Use Cases mega menu.
 *
 * Two axes, because readers arrive along both: some know what kind of team
 * they are, and some only know which job they keep not getting to.
 */
const useCasesMenu: NavItem = {
  text: 'Use Cases',
  activeMatch: '^/use-cases/',
  columns: 2,
  items: [
    {
      text: 'By team',
      items: [
        {
          text: 'Open Source',
          link: '/use-cases/open-source',
          icon: '🌱',
          description: 'A reviewer a maintainer cannot hire',
        },
        {
          text: 'Startups',
          link: '/use-cases/startups',
          icon: '🚀',
          description: 'No spare reviewer, no time for updates',
        },
        {
          text: 'Platform & Enterprise',
          link: '/use-cases/platform-teams',
          icon: '🏢',
          description: 'Standards as check runs, on your infrastructure',
        },
        {
          text: 'Agencies',
          link: '/use-cases/agencies',
          icon: '🧰',
          description: 'Twenty client repositories, one config',
        },
      ],
    },
    {
      text: 'By job',
      items: [
        {
          text: 'Monorepos',
          link: '/use-cases/monorepos',
          icon: '🏗️',
          description: 'Every manifest at every depth, no setting',
        },
        {
          text: 'Security & Compliance',
          link: '/use-cases/security-compliance',
          icon: '🛡️',
          description: 'Licences, advisories and supply-chain audits',
        },
        {
          text: 'Migrating',
          link: '/use-cases/migrating',
          icon: '🔄',
          description: 'Bring the Renovate config you already wrote',
        },
        {
          text: 'AI Coding Agents',
          link: '/use-cases/ai-coding-agents',
          icon: '🤖',
          description: 'Close the loop before the PR exists',
        },
      ],
    },
  ],
  footer: {
    text: 'All use cases →',
    link: '/use-cases/',
    note: 'Find the shape of your problem.',
  },
}

/**
 * The competitors Buddy is compared against, in the order the footer lists
 * them: the two dependency bots most readers arrive from, then the code
 * reviewers, then the security platform.
 *
 * One array drives both the footer strip and the order on `/compare/`, so a
 * new comparison page cannot be added without the footer learning about it.
 */
const competitors = [
  { name: 'Renovate', slug: 'renovate' },
  { name: 'Dependabot', slug: 'dependabot' },
  { name: 'CodeRabbit', slug: 'coderabbit' },
  { name: 'Greptile', slug: 'greptile' },
  { name: 'Qodo Merge', slug: 'qodo' },
  { name: 'Graphite', slug: 'graphite' },
  { name: 'Sourcery', slug: 'sourcery' },
  { name: 'Snyk', slug: 'snyk' },
]

/**
 * Flatten a mega menu into its leaf links, in the order the menu lists them.
 *
 * The footer's Features and Use Cases columns are built from the very objects
 * the nav menus are built from, so a page added to a menu appears in the
 * footer without anybody remembering to add it twice — and, more usefully, a
 * page *removed* from a menu cannot linger in the footer as a dead link.
 */
function menuLinks(menu: NavItem): Array<{ text: string, link: string }> {
  const links: Array<{ text: string, link: string }> = []
  for (const group of menu.items ?? []) {
    for (const item of group.items ?? []) {
      if (item.link)
        links.push({ text: item.text, link: item.link })
    }
  }
  return links
}

/**
 * The documentation pages worth a footer slot.
 *
 * Deliberately not the whole sidebar: a footer that lists everything ranks
 * nothing. These are the pages a reader actually starts from — install it,
 * run it, configure it, or bring an existing Renovate setup across.
 */
const popularDocs = [
  { text: 'Getting Started', link: '/guide/getting-started' },
  { text: 'Installation', link: '/install' },
  { text: 'Local Review', link: '/cli/review' },
  { text: 'CLI Overview', link: '/cli/overview' },
  { text: 'AI Providers', link: '/ai/providers' },
  { text: 'Configuration', link: '/config' },
  { text: 'Monorepos', link: '/advanced/monorepo' },
  { text: 'From Renovate', link: '/advanced/migration/renovate' },
]

/**
 * A footer column.
 *
 * The theme drops `footer.message` into a paragraph, so every element here is
 * inline and given its layout by CSS. A `<div>` would be closed out of that
 * paragraph by the HTML parser and the column would collapse.
 */
function footerColumn(
  label: string,
  links: Array<{ text: string, link: string }>,
  all?: { text: string, link: string },
): string {
  return [
    '<span class="BPFooter-col">',
    `<span class="BPFooter-col-label">${label}</span>`,
    ...links.map(({ text, link }) => `<a href="${link}">${text}</a>`),
    all ? `<a class="BPFooter-col-all" href="${all.link}">${all.text} \u2192</a>` : '',
    '</span>',
  ].join('')
}

/** The footer's three link columns: what it does, who it is for, how to run it. */
const footerColumns = [
  '<span class="BPFooter-cols">',
  footerColumn('Features', menuLinks(featuresMenu), { text: 'All features', link: '/features/' }),
  footerColumn('Use Cases', menuLinks(useCasesMenu), { text: 'All use cases', link: '/use-cases/' }),
  footerColumn('Documentation', popularDocs, { text: 'All docs', link: '/docs' }),
  '</span>',
].join('')

/**
 * The footer's Compare strip.
 *
 * The theme renders `footer.message` as raw HTML inside a paragraph, so this
 * is built from inline elements only — a `<div>` here would be closed out of
 * its own paragraph by the parser.
 */
const compareFooter = [
  '<span class="BPFooter-compare">',
  '<span class="BPFooter-compare-label">Compare Buddy</span>',
  ...competitors.map(
    ({ name, slug }) => `<a href="/compare/${slug}">vs ${name}</a>`,
  ),
  '<a class="BPFooter-compare-all" href="/compare/">All comparisons \u2192</a>',
  '</span>',
].join('')

const config: BunPressConfig = {
  verbose: false,

  docsDir: './docs',
  outDir: './docs/dist',

  title: 'Buddy',
  description:
    'Buddy reviews your pull requests and your local changes, answers questions in the thread, gates merges, repairs failing CI, and keeps your dependencies current. Runs in your own CI, with your own keys.',
  lang: 'en-US',
  url: 'https://buddy.sh',

  fonts: {
    google: [
      'Inter:wght@400;500;600;700',
      'Space Grotesk:wght@500;600;700',
      'JetBrains Mono:wght@400;500;600',
    ],
    display: 'swap',
  },

  head: [
    ['link', { rel: 'icon', href: '/images/favicon.svg', type: 'image/svg+xml' }],
    ['link', { rel: 'mask-icon', href: '/images/logo-mini.svg', color: '#f5a524' }],
    ['meta', { name: 'theme-color', content: '#f5a524' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Buddy' }],
    ['meta', { property: 'og:image', content: 'https://buddy.sh/images/og-image.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: 'https://buddy.sh/images/og-image.png' }],
  ],

  markdown: {
    // Token colours are baked into the HTML as inline styles at build time,
    // so the highlighter theme has to match the panel rather than the page.
    // Every code panel on the site is ink, in both light and dark mode.
    syntaxHighlightTheme: 'github-dark',

    features: {
      // Off by default, which left `::: code-group` fences rendering as
      // literal `::: code-group` text above a stack of untabbed blocks.
      codeGroups: true,
    },
  },

  search: {
    enabled: true,
  },

  sitemap: {
    enabled: true,
    baseUrl: 'https://buddy.sh',
  },

  robots: {
    enabled: true,
  },

  themeConfig: {
    logo: '/images/logo-transparent.svg',

    colors: {
      primary: '#f5a524',
    },

    css: themeCss,

    socialLinks: [
      { icon: 'github', link: REPO },
    ],

    editLink: {
      pattern: `${REPO}/edit/main/docs/:path`,
      text: 'Suggest a change to this page',
    },

    lastUpdated: true,

    footer: {
      message: `${footerColumns}${compareFooter}<span class="BPFooter-note">Released under the MIT License.</span>`,
      copyright: 'Copyright © 2024-present Chris Breuer',
    },

    // Features and Use Cases stay as menus because they are how someone
    // decides; everything else is how someone builds, and that is one
    // destination. GitHub is not listed: the icon beside the nav already
    // links there, and naming it twice spends a nav slot on a duplicate.
    nav: [
      featuresMenu,
      useCasesMenu,
      { text: 'Docs', link: '/docs', activeMatch: '^/(docs|intro|install|usage|config|guide|cli|ai|advanced|api|features)' },
    ],

    sidebar: {
      '/docs': docsSidebar,
      '/guide/': docsSidebar,
      '/intro': docsSidebar,
      '/install': docsSidebar,
      '/usage': docsSidebar,
      '/config': docsSidebar,
      '/features/': docsSidebar,
      '/cli/': docsSidebar,
      '/ai/': docsSidebar,
      '/advanced/': docsSidebar,
      '/api/': docsSidebar,
      '/showcase': projectSidebar,
      '/team': projectSidebar,
      '/sponsors': projectSidebar,
      '/partners': projectSidebar,
      '/stargazers': projectSidebar,
      '/postcardware': projectSidebar,
      '/license': projectSidebar,
    },
  },
}

export default config

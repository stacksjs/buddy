import type { BunPressConfig } from '@stacksjs/bunpress'

const REPO = 'https://github.com/stacksjs/buddy'

/**
 * The sidebar is keyed by path prefix, so a reader inside `/features/` sees the
 * feature list rather than the whole manual. Every markdown file under `docs/`
 * appears in exactly one group below — a page that is not listed here is
 * reachable only by direct link, which is how documentation quietly rots.
 */
const guideSidebar = [
  {
    text: 'Introduction',
    items: [
      { text: 'What is Buddy?', link: '/intro' },
      { text: 'Installation', link: '/install' },
      { text: 'Getting Started', link: '/guide/getting-started' },
      { text: 'Usage', link: '/usage' },
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
]

const featuresSidebar = [
  {
    text: 'Core',
    items: [
      { text: 'Dependency Scanning', link: '/features/scanning' },
      { text: 'Update Strategies', link: '/features/update-strategies' },
      { text: 'Package Management', link: '/features/package-management' },
      { text: 'Dependency Files', link: '/features/dependency-files' },
    ],
  },
  {
    text: 'Pull Requests',
    items: [
      { text: 'Pull Request Generation', link: '/features/pull-requests' },
      { text: 'Release Notes', link: '/features/release-notes' },
      { text: 'Labeling & Assignment', link: '/features/labeling-assignment' },
      { text: 'Auto-Merge', link: '/features/auto-merge' },
      { text: 'Rebase', link: '/features/rebase' },
    ],
  },
  {
    text: 'Integrations',
    items: [
      { text: 'Dependency Dashboard', link: '/features/dependency-dashboard' },
      { text: 'GitHub Actions', link: '/features/github-actions' },
    ],
  },
]

const cliSidebar = [
  {
    text: 'CLI',
    items: [
      { text: 'Overview', link: '/cli/overview' },
      { text: 'setup', link: '/cli/setup' },
      { text: 'Update Commands', link: '/cli/update' },
      { text: 'Package Commands', link: '/cli/package' },
      { text: 'Local Review', link: '/cli/review' },
      { text: 'Utility Commands', link: '/cli/utility' },
    ],
  },
]

const aiSidebar = [
  {
    text: 'AI',
    items: [
      { text: 'Providers', link: '/ai/providers' },
      { text: 'Agent Runtime', link: '/ai/agent' },
      { text: 'Headless Runs', link: '/ai/headless' },
    ],
  },
]

const advancedSidebar = [
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
]

const apiSidebar = [
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
    google: ['Inter:wght@400;500;600;700', 'JetBrains Mono:wght@400;600'],
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

  markdown: {},

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

    socialLinks: [
      { icon: 'github', link: REPO },
    ],

    editLink: {
      pattern: `${REPO}/edit/main/docs/:path`,
      text: 'Suggest a change to this page',
    },

    lastUpdated: true,

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Chris Breuer',
    },

    nav: [
      { text: 'Guide', link: '/intro' },
      { text: 'Features', link: '/features/scanning' },
      { text: 'CLI', link: '/cli/overview' },
      { text: 'AI', link: '/ai/providers' },
      { text: 'Config', link: '/config' },
      { text: 'API', link: '/api/buddy' },
      { text: 'GitHub', link: REPO },
    ],

    sidebar: {
      '/guide/': guideSidebar,
      '/intro': guideSidebar,
      '/install': guideSidebar,
      '/usage': guideSidebar,
      '/config': guideSidebar,
      '/features/': featuresSidebar,
      '/cli/': cliSidebar,
      '/ai/': aiSidebar,
      '/advanced/': advancedSidebar,
      '/api/': apiSidebar,
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

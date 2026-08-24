#!/usr/bin/env bun
/**
 * Publish the built site to Cloudflare Pages and point buddy.sh at it.
 *
 * Run after `bun run build:docs`. Safe to run repeatedly: the project, the
 * custom domains and the DNS records are all reconciled rather than created,
 * and Cloudflare only accepts the bytes of assets whose content changed — a
 * redeploy of an unchanged site uploads nothing.
 *
 * Environment:
 *   CLOUDFLARE_API_TOKEN   Token with `Cloudflare Pages: Edit` and, for the
 *                          DNS step, `Zone: DNS: Edit` on the buddy.sh zone.
 *   CLOUDFLARE_ACCOUNT_ID  Account the Pages project lives under.
 *
 * Flags:
 *   --dry-run   Report what would be deployed, contact nothing.
 *   --preview   Deploy to a preview branch instead of production.
 */
import process from 'node:process'
import { CloudflareProvider } from '@stacksjs/ts-cloud'
import { CloudflarePagesProvider, collectAssets, pagesDnsRecord } from '@stacksjs/ts-cloud'

/** Pages project name. Also decides the `*.pages.dev` host Cloudflare grants. */
const PROJECT = 'buddy'

/** Zone apex. Both hostnames below must live inside it. */
const ZONE = 'buddy.sh'

/** Hostnames served from the project. */
const HOSTNAMES = [ZONE, `www.${ZONE}`]

/** Branch Cloudflare treats as production. */
const PRODUCTION_BRANCH = 'main'

/** Built output. bunpress writes the site root into a `.bunpress` directory. */
const BUILD_DIR = 'docs/dist/.bunpress'

const dryRun = process.argv.includes('--dry-run')
const preview = process.argv.includes('--preview')

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`✖ ${name} is not set.`)
    console.error('  Deploying needs a Cloudflare token with Pages: Edit and Zone: DNS: Edit.')
    process.exit(1)
  }
  return value
}

if (dryRun) {
  const assets = await collectAssets(BUILD_DIR)
  const bytes = assets.reduce((sum, asset) => sum + asset.size, 0)
  console.log(`would deploy ${assets.length} files (${(bytes / 1024 / 1024).toFixed(1)} MiB) to "${PROJECT}"`)
  console.log(`would serve ${HOSTNAMES.join(', ')}`)
  process.exit(0)
}

const apiToken = requireEnv('CLOUDFLARE_API_TOKEN')
const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID')

const pages = new CloudflarePagesProvider({ apiToken, accountId })

const project = await pages.ensureProject(PROJECT, PRODUCTION_BRANCH)
console.log(`▸ project ${project.name} (${project.subdomain})`)

// A preview deploy is any branch that is not the production one; naming it
// after the commit keeps concurrent previews from overwriting each other.
const branch = preview
  ? (process.env.GITHUB_SHA?.slice(0, 8) ?? 'preview')
  : PRODUCTION_BRANCH

const result = await pages.deployDirectory({
  project: PROJECT,
  directory: BUILD_DIR,
  branch,
  onProgress: (done, total) => process.stdout.write(`\r  uploading ${done}/${total}`),
})

process.stdout.write('\r')
console.log(
  `▸ deployed ${result.total} files, ${result.uploaded} changed `
  + `(${(result.uploadedBytes / 1024 / 1024).toFixed(1)} MiB uploaded)`,
)
console.log(`▸ ${result.deployment.url}`)

if (preview) {
  console.log('▸ preview deploy: custom domains and DNS left alone')
  process.exit(0)
}

// Domain attachment and DNS are only reconciled for production, and only when
// the token can do it. A token scoped to Pages alone still deploys perfectly
// well — it just cannot touch the zone — so this must not fail the build.
const dns = new CloudflareProvider(apiToken, { accountId })

for (const hostname of HOSTNAMES) {
  try {
    const attached = await pages.attachCustomDomain(PROJECT, hostname)
    if (attached)
      console.log(`▸ attached ${hostname}`)

    const record = pagesDnsRecord(hostname, project.subdomain)
    await dns.upsertRecord(ZONE, record)
    console.log(`▸ ${hostname} → ${record.value}`)
  }
  catch (error) {
    console.warn(`⚠ could not reconcile ${hostname}: ${error instanceof Error ? error.message : error}`)
    console.warn('  The deployment succeeded; only the domain wiring was skipped.')
  }
}

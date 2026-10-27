import { RegistryClient } from '../../src/registry/registry-client'
import { Logger } from '../../src/utils/logger'
const [root, registry] = process.argv.slice(2)
if (!root || !registry) throw new Error('Registry fixture needs its project and registry URL')
const client = new RegistryClient(root, Logger.quiet(), { registries: { npm: registry }, packages: { strategy: 'all' } })
const updates = await client.getOutdatedPackages()
console.log(`BUDDY_OWNED_RESULT=${JSON.stringify(updates.map(({ name, file, newVersion }) => ({ name, file, newVersion })))}`)

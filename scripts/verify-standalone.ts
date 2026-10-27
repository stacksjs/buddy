import { chmod, lstat, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { name as packageName, version } from '../package.json'

const platform = process.platform === 'win32' ? 'windows' : process.platform
const name = `buddy-${platform}-${process.arch}`, executable = `${name}${process.platform === 'win32' ? '.exe' : ''}`
const archive = resolve(process.argv[2] ?? join('bin', `${name}.zip`))
const temporary = await mkdtemp(join(tmpdir(), 'buddy-standalone-'))
async function run(command: string[], cwd: string): Promise<string> {
  const child = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'pipe', timeout: 10000 })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  if (code !== 0) throw new Error(`Standalone verification failed (${command[0]}, exit ${code}): ${stdout}${stderr}`)
  return stdout
}
try {
  const members = (await run(['unzip', '-Z1', archive], temporary)).trim().split('\n')
  if (members.length !== 1 || members[0] !== executable) throw new Error('Standalone archive does not contain exactly its advertised executable')
  await run(['unzip', '-q', archive, '-d', temporary], temporary)
  const binary = join(temporary, executable), entry = await lstat(binary)
  if (!entry.isFile() || entry.size > 256 * 1024 * 1024) throw new Error('Standalone executable has an unsupported type or capacity')
  await chmod(binary, 0o755)
  const consumer = join(temporary, 'consumer')
  await mkdir(consumer)
  await writeFile(join(consumer, 'bunfig.toml'), 'preload = ["./consumer-preload.ts"]\n')
  await writeFile(join(consumer, 'consumer-preload.ts'), 'throw new Error("The consumer Bunfig preload must not run inside Buddy")\n')
  const output = await run([binary, '--version'], consumer)
  if (!output.includes(`buddy/${version} `)) throw new Error(`Standalone version differs from its source package: ${output}`)
  await run(['git', 'init', '--quiet'], consumer)
  const doctor = await run([binary, 'doctor'], consumer)
  if (!doctor.includes('git repository:') || !doctor.includes('Ready.')) throw new Error('Standalone doctor did not recognize its real consumer repository')
  // Native archives now exist before publication. Exercise the real package
  // file policy so those platform assets cannot bloat the npm SDK tarball.
  await run([process.execPath, 'pm', 'pack', '--ignore-scripts', '--filename', join(temporary, 'sdk.tgz'), '--quiet'], process.cwd())
  const archiveEntries = (await run(['tar', '-tzf', join(temporary, 'sdk.tgz')], temporary)).trim().split('\n')
  for (const required of ['package/dist/src/index.js', 'package/dist/src/index.d.ts', 'package/dist/bin/cli.js']) {
    if (!archiveEntries.includes(required)) throw new Error(`SDK package is missing ${required}`)
  }
  const cliSources = archiveEntries.filter(path => path.startsWith('package/bin/') && !path.endsWith('/'))
  if (cliSources.length !== 1 || cliSources[0] !== 'package/bin/cli.ts' || archiveEntries.some(path => path.endsWith('.zip'))) throw new Error('Native build artifacts leaked into the npm SDK package')
  const packed = JSON.parse(await run(['tar', '-xOzf', join(temporary, 'sdk.tgz'), 'package/package.json'], temporary))
  if (packed.name !== packageName || packed.version !== version) throw new Error('SDK package identity differs from its source')
  console.log(output.trim())
  console.log('Verified standalone version and doctor without executing the consumer Bunfig preload.')
  console.log('Verified SDK entrypoints and package identity without native archive leakage.')
}
finally { await rm(temporary, { recursive: true, force: true }) }

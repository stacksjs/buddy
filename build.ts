import { dts } from 'bun-plugin-dtsx'

console.log('Building...')

await Bun.build({
  entrypoints: ['./src/index.ts', './src/setup.ts', './bin/cli.ts', './bin/entry.ts', './bin/stacks.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  minify: true,
  splitting: true,
  sourcemap: 'none',
  plugins: [dts()],
})

console.log('Built')

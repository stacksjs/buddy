import { dts } from 'bun-plugin-dtsx'

console.log('Building...')

await Bun.build({
  entrypoints: ['./src/index.ts', './src/program.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',
  minify: true,
  external: ['@stacksjs/config'],
  splitting: true,
  plugins: [dts()],
})

console.log('Built')

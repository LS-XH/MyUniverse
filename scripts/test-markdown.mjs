import { build } from 'esbuild'
// Bundle project TypeScript in memory; the tests use simulated document files.
const result = await build({ stdin:{contents:"import './tests/markdown.test.ts'; import './tests/graph.test.ts'; import './tests/models.test.ts'; import './tests/sorting.test.ts';",resolveDir:process.cwd(),loader:'ts'}, bundle: true, platform: 'node', format: 'esm', write: false })
await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`)

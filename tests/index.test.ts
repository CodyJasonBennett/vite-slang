import { describe, it, expect, assert } from 'vitest'
// @ts-ignore
import { fileURLToPath } from 'node:url'
// @ts-ignore
import { dirname } from 'node:path'
import { build, normalizePath } from 'vite'
import viteSlang, { ViteSlangOptions } from '../src/index.js'

async function transform(
  input: string,
  options?: ViteSlangOptions,
): Promise<{ code: string; reflection: SlangReflectionJSON }> {
  const compiled = await build({
    plugins: [viteSlang(options)],
    logLevel: 'silent',
    build: {
      target: 'esnext',
      write: false,
      minify: false,
      modulePreload: false,
      rollupOptions: {
        treeshake: false,
        input: new URL(input, import.meta.url).href,
      },
    },
  })

  // @ts-ignore
  return new Function(`${compiled.output[0].code}\nreturn { reflection, code };`)()
}

const dir = normalizePath(dirname(fileURLToPath(import.meta.url)))

async function expectError(fn: () => Promise<any>): Promise<void> {
  try {
    assert(false, `Promise resolved "${await fn()}" instead of rejecting`)
  } catch (error) {
    expect((error as Error).message.replaceAll(dir, '.')).toMatchSnapshot()
  }
}

describe('viteSlang', () => {
  // Ensure ambient types work correctly for IntelliSense
  import('./shaders/stub.slang') satisfies Promise<{
    default: string
    code: string
    reflection: SlangReflectionJSON
  }>

  it('can compile to WGSL by default', async () => {
    expect(await transform('./shaders/triangle.slang')).toMatchSnapshot()
  })

  it('can resolve #include directives', async () => {
    expect(await transform('./shaders/include-0.slang')).toMatchSnapshot()
  })

  it('throws on unresolved #include directive', async () => {
    await expectError(() => transform('./shaders/include-error.slang'))
  })

  it('throws on unsupported target', async () => {
    // @ts-expect-error
    await expectError(() => transform('./shaders/triangle.slang', { target: 'unsupported' }))
  })

  it('throws if entrypoints are not defined', async () => {
    await expectError(() => transform('./shaders/empty.slang'))
  })

  it('throws on shader compilation error', async () => {
    await expectError(() => transform('./shaders/broken.slang'))
  })
})

import { describe, it, expect, assert } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { createServer, normalizePath } from 'vite'
import viteSlang, { ViteSlangOptions } from '../src/index.js'

async function transform(
  input: string,
  options?: ViteSlangOptions,
): Promise<{ code: string; reflection: SlangReflectionJSON }> {
  const fileUrl = new URL(input, import.meta.url).href

  const server = await createServer({
    plugins: [viteSlang(options)],
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  try {
    const compiled = (await server.transformRequest(fileUrl))!

    const dataUrl = `data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`
    const { code, reflection } = await import(dataUrl)

    return { code, reflection }
  } finally {
    await server.close()
  }
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

  it('can handle link errors', async () => {
    await expectError(() => transform('./shaders/link-error.slang'))
  })

  it('can compile a shared struct between stages', async () => {
    expect(await transform('./shaders/struct-location-bug.slang')).toMatchSnapshot()
  })

  it('identifies valid include guards', async () => {
    expect(await transform('./shaders/valid-guard.slang')).toMatchSnapshot()
  })

  it('ignores commented-out include guards', async () => {
    expect(await transform('./shaders/commented-guard.slang')).toMatchSnapshot()
  })

  it('ignores defines mid-file from include scan', async () => {
    expect(await transform('./shaders/false-positive-guard.slang')).toMatchSnapshot()
  })

  it('prevents infinite recursion via include guards', async () => {
    await expectError(() => transform('./shaders/circular-a.slang'))
  })
})

import { describe, it, expect } from 'vitest'
import { build } from 'vite'
import viteSlang, { ViteSlangOptions } from '../src/index.js'

async function transform(
  shader: string,
  options?: ViteSlangOptions,
): Promise<{ code: string; reflection: SlangReflectionJSON }> {
  const compiled = await build({
    plugins: [
      {
        name: 'virtual',
        enforce: 'pre',
        resolveId(source) {
          if (source === 'shader.slang') return 'shader.slang'
          return null
        },
        load(id) {
          if (id === 'shader.slang') return shader
          return null
        },
      },
      viteSlang(options),
    ],
    logLevel: 'silent',
    build: {
      target: 'esnext',
      write: false,
      minify: false,
      modulePreload: false,
      rollupOptions: {
        treeshake: false,
        input: 'shader.slang',
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
  })

  // @ts-ignore
  return new Function(`${compiled.output[0].code}\nreturn { reflection, code };`)()
}

const triangleShader = /* slang */ `
  cbuffer Globals: register(b0, space0) {
    float time;
  };

  [shader("vertex")]
  float4 vmain(uint vertexIndex: SV_VertexID): SV_Position {
    float2 uv = float2((vertexIndex << 1) & 2, vertexIndex & 2);
    return float4(uv * 2.0 - 1.0, 0.0, 1.0);
  }

  [shader("fragment")]
  float4 fmain(float4 position: SV_Position): SV_Target {
    float2 coord = position.xy / position.w;
    float3 color = float3(0.8, 0.7, 1.0) + 0.3 * cos(normalize(coord).xyx + time);
    return float4(color, 1.0);
  }
`

const emptyShader = /* slang */ `
  void main() {
    //
  }
`

const brokenShader = /* slang */ `
  [shader("compute")]
  [numthreads(1, 1, 1)]
  void main(uint2 dispatchThreadId: SV_DispatchThreadID) {
    error;
  }
`

describe('viteSlang', () => {
  // Ensure ambient types work correctly for IntelliSense
  import('./stub.slang') satisfies Promise<{
    default: string
    code: string
    reflection: SlangReflectionJSON
  }>

  it('can compile to WGSL by default', async () => {
    expect(await transform(triangleShader)).toMatchSnapshot()
  })

  it('throws on unsupported target', async () => {
    // @ts-expect-error
    await expect(transform(triangleShader, { target: 'unsupported' })).rejects.toThrowErrorMatchingSnapshot()
  })

  it('throws if entrypoints are not defined', async () => {
    await expect(transform(emptyShader)).rejects.toThrowErrorMatchingSnapshot()
  })

  it('throws on shader compilation error', async () => {
    await expect(transform(brokenShader)).rejects.toThrowErrorMatchingSnapshot()
  })
})

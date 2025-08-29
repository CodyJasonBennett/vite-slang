import { transformWithEsbuild } from 'vite'
import slangModule from './slang-2025.15-wasm/slang-wasm.js'

const SLANG_STAGES = {
  vertex: 1,
  fragment: 5,
  compute: 6,
}

/** @type {Promise<import('./slang-2025.15-wasm/slang-wasm.js').MainModule> | null} */
let slangPromise = null

/**
 * @param {import('./index.js').ViteSlangOptions} options
 * @returns {import('vite').PluginOption}
 */
function viteSlang(options = { target: 'WGSL' }) {
  return {
    name: 'vite-slang',
    async transform(code, id) {
      // NOTE: ideally, we can evaluate and parse Slang written in JS (e.g., /* slang */ `...`),
      // but Slang expects a full program which does not allow for this dynamic compilation at run-time.
      // For now, we only handle files with a .slang file extension. These are transformed as source code.
      if (!id.endsWith('.slang')) return

      /** @type {import('./slang-2025.15-wasm/slang-wasm.js').Session | null} */
      let session = null

      try {
        // Lazy load Slang WASM so this module can be used in ESM/CJS/UMD contexts (no top-level-await)
        if (!slangPromise) slangPromise = slangModule()
        const slang = await slangPromise

        let wasmCompileTarget = -1
        for (const target of slang.getCompileTargets()) {
          if (target.name == options.target) {
            wasmCompileTarget = target.value
          }
        }

        // TODO: under which scenarios is a session null? Examples expect GlobalSession but not a Session?
        const globalSession = slang.createGlobalSession()
        session = globalSession.createSession(wasmCompileTarget)

        // TODO: module stitching and/or non-standard preprocessor unfolding?
        /** @type {import('./slang-2025.15-wasm/slang-wasm.js').Module} */
        const module = session.loadModuleFromSource(code, 'shader', id)
        /** @type {import('./slang-2025.15-wasm/slang-wasm.js').Module[]} */

        // Surface compilation errors
        if (!module) {
          const error = slang.getLastError()
          throw new Error(`${error.type} error: ${error.message}`)
        }

        // TODO: is there a way to instead infer based on SV_VertexID or SV_Target?
        const count = module.getDefinedEntryPointCount()
        if (count === 0) {
          throw new Error(
            'An entrypoint must be defined with a shader stage attribute! Try adding [shader("fragment")] before your entrypoint method.',
          )
        }

        // TODO: surely, there's a better way to reflect the program and get a top-level layout?
        const components = [module]
        for (let i = 0; i < count; i++) {
          /** @type {import('./slang-2025.15-wasm/slang-wasm.js').EntryPoint} */
          const entryPoint = module.getDefinedEntryPoint(i)
          const program = session.createCompositeComponentType([entryPoint, 1])
          const layout = program.getLayout(0).toJsonObject()
          const { name, stage } = layout.entryPoints[0]
          components.push(module.findAndCheckEntryPoint(name, SLANG_STAGES[stage]))
        }

        /** @type {import('./slang-2025.15-wasm/slang-wasm.js').ComponentType} */
        const linkedProgram = session.createCompositeComponentType(components).link()

        code = ''
        for (let i = 0; i < count; i++) {
          code += linkedProgram.getEntryPointCode(i /* entryPointIndex */, 0 /* targetIndex */) + '\n'
        }
        code.trim()

        return transformWithEsbuild(code, id, {
          format: 'esm',
          loader: 'text',
          sourcemap: 'external', // TODO: pass to WebGPU API?
        })
      } finally {
        if (session) session.delete()
      }
    },
  }
}

export default viteSlang

import { transformWithEsbuild } from 'vite'
import * as fs from 'node:fs'
import * as path from 'node:path'
import slangModule from './slang-2025.15-wasm/slang-wasm.js'

/**
 * Tests a Vite filter against a file id.
 *
 * @param {String} id
 * @param {Exclude<import('./index.js').ViteSlangOptions['filter'], undefined>} filter
 */
function testFilter(id, filter) {
  if (typeof filter === 'string') {
    return id === filter
  } else if (filter instanceof RegExp) {
    return filter.test(id)
  } else if (Array.isArray(filter)) {
    for (const test of filter) {
      if (testFilter(id, test)) return true
    }
    return false
  } else if (filter.exclude || filter.include) {
    if (filter.exclude && testFilter(id, filter.exclude)) return false
    if (filter.include && !testFilter(id, filter.include)) return false
    return true
  }
}

const SLANG_STAGES = {
  vertex: 1,
  fragment: 5,
  compute: 6,
}

const IMPORT_REGEX = /^\s*#include\s+"([^"]+)"/gm

/** @type {Promise<import('./slang-2025.15-wasm/slang-wasm.js').MainModule> | null} */
let slangPromise = null

/** @type {import('./slang-2025.15-wasm/slang-wasm.js').GlobalSession | null} */
let globalSession = null

/**
 * @param {import('./index.js').ViteSlangOptions} options
 * @returns {import('vite').PluginOption}
 */
function viteSlang(options) {
  options = { target: 'WGSL', filter: /\.slang$/, ...options }

  return {
    name: 'vite-slang',
    transform: {
      // NOTE: ideally, we can evaluate and parse Slang written in JS (e.g., /* slang */ `...`),
      // but Slang expects a full program which does not allow for this dynamic compilation at run-time.
      // For now, we only handle files with a .slang file extension (default). These are transformed as source code.
      filter: {
        id: options.filter,
      },
      async handler(code, id) {
        // Backwards compat for non-Rolldown clients
        // https://github.com/CodyJasonBennett/vite-slang/issues/1
        if (!testFilter(id, options.filter)) return

        /** @type {import('./slang-2025.15-wasm/slang-wasm.js').Session | null} */
        let session = null

        try {
          // Lazy load Slang WASM so this module can be used in ESM/CJS/UMD contexts (no top-level-await)
          if (!slangPromise) slangPromise = slangModule()
          const slang = await slangPromise
          if (!globalSession) globalSession = slang.createGlobalSession()

          // Initialize compiler target
          let wasmCompileTarget = null
          for (const target of slang.getCompileTargets()) {
            if (target.name == options.target) {
              wasmCompileTarget = target.value
            }
          }
          if (wasmCompileTarget === null) {
            throw new Error(`Unsupported Slang target: ${options.target}.`)
          }

          session = globalSession.createSession(wasmCompileTarget)
          if (!session) {
            throw new Error(`Unable to create Slang session for ${options.target} target. Please file an issue.`)
          }

          /** @type {import('./slang-2025.15-wasm/slang-wasm.js').Module | null} */
          const module = session.loadModuleFromSource(
            // Resolve #include directives
            code.replaceAll(IMPORT_REGEX, (match, file) => {
              try {
                return fs.readFileSync(path.resolve(path.dirname(id), file), { encoding: 'utf8' })
              } catch {
                return match
              }
            }),
            'shader',
            id,
          )

          // Surface compilation errors
          if (!module) {
            const error = slang.getLastError()
            throw new Error(`${error.type} error: ${error.message}`)
          }

          // Entrypoints must be defined with shader decoration to remove ambiguity (e.g., [shader("fragment")])
          const count = module.getDefinedEntryPointCount()
          if (count === 0) {
            throw new Error(
              'An entrypoint must be defined with a shader stage attribute! Try adding [shader("fragment")] before your entrypoint method.',
            )
          }

          // Link shader entrypoints
          // TODO: surely, there's a better way to reflect the program and get a top-level layout?
          /** @type {import('./slang-2025.15-wasm/slang-wasm.js').Module[]} */
          const components = [module]
          for (let i = 0; i < count; i++) {
            /** @type {import('./slang-2025.15-wasm/slang-wasm.js').EntryPoint} */
            const entryPoint = module.getDefinedEntryPoint(i)
            /** @type {import('./slang-2025.15-wasm/slang-wasm.js').ComponentType} */
            const program = session.createCompositeComponentType([entryPoint, 1])
            const layout = program.getLayout(0).toJsonObject()
            const { name, stage } = layout.entryPoints[0]
            components.push(module.findAndCheckEntryPoint(name, SLANG_STAGES[stage]))
          }

          // Compile shader with reflection
          /** @type {import('./slang-2025.15-wasm/slang-wasm.js').ComponentType} */
          const linkedProgram = session.createCompositeComponentType(components).link()
          const shader = linkedProgram.getTargetCode(0)
          const reflection = linkedProgram.getLayout(0).toJsonObject()

          // Export with overloads for default export or named exports for reflection (see slang.d.ts)
          const reflectionJson = JSON.stringify(reflection)
          code = `export const code = \`${shader}\`;export const reflection = ${reflectionJson};export default code;`

          return transformWithEsbuild(code, id, {
            format: 'esm',
            loader: 'js',
            sourcemap: 'external', // TODO: pass to WebGPU API?
          })
        } finally {
          if (session) session.delete()
        }
      },
    },
  }
}

export default viteSlang
